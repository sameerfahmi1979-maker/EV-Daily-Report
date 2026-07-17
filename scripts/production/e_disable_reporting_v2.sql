-- EV-E rollback: disable Reporting v2 without deleting anything.
-- The report_* RPCs, views, indexes, and their independent role/station
-- authorization remain in place — this only hides the new UI page.
UPDATE public.system_settings
SET value = 'false'
WHERE key = 'reporting_v2_enabled';

SELECT key, value
FROM public.system_settings
WHERE key = 'reporting_v2_enabled';
