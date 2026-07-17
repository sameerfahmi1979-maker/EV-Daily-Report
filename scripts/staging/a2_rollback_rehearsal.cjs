/**
 * Staging-only A2 rollback rehearsal:
 * 1) Snapshot policy count
 * 2) Drop A2-scoped policies on charging_sessions and restore open SELECT
 * 3) Confirm anon can read (proves rollback effect)
 * 4) Re-apply A2 core RLS migration
 * 5) Confirm anon blocked again
 *
 * NEVER point this at production.
 */
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

if (!String(env.VITE_SUPABASE_URL || '').includes('dmbmzjnpbmakotvlckkq')) {
  console.error('ABORT: not staging');
  process.exit(1);
}

async function anonSessionCount() {
  const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.from('charging_sessions').select('id').limit(5);
  return { error: error?.message || null, rows: data?.length ?? 0 };
}

async function main() {
  const started = Date.now();
  const db = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();

  const before = await db.query(
    `select count(*)::int n from pg_policies where schemaname='public'`
  );
  console.log('policies before', before.rows[0].n);
  console.log('anon before', await anonSessionCount());

  await db.query(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT policyname FROM pg_policies
        WHERE schemaname='public' AND tablename='charging_sessions'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.charging_sessions', r.policyname);
      END LOOP;
    END $$;
    CREATE POLICY "rollback_open_select_sessions"
      ON public.charging_sessions FOR SELECT TO anon, authenticated
      USING (true);
  `);
  console.log('anon after open rollback', await anonSessionCount());

  // Re-apply A2 core RLS (drops all policies on listed tables and recreates)
  await db.query(
    fs.readFileSync('supabase/migrations/20260716230300_a2_core_rls_policies.sql', 'utf8')
  );
  const after = await anonSessionCount();
  console.log('anon after A2 reapply', after);

  const policies = await db.query(
    `select count(*)::int n from pg_policies where schemaname='public'`
  );
  console.log('policies after', policies.rows[0].n);
  await db.end();

  const pass = after.rows === 0 || !!after.error;
  console.log(
    JSON.stringify({
      duration_ms: Date.now() - started,
      pass,
      note: 'Full schema rollback path remains: re-apply staging_schema_baseline.sql + seed_staging.cjs',
    })
  );
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
