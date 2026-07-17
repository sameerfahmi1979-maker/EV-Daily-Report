# Operations Manual - OCPP Charging Management

## Daily Operations

### Morning Checklist (8:00 AM)
- [ ] Check all chargers online (Live Monitoring)
- [ ] Review overnight sessions
- [ ] Check for error notifications
- [ ] Verify no stuck sessions
- [ ] Address any offline chargers

### Throughout Day
- [ ] Monitor support requests
- [ ] Respond to charging issues within 1 hour
- [ ] Add/update operators as requested
- [ ] Track charger performance

### End of Day (5:00 PM)
- [ ] Review all sessions closed properly
- [ ] Check daily revenue vs. forecast
- [ ] Document any incidents
- [ ] Prepare handoff notes if 24/7 operation

---

## Weekly Tasks

### Monday
- Generate previous week analytics report
- Review charger uptime statistics
- Set weekly goals
- Schedule any maintenance

### Wednesday
- Mid-week status check
- Review error trends
- Verify operator list current
- Check pricing structures

### Friday
- Weekly summary report
- Review session patterns
- Document lessons learned
- Plan next week activities

---

## Monthly Tasks

### First Business Day
- Generate previous month report (PDF + CSV)
- Submit to management/accounting
- Review revenue vs. targets
- Archive reports

### Mid-Month
- Review and update rate structures if needed
- Audit operator list (remove inactive)
- Check charger firmware versions
- Plan any needed updates

### Month-End
- Reconcile all sessions
- Verify billing calculations
- Address any billing questions
- Prepare for next month

---

## Standard Operating Procedures

### SOP-001: Add New Operator

**When:** New employee, customer, or fleet vehicle

**Steps:**
1. Receive request (email, ticket, phone)
2. Collect required information:
   - Full name
   - Email address
   - RFID card number
   - Department (if applicable)
3. Log into system
4. Navigate to Operations > Operators
5. Click "Add Operator"
6. Enter all information
7. Set status to "Active"
8. Save
9. Test card at charger (if onsite)
10. Confirm with requester

**Time:** 5 minutes

### SOP-002: Deactivate Operator

**When:** Employee departure, card lost/stolen, account closure

**Steps:**
1. Receive deactivation request
2. Log into system
3. Navigate to Operations > Operators
4. Find operator by name or RFID
5. Click "Edit"
6. Change status to "Inactive"
7. Add termination note
8. Save
9. Confirm card immediately rejected
10. Notify requester

**Time:** 3 minutes

### SOP-003: Remote Start Charging Session

**When:** User unable to start charging

**Steps:**
1. Receive support call
2. Verify charger online
3. Get user's RFID card number
4. Navigate to OCPP Management > Remote Control
5. Select charger and connector
6. Enter RFID card number
7. Click "Remote Start"
8. Instruct user to plug in vehicle
9. Verify session starts in Sessions Monitor
10. Follow up with user

**Time:** 5-10 minutes

### SOP-004: Stop Stuck Session

**When:** Session won't end normally

**Steps:**
1. Identify stuck session (Sessions Monitor)
2. Note Transaction ID
3. Navigate to Remote Control
4. Select charger
5. Choose "Remote Stop Transaction"
6. Enter Transaction ID
7. Click "Remote Stop"
8. Verify session ends
9. Check billing calculated
10. Document incident

**Time:** 5 minutes

### SOP-005: Handle Offline Charger

**When:** Charger shows offline in Live Monitoring

**Steps:**
1. Note time offline detected
2. Go to Health & Diagnostics
3. Check last heartbeat
4. If < 5 min: Monitor for reconnection
5. If > 5 min: Investigate
   - Verify power at charger site
   - Check network connectivity
   - Contact site technician if needed
6. Try remote reset
7. If persists > 1 hour: Create maintenance ticket
8. Update status board
9. Notify users if needed
10. Document resolution

**Time:** 15-30 minutes

### SOP-006: Onboard New Charger

**When:** New charger installed

**Reference:** Follow CHARGER-ONBOARDING-GUIDE.md

**Quick Steps:**
1. Pre-register in system
2. Physical installation by technician
3. Configure OCPP settings
4. Verify connection
5. Test charging session
6. Link to station
7. Document in asset register
8. Train site personnel
9. Announce availability

**Time:** 4-8 hours

### SOP-007: Change Pricing

**When:** Rate update needed

**Steps:**
1. Receive pricing change request
2. Get approval from management
3. Determine effective date
4. Create new rate structure or edit existing
5. Test calculations
6. Schedule change
7. Update signage at locations
8. Notify users 2 weeks in advance
9. Implement on effective date
10. Monitor first billing cycle

**Time:** 1-2 hours (+ notification period)

### SOP-008: Generate Monthly Report

**When:** First business day of month

**Steps:**
1. Log into system
2. Navigate to Data > Reports
3. Set date range to previous month
4. Apply filters if needed
5. Generate PDF for management
6. Generate CSV for accounting
7. Download both files
8. Review for accuracy
9. Add executive summary (email)
10. Distribute to stakeholders
11. Archive in shared drive

**Time:** 30 minutes

### SOP-009: Handle Billing Dispute

**When:** User questions charge amount

**Steps:**
1. Receive complaint (email/phone)
2. Get transaction ID or date/time/location
3. Navigate to Billing
4. Find session
5. Review billing breakdown
6. Check:
   - Energy consumed (kWh)
   - Rate applied
   - Fixed charges
   - Calculation accuracy
7. Compare to rate sheet
8. Determine if correct or error
9. If correct: Explain calculation to user
10. If error: Escalate to supervisor
11. Document resolution
12. Follow up with user

**Time:** 15-30 minutes

### SOP-010: Emergency Shutdown

**When:** Safety issue, fire, electrical hazard

**Steps:**
1. Ensure personnel safety first
2. Press emergency stop at charger (if safe)
3. Disable affected circuit breaker
4. Log into system
5. Navigate to Remote Control
6. Send Reset (Hard) to affected charger(s)
7. Mark chargers unavailable in system
8. Post physical signage
9. Notify management
10. Contact emergency services if needed
11. Contact qualified electrician
12. Document incident thoroughly
13. Investigation and root cause analysis
14. Implement corrective actions
15. Resume operation only when safe

**Time:** Varies (safety priority)

---

## Escalation Matrix

### Level 1: Operations Team
- Handle: Routine operations, operator management, basic support
- Response Time: Within 1 hour during business hours
- Contact: [Operations Email/Phone]

### Level 2: Technical Support
- Handle: Charger technical issues, system problems, billing errors
- Response Time: Within 4 hours
- Contact: [Technical Support Email/Phone]

### Level 3: IT/Engineering
- Handle: System outages, database issues, OCPP server problems
- Response Time: Within 2 hours for critical, 1 business day for non-critical
- Contact: [IT Email/Phone]

### Level 4: Management
- Handle: Policy decisions, major incidents, financial issues
- Response Time: Within 1 business day
- Contact: [Management Email/Phone]

### Emergency Contact
- Handle: Safety issues, system-wide failure, security incidents
- Available: 24/7
- Contact: [Emergency Phone Number]

---

## Key Performance Indicators (KPIs)

### Operational KPIs

**Charger Uptime**
- Target: >98%
- Measure: (Online hours / Total hours) × 100
- Report: Weekly

**Session Success Rate**
- Target: >95%
- Measure: (Successful sessions / Total attempts) × 100
- Report: Weekly

**Support Response Time**
- Target: <1 hour
- Measure: Time from request to first response
- Report: Daily

**Resolution Time**
- Target: <4 hours
- Measure: Time from request to resolution
- Report: Weekly

### Business KPIs

**Revenue per Charger per Day**
- Target: [Set based on goals]
- Measure: Daily revenue / Number of chargers
- Report: Daily

**Average Session Cost**
- Target: [Monitor trend]
- Measure: Total revenue / Number of sessions
- Report: Weekly

**Utilization Rate**
- Target: >40%
- Measure: (Charging hours / Available hours) × 100
- Report: Weekly

**Customer Satisfaction**
- Target: >90%
- Measure: Positive feedback / Total feedback
- Report: Monthly

---

## Communication Templates

### New Operator Welcome Email

```
Subject: Welcome to [Company] EV Charging

Dear [Name],

Welcome to our EV charging network! Your RFID card has been activated.

Card Number: [Number]
Effective Date: [Date]

How to Charge:
1. Tap your RFID card on the charger
2. Plug into your vehicle
3. Charging starts automatically
4. Tap card again when done to stop

Pricing:
- Standard Rate: $0.30/kWh
- Session Fee: $1.00

Locations:
[List of available stations]

Support:
Phone: [Number]
Email: [Email]

Driver Guide: [Link to EV-DRIVER-QUICK-GUIDE.md]

Happy charging!

[Team Name]
```

### Price Change Notification

```
Subject: EV Charging Rate Update - Effective [Date]

Dear EV Charging Customers,

We are updating our charging rates effective [Date].

Current Rates:
- Energy: $0.30/kWh
- Session Fee: $1.00

New Rates:
- Energy: $0.35/kWh
- Session Fee: $1.00

Reason: [Brief explanation]

The new rates will apply to all sessions starting on or after [Date].

Questions? Contact us at [Email/Phone]

Thank you for your continued support of sustainable transportation!

[Team Name]
```

### Charger Outage Notification

```
Subject: [Location] Charger Temporarily Unavailable

Dear EV Charging Users,

The charger at [Location] is temporarily out of service.

Details:
- Charger: [Name/Number]
- Since: [Date/Time]
- Reason: [Maintenance/Repair/etc]
- Expected Return: [Date/Time]

Alternative charging is available at:
- [Alternative Location 1]
- [Alternative Location 2]

We apologize for the inconvenience and appreciate your patience.

Updates: [URL or "We will notify you when service is restored"]

[Team Name]
```

---

## Safety Procedures

### Electrical Safety

- Never touch electrical components
- Keep charger dry - don't use in standing water
- Report any exposed wires immediately
- Use emergency stop in case of sparks or smoke
- Qualified electricians only for repairs

### Vehicle Safety

- Ensure vehicle is in Park
- Don't charge damaged battery
- Follow vehicle manufacturer guidelines
- Report any unusual smells or sounds
- Supervise children near charging equipment

### Emergency Procedures

**Fire:**
1. Press emergency stop
2. Evacuate area
3. Call 911
4. Use appropriate fire extinguisher (Class C)
5. Don't use water on electrical fire

**Electrical Shock:**
1. Don't touch victim while energized
2. Turn off power at breaker
3. Call 911
4. Render first aid if trained
5. Report incident immediately

**Equipment Damage:**
1. Mark area unsafe
2. Disable affected equipment
3. Post warning signage
4. Report to supervisor
5. Contact qualified repair service

---

## Maintenance Schedule

### Daily (Operations Team)
- Visual inspection during morning check
- Verify all chargers operational
- Check for physical damage
- Report any issues

### Weekly (Operations Team)
- Test emergency stops
- Clean charger exteriors
- Check cable condition
- Verify signage intact

### Monthly (Maintenance Team)
- Inspect electrical connections
- Test ground fault protection
- Check cable for damage
- Lubricate moving parts if applicable
- Update maintenance log

### Quarterly (Qualified Electrician)
- Full electrical inspection
- Test all safety systems
- Verify proper operation
- Check firmware updates available
- Comprehensive report

### Annually (Qualified Electrician + Inspector)
- Complete system audit
- Electrical safety inspection
- Compliance verification
- Load testing
- Preventive maintenance
- Documentation update

---

## Record Keeping

### Required Records

**Operational Records** (Retain 1 year)
- Daily checklists
- Incident reports
- Support tickets
- Performance metrics

**Financial Records** (Retain 7 years)
- Monthly reports
- Billing records
- Revenue summaries
- Audit trails

**Maintenance Records** (Retain lifetime of equipment)
- Installation documentation
- Maintenance logs
- Repair records
- Inspection reports
- Warranty information

**Compliance Records** (Retain per regulations)
- Safety inspections
- Electrical permits
- Insurance certificates
- Training records

### Documentation Location

- **System Reports:** In-system + shared drive backup
- **Physical Records:** [Location]
- **Digital Archive:** [System/Location]
- **Backup:** [Backup location]

---

## Continuous Improvement

### Weekly Review
- Review KPIs
- Identify issues
- Quick wins implementation
- Update procedures if needed

### Monthly Analysis
- Deep dive into metrics
- Root cause analysis
- Process improvements
- Training needs assessment

### Quarterly Planning
- Strategic review
- Goal setting
- Resource planning
- Technology evaluation

### Annual Review
- Comprehensive assessment
- Lessons learned
- Major improvements
- Budget planning

---

## Appendix

### Quick Reference
- User Training Guide: USER-TRAINING-GUIDE.md
- Charger Onboarding: CHARGER-ONBOARDING-GUIDE.md
- Troubleshooting: TROUBLESHOOTING-GUIDE.md
- EV Driver Guide: EV-DRIVER-QUICK-GUIDE.md

### Contact Directory
- Operations Manager: [Name, Phone, Email]
- Technical Support: [Phone, Email]
- IT Support: [Phone, Email]
- Facilities: [Phone, Email]
- Management: [Phone, Email]
- Emergency: [24/7 Phone]

### System Access
- System URL: [URL]
- Support Portal: [URL]
- Documentation: [URL]

---

**Document Version:** 1.0
**Last Updated:** December 21, 2024
**Next Review:** January 2025
**Owner:** Operations Team
