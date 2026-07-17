/**
 * Phase C closure: post net-new UAT file via post_import_batch_v2 (admin JWT via SQL).
 * Disposable soak fixture: sample files/uat/2026-07-17+abo saleh+c-soak.xlsx
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { parse, isValid, format } = require('date-fns');
const { getTimezoneOffset } = require('date-fns-tz');

const PROJECT = 'qflxupfeyktdrpilctyo';
const STATION_ID = '48f00127-09e8-47f6-8f6a-c3a331b332be';
const ADMIN_ID = '5bbb7898-638e-4a95-b4c5-3bd0cae57a7c';
const OPERATOR_ID = '12a51b90-5690-4495-af6b-5c45cd783aa8';
const FILE = 'sample files/uat/2026-07-17+abo saleh+c-soak.xlsx';
const TIMEZONE = 'Asia/Amman';

function getServiceKey() {
  const r = spawnSync(
    'supabase',
    ['projects', 'api-keys', '--project-ref', PROJECT, '-o', 'json'],
    { encoding: 'utf8', shell: true }
  );
  const i = (r.stdout || '').indexOf('[');
  const j = (r.stdout || '').lastIndexOf(']');
  const keys = JSON.parse(r.stdout.slice(i, j + 1));
  return String(keys.find((k) => k.name === 'service_role').api_key).trim();
}

function sqlQuery(sql) {
  const tmp = path.join(require('os').tmpdir(), `evc_${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql);
  const r = spawnSync('supabase', ['db', 'query', '--linked', '-f', tmp, '-o', 'json'], {
    encoding: 'utf8',
    shell: true,
  });
  try {
    fs.unlinkSync(tmp);
  } catch {}
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (/(^|\n)ERROR:/i.test(out) || /unexpected status/i.test(out)) {
    throw new Error(out.slice(0, 2500));
  }
  const i = out.indexOf('{');
  const j = out.lastIndexOf('}');
  if (i < 0) return null;
  return JSON.parse(out.slice(i, j + 1));
}

function parseDateTimeString(dateTimeStr) {
  let cleanedStr = String(dateTimeStr).trim().replace(/\s*\([^)]+\)\s*$/, '').trim();
  const parsed = parse(cleanedStr, 'yyyy-MM-dd HH:mm:ss', new Date());
  if (!isValid(parsed)) return null;
  const date = format(parsed, 'yyyy-MM-dd');
  const time = format(parsed, 'HH:mm:ss');
  const offsetMinutes = getTimezoneOffset(TIMEZONE, parsed) / (1000 * 60);
  const offsetHours = Math.floor(offsetMinutes / 60);
  const sign = offsetHours >= 0 ? '+' : '-';
  const absHours = Math.abs(offsetHours);
  const offsetStr = `${sign}${String(absHours).padStart(2, '0')}:00`;
  return { date, time, timestamp: `${date}T${time}${offsetStr}` };
}

function parseSessions(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false });
  const hdr = rows[0].map((h) => String(h).toLowerCase());
  const col = (n) => hdr.findIndex((h) => h.includes(n));
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r?.[0]) continue;
    const start = parseDateTimeString(r[col('start')]);
    const end = parseDateTimeString(r[col('stop')] ?? r[col('end')]);
    out.push({
      transaction_id: String(r[0]).trim(),
      charge_id: String(r[1] || r[0]).trim(),
      card_number: String(r[col('card')] || '').trim(),
      start_ts: start.timestamp,
      end_ts: end.timestamp,
      energy_consumed_kwh: Number(r[col('energy')]),
      calculated_cost: 0,
      source_row_number: i + 1,
      connector_number: '1',
      connector_type: 'CCS2',
      duration_text: String(r[col('duration')] || ''),
    });
  }
  return out;
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  const mode = process.argv[2] || 'post';
  const buf = fs.readFileSync(FILE);
  const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
  const sessions = parseSessions(FILE);
  const svc = getServiceKey();
  const sb = createClient(`https://${PROJECT}.supabase.co`, svc, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (mode === 'enable-flag') {
    const r = sqlQuery(`
      UPDATE system_settings SET value='true' WHERE key='import_workflow_v2_enabled';
      SELECT key,value FROM system_settings WHERE key LIKE 'import_workflow_v2%';
    `);
    console.log(JSON.stringify({ mode, rows: r?.rows }, null, 2));
    return;
  }
  if (mode === 'disable-flag') {
    const r = sqlQuery(`
      UPDATE system_settings SET value='false' WHERE key='import_workflow_v2_enabled';
      SELECT key,value FROM system_settings WHERE key LIKE 'import_workflow_v2%';
    `);
    console.log(JSON.stringify({ mode, rows: r?.rows }, null, 2));
    return;
  }
  if (mode === 'enable-officer') {
    const r = sqlQuery(`
      UPDATE system_settings SET value='true' WHERE key='import_workflow_v2_officer_enabled';
      SELECT key,value FROM system_settings WHERE key LIKE 'import_workflow_v2%';
    `);
    console.log(JSON.stringify({ mode, rows: r?.rows }, null, 2));
    return;
  }

  const ids = sessions.map((s) => s.transaction_id);
  const { data: existing } = await sb.from('charging_sessions').select('transaction_id').in('transaction_id', ids);
  console.log('precheck existing', existing?.length || 0);

  const match = sqlQuery(`
    SELECT public.resolve_operator_match_status(
      '${OPERATOR_ID}'::uuid,
      '2024040000006424',
      'abo saleh'
    ) AS status;
  `);
  console.log('match', match?.rows);

  if (mode === 'conflict') {
    // Create a throwaway batch and attempt conflict post with Mohammad selected
    const { data: batch, error } = await sb
      .from('import_batches')
      .insert([
        {
          filename: path.basename(FILE) + '.conflict-test',
          records_total: sessions.length,
          status: 'ready_to_post',
          user_id: ADMIN_ID,
          file_hash: fileHash + 'conflict',
          file_size_bytes: buf.length,
          detected_card_id: '2024040000006424',
          detected_operator_name: 'abo saleh',
          selected_operator_id: '0014b83c-a401-44d0-a7f5-ff39a254be5f',
          station_id: STATION_ID,
          parser_version: 'ev-c-v1.0.0',
          workflow_version: 'ev-c-v1.0.0',
        },
      ])
      .select('id')
      .single();
    if (error) throw error;
    const payload = JSON.stringify(sessions).replace(/'/g, "''");
    const r = sqlQuery(`
      SELECT set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
      SELECT set_config('request.jwt.claim.role', 'authenticated', true);
      SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN_ID}","role":"authenticated"}', true);
      SELECT public.post_import_batch_v2(
        '${batch.id}'::uuid,
        '${STATION_ID}'::uuid,
        '0014b83c-a401-44d0-a7f5-ff39a254be5f'::uuid,
        '${esc(fileHash)}conflict',
        '${payload}'::jsonb,
        false,
        false
      ) AS result;
    `);
    console.log(JSON.stringify({ mode: 'conflict', batchId: batch.id, result: r?.rows }, null, 2));
    return;
  }

  const { data: batch, error: bErr } = await sb
    .from('import_batches')
    .insert([
      {
        filename: path.basename(FILE),
        normalized_filename: path.basename(FILE).toLowerCase(),
        records_total: sessions.length,
        status: 'ready_to_post',
        user_id: ADMIN_ID,
        file_hash: fileHash,
        file_size_bytes: buf.length,
        detected_card_id: '2024040000006424',
        detected_operator_name: 'abo saleh',
        selected_operator_id: OPERATOR_ID,
        station_id: STATION_ID,
        parser_version: 'ev-c-v1.0.0',
        workflow_version: 'ev-c-v1.0.0',
        operator_match_status: 'match',
      },
    ])
    .select('id')
    .single();
  if (bErr) throw bErr;

  const payload = JSON.stringify(sessions).replace(/'/g, "''");
  const r = sqlQuery(`
    SELECT set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
    SELECT set_config('request.jwt.claim.role', 'authenticated', true);
    SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN_ID}","role":"authenticated"}', true);
    SELECT public.post_import_batch_v2(
      '${batch.id}'::uuid,
      '${STATION_ID}'::uuid,
      '${OPERATOR_ID}'::uuid,
      '${esc(fileHash)}',
      '${payload}'::jsonb,
      false,
      false
    ) AS result;
  `);

  const verify = sqlQuery(`
    SELECT ib.id, ib.status, ib.file_hash, ib.operator_match_status, ib.records_success, ib.billing_status, ib.billing_engine_version,
           (SELECT count(*) FROM charging_sessions cs WHERE cs.import_batch_id=ib.id) AS sessions,
           (SELECT count(*) FROM billing_calculations bc JOIN charging_sessions cs ON cs.id=bc.session_id WHERE cs.import_batch_id=ib.id) AS billing_rows
    FROM import_batches ib WHERE ib.id='${batch.id}'::uuid;
    SELECT cs.transaction_id, cs.source_row_number, cs.source_file_hash, cs.operator_id,
           bc.total_amount, bc.calculation_engine_version, bc.taxes, bc.applied_rate_summary
    FROM charging_sessions cs
    LEFT JOIN billing_calculations bc ON bc.session_id=cs.id
    WHERE cs.import_batch_id='${batch.id}'::uuid
    ORDER BY cs.source_row_number;
  `);

  const ledger = {
    project: PROJECT,
    file: FILE,
    fileHash,
    batchId: batch.id,
    postResult: r?.rows,
    verify: verify?.rows,
    at: new Date().toISOString(),
  };
  fs.writeFileSync('scripts/production/c_closure_soak_ledger.json', JSON.stringify(ledger, null, 2));
  console.log(JSON.stringify(ledger, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
