# Import Workflow v2 (Phase C)

## Overview

Phase C adds file identity, operator/card/filename resolution, preview validation, and optional transactional posting via `post_import_batch_v2`.

## Feature flag

`system_settings.import_workflow_v2_enabled`

- `false` (default after migration): UI still shows integrity panel; posting uses legacy `processBatch` + `calculate_batch_billing_v2`.
- `true`: posting uses `post_import_batch_v2` (atomic insert + billing).

## Operator resolution

| Status | Meaning | Posting |
|---|---|---|
| `match` | Selected operator, card, filename agree | Ready |
| `warning` | Card OK, filename differs | Confirm checkbox |
| `conflict` | Selected operator ≠ card owner | Blocked unless authorized override |
| `unknown_card` | Card not mapped | Proceed with caution / map card |
| `no_card` | No card in file | Selected operator used |
| `pending` | No operator selected | Blocked |

## Duplicate protection

1. SHA-256 `file_hash` on `import_batches` (duplicate posted file signal)
2. Unique `charging_sessions.transaction_id`
3. Row skip + batch status `duplicate` when all TXNs already exist

## Rollback

Run `scripts/production/c_rollback_import_workflow.sql` to force-disable v2 posting.
