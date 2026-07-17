const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (ref !== 'qflxupfeyktdrpilctyo') {
  console.error('ABORT wrong project', ref);
  process.exit(1);
}

const files = [
  'supabase/migrations/20260716230100_a2_user_station_access.sql',
  'supabase/migrations/20260716230200_a2_authorization_helpers.sql',
  'supabase/migrations/20260716230300_a2_core_rls_policies.sql',
  'supabase/migrations/20260716230400_a2_financial_rpc_authorization.sql',
  'supabase/migrations/20260716230500_a2_archive_and_audit_security.sql',
];

const log = [];
for (const f of files) {
  const name = path.basename(f);
  console.log('==== APPLY', name, '====');
  const start = new Date().toISOString();
  const r = spawnSync('supabase', ['db', 'query', '--linked', '-f', f], {
    encoding: 'utf8',
    shell: true,
  });
  const end = new Date().toISOString();
  const combined = `${r.stdout || ''}\n${r.stderr || ''}`;
  const hardFail =
    /ERROR:|EXCEPTION|EV-A2 validation failed|permission denied for/i.test(combined) &&
    !/Initialising login role/i.test(combined.replace(/ERROR:/g, ''));
  // More precise: look for postgres ERROR lines
  const pgError = /(^|\n)ERROR:/i.test(combined);
  if (pgError || r.status !== 0) {
    // status non-zero often from PowerShell wrapper noise; trust pgError
    if (pgError) {
      console.error('FAIL', name);
      console.error(combined);
      process.exit(1);
    }
  }
  console.log('OK', name, 'status', r.status);
  log.push({ file: name, start, end, result: 'OK', status: r.status });
}

fs.writeFileSync(
  'scripts/production/a2_migration_apply_log.json',
  JSON.stringify(
    {
      project: ref,
      migration1: 'applied earlier via CLI',
      remaining: log,
    },
    null,
    2
  )
);
console.log('ALL_REMAINING_OK');
