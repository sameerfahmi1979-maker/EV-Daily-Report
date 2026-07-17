/**
 * Direct API security UAT against staging only.
 */
const fs = require('fs');
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

if (!String(env.VITE_SUPABASE_URL || '').includes('dmbmzjnpbmakotvlckkq')) {
  console.error('ABORT: not staging');
  process.exit(1);
}

const creds = JSON.parse(
  fs.readFileSync('scripts/staging/.staging_test_credentials.local.json', 'utf8')
);

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function clientAs(email) {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({
    email,
    password: creds.password,
  });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}

async function main() {
  // Anonymous
  {
    const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessions, error: sErr } = await anon.from('charging_sessions').select('id').limit(1);
    record(
      'Anon cannot read charging_sessions',
      !!sErr || !sessions || sessions.length === 0,
      sErr ? sErr.message : `rows=${sessions?.length}`
    );
    const { data: billing, error: bErr } = await anon.from('billing_calculations').select('id').limit(1);
    record(
      'Anon cannot read billing_calculations',
      !!bErr || !billing || billing.length === 0,
      bErr ? bErr.message : `rows=${billing?.length}`
    );
    const { error: rpcErr } = await anon.rpc('replace_session_billing', {
      p_session_id: '00000000-0000-0000-0000-000000000001',
      p_rate_structure_id: creds.rate_structure_id,
      p_subtotal: 1,
      p_taxes: 0,
      p_fees: 0,
      p_total_amount: 1,
    });
    record('Anon cannot call replace_session_billing', !!rpcErr, rpcErr?.message || 'no error');
    const { data: arch, error: aErr } = await anon
      .from('billing_calculations_duplicate_archive')
      .select('*')
      .limit(1);
    record(
      'Anon cannot read billing archive',
      !!aErr || !arch || arch.length === 0,
      aErr ? aErr.message : `rows=${arch?.length}`
    );
  }

  // Pending user
  {
    const c = await clientAs('pending.staging@example.com');
    const { data, error } = await c.from('charging_sessions').select('id').limit(1);
    record(
      'Pending cannot read charging_sessions',
      !!error || !data || data.length === 0,
      error ? error.message : `rows=${data?.length}`
    );
    await c.auth.signOut();
  }

  // Station manager can read assigned station ops
  {
    const c = await clientAs('station.staging@example.com');
    const { data: stations, error } = await c.from('stations').select('id,station_code');
    record(
      'Station manager can read stations in scope',
      !error && (stations?.length || 0) >= 1,
      error ? error.message : `stations=${stations?.length}`
    );
    const { error: rateErr } = await c.from('rate_structures').insert({
      name: 'Evil Tariff',
      effective_from: '2026-01-01',
      is_active: true,
    });
    record('Station manager cannot manage tariffs (insert denied)', !!rateErr, rateErr?.message || 'inserted');
    await c.auth.signOut();
  }

  // Import officer
  {
    const c = await clientAs('import.staging@example.com');
    const { data: batches, error } = await c.from('import_batches').select('id').limit(1);
    record(
      'Import officer can read import_batches (or empty allowed)',
      !error,
      error ? error.message : `rows=${batches?.length ?? 0}`
    );
    const { error: rpcErr } = await c.rpc('replace_session_billing', {
      p_session_id: '00000000-0000-0000-0000-000000000001',
      p_rate_structure_id: creds.rate_structure_id,
      p_subtotal: 1,
      p_taxes: 0,
      p_fees: 0,
      p_total_amount: 1,
    });
    record(
      'Import officer cannot recalculate billing RPC',
      !!rpcErr,
      rpcErr?.message || 'no error'
    );
    await c.auth.signOut();
  }

  // Report viewer read-only-ish
  {
    const c = await clientAs('viewer.staging@example.com');
    const { error: readErr } = await c.from('stations').select('id').limit(1);
    record('Report viewer can read stations', !readErr, readErr?.message || 'ok');
    const { error: rpcErr } = await c.rpc('replace_session_billing', {
      p_session_id: '00000000-0000-0000-0000-000000000001',
      p_rate_structure_id: creds.rate_structure_id,
      p_subtotal: 1,
      p_taxes: 0,
      p_fees: 0,
      p_total_amount: 1,
    });
    record('Report viewer cannot call financial mutation RPC', !!rpcErr, rpcErr?.message || 'no error');
    await c.auth.signOut();
  }

  // System admin
  {
    const c = await clientAs('admin.staging@example.com');
    const { data: profiles, error } = await c.from('user_profiles').select('id,role,approval_status').limit(20);
    record(
      'System admin can read user_profiles',
      !error && (profiles?.length || 0) >= 1,
      error ? error.message : `profiles=${profiles?.length}`
    );
    await c.auth.signOut();
  }

  // Confirm URL is staging
  record(
    'Client URL targets staging project',
    env.VITE_SUPABASE_URL.includes('dmbmzjnpbmakotvlckkq'),
    env.VITE_SUPABASE_URL
  );

  const failed = results.filter((r) => !r.pass);
  fs.writeFileSync(
    'scripts/staging/security_uat_results.json',
    JSON.stringify({ when: new Date().toISOString(), results, failed: failed.length }, null, 2)
  );
  console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
