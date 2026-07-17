# calculate_batch_billing baseline

- **MD5:** `7f2f259e610692d2dffa45c0603d3d67`
- **Args:** `p_batch_id uuid, p_station_id uuid`
- **Returns:** `jsonb`
- **Security:** `SECURITY DEFINER`
- **Capture:** 2026-07-16 from `qflxupfeyktdrpilctyo`

Exact body is stored in live table:

`a1_backup_20260716.rpc_definitions`

A1 intentionally did **not** rewrite this function. Known defect (no time-of-day period filter; fallback 0.150) is deferred to Phase B.
