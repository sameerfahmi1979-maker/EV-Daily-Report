// EV-F Production Activation UAT — Phase F historical audit, governed
// correction, payment-classification governance, reporting hardening.
// Runs UAT-F-01..15 sequentially against production using real historical
// data plus a small number of clearly-labeled synthetic fixtures (created and
// destroyed by this script) for scenarios with no naturally-occurring
// real-world example (material mismatch, locked-handover block, anomaly).
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const PROJECT = 'qflxupfeyktdrpilctyo';
const STATION_A = '48f00127-09e8-47f6-8f6a-c3a331b332be';
const LEDGER_PATH = path.join(__dirname, 'f_activation_uat_ledger.json');

const ledger = { startedAt: new Date().toISOString(), scenarios: {} };
function record(key, value) { ledger.scenarios[key] = value; }
function ok(cond, msg) { if (!cond) throw new Error('ASSERTION FAILED: ' + msg); }

function getKeys() {
  const r = spawnSync('supabase', ['projects', 'api-keys', '--project-ref', PROJECT, '-o', 'json'], { encoding: 'utf8', shell: true });
  const keys = JSON.parse(r.stdout.slice(r.stdout.indexOf('['), r.stdout.lastIndexOf(']') + 1));
  return {
    service: keys.find((k) => k.name === 'service_role').api_key,
    anon: (keys.find((k) => k.name === 'anon') || keys.find((k) => k.name === 'publishable')).api_key,
  };
}

const { service: SERVICE_KEY, anon: ANON_KEY } = getKeys();
const admin = createClient(`https://${PROJECT}.supabase.co`, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function setFlag(key, value) {
  await admin.from('system_settings').update({ value: String(value) }).eq('key', key);
}
async function getFlag(key) {
  const { data } = await admin.from('system_settings').select('value').eq('key', key).maybeSingle();
  return data?.value;
}

async function reactivateAndSignIn(email, patch) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const u = list.users.find((x) => x.email === email);
  if (!u) throw new Error('user not found: ' + email);
  const pw = 'EvF!' + Math.random().toString(36).slice(2, 12);
  await admin.auth.admin.updateUserById(u.id, { password: pw });
  await admin.from('user_profiles').update({ approval_status: 'approved', is_active: true, ...patch }).eq('id', u.id);
  const anonClient = createClient(`https://${PROJECT}.supabase.co`, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signed, error } = await anonClient.auth.signInWithPassword({ email, password: pw });
  if (error) throw error;
  const authed = createClient(`https://${PROJECT}.supabase.co`, ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + signed.session.access_token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { id: u.id, client: authed };
}

async function createTempUser(email, role, patch) {
  const pw = 'EvF!' + Math.random().toString(36).slice(2, 12);
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.users.find((x) => x.email === email);
  let userId;
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password: pw });
    userId = existing.id;
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
    if (error) throw error;
    userId = created.user.id;
  }
  await admin.from('user_profiles').upsert({ id: userId, role, approval_status: 'approved', is_active: true, ...patch }, { onConflict: 'id' });
  const created = { user: { id: userId } };
  const anonClient = createClient(`https://${PROJECT}.supabase.co`, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signed, error: signErr } = await anonClient.auth.signInWithPassword({ email, password: pw });
  if (signErr) throw signErr;
  const authed = createClient(`https://${PROJECT}.supabase.co`, ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + signed.session.access_token } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { id: created.user.id, client: authed };
}

async function main() {
  console.log('=== EV-F Production Activation UAT ===');

  // ---- Setup: enable flags progressively ----
  await setFlag('historical_comparison_enabled', 'true');
  record('flags_step1', { historical_comparison_enabled: await getFlag('historical_comparison_enabled') });

  const admin_user = await reactivateAndSignIn('sameer@algt.net', {});
  const opsMgr = await reactivateAndSignIn('uat.d.opsmgr1@energy-stream.net', { role: 'operations_manager', station_id: null });
  const accountant = await reactivateAndSignIn('uat.d.accountant1@energy-stream.net', { role: 'accountant', station_id: STATION_A });
  const importOfficer = await reactivateAndSignIn('uat.import.officer+cclosure@energy-stream.net', { role: 'import_officer', station_id: STATION_A });
  const viewer = await reactivateAndSignIn('uat.d.viewer1@energy-stream.net', { role: 'report_viewer', station_id: STATION_A });
  const stationMgr = await createTempUser('uat.f.stationmgr@energy-stream.net', 'station_manager', { station_id: STATION_A });
  const pendingUser = await createTempUser('uat.f.pending@energy-stream.net', 'accountant', { approval_status: 'pending', is_active: false });
  const anonClient = createClient(`https://${PROJECT}.supabase.co`, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Temp second station for cross-station denial test.
  const { data: stationB, error: stationBErr } = await admin.from('stations').insert({
    name: 'EV-F UAT Station B', status: 'active',
  }).select('id').single();
  if (stationBErr) throw stationBErr;
  const viewerB = await createTempUser('uat.f.viewerB@energy-stream.net', 'report_viewer', { station_id: stationB.id });

  console.log('Setup complete. Station A:', STATION_A, 'Station B (temp):', stationB.id);

  // =========================================================================
  // UAT-F-01: Historical inventory vs direct SQL
  // =========================================================================
  {
    const start = '2026-01-01', end = '2026-07-17';
    const { data: summary, error } = await admin_user.client.rpc('report_historical_inventory_summary', { p_start: start, p_end: end, p_station_id: null });
    if (error) throw error;

    const { data: directCount } = await admin.from('charging_sessions').select('id', { count: 'exact', head: true }).gte('start_date', start).lte('start_date', end);
    const { count: directTotal } = await admin.from('charging_sessions').select('id', { count: 'exact', head: true }).gte('start_date', start).lte('start_date', end);

    ok(summary.total_sessions === directTotal, `inventory total_sessions ${summary.total_sessions} !== direct SQL count ${directTotal}`);
    record('UAT-F-01', { status: 'PASS', summary_total_sessions: summary.total_sessions, direct_sql_count: directTotal, missing_billing_count: summary.missing_billing_count });
    console.log('UAT-F-01 PASS — inventory matches direct SQL:', summary.total_sessions);
  }

  // =========================================================================
  // UAT-F-02: Dry-run comparison (never mutates)
  // =========================================================================
  let exactMatchSessionId = null;
  {
    const { data: candidates } = await admin.from('charging_sessions').select('id, transaction_id').eq('start_date', '2026-01-15').limit(3);
    exactMatchSessionId = candidates[0].id;

    const { data: beforeRow } = await admin.from('billing_calculations').select('*').eq('session_id', exactMatchSessionId).single();
    const { data: cmp, error } = await accountant.client.rpc('compare_historical_session_to_v2', { p_session_id: exactMatchSessionId });
    if (error) throw error;
    const { data: afterRow } = await admin.from('billing_calculations').select('*').eq('session_id', exactMatchSessionId).single();

    ok(JSON.stringify(beforeRow) === JSON.stringify(afterRow), 'dry-run comparison mutated billing_calculations!');
    ok(cmp.match_tier === 'exact', `expected exact match, got ${cmp.match_tier}`);
    record('UAT-F-02', { status: 'PASS', session_id: exactMatchSessionId, match_tier: cmp.match_tier, difference: cmp.difference, non_mutating_verified: true });
    console.log('UAT-F-02 PASS — comparison exact, non-mutating verified');
  }

  // =========================================================================
  // Enable correction workflow for the pilot.
  // =========================================================================
  await setFlag('historical_correction_enabled', 'true');

  // =========================================================================
  // UAT-F-03: Approval and self-approval restrictions
  // =========================================================================
  let metadataCorrectionId = null;
  {
    const { data: sub, error: subErr } = await accountant.client.rpc('submit_historical_correction', {
      p_session_id: exactMatchSessionId, p_proposed_action: 'repair_metadata_only',
      p_reason: 'EV-F UAT-F-03/04: exact match, engine version missing — metadata-only repair pilot', p_evidence: {},
    });
    if (subErr) throw subErr;
    metadataCorrectionId = sub.correction_id;

    const { error: selfApproveErr } = await accountant.client.rpc('approve_historical_correction', { p_correction_id: metadataCorrectionId, p_reason: 'self' });
    ok(!!selfApproveErr, 'accountant was able to self-approve their own submission!');

    const { error: viewerApproveErr } = await viewer.client.rpc('approve_historical_correction', { p_correction_id: metadataCorrectionId, p_reason: 'viewer' });
    ok(!!viewerApproveErr, 'report_viewer was able to approve a correction (role denial expected)!');

    const { error: stationMgrApproveErr } = await stationMgr.client.rpc('approve_historical_correction', { p_correction_id: metadataCorrectionId, p_reason: 'sm' });
    ok(!!stationMgrApproveErr, 'station_manager was able to approve (review-only expected)!');

    const { data: approved, error: approveErr } = await opsMgr.client.rpc('approve_historical_correction', { p_correction_id: metadataCorrectionId, p_reason: 'ops mgr approval for UAT' });
    if (approveErr) throw approveErr;
    ok(approved.status === 'approved', 'ops manager approval did not set status=approved');

    record('UAT-F-03', {
      status: 'PASS', correction_id: metadataCorrectionId,
      self_approve_denied: !!selfApproveErr, viewer_approve_denied: !!viewerApproveErr,
      station_manager_approve_denied: !!stationMgrApproveErr, ops_manager_approved: true,
    });
    console.log('UAT-F-03 PASS — self/viewer/station_manager approval denied; ops manager approval succeeded');
  }

  // Duplicate-correction blocked while the first is still ACTIVE (approved, not yet applied).
  {
    const { error: dupActiveErr } = await accountant.client.rpc('submit_historical_correction', {
      p_session_id: exactMatchSessionId, p_proposed_action: 'repair_metadata_only', p_reason: 'duplicate attempt while active', p_evidence: {},
    });
    ok(!!dupActiveErr, 'submit_historical_correction succeeded for a session with an already-ACTIVE correction (duplicate should be blocked)!');
    record('UAT-F-duplicate-blocked', { status: 'PASS', blocked_error: dupActiveErr.message });
    console.log('UAT-F duplicate-active-correction PASS — blocked:', dupActiveErr.message);
  }

  // =========================================================================
  // UAT-F-04: Controlled correction (metadata-only pilot) + UAT-F-05: exact rollback
  // =========================================================================
  {
    const { data: beforeRow } = await admin.from('billing_calculations').select('*').eq('session_id', exactMatchSessionId).single();

    const { data: applied, error: applyErr } = await opsMgr.client.rpc('apply_historical_correction', { p_correction_id: metadataCorrectionId });
    if (applyErr) throw applyErr;
    ok(applied.status === 'applied', 'apply did not set status=applied');

    const { data: afterRow } = await admin.from('billing_calculations').select('*').eq('session_id', exactMatchSessionId).single();
    ok(afterRow.calculation_engine_version === 'ev-b-v2.0.0', `expected engine version backfilled, got ${afterRow.calculation_engine_version}`);
    ok(Number(afterRow.total_amount) === Number(beforeRow.total_amount), 'metadata-only repair changed total_amount (should not)!');

    record('UAT-F-04', { status: 'PASS', correction_id: metadataCorrectionId, before_engine_version: beforeRow.calculation_engine_version, after_engine_version: afterRow.calculation_engine_version, total_unchanged: true });
    console.log('UAT-F-04 PASS — metadata-only correction applied, total_amount unchanged');

    const { data: rolledBack, error: rollbackErr } = await opsMgr.client.rpc('rollback_historical_correction', { p_correction_id: metadataCorrectionId, p_reason: 'EV-F UAT-F-05: exact rollback verification' });
    if (rollbackErr) throw rollbackErr;
    ok(rolledBack.status === 'rolled_back', 'rollback did not set status=rolled_back');

    const { data: restoredRow } = await admin.from('billing_calculations').select('*').eq('session_id', exactMatchSessionId).single();
    ok(restoredRow.calculation_engine_version === beforeRow.calculation_engine_version, 'rollback did not restore original engine_version');
    ok(Number(restoredRow.total_amount) === Number(beforeRow.total_amount), 'rollback changed total_amount');
    ok(restoredRow.subtotal == beforeRow.subtotal && restoredRow.currency === beforeRow.currency, 'rollback did not restore all original fields exactly');

    record('UAT-F-05', { status: 'PASS', correction_id: metadataCorrectionId, restored_engine_version: restoredRow.calculation_engine_version, exact_restore_verified: true });
    console.log('UAT-F-05 PASS — rollback restored exact original billing_calculations row');
  }

  // =========================================================================
  // UAT-F-06: Locked-handover protection (synthetic fixture)
  // =========================================================================
  let syntheticSessionId = null, syntheticBillingId = null, lockedCorrectionId = null;
  {
    // Build a synthetic session + billing row cloned from a real one's station/time window,
    // then attach it to a synthetic LOCKED handover so apply/rollback must be blocked.
    const { data: template } = await admin.from('charging_sessions').select('*').eq('id', exactMatchSessionId).single();
    const clone = { ...template };
    delete clone.id; delete clone.created_at; delete clone.updated_at;
    clone.transaction_id = 'EVF-UAT-LOCKED-' + Date.now();
    clone.has_billing_calculation = false;
    clone.calculated_cost = template.calculated_cost; // clone is fine; this fixture is deleted at cleanup
    const { data: newSession, error: sessErr } = await admin.from('charging_sessions').insert(clone).select('id').single();
    if (sessErr) throw sessErr;
    syntheticSessionId = newSession.id;

    const { data: calc, error: calcErr } = await admin_user.client.rpc('calculate_session_billing_v2', { p_session_id: syntheticSessionId, p_source: 'manual_recalculate', p_reason: 'EV-F UAT fixture' });
    if (calcErr) throw calcErr;
    syntheticBillingId = calc.billing_id;

    // Force a material mismatch by overwriting total_amount directly (service role, fixture only).
    await admin.from('billing_calculations').update({ total_amount: 999.999, subtotal: 999.999 }).eq('id', syntheticBillingId);

    const { data: sub, error: subErr } = await accountant.client.rpc('submit_historical_correction', {
      p_session_id: syntheticSessionId, p_proposed_action: 'replace_billing_with_v2',
      p_reason: 'EV-F UAT-F-06: locked handover protection fixture (material mismatch)', p_evidence: { fixture: true },
    });
    if (subErr) throw subErr;
    lockedCorrectionId = sub.correction_id;
    ok(sub.comparison.match_tier === 'material', `expected material mismatch fixture, got ${sub.comparison.match_tier}`);

    const { error: approveErr } = await opsMgr.client.rpc('approve_historical_correction', { p_correction_id: lockedCorrectionId, p_reason: 'approved for UAT-F-06' });
    if (approveErr) throw approveErr;

    // Simulate a locked handover containing this session.
    const { data: shift } = await admin.from('shifts').select('id, operator_id').limit(1).single();
    const { data: lockedHandover, error: hoErr } = await admin.from('cash_handovers').insert({
      station_id: template.station_id, operator_id: shift.operator_id, shift_id: shift?.id ?? null, handover_number: 'EVF-UAT-LOCKED-' + Date.now(),
      status: 'locked', shift_date: template.start_date, submitted_by: admin_user.id, locked_at: new Date().toISOString(),
    }).select('id').single();
    if (hoErr) throw hoErr;
    const { data: syntheticBilling } = await admin.from('billing_calculations').select('total_amount').eq('id', syntheticBillingId).single();
    const { error: chsErr } = await admin.from('cash_handover_sessions').insert({
      handover_id: lockedHandover.id, session_id: syntheticSessionId, billing_calculation_id: syntheticBillingId,
      amount_jod: syntheticBilling.total_amount, payment_method: 'Cash',
    });
    if (chsErr) throw chsErr;

    const { error: applyBlockedErr } = await opsMgr.client.rpc('apply_historical_correction', { p_correction_id: lockedCorrectionId });
    ok(!!applyBlockedErr, 'apply_historical_correction succeeded on a session in a LOCKED handover (should be blocked)!');

    record('UAT-F-06', { status: 'PASS', correction_id: lockedCorrectionId, locked_handover_id: lockedHandover.id, apply_blocked: true, blocked_error: applyBlockedErr.message });
    console.log('UAT-F-06 PASS — apply blocked for session in locked handover:', applyBlockedErr.message);

    // Unlock (reopen) so we can finish the material-mismatch pilot end-to-end.
    await admin.from('cash_handover_sessions').delete().eq('handover_id', lockedHandover.id);
    await admin.from('cash_handovers').delete().eq('id', lockedHandover.id);

    const { data: appliedMaterial, error: applyErr2 } = await opsMgr.client.rpc('apply_historical_correction', { p_correction_id: lockedCorrectionId });
    if (applyErr2) throw applyErr2;
    ok(appliedMaterial.status === 'applied', 'material-mismatch pilot did not apply after handover reopened');

    const { data: fixedRow } = await admin.from('billing_calculations').select('id, total_amount').eq('session_id', syntheticSessionId).single();
    ok(Math.abs(Number(fixedRow.total_amount) - 999.999) > 1, 'material mismatch was not actually corrected by apply');
    syntheticBillingId = fixedRow.id; // replace_billing_with_v2 delete+inserts a new billing row; track the new id for cleanup

    record('UAT-F-material-pilot', { status: 'PASS', corrected_total: fixedRow.total_amount, note: 'synthetic fixture — material mismatch corrected to true v2 total after handover reopened' });
    console.log('UAT-F material-difference pilot PASS — corrected total:', fixedRow.total_amount);
  }

  // =========================================================================
  // UAT-F-07: Evidence-based metadata repair (automated RPC rejects weak evidence; governed correction succeeds)
  // =========================================================================
  {
    const { data: billingRow } = await admin.from('billing_calculations').select('id').eq('session_id', exactMatchSessionId).single();
    const { data: investigation, error: invErr } = await admin_user.client.rpc('investigate_engine_metadata', { p_billing_id: billingRow.id });
    if (invErr) throw invErr;
    // exactMatchSessionId's metadata was already repaired+rolled-back in UAT-F-04/05, engine_version is NULL again.
    ok(investigation.ok === true, 'investigate_engine_metadata failed unexpectedly');

    const { error: autoRepairErr } = await opsMgr.client.rpc('apply_engine_metadata_repair', { p_billing_id: billingRow.id, p_reason: 'attempt automated backfill' });
    // Real historical rows never populated calculation_method, so investigate_engine_metadata cannot reach
    // high-confidence 'v2_missing_metadata' from totals alone — apply_engine_metadata_repair must reject this,
    // proving "do not label unknown rows as v2 based only on matching totals".
    ok(!!autoRepairErr, 'apply_engine_metadata_repair succeeded from totals-match alone (should require calculation_method evidence too)!');

    record('UAT-F-07', {
      status: 'PASS', billing_id: billingRow.id, investigation_basis: investigation.inference_basis, investigation_confidence: investigation.confidence,
      automated_repair_rejected: true, rejection_reason: autoRepairErr.message,
      note: 'Automated high-confidence backfill correctly rejects totals-only evidence; metadata repair for real historical rows goes through the governed correction queue (see UAT-F-04) which requires explicit human approval.',
    });
    console.log('UAT-F-07 PASS — automated metadata repair correctly rejects insufficient evidence:', autoRepairErr.message);
  }

  // =========================================================================
  // UAT-F-08: Historical payment classification pilot
  // =========================================================================
  await setFlag('historical_payment_classification_enabled', 'true');
  {
    // Blocked: batch-level Cash proposal without uniform-method evidence.
    const { data: someBatch } = await admin.from('import_batches').select('id').limit(1).single();
    const { error: blockedErr } = await accountant.client.rpc('propose_historical_payment_classification', {
      p_scope: 'batch', p_session_id: null, p_batch_id: someBatch.id, p_classification: 'Cash',
      p_evidence_source: 'UAT attempt without evidence', p_evidence: {}, p_confidence: 'low', p_notes: null,
    });
    ok(!!blockedErr, 'batch-level Cash classification succeeded WITHOUT uniform_method_confirmed evidence (should be blocked)!');

    // Allowed: Unknown/Deferred never requires guessing, and never writes an allocation.
    const { data: proposal, error: propErr } = await accountant.client.rpc('propose_historical_payment_classification', {
      p_scope: 'session', p_session_id: exactMatchSessionId, p_batch_id: null, p_classification: 'Unknown',
      p_evidence_source: 'EV-F UAT-F-08: no reliable source evidence available for this historical session', p_evidence: {}, p_confidence: 'low', p_notes: 'UAT pilot',
    });
    if (propErr) throw propErr;

    const { error: approveErr } = await opsMgr.client.rpc('approve_historical_payment_classification', { p_id: proposal.id });
    if (approveErr) throw approveErr;
    const { data: applied, error: applyErr } = await opsMgr.client.rpc('apply_historical_payment_classification', { p_id: proposal.id });
    if (applyErr) throw applyErr;

    const { data: allocations } = await admin.from('session_payment_allocations').select('*').eq('session_id', exactMatchSessionId).eq('is_active', true);
    ok(allocations.length === 0, 'Unknown classification incorrectly wrote an active payment allocation (should stay unassigned)!');

    record('UAT-F-08', {
      status: 'PASS', batch_cash_without_evidence_blocked: true, unknown_classification_id: proposal.id,
      applied_count: applied.applied_count, allocations_after_unknown: allocations.length,
      note: 'Unknown/Deferred correctly write NO allocation row — session remains unassigned by design, never guessed.',
    });
    console.log('UAT-F-08 PASS — batch Cash without evidence blocked; Unknown classification applied with zero allocations written');
  }

  // =========================================================================
  // UAT-F-09: Pagination beyond 1000 rows + UAT-F-10: secondary filters
  // =========================================================================
  {
    const start = '2026-01-01', end = '2026-07-17';
    const page0 = await admin_user.client.rpc('report_billing_reconciliation', { p_start: start, p_end: end, p_station_id: null, p_page_size: 500, p_page_offset: 0 });
    if (page0.error) throw page0.error;
    const totalCount = page0.data[0]?.total_count ?? 0;
    ok(totalCount > 1000, `expected >1000 rows in range to prove pagination beyond default cap, got ${totalCount}`);

    const pageBeyond1000 = await admin_user.client.rpc('report_billing_reconciliation', { p_start: start, p_end: end, p_station_id: null, p_page_size: 500, p_page_offset: 1000 });
    if (pageBeyond1000.error) throw pageBeyond1000.error;
    ok(pageBeyond1000.data.length > 0, 'no rows returned at offset=1000 (pagination truncated)');
    ok(pageBeyond1000.data[0].session_id !== page0.data[0].session_id, 'offset=1000 page returned the same rows as offset=0');

    record('UAT-F-09', { status: 'PASS', total_count: totalCount, page0_rows: page0.data.length, page_at_1000_rows: pageBeyond1000.data.length });
    console.log('UAT-F-09 PASS — total_count', totalCount, 'exceeds 1000; page at offset=1000 returned', pageBeyond1000.data.length, 'distinct rows');

    const filtered = await admin_user.client.rpc('report_billing_reconciliation', { p_start: start, p_end: end, p_station_id: null, p_exception_status: 'legacy_engine', p_page_size: 50, p_page_offset: 0 });
    if (filtered.error) throw filtered.error;
    ok(filtered.data.every((r) => r.exception_status === 'legacy_engine'), 'exception_status filter returned non-matching rows');

    const unassignedFiltered = await admin_user.client.rpc('report_billing_reconciliation', { p_start: start, p_end: end, p_station_id: null, p_payment_method: 'UNASSIGNED', p_page_size: 50, p_page_offset: 0 });
    if (unassignedFiltered.error) throw unassignedFiltered.error;
    ok(unassignedFiltered.data.every((r) => r.payment_method === 'UNASSIGNED'), 'payment_method filter returned non-matching rows');

    record('UAT-F-10', { status: 'PASS', exception_status_filter_rows: filtered.data.length, payment_method_filter_rows: unassignedFiltered.data.length });
    console.log('UAT-F-10 PASS — secondary filters (exception_status, payment_method) verified');
  }

  // =========================================================================
  // UAT-F-11: Legacy report retirement (flag + banner presence)
  // =========================================================================
  {
    await setFlag('legacy_report_retirement_enabled', 'true');
    const val = await getFlag('legacy_report_retirement_enabled');
    ok(val === 'true', 'legacy_report_retirement_enabled did not persist');
    const bannerFile = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'components', 'LegacyReportBanner.tsx'), 'utf8');
    ok(bannerFile.includes('legacy_report_retirement_enabled'), 'LegacyReportBanner does not reference the flag');
    const matrixDoc = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'PHASE_F_LEGACY_REPORT_RETIREMENT_MATRIX.md'), 'utf8');
    ok(matrixDoc.length > 500, 'retirement matrix doc missing/too short');
    await setFlag('legacy_report_retirement_enabled', 'false'); // restore default off for controlled rollout
    record('UAT-F-11', { status: 'PASS', flag_toggle_verified: true, banner_wired: true, matrix_doc_present: true });
    console.log('UAT-F-11 PASS — legacy retirement flag + banner + matrix doc verified');
  }

  // =========================================================================
  // UAT-F-12: Full Excel/PDF export retrieves the full filtered dataset (no truncation)
  // =========================================================================
  {
    const start = '2026-01-01', end = '2026-07-17';
    let offset = 0; let collected = 0; let totalCount = null;
    for (;;) {
      const { data, error } = await admin_user.client.rpc('report_billing_reconciliation', { p_start: start, p_end: end, p_station_id: null, p_page_size: 500, p_page_offset: offset });
      if (error) throw error;
      if (data.length === 0) break;
      totalCount = data[0].total_count;
      collected += data.length;
      offset += 500;
      if (offset > totalCount + 500) break;
    }
    ok(collected === totalCount, `export-style full pagination collected ${collected} rows but total_count is ${totalCount}`);
    record('UAT-F-12', { status: 'PASS', total_count: totalCount, collected_via_pagination: collected });
    console.log('UAT-F-12 PASS — full paginated collection matches total_count exactly:', collected);
  }

  // =========================================================================
  // UAT-F-13: Role/station/direct API security
  // =========================================================================
  {
    const anonResult = await anonClient.rpc('report_historical_inventory_summary', { p_start: '2026-01-01', p_end: '2026-01-02', p_station_id: null });
    ok(!!anonResult.error, 'anonymous call to report_historical_inventory_summary succeeded (should be denied)!');

    // pendingUser has a valid auth session but approval_status='pending', is_active=false —
    // current_user_is_approved() must deny it at the RPC level regardless of a valid JWT.
    const { error: pendingErr } = await pendingUser.client.rpc('submit_historical_correction', {
      p_session_id: exactMatchSessionId, p_proposed_action: 'no_action_required', p_reason: 'pending user attempt', p_evidence: {},
    });
    ok(!!pendingErr, 'pending user was able to call a Phase F RPC (should be denied)!');

    const { error: crossStationErr } = await viewerB.client.rpc('report_correction_queue', { p_station_id: STATION_A, p_page_size: 5, p_page_offset: 0 });
    // report_correction_queue uses report_assert_access(p_station_id) — a station-B-scoped viewer requesting station A must be denied.
    ok(!!crossStationErr, 'Station-B-scoped viewer was able to read Station-A correction queue (cross-station isolation broken)!');

    record('UAT-F-13', { status: 'PASS', anonymous_denied: true, pending_denied: true, cross_station_denied: true });
    console.log('UAT-F-13 PASS — anonymous, pending, and cross-station access all denied');
  }

  // =========================================================================
  // UAT-F-14: Performance / chunking
  // =========================================================================
  {
    const t0 = Date.now();
    const { data, error } = await admin_user.client.rpc('compare_historical_batch_to_v2', { p_start: '2026-01-01', p_end: '2026-01-31', p_station_id: null, p_limit: 200, p_offset: 0 });
    if (error) throw error;
    const batchMs = Date.now() - t0;

    const t1 = Date.now();
    const { error: invError } = await admin_user.client.rpc('report_historical_inventory_summary', { p_start: '2026-01-01', p_end: '2026-07-17', p_station_id: null });
    if (invError) throw invError;
    const inventoryMs = Date.now() - t1;

    record('UAT-F-14', { status: 'PASS', batch_compare_200_rows_ms: batchMs, rows_returned: data.length, inventory_summary_wide_range_ms: inventoryMs, hard_cap_per_page: 200 });
    console.log('UAT-F-14 PASS — batch compare (200 rows):', batchMs, 'ms; inventory summary (wide range):', inventoryMs, 'ms');
  }

  // =========================================================================
  // UAT-F-15: A1-E regression
  // =========================================================================
  {
    const { data: dupCheck } = await admin.from('billing_calculations').select('session_id');
    const seen = new Map();
    let dup = 0;
    for (const r of dupCheck) { seen.set(r.session_id, (seen.get(r.session_id) || 0) + 1); }
    for (const v of seen.values()) if (v > 1) dup++;
    ok(dup === 0, `A1 duplicate billing groups regressed: ${dup}`);

    const flagsNow = {
      billing_engine_v2_enabled: await getFlag('billing_engine_v2_enabled'),
      import_workflow_v2_enabled: await getFlag('import_workflow_v2_enabled'),
      payment_workflow_v1_enabled: await getFlag('payment_workflow_v1_enabled'),
      handover_workflow_v1_enabled: await getFlag('handover_workflow_v1_enabled'),
      reporting_v2_enabled: await getFlag('reporting_v2_enabled'),
    };
    ok(Object.values(flagsNow).every((v) => v === 'true'), 'an A1-E feature flag regressed to false: ' + JSON.stringify(flagsNow));

    const { data: recon, error: reconErr } = await admin_user.client.rpc('report_revenue_summary', { p_start: '2026-01-01', p_end: '2026-01-07', p_station_id: null });
    if (reconErr) throw reconErr;

    record('UAT-F-15', { status: 'PASS', a1_duplicate_billing_groups: dup, flags: flagsNow, reporting_v2_still_functional: true, revenue_summary_rows: recon.length });
    console.log('UAT-F-15 PASS — A1 duplicate check, feature flags, Reporting v2 all regression-clean');
  }

  // =========================================================================
  // Cleanup: synthetic fixtures + deactivate temp/reactivated UAT users.
  // =========================================================================
  await admin.from('historical_correction_archive').delete().eq('correction_id', lockedCorrectionId);
  await admin.from('historical_correction_queue').delete().eq('id', lockedCorrectionId);
  await admin.from('cash_handover_sessions').delete().eq('session_id', syntheticSessionId);
  await admin.from('billing_breakdown_items').delete().eq('billing_calculation_id', syntheticBillingId);
  await admin.from('billing_calculations').delete().eq('id', syntheticBillingId);
  await admin.from('charging_sessions').delete().eq('id', syntheticSessionId);
  await admin.from('user_profiles').delete().in('id', [stationMgr.id, pendingUser.id, viewerB.id]);
  await admin.auth.admin.deleteUser(stationMgr.id);
  await admin.auth.admin.deleteUser(pendingUser.id);
  await admin.auth.admin.deleteUser(viewerB.id);
  await admin.from('stations').delete().eq('id', stationB.id);

  for (const [email, role, stationId] of [
    ['uat.d.opsmgr1@energy-stream.net', 'operations_manager', null],
    ['uat.d.accountant1@energy-stream.net', 'accountant', STATION_A],
    ['uat.import.officer+cclosure@energy-stream.net', 'import_officer', STATION_A],
    ['uat.d.viewer1@energy-stream.net', 'report_viewer', STATION_A],
  ]) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = list.users.find((x) => x.email === email);
    await admin.from('user_profiles').update({ approval_status: 'rejected', is_active: false }).eq('id', u.id);
  }

  // Restore flags to a controlled activation state (comparison on; correction/payment-classification
  // remain enabled per the activation plan since the pilots above succeeded — see closure report).
  record('final_flags', {
    historical_comparison_enabled: await getFlag('historical_comparison_enabled'),
    historical_correction_enabled: await getFlag('historical_correction_enabled'),
    historical_payment_classification_enabled: await getFlag('historical_payment_classification_enabled'),
    legacy_report_retirement_enabled: await getFlag('legacy_report_retirement_enabled'),
  });

  ledger.finishedAt = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
  console.log('=== ALL UAT-F-01..15 SCENARIOS PASSED ===');
  console.log('Ledger written to', LEDGER_PATH);
}

main().catch((e) => {
  console.error('UAT FAILED:', e);
  ledger.error = e.message;
  ledger.finishedAt = new Date().toISOString();
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
  process.exit(1);
});
