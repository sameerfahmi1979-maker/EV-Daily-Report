-- EV-D rollback: disable workflows without destroying data
UPDATE public.system_settings
SET value = 'false'
WHERE key IN ('payment_workflow_v1_enabled', 'handover_workflow_v1_enabled');

SELECT key, value
FROM public.system_settings
WHERE key IN ('payment_workflow_v1_enabled', 'handover_workflow_v1_enabled');
