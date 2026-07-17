# EV-A1 RPC Baselines

Captured 2026-07-16 from live project `qflxupfeyktdrpilctyo`.

| Function | Args | MD5 |
|---|---|---|
| `calculate_batch_billing` | `p_batch_id uuid, p_station_id uuid` | `7f2f259e610692d2dffa45c0603d3d67` |
| `delete_import_batch` | `p_batch_id uuid` | `67fea76cd9c249fb08def8a48676fb19` |
| `recalculate_shift_totals` | `p_shift_id uuid` | `65897713a84c803f0c590ee4c12f7fce` |
| `recalculate_all_shift_totals` | _(none)_ | `00653252da9c0efcf63a9118bc51f3bf` |
| `turbo_bulk_calculate_billing` | session ids + recalculate flag | `6ed44ddffbccfc5d773ff4215aa357bb` |
| `turbo_calculate_all_pending` | station + batch size | `76cdd7a8daef49f185fdfbe4f85699da` |

Exact bodies are stored in live schema `a1_backup_20260716.rpc_definitions` and should not be “improved” in A1.

Tariff algorithm rewrite is deferred to Phase B.
