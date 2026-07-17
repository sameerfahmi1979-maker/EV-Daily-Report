/**
 * Phase B closure: controlled production import of two sample files.
 * Uses service role for inserts + linked SQL (admin JWT) for billing v2.
 * NEVER logs secrets.
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
const TIMEZONE = 'Asia/Amman';

const FILES = [
  {
    file: 'sample files/2026-07-16+abo saleh.xlsx',
    operatorId: '12a51b90-5690-4495-af6b-5c45cd783aa8',
    operatorName: 'ABO SALEH ALI SALEH',
    cardSuffix: '6424',
  },
  {
    file: 'sample files/2026-07-16+mohammad.xlsx',
    operatorId: '0014b83c-a401-44d0-a7f5-ff39a254be5f',
    operatorName: 'MOHAMMAD DARWESH',
    cardSuffix: '6443',
  },
];

function getServiceKey() {
  const r = spawnSync(
    'supabase',
    ['projects', 'api-keys', '--project-ref', PROJECT, '-o', 'json'],
    { encoding: 'utf8', shell: true }
  );
  const i = (r.stdout || '').indexOf('[');
  const j = (r.stdout || '').lastIndexOf(']');
  if (i < 0) throw new Error('api-keys json missing');
  const keys = JSON.parse(r.stdout.slice(i, j + 1));
  const svc = keys.find((k) => k.name === 'service_role');
  if (!svc?.api_key) throw new Error('service_role api_key missing');
  return String(svc.api_key).trim();
}

function sqlQuery(sql) {
  const tmp = path.join(require('os').tmpdir(), `evb_${Date.now()}.sql`);
  fs.writeFileSync(tmp, sql);
  const r = spawnSync('supabase', ['db', 'query', '--linked', '-f', tmp, '-o', 'json'], {
    encoding: 'utf8',
    shell: true,
  });
  try {
    fs.unlinkSync(tmp);
  } catch {}
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (/(^|\n)ERROR:/i.test(out)) {
    throw new Error(out.slice(0, 2000));
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

function parseFile(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const headers = jsonData[0].map((h) => String(h).toLowerCase().trim());
  const map = {};
  headers.forEach((h, index) => {
    if (h.includes('transaction')) map.transactionId = index;
    if (h.includes('charge') && (h.includes('point') || h.includes('id'))) map.chargeId = index;
    if (h.includes('card')) map.cardNumber = index;
    if (h.includes('start') && !h.includes('soc')) map.startDateTime = index;
    if (h.includes('stop') || (h.includes('end') && !h.includes('soc'))) map.endDateTime = index;
    if (h.includes('energy') && !h.includes('co2')) map.energyKwh = index;
    if (h.includes('connector')) map.connector = index;
    if (h.includes('duration')) map.duration = index;
  });
  const sessions = [];
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.every((c) => c === undefined || c === null || c === '')) continue;
    sessions.push({
      rowNumber: i + 1,
      transactionId: String(row[map.transactionId] || '').trim(),
      chargeId: String(row[map.chargeId] || '').trim(),
      cardNumber: String(row[map.cardNumber] || '').trim(),
      startDateTime: String(row[map.startDateTime] || '').trim(),
      endDateTime: String(row[map.endDateTime] || '').trim(),
      energyKwh: parseFloat(row[map.energyKwh]),
      connector: map.connector !== undefined ? String(row[map.connector] || '') : '',
      durationText: map.duration !== undefined ? String(row[map.duration] || '') : '',
    });
  }
  return sessions;
}

function toInsert(session, batchId) {
  const start = parseDateTimeString(session.startDateTime);
  const end = parseDateTimeString(session.endDateTime);
  if (!start || !end) throw new Error(`bad datetime row ${session.rowNumber}`);
  const durationMinutes = Math.round(
    (new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) / 60000
  );
  let connectorNumber = null;
  let connectorType = null;
  const m = session.connector.match(/^(\d+)\s*-\s*(.+)$/);
  if (m) {
    connectorNumber = m[1];
    connectorType = m[2].trim();
  }
  return {
    transaction_id: session.transactionId,
    charge_id: session.chargeId,
    card_number: session.cardNumber,
    start_date: start.date,
    start_time: start.time,
    start_ts: start.timestamp,
    end_date: end.date,
    end_time: end.time,
    end_ts: end.timestamp,
    duration_minutes: durationMinutes,
    energy_consumed_kwh: session.energyKwh,
    calculated_cost: 0,
    import_batch_id: batchId,
    station_id: STATION_ID,
    connector_number: connectorNumber,
    connector_type: connectorType,
    duration_text: session.durationText || null,
  };
}

async function importOne(supabase, spec, ledger) {
  const abs = path.resolve(spec.file);
  const buf = fs.readFileSync(abs);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const sessions = parseFile(abs);
  console.log(`Parsing ${spec.file}: ${sessions.length} rows, sha256=${hash.slice(0, 12)}...`);

  const { data: batch, error: bErr } = await supabase
    .from('import_batches')
    .insert({
      filename: path.basename(spec.file),
      records_total: sessions.length,
      records_success: 0,
      records_failed: 0,
      records_skipped: 0,
      status: 'processing',
      user_id: ADMIN_ID,
    })
    .select('id')
    .single();
  if (bErr) throw bErr;

  const rows = sessions.map((s) => toInsert(s, batch.id));
  // chunk insert
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('charging_sessions').insert(chunk);
    if (error) throw new Error(`insert chunk ${i}: ${error.message}`);
    inserted += chunk.length;
  }

  await supabase
    .from('charging_sessions')
    .update({ operator_id: spec.operatorId })
    .eq('import_batch_id', batch.id);

  // Bill via SQL with admin JWT
  const billSql = `
SELECT set_config('request.jwt.claim.sub', '${ADMIN_ID}', true);
SELECT set_config('request.jwt.claims', '{"sub":"${ADMIN_ID}","role":"authenticated"}', true);
SELECT public.calculate_batch_billing_v2('${batch.id}'::uuid, '${STATION_ID}'::uuid) AS result;
`;
  const billRes = sqlQuery(billSql);
  const resultRow = billRes?.rows?.[0]?.result || billRes?.rows?.[0];
  console.log('Billing result', resultRow);

  await supabase
    .from('import_batches')
    .update({
      records_success: inserted,
      status: 'completed',
    })
    .eq('id', batch.id);

  const { data: sessionIds } = await supabase
    .from('charging_sessions')
    .select('id, transaction_id')
    .eq('import_batch_id', batch.id);

  const entry = {
    batchId: batch.id,
    file: spec.file,
    fileHash: hash,
    fileSize: buf.length,
    operatorId: spec.operatorId,
    operatorName: spec.operatorName,
    stationId: STATION_ID,
    insertedSessions: inserted,
    sessionIds: (sessionIds || []).map((s) => s.id),
    transactionIds: (sessionIds || []).map((s) => s.transaction_id),
    billingResult: resultRow,
    importedAt: new Date().toISOString(),
  };
  ledger.imports.push(entry);
  return entry;
}

async function main() {
  const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
  if (ref !== PROJECT) throw new Error(`wrong project ${ref}`);

  const serviceKey = getServiceKey();
  const supabase = createClient(`https://${PROJECT}.supabase.co`, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pre = sqlQuery(`
    select
      (select count(*)::int from charging_sessions) sessions,
      (select count(*)::int from billing_calculations) billing,
      (select count(*)::int from import_batches) batches,
      (select count(*)::int from billing_breakdown_items) breakdown
  `);

  const ledger = {
    project: PROJECT,
    preCounts: pre?.rows?.[0],
    imports: [],
  };

  for (const spec of FILES) {
    await importOne(supabase, spec, ledger);
  }

  // Verifications
  const verify = sqlQuery(`
    select cs.transaction_id, cs.start_date, cs.end_date, cs.duration_minutes,
           cs.energy_consumed_kwh, cs.operator_id, cs.import_batch_id,
           bc.total_amount, bc.taxes, bc.calculation_engine_version, bc.billing_source,
           bc.applied_rate_summary,
           (select coalesce(sum(demand_charge),0) from billing_breakdown_items bbi where bbi.billing_calculation_id=bc.id) as demand_sum,
           (select count(*) from billing_calculations x where x.session_id=cs.id) as billing_rows
    from charging_sessions cs
    left join billing_calculations bc on bc.session_id = cs.id
    where cs.transaction_id in (
      '1573323579','1409778499','1613808371','445488588','1201532186','696086752','2046279491'
    )
    order by cs.transaction_id;
  `);
  ledger.criticalTxns = verify?.rows || [];

  const post = sqlQuery(`
    select
      (select count(*)::int from charging_sessions) sessions,
      (select count(*)::int from billing_calculations) billing,
      (select count(*)::int from (select session_id from billing_calculations group by session_id having count(*)>1) d) dups,
      (select value from system_settings where key='billing_engine_v2_enabled') flag
  `);
  ledger.postCounts = post?.rows?.[0];

  fs.mkdirSync('scripts/production', { recursive: true });
  fs.writeFileSync(
    'scripts/production/b_closure_import_ledger.json',
    JSON.stringify(ledger, null, 2)
  );
  console.log('Ledger written to scripts/production/b_closure_import_ledger.json');
  console.log('Critical TXNs:', JSON.stringify(ledger.criticalTxns, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
