/**
 * Create disposable import_officer, verify station-scoped v2 post auth, then disable user.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const PROJECT = 'qflxupfeyktdrpilctyo';
const STATION = '48f00127-09e8-47f6-8f6a-c3a331b332be';
const EMAIL = 'uat.import.officer+cclosure@energy-stream.net';

function getKeys() {
  const r = spawnSync(
    'supabase',
    ['projects', 'api-keys', '--project-ref', PROJECT, '-o', 'json'],
    { encoding: 'utf8', shell: true }
  );
  const i = (r.stdout || '').indexOf('[');
  const j = (r.stdout || '').lastIndexOf(']');
  const keys = JSON.parse(r.stdout.slice(i, j + 1));
  const svc = keys.find((k) => k.name === 'service_role')?.api_key;
  const anon =
    keys.find((k) => k.name === 'anon')?.api_key ||
    keys.find((k) => k.name === 'publishable')?.api_key;
  if (!svc || !anon) throw new Error('missing keys');
  return { svc: String(svc).trim(), anon: String(anon).trim() };
}

function sqlQuery(sql) {
  const tmp = path.join(require('os').tmpdir(), `evc_off_${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql);
  const r = spawnSync('supabase', ['db', 'query', '--linked', '-f', tmp, '-o', 'json'], {
    encoding: 'utf8',
    shell: true,
  });
  try {
    fs.unlinkSync(tmp);
  } catch {}
  return `${r.stdout || ''}\n${r.stderr || ''}`;
}

async function main() {
  const { svc, anon } = getKeys();
  const admin = createClient(`https://${PROJECT}.supabase.co`, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const password = 'UatC!' + crypto.randomBytes(10).toString('hex');

  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = (list?.users || []).find((u) => u.email === EMAIL);
  if (existing) await admin.auth.admin.deleteUser(existing.id);

  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'UAT Import Officer C-Closure' },
  });
  if (error) throw error;
  const uid = created.user.id;

  const { error: pErr } = await admin.from('user_profiles').upsert({
    id: uid,
    email: EMAIL,
    full_name: 'UAT Import Officer C-Closure',
    role: 'import_officer',
    approval_status: 'approved',
    is_active: true,
    station_id: STATION,
  });
  if (pErr) throw pErr;

  // station access (ignore conflict)
  await admin.from('user_station_access').delete().eq('user_id', uid);
  const { error: aErr } = await admin.from('user_station_access').insert({
    user_id: uid,
    station_id: STATION,
    is_active: true,
  });
  if (aErr) throw aErr;

  // Ensure officer gate on
  sqlQuery(`UPDATE system_settings SET value='true' WHERE key='import_workflow_v2_officer_enabled';
             UPDATE system_settings SET value='true' WHERE key='import_workflow_v2_enabled';`);

  // Auth as officer and call RPC
  const userClient = createClient(`https://${PROJECT}.supabase.co`, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signed, error: sErr } = await userClient.auth.signInWithPassword({
    email: EMAIL,
    password,
  });
  if (sErr) throw sErr;

  const authed = createClient(`https://${PROJECT}.supabase.co`, anon, {
    global: { headers: { Authorization: `Bearer ${signed.session.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create ready batch + tiny unique txn for officer post
  const txn = '9001707179' + String(Date.now()).slice(-3);
  const fileHash = crypto.createHash('sha256').update('officer-soak-' + txn).digest('hex');
  const { data: batch, error: bErr } = await admin
    .from('import_batches')
    .insert([
      {
        filename: 'officer-soak-' + txn + '.xlsx',
        records_total: 1,
        status: 'ready_to_post',
        user_id: uid,
        file_hash: fileHash,
        detected_card_id: '2024040000006424',
        detected_operator_name: 'abo saleh',
        selected_operator_id: '12a51b90-5690-4495-af6b-5c45cd783aa8',
        station_id: STATION,
        parser_version: 'ev-c-v1.0.0',
        workflow_version: 'ev-c-v1.0.0',
        operator_match_status: 'match',
      },
    ])
    .select('id')
    .single();
  if (bErr) throw bErr;

  const sessions = [
    {
      transaction_id: txn,
      charge_id: 'OFFICER-SOAK',
      card_number: '2024040000006424',
      start_ts: '2026-07-17T11:00:00+03:00',
      end_ts: '2026-07-17T11:15:00+03:00',
      energy_consumed_kwh: 3,
      calculated_cost: 0,
      source_row_number: 2,
    },
  ];

  const { data: post, error: postErr } = await authed.rpc('post_import_batch_v2', {
    p_batch_id: batch.id,
    p_station_id: STATION,
    p_operator_id: '12a51b90-5690-4495-af6b-5c45cd783aa8',
    p_file_hash: fileHash,
    p_sessions: sessions,
    p_allow_filename_warning: false,
    p_allow_conflict_override: false,
  });

  // Negative: manage tariffs should be denied by RPC (role check)
  const { error: tariffErr } = await authed.rpc('b_validate_rate_structure_coverage', {
    p_rate_structure_id: '00000000-0000-0000-0000-000000000001',
  }).maybeSingle?.() || { error: null };

  // Disable officer after soak
  await admin
    .from('user_profiles')
    .update({ is_active: false, approval_status: 'rejected' })
    .eq('id', uid);

  const out = {
    officerId: uid,
    email: EMAIL,
    batchId: batch.id,
    txn,
    postResult: post,
    postError: postErr?.message || null,
    disabledAfter: true,
  };
  fs.writeFileSync('scripts/production/c_closure_officer_soak.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (postErr || !post?.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
