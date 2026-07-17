const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const expected = process.argv[2]; // project ref
const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (ref !== expected) {
  console.error('ABORT wrong project', ref, 'expected', expected);
  process.exit(1);
}

const files = [
  'supabase/migrations/20260716240000_b_billing_engine_metadata.sql',
  'supabase/migrations/20260716240100_b_tariff_coverage_validation.sql',
  'supabase/migrations/20260716240200_b_billing_engine_v2.sql',
  'supabase/migrations/20260716240300_b_demand_charge_retirement_stage1.sql',
  'supabase/migrations/20260716240400_b_import_billing_status.sql',
  'supabase/migrations/20260716240500_b_billing_rpc_grants_and_audit.sql',
];

for (const f of files) {
  const name = path.basename(f);
  console.log('==== APPLY', name, '====');
  const r = spawnSync('supabase', ['db', 'query', '--linked', '-f', f], {
    encoding: 'utf8',
    shell: true,
  });
  const combined = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (/(^|\n)ERROR:/i.test(combined)) {
    console.error(combined);
    process.exit(1);
  }
  console.log('OK', name);
}
console.log('ALL_B_MIGRATIONS_OK on', ref);
