# EV Daily Report — Staging Environment Setup

## Purpose

Isolated Supabase project for Phase A2 RLS/RPC security UAT and future phase work. Production remains read-only unless Sameer explicitly authorizes writes.

## Projects

| Environment | Project name | Project ref | Region |
|---|---|---|---|
| Production | EV Charging Daily Report | `qflxupfeyktdrpilctyo` | Northeast Asia (Tokyo) |
| Staging | EV-Daily-Report-Staging | `dmbmzjnpbmakotvlckkq` | Northeast Asia (Tokyo) |

PostgreSQL on both: **17.6**. App business timezone remains `Asia/Amman`.

## Local configuration

1. Copy `.env.staging.example` → `.env.staging` (gitignored).
2. Fill with **staging** URL, anon key, service-role key, and DB URL.
3. Prefer pooler session mode if direct `db.<ref>.supabase.co` has IPv6-only DNS:

```text
postgresql://postgres.<ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

4. Run the Vite app against staging:

```bash
# PowerShell
Get-Content .env.staging | ForEach-Object {
  if ($_ -match '^(VITE_[^=]+)=(.*)$') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] }
}
npm run dev
```

Confirm the amber **STAGING ENVIRONMENT** banner and that network calls go to `dmbmzjnpbmakotvlckkq.supabase.co`.

## Schema bootstrap (Option B)

Local `supabase/migrations/` history is incomplete vs production. Staging was built as:

1. Schema-only export from production public schema → `supabase/migrations/20251219000000_staging_schema_baseline.sql` (includes post-A1 objects).
2. Apply baseline to staging via `SUPABASE_DB_URL` (never production).
3. Apply A2 migrations `20260716230000` … `20260716230500`.
4. Seed via `node scripts/staging/seed_staging.cjs`.

Do **not** `db push` the entire historical local migration set onto staging; it will conflict with the baseline snapshot.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/staging/export_public_schema_ddl.sql` | Read-only DDL extractor (run against prod via `supabase db query --linked`) |
| `scripts/staging/seed_staging.cjs` | Auth users, station/operators/tariff, A2 apply, A1 smoke |
| `scripts/staging/security_uat.cjs` | Direct API RLS/RPC security checks |
| `scripts/staging/rpc_role_uat.cjs` | Role-gated `replace_session_billing` checks |
| `scripts/staging/a2_rollback_rehearsal.cjs` | Policy rollback + A2 re-apply smoke |
| `scripts/staging/apply_a2_migrations.cjs` | Apply A2 only (requires approved admin profile) |

Test credentials (password + emails) are stored only in:

```text
scripts/staging/.staging_test_credentials.local.json
```

That file is gitignored. Do not commit it.

## CLI safety

```bash
supabase link --project-ref dmbmzjnpbmakotvlckkq --yes
```

Cursor MCP `user-supabase` remains wired to **production**. Prefer CLI + staging `.env.staging` for all staging writes. Never run staging seed/migration scripts against production URLs.

## Auth redirect notes

Configure staging Auth Site URL / redirect URLs in the staging project dashboard to local/staging hosts only. Do not reuse production redirect URLs for password reset in staging.

## Sample files

Use only on staging after security UAT:

- `sample files/2026-07-16+abo saleh.xlsx` (card `6424`)
- `sample files/2026-07-16+mohammad.xlsx` (card `6443`)

Operators for those cards are seeded in staging.

## Full reset path

1. Drop/recreate public application objects or create a fresh staging project.
2. Re-apply `20251219000000_staging_schema_baseline.sql`.
3. Run `node scripts/staging/seed_staging.cjs`.
4. Run security UAT scripts.
