# Fleet Management Procedures

## Overview

This document provides procedures for managing multiple ChargeCore Verde chargers across different locations during and after the rollout phase.

---

## Fleet Composition (Target: 9 Chargers)

### Planning Phase
- **Total Chargers:** 9 ChargeCore Verde units
- **Total Connectors:** 18 (2 per charger)
- **Locations:** [Number] different sites
- **Expected Utilization:** [Target]%

### Naming Convention

**Format:** `CV-[LOCATION]-CP[NUMBER]`

**Examples:**
- CV-MAIN-CP01 (Main Office, Charger 1)
- CV-MAIN-CP02 (Main Office, Charger 2)
- CV-NORTH-CP01 (North Parking Lot, Charger 1)

**Benefits:**
- Easy identification
- Location grouping
- Scalable numbering

---

## Rollout Schedule

### Phase 11: Weeks 11-12

**First Charger (Already Onboarded in Phase 10):**
- Week 10: CV-MAIN-CP01
- Status: Operational, parallel operation ongoing

**Remaining 8 Chargers:**

**Week 11:**
- **Days 1-2:** CV-MAIN-CP02, CV-NORTH-CP01
- **Days 3-4:** CV-NORTH-CP02, CV-SOUTH-CP01
- **Day 5:** Review, address any issues

**Week 12:**
- **Days 1-2:** CV-SOUTH-CP02, CV-EAST-CP01
- **Days 3-4:** CV-EAST-CP02, CV-WEST-CP01
- **Day 5:** CV-WEST-CP02, final review

**Pacing Strategy:**
- 2 chargers per session
- Allow 1 day between sessions for adjustment
- Don't rush - quality over speed
- Learn from each deployment

---

## Pre-Onboarding Preparation

### Bulk Registration (Day -7)

**Use Bulk Registration Tool:**

1. Navigate to OCPP Management > Bulk Registration
2. Generate template for all 9 chargers
3. Customize details for each:
   - Charge Point IDs
   - Serial Numbers (from physical labels)
   - Locations (station linkage)
   - IP addresses (if static)
   - Installation dates
4. Review all entries carefully
5. Click "Register 9 Charger(s)"
6. Export to CSV for documentation
7. Verify all appear in Charger Management

**Result:** All chargers pre-registered, showing "Offline" status

### Site Preparation Checklist

**For Each Location (Day -5):**

- [ ] Electrical capacity verified
- [ ] Conduit and wiring installed
- [ ] Network connectivity tested
- [ ] Mounting hardware ready
- [ ] Signage prepared
- [ ] User communication sent
- [ ] Site contact designated
- [ ] Access arranged for installers

### Inventory Check (Day -3)

**Per Charger:**
- [ ] Physical unit received
- [ ] Serial number matches registration
- [ ] All cables included
- [ ] Mounting hardware complete
- [ ] Documentation present
- [ ] No visible damage

### Team Coordination (Day -1)

- [ ] Installation team scheduled
- [ ] Network team on standby
- [ ] Operations team prepared
- [ ] Testing plan reviewed
- [ ] Rollback procedure ready

---

## Parallel Onboarding Process

### Two-Charger Deployment Session

**Time Required:** 4-6 hours for 2 chargers

**Team Roles:**
- **Lead Installer:** Physical installation
- **Network Tech:** Connectivity setup
- **OCPP Admin:** System configuration
- **QA Tester:** Verification testing

**Timeline:**

**Hour 0-2: Physical Installation**
- Both chargers mounted simultaneously
- Electrical connections (licensed electrician)
- Network connections
- Power-on and startup

**Hour 2-3: OCPP Configuration**
- Configure OCPP settings on both chargers
- Set OCPP server URL
- Configure network parameters
- Set security settings

**Hour 3-4: Connection and Registration**
- Monitor for BootNotification
- Verify both chargers online
- Check configuration keys retrieved
- Link to stations
- Verify in Live Monitoring

**Hour 4-5: Functional Testing**
- Test RFID authorization on both
- Complete test charging session on each
- Test both connectors per charger
- Verify billing calculations
- Test remote commands

**Hour 5-6: Documentation and Handoff**
- Photos of installations
- Update asset register
- Brief site contact
- Post user instructions
- Final system check

### Batch Operations

**After All Onboarded:**

Update multiple chargers at once when needed:

**Firmware Updates:**
1. Test on one charger first
2. Schedule during low-usage time
3. Update in batches of 3-4
4. Monitor for issues
5. Complete fleet update

**Configuration Changes:**
1. Use OCPP Configuration dashboard
2. Filter to select multiple chargers
3. Apply change to all simultaneously
4. Verify acceptance
5. Monitor behavior

**Status Checks:**
1. Live Monitoring shows all chargers
2. Use filters to group by location
3. Health & Diagnostics for fleet health
4. Generate fleet reports

---

## Fleet Monitoring

### Daily Fleet Health Check

**Morning Routine (10 minutes):**

1. **Live Monitoring:**
   - Count online chargers (should be 9/9)
   - Note any offline
   - Check connector statuses

2. **Quick Stats:**
   - Active sessions count
   - Yesterday's session count
   - Yesterday's revenue

3. **Error Review:**
   - Any red alerts?
   - Recurring issues?
   - Action items

**Document:** Daily fleet status log

### Weekly Fleet Analysis

**Every Monday (30 minutes):**

1. **Uptime Report:**
   - Per-charger uptime percentage
   - Fleet average uptime
   - Identify problem chargers

2. **Utilization Report:**
   - Sessions per charger
   - Energy per charger
   - Revenue per charger
   - Identify underutilized chargers

3. **Performance Comparison:**
   - Best performing chargers
   - Worst performing chargers
   - Location analysis
   - Trends

4. **Maintenance Needs:**
   - Any chargers needing attention?
   - Schedule preventive maintenance
   - Parts/supplies needed?

**Document:** Weekly fleet report

### Monthly Fleet Review

**First Monday of Month (1 hour):**

1. **Comprehensive Analysis:**
   - Full fleet statistics
   - Month-over-month comparison
   - Goal vs actual performance
   - Financial analysis

2. **Charger Lifecycle:**
   - Firmware versions review
   - Update planning
   - Warranty status
   - Maintenance schedules

3. **Strategic Planning:**
   - Expansion opportunities?
   - Retirement planning?
   - Budget forecasting
   - Capacity planning

**Document:** Monthly executive report

---

## Fleet Performance Metrics

### Key Fleet KPIs

**Availability:**
- **Target:** 98% fleet-wide
- **Calculation:** (Total online hours / Total possible hours) × 100
- **Action if below:** Investigate chronic offline chargers

**Utilization:**
- **Target:** 40% fleet-wide
- **Calculation:** (Charging hours / Available hours) × 100
- **Action if low:** Marketing, pricing review, access improvements

**Revenue per Charger per Day:**
- **Target:** $[Amount] per charger per day
- **Calculation:** Total daily revenue / Number of chargers
- **Action if low:** Usage analysis, pricing review

**Session Success Rate:**
- **Target:** 95%
- **Calculation:** (Successful sessions / Total attempts) × 100
- **Action if low:** Authorization issues, charger problems

**Mean Time Between Failures (MTBF):**
- **Target:** >720 hours (30 days)
- **Track:** Time between charger failures
- **Action if low:** Reliability investigation, vendor engagement

### Benchmarking

**Compare Chargers:**
- Rank by uptime
- Rank by utilization
- Rank by revenue
- Rank by session count
- Identify outliers

**Best Practices from Top Performers:**
- What makes them successful?
- Location factors?
- User behavior differences?
- Technical configuration?
- Replicate success factors

---

## Load Balancing

### Distributing Load Across Fleet

**Monitor:**
- Which chargers are busiest?
- Which are underutilized?
- Peak times per location?

**Strategies:**
- Direct users to less-busy chargers
- Dynamic pricing (future capability)
- Reservation system (future capability)
- Communication and signage

**Capacity Planning:**
- Track utilization trends
- Predict capacity needs
- Plan expansion timing
- Optimal locations for new chargers

---

## Firmware Management

### Fleet Firmware Strategy

**Current State:**
- Track version of each charger
- Document firmware history
- Maintain version compatibility

**Update Planning:**
1. **Notification:** Vendor releases new firmware
2. **Review:** Release notes, bug fixes, new features
3. **Testing:** Update one charger (test unit)
4. **Validation:** Run for 1 week, verify no issues
5. **Rollout:** Update fleet in phases
   - Phase 1: 2-3 chargers
   - Phase 2: 3-4 chargers (after 48 hours)
   - Phase 3: Remaining chargers (after 48 hours)
6. **Verification:** Confirm all updated successfully

**Rollback Plan:**
- Know how to revert if issues
- Keep previous version available
- Test rollback procedure

---

## Incident Management

### Fleet-Wide Incident

**If Multiple Chargers Affected:**

1. **Assess Scope:**
   - How many chargers affected?
   - Same location or multiple?
   - Common symptoms?
   - Started when?

2. **Identify Cause:**
   - Network outage?
   - OCPP server issue?
   - Power problem?
   - Configuration change?
   - Vendor issue?

3. **Immediate Action:**
   - Notify management
   - Post user communication
   - Workarounds if available
   - Escalate to appropriate team

4. **Resolution:**
   - Fix root cause
   - Verify all chargers recovered
   - Test functionality
   - Clear user communications

5. **Post-Incident:**
   - Document incident
   - Root cause analysis
   - Preventive measures
   - Update procedures

### Single Charger Issues

**Isolate and Resolve:**

1. Mark charger as "Maintenance" in system
2. Post physical signage
3. Troubleshoot per TROUBLESHOOTING-GUIDE.md
4. Repair or replace as needed
5. Test thoroughly before returning to service
6. Document resolution

---

## Expansion Planning

### Adding More Chargers (Phase 12+)

**Decision Criteria:**
- Utilization of existing chargers >60%
- User demand exceeds capacity
- New locations identified
- Budget available
- Infrastructure ready

**Process:**
1. Needs assessment
2. Site survey
3. Business case
4. Approval
5. Procurement
6. Installation
7. Onboarding (repeat Phase 11 process)
8. Integration into fleet

**Scalability:**
- System supports hundreds of chargers
- Same processes apply
- Consider regional grouping
- May need additional staff

---

## Retirement and Replacement

### End of Life Planning

**When to Retire:**
- Excessive maintenance costs
- Technology obsolescence
- Capacity no longer needed
- Relocation needed

**Process:**
1. Decommission in system
2. Notify users in advance
3. Physical removal
4. Disposal per regulations
5. Update asset register
6. Documentation archival

**Replacement:**
- Follow onboarding process
- Reuse charge point ID if replacing in same location
- Or assign new ID for different location

---

## Documentation and Reporting

### Fleet Documentation

**Maintain Current:**
- Asset register (all chargers)
- Network diagram
- Configuration baseline
- Firmware versions
- Maintenance history

**Regular Reports:**
- Daily: Fleet status log
- Weekly: Performance summary
- Monthly: Executive report
- Quarterly: Strategic review
- Annual: Comprehensive analysis

**Audit Trail:**
- Configuration changes
- Firmware updates
- Maintenance activities
- Incident resolutions

---

## Training and Knowledge Transfer

### Operations Team Training

**Topics:**
- Fleet monitoring procedures
- Batch operations
- Performance analysis
- Incident response
- Reporting

**Schedule:**
- Initial: 2-day workshop
- Refresher: Quarterly
- Updates: As needed

### Site Contact Training

**For Each Location:**
- Basic charger operation
- User support
- Visual inspection
- When to escalate
- Emergency procedures

**Format:**
- 1-hour onsite session
- Quick reference card
- Contact information

---

## Success Criteria

### Phase 11 Completion Criteria

- [ ] All 9 chargers installed
- [ ] All 9 chargers online
- [ ] All 18 connectors operational
- [ ] Successful test sessions on all
- [ ] Linked to appropriate stations
- [ ] Rate structures applied
- [ ] Billing working correctly
- [ ] Fleet monitoring established
- [ ] Documentation complete
- [ ] Team trained

### Ongoing Success Metrics

- Fleet uptime >98%
- Utilization >40%
- User satisfaction >90%
- Revenue targets met
- No critical incidents
- Continuous improvement

---

## Appendix

### Fleet Inventory Template

| Charger ID | Location | Serial Number | Installation Date | Firmware | Status | Notes |
|------------|----------|---------------|-------------------|----------|--------|-------|
| CV-MAIN-CP01 | Main Office | SN-001 | 2024-12-01 | 1.0.0 | Online | - |
| CV-MAIN-CP02 | Main Office | SN-002 | 2024-12-15 | 1.0.0 | Online | - |
| ... | ... | ... | ... | ... | ... | ... |

### Deployment Tracking

| Charger ID | Scheduled | Installed | Configured | Tested | Operational | Issues |
|------------|-----------|-----------|------------|---------|-------------|--------|
| CV-MAIN-CP01 | Week 10 | ✓ | ✓ | ✓ | ✓ | None |
| CV-MAIN-CP02 | Week 11 Day 1 | | | | | |
| ... | ... | ... | ... | ... | ... | ... |

---

**Document Version:** 1.0
**Last Updated:** December 21, 2024
**Owner:** Operations Manager
**Next Review:** After Phase 11 completion
