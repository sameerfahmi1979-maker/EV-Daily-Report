-- Read-only DDL extractor for public schema (Option B staging baseline).
-- Returns one row per DDL statement in dependency-friendly order groups.

WITH enums AS (
  SELECT 10 AS ord,
         'CREATE TYPE public.' || quote_ident(t.typname) || ' AS ENUM (' ||
         string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) || ');' AS ddl
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname
),
sequences AS (
  SELECT 20 AS ord,
         'CREATE SEQUENCE IF NOT EXISTS public.' || quote_ident(c.relname) || ';' AS ddl
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'S'
),
tables AS (
  SELECT 30 AS ord,
         format(
           'CREATE TABLE IF NOT EXISTS public.%I (%s);',
           c.relname,
           string_agg(
             format(
               '%I %s%s%s',
               a.attname,
               pg_catalog.format_type(a.atttypid, a.atttypmod),
               CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
               CASE
                 WHEN a.atthasdef THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid)
                 ELSE ''
               END
             ),
             ', ' ORDER BY a.attnum
           )
         ) AS ddl
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  GROUP BY c.relname
),
pkeys AS (
  SELECT 40 AS ord,
         format(
           'ALTER TABLE ONLY public.%I ADD CONSTRAINT %I %s;',
           c.relname,
           con.conname,
           pg_get_constraintdef(con.oid, true)
         ) AS ddl
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND con.contype = 'p'
),
uniques AS (
  SELECT 50 AS ord,
         format(
           'ALTER TABLE ONLY public.%I ADD CONSTRAINT %I %s;',
           c.relname,
           con.conname,
           pg_get_constraintdef(con.oid, true)
         ) AS ddl
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND con.contype = 'u'
),
checks AS (
  SELECT 55 AS ord,
         format(
           'ALTER TABLE ONLY public.%I ADD CONSTRAINT %I %s;',
           c.relname,
           con.conname,
           pg_get_constraintdef(con.oid, true)
         ) AS ddl
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND con.contype = 'c'
),
fkeys AS (
  SELECT 60 AS ord,
         format(
           'ALTER TABLE ONLY public.%I ADD CONSTRAINT %I %s;',
           c.relname,
           con.conname,
           pg_get_constraintdef(con.oid, true)
         ) AS ddl
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND con.contype = 'f'
),
indexes AS (
  SELECT 70 AS ord,
         pg_get_indexdef(i.indexrelid) || ';' AS ddl
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_class tbl ON tbl.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = tbl.relnamespace
  WHERE n.nspname = 'public'
    AND NOT i.indisprimary
    AND NOT i.indisunique
    AND idx.relname NOT LIKE '%_pkey'
),
unique_indexes AS (
  -- unique indexes that are not constraints (coverage)
  SELECT 65 AS ord,
         pg_get_indexdef(i.indexrelid) || ';' AS ddl
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_class tbl ON tbl.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = tbl.relnamespace
  WHERE n.nspname = 'public'
    AND i.indisunique
    AND NOT i.indisprimary
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint con
      WHERE con.conindid = i.indexrelid
    )
),
functions AS (
  SELECT 80 AS ord,
         pg_get_functiondef(p.oid) || ';' AS ddl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND l.lanname IN ('plpgsql', 'sql')
    AND p.prokind IN ('f', 'p')
),
triggers AS (
  SELECT 90 AS ord,
         pg_get_triggerdef(t.oid, true) || ';' AS ddl
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
),
rls AS (
  SELECT 95 AS ord,
         format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', c.relname) AS ddl
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
),
policies AS (
  SELECT 100 AS ord,
         format(
           'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s %s %s;',
           pol.polname,
           c.relname,
           CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
           CASE pol.polcmd
             WHEN 'r' THEN 'SELECT'
             WHEN 'a' THEN 'INSERT'
             WHEN 'w' THEN 'UPDATE'
             WHEN 'd' THEN 'DELETE'
             WHEN '*' THEN 'ALL'
           END,
           CASE
             WHEN pol.polroles = '{0}'::oid[] THEN 'public'
             ELSE array_to_string(ARRAY(
               SELECT quote_ident(r.rolname) FROM pg_roles r WHERE r.oid = ANY (pol.polroles)
             ), ', ')
           END,
           CASE WHEN pol.polqual IS NOT NULL THEN 'USING (' || pg_get_expr(pol.polqual, pol.polrelid) || ')' ELSE '' END,
           CASE WHEN pol.polwithcheck IS NOT NULL THEN 'WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')' ELSE '' END
         ) AS ddl
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
),
grants AS (
  SELECT 110 AS ord,
         format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role;', c.relname) AS ddl
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
fn_grants AS (
  SELECT 120 AS ord,
         format(
           'GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated, service_role;',
           p.proname,
           pg_get_function_identity_arguments(p.oid)
         ) AS ddl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public' AND l.lanname IN ('plpgsql', 'sql') AND p.prokind IN ('f', 'p')
)
SELECT ord, ddl
FROM (
  SELECT * FROM enums
  UNION ALL SELECT * FROM sequences
  UNION ALL SELECT * FROM tables
  UNION ALL SELECT * FROM pkeys
  UNION ALL SELECT * FROM uniques
  UNION ALL SELECT * FROM checks
  UNION ALL SELECT * FROM unique_indexes
  UNION ALL SELECT * FROM fkeys
  UNION ALL SELECT * FROM indexes
  UNION ALL SELECT * FROM functions
  UNION ALL SELECT * FROM triggers
  UNION ALL SELECT * FROM rls
  UNION ALL SELECT * FROM policies
  UNION ALL SELECT * FROM grants
  UNION ALL SELECT * FROM fn_grants
) x
WHERE ddl IS NOT NULL AND length(trim(ddl)) > 0
ORDER BY ord, ddl;
