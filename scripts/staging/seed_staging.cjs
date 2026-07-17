/**
 * Staging seed + auth bootstrap (NEVER point at production).
 */
const fs = require('fs');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

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
  console.error('ABORT: VITE_SUPABASE_URL is not staging project');
  process.exit(1);
}

const TEMP_PASSWORD =
  process.env.STAGING_TEST_PASSWORD || `Stg-${crypto.randomBytes(9).toString('base64url')}!aA1`;

const USERS = [
  { email: 'admin.staging@example.com', role: 'system_admin', approval: 'approved', name: 'Staging System Admin' },
  { email: 'ops.staging@example.com', role: 'operations_manager', approval: 'approved', name: 'Staging Ops Manager' },
  { email: 'station.staging@example.com', role: 'station_manager', approval: 'approved', name: 'Staging Station Manager' },
  { email: 'import.staging@example.com', role: 'import_officer', approval: 'approved', name: 'Staging Import Officer' },
  { email: 'acct.staging@example.com', role: 'accountant', approval: 'approved', name: 'Staging Accountant' },
  { email: 'viewer.staging@example.com', role: 'report_viewer', approval: 'approved', name: 'Staging Report Viewer' },
  { email: 'pending.staging@example.com', role: 'report_viewer', approval: 'pending', name: 'Staging Pending User' },
  { email: 'disabled.staging@example.com', role: 'report_viewer', approval: 'disabled', name: 'Staging Disabled User' },
  { email: 'rejected.staging@example.com', role: 'report_viewer', approval: 'rejected', name: 'Staging Rejected User' },
  { email: 'sameer@algt.net', role: 'system_admin', approval: 'approved', name: 'Sameer (Staging Mirror)' },
];

async function ensureAuthUser(admin, u) {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);
  const existing = list?.users?.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
  if (existing) {
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password: TEMP_PASSWORD,
      email_confirm: true,
    });
    if (updErr) throw new Error(`updateUser ${u.email}: ${updErr.message}`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.name },
  });
  if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
  return data.user.id;
}

async function main() {
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const db = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await db.connect();

  console.log('Creating auth users...');
  const ids = {};
  for (const u of USERS) {
    ids[u.email] = await ensureAuthUser(admin, u);
    console.log('  auth', u.email, ids[u.email].slice(0, 8) + '...');
  }

  const adminId = ids['sameer@algt.net'];

  console.log('Bootstrapping pre-A2 admin profile (legacy global_admin)...');
  await db.query(
    `
    INSERT INTO public.user_profiles (id, email, full_name, role, is_active)
    VALUES ($1, $2, $3, 'global_admin', true)
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email, role = 'global_admin', is_active = true
  `,
    [adminId, 'sameer@algt.net', 'Sameer (Staging Mirror)']
  );

  console.log('Seeding station / operators / tariff (pre-A2)...');
  let stationId;
  {
    const existing = await db.query(
      `SELECT id FROM public.stations WHERE station_code = 'STATION-STG-1' LIMIT 1`
    );
    if (existing.rows[0]) {
      stationId = existing.rows[0].id;
    } else {
      const ins = await db.query(
        `
        INSERT INTO public.stations (name, station_code, location, status, user_id)
        VALUES ('Ein al basha Staging', 'STATION-STG-1', 'Ein al Basha (Staging)', 'active', $1)
        RETURNING id
      `,
        [adminId]
      );
      stationId = ins.rows[0].id;
    }
  }

  for (const op of [
    { name: 'Abo Saleh', card: '6424' },
    { name: 'Mohammad', card: '6443' },
  ]) {
    await db.query(
      `
      INSERT INTO public.operators (user_id, name, card_number, status)
      SELECT $1, $2, $3, 'active'
      WHERE NOT EXISTS (SELECT 1 FROM public.operators WHERE card_number = $3)
    `,
      [adminId, op.name, op.card]
    );
  }

  let rateId;
  {
    const existing = await db.query(
      `SELECT id FROM public.rate_structures WHERE name = 'Staging TOU Energy' AND station_id = $1 LIMIT 1`,
      [stationId]
    );
    if (existing.rows[0]) {
      rateId = existing.rows[0].id;
    } else {
      const rs = await db.query(
        `
        INSERT INTO public.rate_structures (name, station_id, is_active, effective_from, description)
        VALUES ('Staging TOU Energy', $1, true, CURRENT_DATE, 'Staging energy-only TOU (demand=0)')
        RETURNING id
      `,
        [stationId]
      );
      rateId = rs.rows[0].id;
    }
  }

  const periodCount = await db.query(
    `SELECT count(*)::int n FROM public.rate_periods WHERE rate_structure_id = $1`,
    [rateId]
  );
  if (periodCount.rows[0].n === 0) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const periods = [
      ['Off-Peak', '05:00', '14:00', 0.183, 10],
      ['Mid-Peak', '14:00', '17:00', 0.193, 20],
      ['Peak', '17:00', '23:00', 0.213, 30],
      ['MID', '23:00', '05:00', 0.193, 40],
    ];
    for (const [name, start, end, rate, priority] of periods) {
      await db.query(
        `
        INSERT INTO public.rate_periods (
          rate_structure_id, period_name, start_time, end_time,
          days_of_week, energy_rate_per_kwh, demand_charge_per_kw, priority
        ) VALUES ($1,$2,$3::time,$4::time,$5::text[],$6,0,$7)
      `,
        [rateId, name, start, end, days, rate, priority]
      );
    }
  }

  await db.query(`
    INSERT INTO public.tax_configurations (tax_name, tax_rate, is_active, applies_to, effective_from, station_id)
    SELECT 'Staging Zero Tax', 0, true, 'all', CURRENT_DATE, $1
    WHERE NOT EXISTS (SELECT 1 FROM public.tax_configurations WHERE tax_name = 'Staging Zero Tax')
  `, [stationId]);

  const a2 = [
    'supabase/migrations/20260716230000_a2_user_approval_and_role_foundation.sql',
    'supabase/migrations/20260716230100_a2_user_station_access.sql',
    'supabase/migrations/20260716230200_a2_authorization_helpers.sql',
    'supabase/migrations/20260716230300_a2_core_rls_policies.sql',
    'supabase/migrations/20260716230400_a2_financial_rpc_authorization.sql',
    'supabase/migrations/20260716230500_a2_archive_and_audit_security.sql',
  ];
  for (const f of a2) {
    process.stdout.write(`Applying ${f.split('/').pop()} ... `);
    await db.query(fs.readFileSync(f, 'utf8'));
    console.log('OK');
  }

  console.log('Upserting all test user_profiles + station access...');
  for (const u of USERS) {
    const scoped = ['station_manager', 'import_officer', 'accountant', 'report_viewer'].includes(u.role);
    await db.query(
      `
      INSERT INTO public.user_profiles (
        id, email, full_name, role, is_active, approval_status, approved_at, station_id
      ) VALUES (
        $1,$2,$3,$4,
        $5, $6,
        CASE WHEN $6 = 'approved' THEN now() ELSE NULL END,
        $7
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        approval_status = EXCLUDED.approval_status,
        approved_at = EXCLUDED.approved_at,
        station_id = EXCLUDED.station_id,
        disabled_at = CASE WHEN EXCLUDED.approval_status = 'disabled' THEN now() ELSE NULL END
    `,
      [
        ids[u.email],
        u.email,
        u.name,
        u.role,
        u.approval !== 'disabled' && u.approval !== 'rejected',
        u.approval,
        scoped ? stationId : null,
      ]
    );

    if (u.approval === 'approved') {
      await db.query(
        `
        INSERT INTO public.user_station_access (user_id, station_id, access_level, is_active, created_by)
        VALUES ($1, $2, $3, true, $4)
        ON CONFLICT (user_id, station_id) DO UPDATE SET is_active = true
      `,
        [
          ids[u.email],
          stationId,
          u.role === 'accountant' || u.role === 'report_viewer' ? 'readonly' : 'manager',
          adminId,
        ]
      );
    }
  }

  console.log('Running A1 uniqueness smoke test...');
  await db.query('BEGIN');
  try {
    const sess = await db.query(
      `
      INSERT INTO public.charging_sessions (
        station_id, transaction_id, charge_id, card_number,
        start_date, start_time, start_ts,
        end_date, end_time, end_ts,
        duration_minutes, energy_consumed_kwh, calculated_cost, station_code
      ) VALUES (
        $1, 'STG-A1-UNIQUE-1', 'CHG-STG-A1-1', '6424',
        CURRENT_DATE, '10:00', date_trunc('day', now()) + interval '10 hours',
        CURRENT_DATE, '11:00', date_trunc('day', now()) + interval '11 hours',
        60, 10, 0, 'STATION-STG-1'
      )
      RETURNING id
    `,
      [stationId]
    );
    const sid = sess.rows[0].id;
    await db.query(
      `
      INSERT INTO public.billing_calculations (
        session_id, rate_structure_id, subtotal, taxes, fees, total_amount, currency
      ) VALUES ($1, $2, 1, 0, 0, 1, 'JOD')
    `,
      [sid, rateId]
    );
    let rejected = false;
    try {
      await db.query(
        `
        INSERT INTO public.billing_calculations (
          session_id, rate_structure_id, subtotal, taxes, fees, total_amount, currency
        ) VALUES ($1, $2, 2, 0, 0, 2, 'JOD')
      `,
        [sid, rateId]
      );
    } catch {
      rejected = true;
    }
    await db.query('ROLLBACK');
    console.log('A1 duplicate reject:', rejected ? 'PASS' : 'FAIL');
    if (!rejected) process.exitCode = 2;
  } catch (e) {
    await db.query('ROLLBACK');
    console.error('A1 smoke failed', e.message);
    process.exitCode = 3;
  }

  fs.writeFileSync(
    'scripts/staging/.staging_test_credentials.local.json',
    JSON.stringify(
      {
        project_ref: 'dmbmzjnpbmakotvlckkq',
        password: TEMP_PASSWORD,
        users: USERS.map((u) => ({
          email: u.email,
          role: u.role,
          approval: u.approval,
          id: ids[u.email],
        })),
        station_id: stationId,
        rate_structure_id: rateId,
      },
      null,
      2
    )
  );
  const gi = fs.readFileSync('.gitignore', 'utf8');
  if (!gi.includes('.staging_test_credentials.local.json')) {
    fs.appendFileSync('.gitignore', '\nscripts/staging/.staging_test_credentials.local.json\n');
  }

  const verify = await db.query(`
    select
      (select count(*)::int from public.user_profiles) as profiles,
      (select count(*)::int from public.stations) as stations,
      (select count(*)::int from public.operators) as operators,
      (select count(*)::int from public.rate_periods) as periods,
      (select count(*)::int from public.user_station_access) as access_rows,
      (select count(*)::int from pg_policies where schemaname='public') as policies,
      (select count(*)::int from public.user_profiles where role='system_admin' and approval_status='approved') as approved_admins
  `);
  console.log('VERIFY', verify.rows[0]);
  console.log('Credentials file: scripts/staging/.staging_test_credentials.local.json (gitignored)');
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
