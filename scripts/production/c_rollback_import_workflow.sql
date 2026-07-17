-- EV-C rollback helpers (controlled)
-- Does NOT drop columns by default (data-preserving). Disables v2 posting path.

UPDATE public.system_settings
SET value = 'false'
WHERE key = 'import_workflow_v2_enabled';

-- Optional hard rollback (commented): drop posting RPC only if urgently required
-- DROP FUNCTION IF EXISTS public.post_import_batch_v2(uuid, uuid, uuid, text, jsonb, boolean, boolean);
-- DROP FUNCTION IF EXISTS public.cancel_unposted_import_batch(uuid);

SELECT key, value
FROM public.system_settings
WHERE key = 'import_workflow_v2_enabled';
