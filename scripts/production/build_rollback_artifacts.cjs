const fs = require('fs');

function parseJsonFile(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const i = raw.indexOf('[');
  const j = raw.lastIndexOf(']');
  if (i < 0 || j < 0) throw new Error('no array in ' + p);
  return JSON.parse(raw.slice(i, j + 1));
}

const policies = parseJsonFile('scripts/production/a2_predeploy_pg_policies.json');
const lines = [
  '-- Auto-generated from pre-deploy pg_policies snapshot',
  '-- Restores pre-A2 policies if A2 RLS must be rolled back',
  'BEGIN;',
  `DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;`,
];

for (const p of policies) {
  const roles = String(p.roles || '')
    .replace(/[{}]/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const toClause = roles.length
    ? roles.map((r) => (r === 'public' ? 'PUBLIC' : `"${r}"`)).join(', ')
    : 'PUBLIC';
  const cmd = p.cmd || 'ALL';
  const using = p.qual ? ` USING (${p.qual})` : '';
  const check = p.with_check ? ` WITH CHECK (${p.with_check})` : '';
  const permissive =
    String(p.permissive).toLowerCase() === 'restrictive' ? 'AS RESTRICTIVE' : 'AS PERMISSIVE';
  const name = String(p.policyname).replace(/"/g, '""');
  lines.push(
    `CREATE POLICY "${name}" ON public.${p.tablename} ${permissive} FOR ${cmd} TO ${toClause}${using}${check};`
  );
}
lines.push('COMMIT;');
fs.writeFileSync('scripts/production/a2_restore_predeployment_policies.sql', lines.join('\n') + '\n');

fs.writeFileSync(
  'scripts/production/a2_restore_predeployment_role_constraint.sql',
  `-- Restore legacy role check (pre-A2)
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role = ANY (ARRAY['global_admin'::text, 'company_manager'::text, 'station_manager'::text, 'accountant'::text]));
UPDATE public.user_profiles SET role = 'global_admin' WHERE role = 'system_admin';
UPDATE public.user_profiles SET role = 'company_manager' WHERE role = 'operations_manager';
`
);

fs.writeFileSync(
  'scripts/production/a2_restore_predeployment_grants.sql',
  `-- Restore pre-A2 open execute grants on financial RPCs (emergency only)
GRANT EXECUTE ON FUNCTION public.calculate_batch_billing(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replace_session_billing(uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_import_batch(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_shift_totals(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_all_shift_totals() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.turbo_bulk_calculate_billing(uuid[], boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.turbo_calculate_all_pending(uuid, integer) TO anon, authenticated, service_role;
`
);

console.log('policies', policies.length, 'rollback artifacts written');
