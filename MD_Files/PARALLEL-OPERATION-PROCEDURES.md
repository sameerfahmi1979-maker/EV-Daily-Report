# Parallel Operation Procedures

## Overview

This document outlines procedures for running the new OCPP management system in parallel with the existing CSV import system during the transition period. This approach ensures data continuity, allows validation, and provides a fallback option while building confidence in the new system.

---

## Parallel Operation Strategy

### Objectives

1. **Validate OCPP system accuracy** against existing CSV data
2. **Build operational confidence** in the new system
3. **Maintain business continuity** during transition
4. **Train team** on new workflows
5. **Identify and resolve issues** before full migration
6. **Establish baseline metrics** for comparison

### Duration

**Recommended Parallel Period:**
- **Minimum:** 2 weeks
- **Recommended:** 4-6 weeks
- **Extended:** Up to 3 months for complex deployments

---

## System Coexistence Configuration

### Database Schema

Both systems use the same database with coexistence features:

**Legacy System:**
- Uses `charging_sessions` table (CSV imports)
- Uses `stations`, `operators`, `rate_structures`, `fixed_charges` tables

**OCPP System:**
- Uses `ocpp_chargers`, `ocpp_connectors`, `ocpp_charging_sessions` tables
- Shares `stations`, `operators` tables
- Links via `ocpp_charging_sessions.legacy_session_id`

**Key Relationship:**
```sql
ocpp_charging_sessions
  ├── legacy_session_id → charging_sessions.id (nullable)
  ├── station_id → stations.id (via ocpp_chargers)
  └── operator_id → operators.id
```

### Data Flow During Parallel Operation

```
CSV Import System:
CSV File → Import Process → charging_sessions table → Billing → Reports

OCPP System:
Charger → OCPP Server → ocpp_charging_sessions → Billing → Reports

Shared:
Both systems use → stations, operators, rate_structures, fixed_charges
```

---

## Phase 1: Initial Parallel Setup

### Week 1: First Charger Parallel Operation

**Day 1-2: Setup**

1. **Onboard First Charger**
   - Complete onboarding per guide
   - Verify fully operational
   - Document charger location

2. **Establish Baseline**
   ```sql
   -- Record starting metrics
   SELECT
     COUNT(*) as legacy_sessions_count,
     SUM(energy_consumed_kwh) as legacy_energy_total,
     SUM(calculated_cost) as legacy_revenue_total
   FROM charging_sessions
   WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';
   ```

3. **Configure Monitoring**
   - Set up alerts for OCPP charger
   - Enable detailed logging
   - Create daily check procedures

**Day 3-7: Monitoring and Comparison**

1. **Daily Data Reconciliation**
   - Run comparison queries
   - Validate session data
   - Check billing accuracy
   - Document discrepancies

2. **Weekly Report**
   - Sessions count (CSV vs OCPP)
   - Energy totals comparison
   - Revenue comparison
   - Uptime statistics
   - Issue log

---

## Daily Operations During Parallel Period

### Morning Routine (Daily)

**8:00 AM - System Health Check**

1. **Check OCPP Charger Status**
   ```
   - Navigate to Live Monitoring
   - Verify all OCPP chargers online
   - Check last heartbeat times
   - Review any overnight errors
   ```

2. **Check Legacy System**
   ```
   - Verify CSV import scheduler running
   - Check last import time
   - Review import errors log
   ```

3. **Review Active Sessions**
   ```
   - OCPP: Check Sessions Monitor for active
   - Legacy: Check charging_sessions for today
   - Note any anomalies
   ```

**Action Items:**
- [ ] All OCPP chargers online: Yes/No
- [ ] CSV import up to date: Yes/No
- [ ] Active sessions normal: Yes/No
- [ ] Issues to investigate: List

### Data Reconciliation (Daily)

**10:00 AM - Yesterday's Data Comparison**

Run reconciliation queries to compare systems:

**1. Session Count Comparison**
```sql
-- OCPP sessions yesterday
SELECT
  'OCPP' as source,
  COUNT(*) as session_count,
  SUM(energy_consumed_wh)/1000.0 as total_kwh,
  SUM(calculated_cost) as total_revenue
FROM ocpp_charging_sessions
WHERE DATE(start_timestamp) = CURRENT_DATE - INTERVAL '1 day'
  AND user_id = '[YOUR_USER_ID]'
  AND session_status = 'Completed';

-- Legacy sessions yesterday (for non-OCPP chargers)
SELECT
  'Legacy' as source,
  COUNT(*) as session_count,
  SUM(energy_consumed_kwh) as total_kwh,
  SUM(calculated_cost) as total_revenue
FROM charging_sessions
WHERE DATE(start_time) = CURRENT_DATE - INTERVAL '1 day'
  AND user_id = '[YOUR_USER_ID]'
  AND station_id NOT IN (
    SELECT station_id FROM ocpp_chargers WHERE station_id IS NOT NULL
  );
```

**2. Station-Level Comparison**
```sql
-- OCPP charger performance
SELECT
  c.charge_point_id,
  s.name as station_name,
  COUNT(sess.id) as session_count,
  SUM(sess.energy_consumed_wh)/1000.0 as total_kwh,
  SUM(sess.calculated_cost) as revenue,
  AVG(sess.duration_minutes) as avg_duration_min
FROM ocpp_charging_sessions sess
JOIN ocpp_chargers c ON sess.charger_id = c.id
LEFT JOIN stations s ON c.station_id = s.id
WHERE DATE(sess.start_timestamp) = CURRENT_DATE - INTERVAL '1 day'
  AND c.user_id = '[YOUR_USER_ID]'
  AND sess.session_status = 'Completed'
GROUP BY c.charge_point_id, s.name
ORDER BY session_count DESC;

-- Legacy station performance (same period)
SELECT
  s.name as station_name,
  COUNT(sess.id) as session_count,
  SUM(sess.energy_consumed_kwh) as total_kwh,
  SUM(sess.calculated_cost) as revenue,
  AVG(sess.duration_minutes) as avg_duration_min
FROM charging_sessions sess
JOIN stations s ON sess.station_id = s.id
WHERE DATE(sess.start_time) = CURRENT_DATE - INTERVAL '1 day'
  AND sess.user_id = '[YOUR_USER_ID]'
  AND s.id NOT IN (
    SELECT station_id FROM ocpp_chargers WHERE station_id IS NOT NULL
  )
GROUP BY s.name
ORDER BY session_count DESC;
```

**3. Billing Accuracy Check**
```sql
-- Check if OCPP billing matches expected
SELECT
  charge_point_id,
  transaction_id,
  start_timestamp,
  end_timestamp,
  energy_consumed_wh / 1000.0 as energy_kwh,
  calculated_cost,
  -- Manual calculation for verification
  (energy_consumed_wh / 1000.0) * [YOUR_BASE_RATE] as expected_cost_simple
FROM ocpp_charging_sessions sess
JOIN ocpp_chargers c ON sess.charger_id = c.id
WHERE DATE(start_timestamp) = CURRENT_DATE - INTERVAL '1 day'
  AND sess.session_status = 'Completed'
ORDER BY start_timestamp;
```

**Document Results:**
```
Date: [Date]
OCPP Sessions: [Count]
Legacy Sessions: [Count]
OCPP Energy: [kWh]
Legacy Energy: [kWh]
OCPP Revenue: $[Amount]
Legacy Revenue: $[Amount]
Discrepancies: [List any]
Action Items: [List]
```

### Afternoon Check (Daily)

**2:00 PM - Mid-Day Status**

1. **Active Sessions Check**
   - Any sessions running longer than expected?
   - Any stuck sessions?
   - Any billing issues?

2. **Error Log Review**
   ```
   - Navigate to Message Logs
   - Filter for errors
   - Review and categorize
   - Create tickets for issues
   ```

3. **Performance Metrics**
   - Average session duration
   - Energy per session
   - Revenue per session
   - Error rate

### Evening Summary (Daily)

**5:00 PM - Daily Summary Report**

**Create Daily Summary:**
```markdown
# Daily OCPP Operations Report - [Date]

## System Health
- OCPP Chargers Online: [X/Y]
- Uptime: [%]
- Error Count: [#]

## Sessions Today
- OCPP: [Count] sessions, [kWh] kWh, $[Revenue]
- Legacy: [Count] sessions, [kWh] kWh, $[Revenue]

## Issues
1. [Issue description] - Status: [Open/Resolved]
2. ...

## Actions Taken
- [Action 1]
- [Action 2]

## Tomorrow's Plan
- [Plan items]

Prepared by: [Name]
```

---

## Weekly Operations During Parallel Period

### Monday: Planning Week

**Activities:**
1. Review previous week's metrics
2. Set goals for current week
3. Schedule any maintenance
4. Plan additional charger onboarding (if ready)

### Wednesday: Mid-Week Review

**Activities:**
1. Run comprehensive comparison report
2. Review error trends
3. Check customer feedback
4. Adjust monitoring as needed

### Friday: Week Wrap-Up

**Activities:**
1. Generate weekly summary report
2. Update stakeholders
3. Document lessons learned
4. Plan next week's improvements

---

## Weekly Comparison Report Template

```markdown
# Weekly OCPP vs Legacy Comparison Report
**Week of:** [Start Date] to [End Date]

## Executive Summary
- Overall Status: [On Track / Issues / Behind Schedule]
- OCPP System Readiness: [%]
- Recommendation: [Continue Parallel / Extend Period / Ready for Full Cutover]

## Operational Metrics

### OCPP System
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Uptime | XX.X% | >98% | ✅/❌ |
| Session Count | XXX | - | - |
| Total Energy | XXX kWh | - | - |
| Total Revenue | $XXX | - | - |
| Avg Session | XX min | - | - |
| Error Rate | X.X% | <2% | ✅/❌ |

### Legacy System
| Metric | Value |
|--------|-------|
| Session Count | XXX |
| Total Energy | XXX kWh |
| Total Revenue | $XXX |
| Import Errors | X |

### Comparison
| Metric | OCPP | Legacy | Variance |
|--------|------|--------|----------|
| Sessions/Charger/Day | X.X | X.X | XX% |
| Revenue/Session | $XX | $XX | XX% |
| Avg Energy/Session | XX kWh | XX kWh | XX% |

## Billing Accuracy
- Sessions Reviewed: XXX
- Billing Matches Expected: XX%
- Discrepancies Found: X
- Discrepancies Resolved: X

## Issues & Resolutions
1. **[Issue Title]**
   - Description: ...
   - Impact: High/Medium/Low
   - Status: Open/In Progress/Resolved
   - Resolution: ...

## Charger-Specific Performance
| Charger | Uptime | Sessions | Energy | Revenue | Issues |
|---------|--------|----------|--------|---------|--------|
| CP-001 | XX% | XX | XX kWh | $XX | X |
| CP-002 | XX% | XX | XX kWh | $XX | X |

## User Feedback
- Positive: [Count and examples]
- Negative: [Count and examples]
- Suggestions: [List]

## System Improvements Implemented
- [Improvement 1]
- [Improvement 2]

## Next Week Plan
- [ ] Continue monitoring current chargers
- [ ] Onboard charger CP-XXX (if ready)
- [ ] Address issue #X
- [ ] Test feature Y

## Go-Live Readiness Assessment
| Criterion | Status | Notes |
|-----------|--------|-------|
| System Stability | ✅/❌ | ... |
| Billing Accuracy | ✅/❌ | ... |
| Team Readiness | ✅/❌ | ... |
| Documentation | ✅/❌ | ... |
| Stakeholder Approval | ✅/❌ | ... |

**Prepared by:** [Name]
**Date:** [Date]
**Next Review:** [Date]
```

---

## Data Validation Procedures

### Session Data Validation

**For Each Completed Session:**

1. **Verify Session Integrity**
   ```sql
   SELECT
     transaction_id,
     start_timestamp,
     end_timestamp,
     start_meter_value,
     end_meter_value,
     energy_consumed_wh,
     (end_meter_value - start_meter_value) as calc_energy,
     calculated_cost
   FROM ocpp_charging_sessions
   WHERE session_status = 'Completed'
     AND DATE(end_timestamp) = CURRENT_DATE - INTERVAL '1 day'
   ORDER BY end_timestamp DESC;
   ```

2. **Check for Anomalies**
   - Energy consumed = 0 (but session > 5 minutes)
   - Negative energy values
   - Extremely high energy (>200 kWh)
   - Cost = 0 or NULL
   - Duration > 24 hours
   - Start meter > end meter

3. **Validate Against Meter Values**
   ```sql
   SELECT
     sess.transaction_id,
     sess.energy_consumed_wh / 1000.0 as session_energy_kwh,
     MAX(mv.value) - MIN(mv.value) as meter_values_energy_kwh
   FROM ocpp_charging_sessions sess
   LEFT JOIN ocpp_meter_values mv ON sess.id = mv.session_id
     AND mv.measurand = 'Energy.Active.Import.Register'
   WHERE sess.id = '[SESSION_ID]'
   GROUP BY sess.id, sess.transaction_id, sess.energy_consumed_wh;
   ```

4. **Compare Billing**
   - Verify rate structure applied
   - Check time-of-use if applicable
   - Confirm fixed charges included
   - Validate discounts applied

### Weekly Audit Sample

**Randomly select 10% of sessions for detailed audit:**

1. **Select Random Sample**
   ```sql
   SELECT *
   FROM ocpp_charging_sessions
   WHERE end_timestamp BETWEEN '[START]' AND '[END]'
     AND session_status = 'Completed'
   ORDER BY RANDOM()
   LIMIT (SELECT COUNT(*) * 0.1 FROM ocpp_charging_sessions
          WHERE end_timestamp BETWEEN '[START]' AND '[END]');
   ```

2. **Deep Dive Review**
   - Review all messages for session
   - Check meter value progression
   - Validate authorization
   - Verify billing step-by-step
   - Document findings

3. **Document Results**
   - Pass/Fail for each session
   - Issues found
   - Patterns observed
   - Recommendations

---

## Issue Management During Parallel Period

### Issue Classification

**Priority Levels:**

**P1 - Critical**
- System completely down
- Data loss occurring
- Billing completely wrong
- Safety issue
- **Response Time:** Immediate
- **Resolution Time:** 4 hours

**P2 - High**
- Charger offline > 1 hour
- Sessions not completing
- Billing inaccurate >20%
- Degraded performance
- **Response Time:** 1 hour
- **Resolution Time:** 24 hours

**P3 - Medium**
- Single session error
- Minor billing discrepancy <20%
- Dashboard display issue
- **Response Time:** 4 hours
- **Resolution Time:** 3 days

**P4 - Low**
- Cosmetic issue
- Feature request
- Documentation gap
- **Response Time:** 1 business day
- **Resolution Time:** 1 week

### Issue Tracking Template

```markdown
## Issue #[Number]

**Title:** [Brief Description]

**Priority:** P1/P2/P3/P4

**Reported:** [Date/Time]
**Reported By:** [Name]

**Description:**
[Detailed description of the issue]

**Impact:**
- Users Affected: [Number/All/Some]
- Systems Affected: [OCPP/Legacy/Both]
- Revenue Impact: [Yes/No, Amount]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Result]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Workaround:**
[Temporary workaround if available]

**Investigation:**
[Findings from investigation]

**Resolution:**
[How it was fixed]

**Resolved:** [Date/Time]
**Resolved By:** [Name]

**Root Cause:**
[Underlying cause]

**Prevention:**
[How to prevent in future]

**Status:** Open/In Progress/Resolved/Closed
```

---

## Transition Decision Criteria

### Readiness Checklist for Full Cutover

**Technical Readiness:**
- [ ] System uptime >98% for 2+ consecutive weeks
- [ ] All critical bugs resolved
- [ ] No P1 or P2 issues open
- [ ] Billing accuracy >99%
- [ ] All planned chargers onboarded
- [ ] Integration testing passed
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Backup/recovery tested

**Operational Readiness:**
- [ ] Team trained on all procedures
- [ ] Documentation complete
- [ ] Runbooks created
- [ ] On-call rotation established
- [ ] Escalation paths defined
- [ ] Monitoring alerts configured
- [ ] Reporting templates finalized

**Business Readiness:**
- [ ] Stakeholders briefed
- [ ] Users communicated with
- [ ] Marketing materials updated
- [ ] Support team prepared
- [ ] Pricing verified
- [ ] Legal/compliance reviewed
- [ ] Financial projections validated

**Data Readiness:**
- [ ] Historical data migrated (if needed)
- [ ] Data validation passed
- [ ] Reporting accuracy confirmed
- [ ] Export processes tested
- [ ] Audit trail complete

### Go/No-Go Meeting

**Schedule:** End of Week 4-6 of parallel operation

**Attendees:**
- Project Manager
- Technical Lead
- Operations Manager
- Finance Representative
- Executive Sponsor

**Agenda:**
1. Review readiness checklist
2. Present metrics comparison
3. Review open issues
4. Assess risk factors
5. Make decision: Go / No-Go / Extend Parallel

**Decision:**
- **Go:** Proceed to full cutover, deprecate legacy system
- **No-Go:** Extend parallel period, address issues
- **Rollback:** Revert to legacy only (if serious issues)

---

## Cutover Planning

### Pre-Cutover (Week Before)

**Day -7:**
- [ ] Final readiness review
- [ ] Freeze new feature development
- [ ] Complete all testing
- [ ] Prepare communications

**Day -3:**
- [ ] Team briefing
- [ ] Finalize cutover plan
- [ ] Backup all data
- [ ] Prepare rollback plan

**Day -1:**
- [ ] System health check
- [ ] Confirm all issues resolved
- [ ] Communications ready
- [ ] Support team on standby

### Cutover Day (Recommended: Sunday)

**Phase 1: Legacy System Shutdown (6:00 AM)**
- [ ] Disable CSV import scheduler
- [ ] Mark legacy system read-only
- [ ] Backup final state
- [ ] Notify team

**Phase 2: OCPP System Primary (6:30 AM)**
- [ ] Verify all chargers online
- [ ] Update configuration
- [ ] Enable production monitoring
- [ ] Test end-to-end

**Phase 3: Verification (7:00 AM - 10:00 AM)**
- [ ] Complete test transaction
- [ ] Verify billing
- [ ] Check all dashboards
- [ ] Confirm reports working

**Phase 4: Communication (10:00 AM)**
- [ ] Send go-live announcement
- [ ] Update website/app
- [ ] Activate support channels
- [ ] Monitor closely

### Post-Cutover (First Week)

**Day 1:**
- Intensive monitoring (hourly checks)
- Rapid response to any issues
- Document all events
- Daily summary to stakeholders

**Day 2-3:**
- Continue intensive monitoring
- Four times daily checks
- Review all sessions
- Address any issues immediately

**Day 4-7:**
- Reduce to twice daily checks
- Weekly summary report
- Lessons learned session
- Optimize as needed

---

## Rollback Plan

### When to Rollback

**Immediate Rollback Triggers:**
- System downtime >4 hours
- Data loss or corruption
- Billing errors >50% of sessions
- Safety issue identified
- Multiple P1 issues

**Considered Rollback:**
- Persistent performance issues
- High error rate (>10%)
- Team unable to manage
- Negative user feedback overwhelming

### Rollback Procedure

**Step 1: Decision (Within 1 hour)**
- Assess situation
- Consult with team
- Get executive approval
- Communicate decision

**Step 2: Revert to Legacy (Within 2 hours)**
- Re-enable CSV import scheduler
- Disable OCPP system (set chargers offline in UI)
- Restore legacy system to read-write
- Test legacy system functioning

**Step 3: Data Reconciliation**
- Identify any sessions during cutover
- Manually reconcile if needed
- Ensure no data loss
- Document gap

**Step 4: Communication**
- Notify all stakeholders
- Explain situation (appropriate detail)
- Provide updated timeline
- Restore confidence

**Step 5: Root Cause Analysis**
- Investigate what went wrong
- Document findings
- Create remediation plan
- Schedule retry (when ready)

---

## Success Metrics

### Key Performance Indicators (KPIs)

**System Health:**
- Uptime: >98%
- Error Rate: <2%
- Average Response Time: <100ms

**Business Metrics:**
- Sessions Per Day: [Track trend]
- Revenue Per Day: [Track trend]
- Billing Accuracy: >99%
- User Satisfaction: >90%

**Operational Efficiency:**
- Time Savings: >80% reduction in manual work
- Error Resolution Time: <24 hours average
- Team Confidence: High

**Data Accuracy:**
- Session Data Complete: 100%
- Billing Calculation Correct: >99%
- Reporting Accurate: >99%

---

## Communication Plan

### Daily Updates

**To:** Operations team
**Format:** Email/Slack
**Content:** System status, issues, actions

### Weekly Reports

**To:** Management
**Format:** PDF report
**Content:** Comprehensive metrics, issues, recommendations

### Monthly Reviews

**To:** Executives, stakeholders
**Format:** Presentation
**Content:** Strategic overview, business impact, future plans

---

## Conclusion

Parallel operation is a critical phase that validates the new OCPP system while maintaining business continuity. Follow these procedures diligently to ensure a smooth transition and build confidence in the new infrastructure.

**Remember:** It's better to extend the parallel period than to rush cutover and risk issues!
