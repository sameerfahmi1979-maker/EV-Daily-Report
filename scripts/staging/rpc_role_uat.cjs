const fs = require('fs');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const env = Object.fromEntries(
  fs
    .readFileSync('.env.staging', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);
const creds = JSON.parse(
  fs.readFileSync('scripts/staging/.staging_test_credentials.local.json', 'utf8')
);

async function tryRpc(email, sid) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await c.auth.signInWithPassword({ email, password: creds.password });
  const { error } = await c.rpc('replace_session_billing', {
    p_session_id: sid,
    p_rate_structure_id: creds.rate_structure_id,
    p_subtotal: 1,
    p_taxes: 0,
    p_fees: 0,
    p_total_amount: 1,
  });
  console.log(email, error ? `DENIED: ${error.message}` : 'ALLOWED');
  await c.auth.signOut();
  return !error;
}

async function main() {
  const db = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  const sess = await db.query(
    `
    INSERT INTO public.charging_sessions (
      station_id, transaction_id, charge_id, card_number,
      start_date, start_time, start_ts, end_date, end_time, end_ts,
      duration_minutes, energy_consumed_kwh, calculated_cost, station_code
    ) VALUES (
      $1, $2, 'CHG-SEC-1', '6424',
      CURRENT_DATE, '10:00', now()-interval '1 hour', CURRENT_DATE, '11:00', now(),
      60, 5, 0, 'STATION-STG-1'
    ) RETURNING id`,
    [creds.station_id, `STG-SEC-UAT-${Date.now()}`]
  );
  const sid = sess.rows[0].id;
  await db.end();

  const importOk = await tryRpc('import.staging@example.com', sid);
  const viewerOk = await tryRpc('viewer.staging@example.com', sid);
  const adminOk = await tryRpc('admin.staging@example.com', sid);

  if (importOk || viewerOk || !adminOk) {
    console.error('RPC role UAT unexpected results');
    process.exit(1);
  }
  console.log('RPC role UAT PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
