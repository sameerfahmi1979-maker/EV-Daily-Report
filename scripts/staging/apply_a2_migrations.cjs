const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

const files = [
  'supabase/migrations/20260716230000_a2_user_approval_and_role_foundation.sql',
  'supabase/migrations/20260716230100_a2_user_station_access.sql',
  'supabase/migrations/20260716230200_a2_authorization_helpers.sql',
  'supabase/migrations/20260716230300_a2_core_rls_policies.sql',
  'supabase/migrations/20260716230400_a2_financial_rpc_authorization.sql',
  'supabase/migrations/20260716230500_a2_archive_and_audit_security.sql',
];

async function main() {
  const c = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await c.connect();
  for (const f of files) {
    const sql = fs.readFileSync(f, 'utf8');
    process.stdout.write(`Applying ${path.basename(f)} ... `);
    try {
      await c.query(sql);
      console.log('OK');
    } catch (e) {
      console.log('FAIL');
      console.error(e.message);
      await c.end();
      process.exit(1);
    }
  }
  const checks = await c.query(`
    select
      (select count(*)::int from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tables,
      (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions,
      (select count(*)::int from pg_policies where schemaname='public') as policies,
      (select to_regclass('public.user_station_access') is not null) as has_usa,
      (select count(*)::int from information_schema.columns where table_schema='public' and table_name='user_profiles' and column_name in ('approval_status','is_active')) as a2_cols
  `);
  console.log('VERIFY', JSON.stringify(checks.rows[0]));
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
