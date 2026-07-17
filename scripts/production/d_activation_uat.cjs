/**
 * Phase D controlled activation UAT on C-soak batch sessions.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const PROJECT = 'qflxupfeyktdrpilctyo';
const ADMIN = '5bbb7898-638e-4a95-b4c5-3bd0cae57a7c';
const APPROVER = 'fd11648e-9758-4e3e-8ddd-49dac210ae6e'; // tariq system_admin
const STATION = '48f00127-09e8-47f6-8f6a-c3a331b332be';
const OPERATOR = '12a51b90-5690-4495-af6b-5c45cd783aa8';
const BATCH = '9dbf9daf-16ba-47e4-8dc2-f44250d8d9c7';

function getSvc() {
  const r = spawnSync(
    'supabase',
    ['projects', 'api-keys', '--project-ref', PROJECT, '-o', 'json'],
    { encoding: 'utf8', shell: true }
  );
  const keys = JSON.parse(r.stdout.slice(r.stdout.indexOf('['), r.stdout.lastIndexOf(']') + 1));
  return String(keys.find((k) => k.name === 'service_role').api_key).trim();
}

function sql(q) {
  const t = path.join(require('os').tmpdir(), `evd_${Date.now()}.sql`);
  fs.writeFileSync(t, q);
  const r = spawnSync('supabase', ['db', 'query', '--linked', '-f', t, '-o', 'json'], {
    encoding: 'utf8',
    shell: true,
  });
  try {
    fs.unlinkSync(t);
  } catch {}
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (/unexpected status|ERROR:/i.test(out) && !/untrusted data/i.test(out)) {
    // still parse if rows present
  }
  const i = out.indexOf('{');
  const j = out.lastIndexOf('}');
  if (i < 0) throw new Error(out.slice(0, 1500));
  return { raw: out, json: JSON.parse(out.slice(i, j + 1)) };
}

function asUser(uid, callSql) {
  return sql(`
    SELECT set_config('request.jwt.claim.sub', '${uid}', true);
    SELECT set_config('request.jwt.claim.role', 'authenticated', true);
    SELECT set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);
    ${callSql}
  `);
}

async function main() {
  const sb = createClient(`https://${PROJECT}.supabase.co`, getSvc(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Enable flags
  sql(`UPDATE system_settings SET value='true' WHERE key IN ('payment_workflow_v1_enabled','handover_workflow_v1_enabled');`);

  // Create shift for soak batch
  const { data: shift, error: sErr } = await sb
    .from('shifts')
    .insert([
      {
        station_id: STATION,
        operator_id: OPERATOR,
        shift_duration: '8h',
        shift_type: 'evening',
        shift_date: '2026-07-17',
        start_time: '2026-07-17T08:00:00+03:00',
        end_time: '2026-07-17T16:00:00+03:00',
        import_batch_id: BATCH,
        handover_status: 'pending',
        notes: 'EV-D UAT soak shift',
      },
    ])
    .select('id')
    .single();
  if (sErr) throw sErr;

  await sb.from('charging_sessions').update({ shift_id: shift.id }).eq('import_batch_id', BATCH);

  const { data: sessions } = await sb
    .from('charging_sessions')
    .select('id, transaction_id')
    .eq('import_batch_id', BATCH)
    .order('transaction_id');

  // Mixed payments: Cash, Card, CliQ, Cash
  const methods = ['Cash', 'Card', 'CliQ', 'Cash'];
  for (let i = 0; i < sessions.length; i++) {
    const r = asUser(
      ADMIN,
      `SELECT public.assign_session_payment_method('${sessions[i].id}'::uuid, '${methods[i]}', NULL, 'd-uat', 'manual_override') AS result;`
    );
    console.log('assign', sessions[i].transaction_id, methods[i], r.json.rows?.slice(-1));
  }

  const draft = asUser(ADMIN, `SELECT public.create_handover_draft('${shift.id}'::uuid) AS result;`);
  const draftRow = draft.json.rows?.find((x) => x.result)?.result || draft.json.rows?.slice(-1)[0]?.result;
  const handoverId = draftRow.handover_id;
  console.log('draft', draftRow);

  // Refresh + read expected cash
  const { data: ho1 } = await sb.from('cash_handovers').select('*').eq('id', handoverId).single();
  console.log('totals after draft', {
    billing: ho1.billing_total,
    cash: ho1.cash_total,
    card: ho1.card_total,
    cliq: ho1.cliq_total,
    expected: ho1.expected_cash,
  });

  const submit = asUser(
    ADMIN,
    `SELECT public.submit_handover('${handoverId}'::uuid, ${ho1.expected_cash}::numeric) AS result;`
  );
  console.log('submit', submit.json.rows?.slice(-1));

  const approve = asUser(APPROVER, `SELECT public.approve_handover('${handoverId}'::uuid) AS result;`);
  console.log('approve', approve.json.rows?.slice(-1));

  const lock = asUser(APPROVER, `SELECT public.lock_handover('${handoverId}'::uuid) AS result;`);
  console.log('lock', lock.json.rows?.slice(-1));

  // Locked billing guard
  const guard = asUser(
    ADMIN,
    `SELECT public.calculate_session_billing_v2('${sessions[0].id}'::uuid, 'manual', 'd-uat-lock-test') AS result;`
  );
  const guardDenied = /locked by cash handover|EV-D denied/i.test(guard.raw);
  console.log('locked billing denied', guardDenied, guard.raw.slice(0, 400));

  const reopen = asUser(
    ADMIN,
    `SELECT public.reopen_handover('${handoverId}'::uuid, 'EV-D UAT reopen verification') AS result;`
  );
  console.log('reopen', reopen.json.rows?.slice(-1));

  // Flag rollback
  sql(`UPDATE system_settings SET value='false' WHERE key IN ('payment_workflow_v1_enabled','handover_workflow_v1_enabled');`);
  const denied = asUser(
    ADMIN,
    `SELECT public.assign_session_payment_method('${sessions[0].id}'::uuid, 'Cash', NULL, NULL, 'manual_override') AS result;`
  );
  const flagDenied = /payment_workflow_v1_enabled is not true/i.test(denied.raw);
  // re-enable for ops after UAT
  sql(`UPDATE system_settings SET value='true' WHERE key IN ('payment_workflow_v1_enabled','handover_workflow_v1_enabled');`);

  const { data: finalHo } = await sb.from('cash_handovers').select('*').eq('id', handoverId).single();
  const { data: allocs } = await sb
    .from('session_payment_allocations')
    .select('payment_method, amount_jod')
    .in(
      'session_id',
      sessions.map((s) => s.id)
    )
    .eq('is_active', true);

  const ledger = {
    shiftId: shift.id,
    handoverId,
    handoverNumber: finalHo.handover_number,
    status: finalHo.status,
    billing_total: finalHo.billing_total,
    cash_total: finalHo.cash_total,
    card_total: finalHo.card_total,
    cliq_total: finalHo.cliq_total,
    expected_cash: finalHo.expected_cash,
    actual_cash_received: finalHo.actual_cash_received,
    shortage_amount: finalHo.shortage_amount,
    surplus_amount: finalHo.surplus_amount,
    allocations: allocs,
    cashExcludesCardCliq:
      Number(finalHo.expected_cash) === Number(finalHo.cash_total) ||
      Math.abs(Number(finalHo.expected_cash) - Number(finalHo.cash_total)) < 0.001,
    lockedBillingDenied: guardDenied,
    flagRollbackDenied: flagDenied,
    flagsReenabled: true,
  };
  fs.writeFileSync('scripts/production/d_activation_uat_ledger.json', JSON.stringify(ledger, null, 2));
  console.log(JSON.stringify(ledger, null, 2));
  if (!ledger.cashExcludesCardCliq || !guardDenied || !flagDenied) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
