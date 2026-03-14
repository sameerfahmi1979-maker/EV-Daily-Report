# User Training Guide - EV Charging Management System

## Overview

Welcome to your new EV Charging Management System with OCPP support! This guide will help you understand and effectively use all features of the system, from monitoring chargers to managing billing and generating reports.

**Target Audience:** System administrators, operations staff, facility managers, and billing personnel

**Estimated Training Time:** 2-3 hours for basic proficiency, 1 week for full mastery

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [OCPP Management](#ocpp-management)
4. [Station Management](#station-management)
5. [Operator Management](#operator-management)
6. [Pricing Configuration](#pricing-configuration)
7. [Billing and Reports](#billing-and-reports)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

---

## Getting Started

### Logging In

1. **Navigate** to your system URL (provided by your administrator)
2. **Enter** your email address and password
3. **Click** "Sign In"

**First-Time Login:**
- You will receive login credentials via email
- Change your password immediately after first login
- Use a strong password (at least 12 characters, mix of letters, numbers, symbols)

### System Requirements

**Supported Browsers:**
- Chrome (recommended)
- Firefox
- Safari
- Edge

**Screen Resolution:**
- Minimum: 1280x720
- Recommended: 1920x1080 or higher

**Internet Connection:**
- Stable broadband connection required
- Minimum: 5 Mbps

---

## Dashboard Overview

### Home Dashboard

The home dashboard provides a quick overview of your charging operations.

**Key Metrics Displayed:**
- **Total Stations** - Number of charging locations
- **Active Sessions** - Currently charging vehicles
- **Today's Revenue** - Revenue generated today
- **Energy Delivered** - Total kWh delivered
- **Total Sessions** - Number of charging sessions

**Quick Actions:**
- Import new session data
- View analytics
- Generate reports
- Manage chargers

### Navigation Menu

The system is organized into sections accessible from the left sidebar:

**Operations Section:**
- **Home** - Dashboard overview
- **Stations** - Manage charging locations
- **Operators** - Manage RFID cardholders

**OCPP Management Section:**
- **Live Monitoring** - Real-time charger status
- **Charger Management** - Configure chargers
- **Bulk Registration** - Register multiple chargers
- **Remote Control** - Send commands to chargers
- **Sessions Monitor** - Track charging sessions
- **Message Logs** - View OCPP communications
- **Health & Diagnostics** - System health
- **OCPP Configuration** - Advanced settings

**Pricing Section:**
- **Rate Structures** - Configure pricing
- **Fixed Charges** - Set fees (parking, session, etc.)

**Data Section:**
- **Import** - Upload CSV data (legacy)
- **Billing** - View all sessions and costs
- **Analytics** - Charts and insights
- **Reports** - Generate and export reports

---

## OCPP Management

OCPP (Open Charge Point Protocol) enables real-time management of your ChargeCore Verde chargers.

### Live Monitoring

**Purpose:** Monitor all chargers in real-time

**How to Access:**
- Click "Live Monitoring" in the OCPP Management section

**What You'll See:**

1. **Charger Cards** - One card per charger showing:
   - Charger name and location
   - Connection status (Online/Offline)
   - Each connector's status
   - Current power output
   - Last heartbeat time
   - Firmware version

**Connector Status Colors:**
- **Green** (Available) - Ready for use
- **Blue** (Charging) - Actively charging a vehicle
- **Yellow** (Preparing) - Getting ready to charge
- **Red** (Faulted) - Error condition
- **Gray** (Unavailable) - Offline or disabled

**Common Tasks:**
- **Check charger status** - Verify all chargers online
- **Monitor active sessions** - See which connectors are charging
- **Identify problems** - Quickly spot offline or faulted chargers

**Refresh Data:**
- Page auto-refreshes every 60 seconds
- Or click the refresh button for immediate update

### Charger Management

**Purpose:** Configure and manage individual chargers

**How to Access:**
- Click "Charger Management" in the OCPP Management section

**View All Chargers:**
- List view shows all chargers with key information
- Status indicators show online/offline
- Search and filter options available

**Add New Charger:**
1. Click "Add Charger" button
2. Fill in required information:
   - Charge Point ID (unique identifier)
   - Vendor (ChargeCore Verde)
   - Model
   - Serial Number
   - Firmware Version
3. Add connectors (typically 2 per charger)
4. Link to a station (optional but recommended)
5. Click "Save"

**Edit Existing Charger:**
1. Click on charger in list
2. Click "Edit" button
3. Modify information as needed
4. Click "Save Changes"

**View Charger Details:**
- Click on any charger to see:
  - Complete configuration
  - Connection history
  - Recent sessions
  - Associated station
  - Connector details

### Bulk Registration

**Purpose:** Register multiple chargers at once (for Phase 11)

**How to Access:**
- Click "Bulk Registration" in the OCPP Management section

**Generate Template:**
1. Click "Generate Template"
2. Enter location code (e.g., "LOC001")
3. Enter number of chargers to generate
4. Template creates standard configuration for all chargers

**Manual Entry:**
1. Click "Add Charger" to add one at a time
2. Fill in each charger's details
3. Configure connectors for each

**Register Chargers:**
1. Review all entries for accuracy
2. Click "Register X Charger(s)" button
3. System will create all chargers in database
4. Review results - shows success/failure for each
5. Chargers will appear as "Offline" until they connect

**Export to CSV:**
- Click "Export to CSV" to save configuration
- Useful for documentation and record-keeping

**Tips:**
- Use consistent naming conventions
- Link chargers to stations immediately
- Double-check serial numbers (must be unique)
- Keep exported CSV for reference

### Remote Control

**Purpose:** Send commands to chargers remotely

**How to Access:**
- Click "Remote Control" in the OCPP Management section

**Available Commands:**

**1. Remote Start Transaction**
- Starts a charging session remotely
- Required: Charger, Connector, RFID Card Number
- Use case: Help users who can't start charging

Steps:
1. Select charger and connector
2. Enter RFID card number
3. Click "Remote Start"
4. Charger begins transaction
5. User plugs in vehicle to start charging

**2. Remote Stop Transaction**
- Stops an active charging session
- Required: Transaction ID
- Use case: End stuck sessions, emergency stops

Steps:
1. Select charger
2. Enter transaction ID (from Sessions Monitor)
3. Click "Remote Stop"
4. Session ends and charger returns to Available

**3. Reset Charger**
- Reboots the charger
- Types: Soft (graceful) or Hard (immediate)
- Use case: Fix charger issues, apply updates

Steps:
1. Select charger
2. Choose reset type (Soft recommended)
3. Click "Reset"
4. Charger reboots (30-60 seconds)
5. Verify charger comes back online

**4. Unlock Connector**
- Manually unlocks cable lock
- Use case: Cable stuck, help user disconnect

Steps:
1. Select charger and connector
2. Click "Unlock Connector"
3. Cable releases

**5. Change Configuration**
- Modify charger settings remotely
- Available in OCPP Configuration section
- Use case: Adjust heartbeat, meter intervals, etc.

**Command History:**
- View all sent commands
- See status (Pending, Sent, Accepted, Rejected)
- Review results

**Important Notes:**
- Commands only work when charger is online
- Some commands require charger support
- Failed commands show error message
- Always verify command success

### Sessions Monitor

**Purpose:** Track charging sessions in real-time

**How to Access:**
- Click "Sessions Monitor" in the OCPP Management section

**Active Sessions Tab:**
- Shows currently charging vehicles
- Real-time updates

Information displayed:
- Transaction ID
- Charger and connector
- Operator (RFID card user)
- Start time
- Duration
- Energy consumed so far
- Estimated cost
- Current power

**Recent Sessions Tab:**
- Shows completed sessions
- Sortable and filterable

Information displayed:
- Transaction ID
- Charger location
- Operator name
- Start and end times
- Duration
- Energy consumed
- Final cost
- Stop reason

**Filters:**
- Date range
- Specific charger
- Specific operator
- Minimum/maximum energy

**Search:**
- By transaction ID
- By operator name
- By charger name

**Export:**
- Export filtered sessions to CSV
- Useful for reporting and analysis

**Refresh:**
- Auto-refresh every 30 seconds
- Manual refresh button available

### Message Logs

**Purpose:** View detailed OCPP protocol messages (advanced)

**Who Uses This:** Technical staff, troubleshooting

**How to Access:**
- Click "Message Logs" in the OCPP Management section

**What You'll See:**
- All OCPP messages between server and chargers
- Message type (Call, CallResult, CallError)
- Direction (Incoming from charger, Outgoing to charger)
- Timestamp
- Action (BootNotification, StartTransaction, etc.)
- Full message payload (JSON)

**Filters:**
- Charger
- Message type
- Direction
- Action
- Date/time range

**Common Use Cases:**
- **Debugging issues** - See exact messages during problem
- **Verify commands sent** - Confirm remote commands delivered
- **Audit trail** - Complete history of communications
- **Support** - Share logs with technical support

**Understanding Messages:**
- **BootNotification** - Charger startup/registration
- **Heartbeat** - Keep-alive message (every 60 seconds)
- **Authorize** - RFID card authorization check
- **StartTransaction** - Session start
- **MeterValues** - Ongoing power/energy data
- **StatusNotification** - Connector status change
- **StopTransaction** - Session end

### Health & Diagnostics

**Purpose:** Monitor system health and diagnose problems

**How to Access:**
- Click "Health & Diagnostics" in the OCPP Management section

**Summary Metrics:**
- Total chargers
- Online chargers
- Offline chargers
- Active sessions
- Message error rate
- System uptime

**Per-Charger Diagnostics:**

Select a charger to view:
1. **Connection Info**
   - Last heartbeat
   - Uptime
   - IP address
   - Connection quality

2. **Configuration Keys**
   - All charger settings
   - Current values
   - Last updated

3. **Recent Commands**
   - Commands sent to this charger
   - Success/failure status
   - Timestamps

4. **Recent Messages**
   - Latest OCPP messages
   - Error messages highlighted

5. **Error Log**
   - All errors for this charger
   - Error codes and descriptions
   - When they occurred

**Health Indicators:**
- **Green** - All good
- **Yellow** - Warning (e.g., offline recently)
- **Red** - Problem (e.g., offline now, errors)

**Common Diagnostics:**
- **Charger won't connect** - Check network, configuration
- **Frequent disconnects** - Check heartbeat interval, network stability
- **Sessions not starting** - Check authorization, connector status
- **Billing incorrect** - Verify rate structure, meter values

### OCPP Configuration

**Purpose:** Advanced system configuration (use carefully!)

**Who Uses This:** System administrators, technical staff

**How to Access:**
- Click "OCPP Configuration" in the OCPP Management section

**Configuration Keys:**

Each charger has configuration keys that control behavior.

**Common Configuration Keys:**

1. **HeartbeatInterval** (seconds)
   - How often charger sends heartbeat
   - Typical: 60 seconds
   - Lower = more traffic, better monitoring
   - Higher = less traffic, delayed offline detection

2. **MeterValueSampleInterval** (seconds)
   - How often charger reports power/energy
   - Typical: 60 seconds
   - Lower = more detailed data, more traffic
   - Higher = less detail, less traffic

3. **ClockAlignedDataInterval** (seconds)
   - Time-aligned meter value reporting
   - Typical: 900 seconds (15 minutes)
   - Used for interval billing

4. **AuthorizeRemoteTxRequests** (true/false)
   - Allow remote start commands
   - Must be true for remote start to work

5. **LocalAuthListEnabled** (true/false)
   - Store authorized RFID cards on charger
   - Allows offline operation

**Editing Configuration:**
1. Find configuration key in table
2. Click edit icon (pencil)
3. Enter new value
4. Click save (checkmark)
5. System sends ChangeConfiguration command
6. Charger confirms change
7. New value saved

**Warning:**
- Incorrect configuration can cause problems
- Test changes on one charger first
- Document changes made
- Contact support if unsure

**Firmware Versions:**
- View current firmware for each charger
- Track firmware updates
- Ensure all chargers on compatible versions

**Authorization List:**
- View all operators (RFID cardholders)
- See which cards are authorized
- Add/remove authorized cards

---

## Station Management

### Understanding Stations

**What is a Station?**
- A physical location with one or more chargers
- Examples: "Main Office," "Building A," "North Parking Lot"
- Stations group chargers for billing and reporting

**Why Use Stations?**
- Apply different pricing at different locations
- Generate location-specific reports
- Track performance by location
- Link OCPP chargers to billing rates

### Managing Stations

**View All Stations:**
1. Click "Stations" in Operations section
2. See list of all stations with:
   - Station name
   - Location
   - Number of chargers (if OCPP chargers linked)
   - Associated rate structure
   - Status

**Add New Station:**
1. Click "Add Station" button
2. Enter required information:
   - Station Name (e.g., "Main Office Parking")
   - Station Code (optional, for your reference)
   - Location Address
3. Select rate structure (how you charge at this location)
4. Add notes if needed
5. Click "Save"

**Edit Station:**
1. Click on station in list
2. Click "Edit" button
3. Modify information
4. Click "Save Changes"

**Delete Station:**
1. Click on station
2. Click "Delete" button
3. Confirm deletion
4. Note: Cannot delete station with active chargers or sessions

**Link Station to OCPP Chargers:**
1. Go to Charger Management
2. Edit charger
3. Select station from dropdown
4. Save
5. Charger now uses station's rate structure

---

## Operator Management

### Understanding Operators

**What is an Operator?**
- A person authorized to use the charging stations
- Identified by RFID card number
- Examples: Employees, fleet drivers, customers

**Why Manage Operators?**
- Control who can charge
- Track usage by person
- Generate user-specific reports
- Bill back to departments or customers

### Managing Operators

**View All Operators:**
1. Click "Operators" in Operations section
2. See list with:
   - Name
   - Email
   - RFID Card Number
   - Status (Active/Inactive)
   - Total sessions
   - Total energy used

**Add New Operator:**
1. Click "Add Operator" button
2. Fill in:
   - Full Name
   - Email Address
   - RFID Card Number (from physical card)
   - Phone (optional)
   - Department (optional)
   - Notes (optional)
3. Status: Set to "Active" to allow charging
4. Click "Save"

**Edit Operator:**
1. Click on operator in list
2. Click "Edit" button
3. Modify information
4. Click "Save Changes"

**Deactivate Operator:**
1. Edit operator
2. Change status to "Inactive"
3. Save
4. Operator's RFID card will be rejected at chargers

**View Operator Details:**
- Click on operator to see:
  - Contact information
  - Charging history
  - Total usage statistics
  - Recent sessions

**Important Notes:**
- RFID card numbers must be unique
- Use exact card number (usually on the card)
- Test new card at charger after adding
- Keep operator list up to date

---

## Pricing Configuration

### Rate Structures

**What is a Rate Structure?**
- Defines how you charge for electricity
- Can be simple (flat rate) or complex (time-of-use)
- Applied to stations

**View Rate Structures:**
1. Click "Rate Structures" in Pricing section
2. See all rate structures with:
   - Name
   - Type (Simple/Time-of-Use)
   - Base rate or rate ranges
   - Stations using this structure

**Create Simple Rate Structure:**

Best for: Straightforward pricing (e.g., $0.30/kWh)

1. Click "Add Rate Structure"
2. Enter Name (e.g., "Standard Rate")
3. Choose "Simple" type
4. Enter Base Rate (e.g., 0.30 for $0.30/kWh)
5. Set as default if desired
6. Enter start date and optional end date
7. Click "Save"

**Create Time-of-Use Rate Structure:**

Best for: Different prices at different times

1. Click "Add Rate Structure"
2. Enter Name (e.g., "Peak/Off-Peak")
3. Choose "Time-of-Use" type
4. Add rate periods:

Example periods:
- **Off-Peak** (11 PM - 7 AM): $0.15/kWh
- **Mid-Peak** (7 AM - 4 PM): $0.25/kWh
- **Peak** (4 PM - 9 PM): $0.40/kWh
- **Off-Peak** (9 PM - 11 PM): $0.15/kWh

5. Set start/end dates
6. Click "Save"

**Edit Rate Structure:**
1. Click on rate structure
2. Click "Edit"
3. Modify as needed
4. Save changes
5. Note: Changes apply to future sessions only

**Apply Rate to Station:**
1. Go to Stations
2. Edit station
3. Select rate structure
4. Save
5. All sessions at this station use this rate

### Fixed Charges

**What are Fixed Charges?**
- Fees charged in addition to energy cost
- Examples: Session fee, parking fee, monthly fee

**Types of Fixed Charges:**
- **Per Session** - Flat fee per charging session
- **Per Hour** - Hourly fee (parking, etc.)
- **Monthly** - Recurring monthly charge

**Add Fixed Charge:**
1. Click "Fixed Charges" in Pricing section
2. Click "Add Fixed Charge"
3. Fill in:
   - Charge Name (e.g., "Session Fee")
   - Charge Type (Per Session, Per Hour, Monthly)
   - Amount
   - Station (where this applies)
   - Start Date
   - End Date (optional)
4. Click "Save"

**Examples:**

**Session Fee:** $1.00 per session
- Charge Type: Per Session
- Amount: 1.00

**Parking Fee:** $2.00/hour
- Charge Type: Per Hour
- Amount: 2.00

**Monthly Access:** $20.00/month
- Charge Type: Monthly
- Amount: 20.00

**View Charges:**
- See all fixed charges
- Edit or delete as needed
- View which stations have charges

---

## Billing and Reports

### Viewing Sessions and Billing

**Access Billing:**
1. Click "Billing" in Data section
2. See all charging sessions with costs

**Information Displayed:**
- Transaction ID
- Date and time
- Station/Charger
- Operator
- Duration
- Energy (kWh)
- Rate applied
- Energy cost
- Fixed charges
- Total cost

**Filter Sessions:**
- Date range
- Station
- Operator
- Minimum/maximum cost
- Minimum/maximum energy

**Search:**
- By transaction ID
- By operator name
- By station name

**View Billing Breakdown:**
1. Click on any session
2. See detailed cost calculation:
   - Energy charge breakdown
   - Fixed charges applied
   - Any discounts
   - Final total

**Export Data:**
- Click "Export" button
- Choose format (CSV, Excel)
- Select date range and filters
- Download file

### Analytics Dashboard

**Access Analytics:**
1. Click "Analytics" in Data section
2. Interactive charts and metrics

**Available Analytics:**

**Revenue Overview:**
- Total revenue (today, week, month, year)
- Revenue trends over time
- Revenue by station
- Revenue by operator

**Energy Metrics:**
- Total energy delivered
- Energy trends
- Energy by station
- Energy by time of day

**Session Analytics:**
- Total sessions
- Average session duration
- Session trends
- Sessions by station
- Sessions by operator

**Charger Performance:**
- Utilization rate (% of time charging)
- Sessions per charger
- Energy per charger
- Uptime statistics

**Best Time to Charge:**
- Shows when chargers are busiest
- Helps users find available times
- Identifies peak usage patterns

**Charts Available:**
- Line charts (trends over time)
- Bar charts (comparisons)
- Pie charts (distributions)
- Heatmaps (time-based patterns)

**Date Range Selection:**
- Today
- Last 7 days
- Last 30 days
- Last 90 days
- Custom range

### Generating Reports

**Access Reports:**
1. Click "Reports" in Data section
2. Choose report options

**Report Options:**

**1. Date Range:**
- Select start and end dates
- Predefined ranges available

**2. Filters:**
- Specific stations
- Specific operators
- Minimum energy threshold

**3. Format:**
- CSV (for Excel, data analysis)
- PDF (for printing, sharing)

**Generate Report:**
1. Set date range
2. Apply filters (optional)
3. Choose format
4. Click "Generate Report"
5. Download file

**Report Contents:**
- Summary statistics
- Session listing
- Revenue totals
- Energy totals
- Charts (PDF only)

**Scheduled Reports (Future Feature):**
- Automatic daily/weekly/monthly reports
- Email delivery
- Custom recipients

---

## Common Tasks

### Task: Check Charger Status

**Goal:** Verify all chargers are online and working

**Steps:**
1. Go to OCPP Management > Live Monitoring
2. Review charger cards
3. Check for green "Online" indicators
4. Note any offline or faulted chargers
5. If charger offline, check Health & Diagnostics

**Frequency:** Daily (morning routine)

### Task: Start Charging Session (Remote)

**Goal:** Help user who can't start charging

**Steps:**
1. Get user's RFID card number
2. Go to OCPP Management > Remote Control
3. Select charger and connector
4. Enter RFID card number
5. Click "Remote Start"
6. Tell user to plug in vehicle
7. Verify session starts in Sessions Monitor

**Frequency:** As needed (support request)

### Task: Add New Operator

**Goal:** Give new person access to charge

**Steps:**
1. Get person's information and RFID card
2. Go to Operations > Operators
3. Click "Add Operator"
4. Enter name, email, card number
5. Set status to "Active"
6. Click "Save"
7. Test card at charger (optional)

**Frequency:** As needed (new hires, customers)

### Task: Register New Charger

**Goal:** Add newly installed charger to system

**Steps:**
1. Gather charger information:
   - Charge Point ID
   - Serial Number
   - Location/Station
2. Go to OCPP Management > Charger Management
3. Click "Add Charger"
4. Fill in all details
5. Add 2 connectors (typically)
6. Link to station
7. Click "Save"
8. Follow onboarding guide to configure charger
9. Verify charger connects (appears online)

**Frequency:** When installing new chargers

### Task: Bulk Register Multiple Chargers

**Goal:** Add multiple chargers at once (Phase 11)

**Steps:**
1. Gather information for all chargers
2. Go to OCPP Management > Bulk Registration
3. Click "Generate Template"
4. Enter location code and count
5. Review and adjust details for each charger
6. Verify all information correct
7. Click "Register X Charger(s)"
8. Review results
9. Export to CSV for records

**Frequency:** During expansion, new location setup

### Task: Change Pricing

**Goal:** Update charging rates

**Steps:**
1. Go to Pricing > Rate Structures
2. Option A: Create new rate structure
   - For future effective date
   - Apply to stations when ready
3. Option B: Edit existing rate structure
   - Changes apply immediately to future sessions
   - Past sessions unaffected
4. Communicate changes to users

**Frequency:** As needed (policy changes, seasonal rates)

### Task: Generate Monthly Report

**Goal:** Create summary for management/accounting

**Steps:**
1. Go to Data > Reports
2. Set date range to last month
3. Apply any filters (station, operator)
4. Choose format (PDF for presentation, CSV for Excel)
5. Click "Generate Report"
6. Download and save
7. Distribute as needed

**Frequency:** Monthly (first business day of new month)

### Task: Troubleshoot Charger Not Starting Session

**Goal:** Fix issue preventing charging

**Steps:**
1. Go to OCPP Management > Live Monitoring
2. Check charger status (should be online)
3. Check connector status (should be available)
4. Go to Sessions Monitor
5. Verify no stuck session
6. If stuck session, use Remote Stop
7. Go to Message Logs
8. Check for Authorize message (RFID card)
9. If not authorized, check Operators list
10. Verify operator active
11. Try Remote Start to test
12. If still fails, check Health & Diagnostics
13. May need to reset charger

**Frequency:** As needed (user complaints)

### Task: End Stuck Session

**Goal:** Stop session that won't end normally

**Steps:**
1. Go to OCPP Management > Sessions Monitor
2. Find active session
3. Note Transaction ID
4. Go to Remote Control
5. Select charger
6. Choose "Remote Stop Transaction"
7. Enter Transaction ID
8. Click "Remote Stop"
9. Verify session ends in Sessions Monitor
10. Verify billing calculated

**Frequency:** As needed (few times per month)

### Task: Monitor Daily Operations

**Goal:** Ensure system running smoothly

**Morning Routine:**
1. Go to OCPP Management > Live Monitoring
2. Verify all chargers online
3. Note any offline chargers for follow-up
4. Go to Sessions Monitor
5. Review overnight sessions
6. Check for any errors
7. Go to Health & Diagnostics
8. Check error log for issues
9. Address any problems found

**Frequency:** Daily (every morning)

---

## Troubleshooting

### Problem: Can't Log In

**Symptoms:** Login fails, wrong password error

**Solutions:**
1. Verify email address correct
2. Check Caps Lock off
3. Try "Forgot Password" link
4. Clear browser cache and cookies
5. Try different browser
6. Contact administrator for password reset

### Problem: Charger Shows Offline

**Symptoms:** Charger card shows red "Offline" status

**Diagnosis:**
1. Go to Health & Diagnostics
2. Select charger
3. Check last heartbeat time
4. If recent (< 5 min): Temporary network issue
5. If old (> 5 min): Connection problem

**Solutions:**
1. Check charger power (is it on?)
2. Check network connection (cable plugged in? WiFi signal?)
3. Try resetting charger (Remote Control > Reset)
4. If persists, check OCPP server status
5. Contact technical support

### Problem: Session Won't Start

**Symptoms:** User scans RFID card but charging doesn't begin

**Diagnosis:**
1. Check charger online (Live Monitoring)
2. Check connector available (not faulted)
3. Check operator authorized (Operators list)
4. Check vehicle properly connected

**Solutions:**
1. If charger offline: Fix connection issue
2. If connector faulted: Reset charger or clear fault
3. If operator inactive: Activate operator
4. If operator not found: Add operator with correct RFID
5. Try Remote Start to bypass card issue
6. Check vehicle charging port (may be vehicle issue)

### Problem: Session Won't Stop

**Symptoms:** Vehicle unplugged but session still shows active

**Solutions:**
1. Use Remote Stop (see Common Tasks)
2. If Remote Stop fails, reset charger
3. Manually end session in database (last resort, contact support)
4. Verify billing calculated after ending

### Problem: Incorrect Billing

**Symptoms:** Session cost doesn't match expectations

**Diagnosis:**
1. Go to Billing
2. Click on session
3. View billing breakdown
4. Check rate applied
5. Check fixed charges
6. Compare to rate structure

**Solutions:**
1. If wrong rate: Verify station's rate structure
2. If wrong station: Update charger's station link
3. If rate changed mid-session: Expected (start rate applies)
4. If calculation error: Contact support
5. Can manually adjust if needed (document reason)

### Problem: Dashboard Not Loading

**Symptoms:** Blank page, spinner forever, errors

**Solutions:**
1. Check internet connection
2. Refresh page (Ctrl+R or Cmd+R)
3. Clear browser cache
4. Try incognito/private window
5. Try different browser
6. Check browser console for errors (F12)
7. Contact support if persists

### Problem: Data Not Updating

**Symptoms:** Dashboard shows old data, won't refresh

**Solutions:**
1. Click manual refresh button
2. Hard refresh page (Ctrl+Shift+R)
3. Check internet connection
4. Wait a minute and try again
5. Log out and log back in
6. Clear browser cache

### Problem: Can't Send Remote Command

**Symptoms:** Remote command fails or stays pending

**Diagnosis:**
1. Check charger online
2. Check command history for error message
3. Check Message Logs for command

**Solutions:**
1. If charger offline: Wait for reconnection or fix connection
2. If command rejected: Check charger supports this command
3. If command timeout: Charger may not have received it
4. Try again after verifying charger online

### Problem: Missing Sessions

**Symptoms:** Expected session not showing in Sessions Monitor

**Diagnosis:**
1. Check date range filter
2. Check station filter
3. Check operator filter
4. Search by transaction ID

**Solutions:**
1. Expand date range
2. Clear filters
3. Check if session in Billing instead
4. Verify charger recorded session (Message Logs)
5. If truly missing, contact support

---

## Best Practices

### Daily Operations

**Start of Day:**
- [ ] Check all chargers online (Live Monitoring)
- [ ] Review overnight sessions (Sessions Monitor)
- [ ] Check for errors (Health & Diagnostics)
- [ ] Address any offline chargers immediately

**During Day:**
- [ ] Monitor for support requests
- [ ] Respond to user issues promptly
- [ ] Keep operator list updated
- [ ] Note any recurring problems

**End of Day:**
- [ ] Review day's sessions (Sessions Monitor)
- [ ] Verify all sessions closed properly
- [ ] Check revenue matches expectations (Analytics)
- [ ] Document any issues and resolutions

### Weekly Operations

**Monday:**
- [ ] Review previous week's analytics
- [ ] Set goals for current week
- [ ] Plan any maintenance

**Mid-Week:**
- [ ] Check charging patterns
- [ ] Identify busy times
- [ ] Adjust operations if needed

**Friday:**
- [ ] Generate weekly summary report
- [ ] Review operator activity
- [ ] Check equipment health
- [ ] Plan next week

### Monthly Operations

**Beginning of Month:**
- [ ] Generate previous month report
- [ ] Review revenue vs. targets
- [ ] Submit to accounting/management
- [ ] Plan next month

**Mid-Month:**
- [ ] Review rate structures
- [ ] Check for needed price updates
- [ ] Review operator list (remove inactive)

**End of Month:**
- [ ] Prepare for month-end close
- [ ] Verify all sessions billed
- [ ] Check for anomalies

### Charger Management

**Keep Chargers Updated:**
- Monitor firmware versions
- Plan coordinated updates
- Test updates on one charger first
- Document changes

**Maintain Accurate Information:**
- Keep charger details current
- Link all chargers to stations
- Document any issues in notes
- Track maintenance history

**Monitor Health:**
- Check Health & Diagnostics weekly
- Address warnings promptly
- Track uptime statistics
- Identify problem chargers

### Operator Management

**Keep List Current:**
- Add new operators promptly
- Deactivate departing users immediately
- Update information as it changes
- Review list monthly for cleanup

**Naming Conventions:**
- Use full real names
- Include department or ID
- Consistent format
- Easy to search

**Communication:**
- Welcome email to new operators
- Instructions for using chargers
- Who to contact for support
- Pricing information

### Pricing Management

**Rate Structure Best Practices:**
- Use clear, descriptive names
- Document rate reasoning
- Set future effective dates for changes
- Notify users before changes
- Keep historical rates in system

**Fixed Charges:**
- Clearly communicate all fees
- Post at charging locations
- Include in reports
- Review periodically for relevance

### Data Management

**Regular Backups:**
- System backs up automatically (Supabase)
- Export monthly data for local backup
- Keep reports for audit trail
- Document in case of data questions

**Data Quality:**
- Review sessions for anomalies
- Address data issues immediately
- Keep historical data clean
- Document any manual adjustments

### Security

**Account Security:**
- Use strong passwords
- Change passwords regularly
- Don't share credentials
- Log out when done

**Access Control:**
- Only give access to those who need it
- Use appropriate permission levels
- Review access periodically
- Remove access promptly when no longer needed

**Data Privacy:**
- Protect user information
- Follow privacy policies
- Don't share sensitive data
- Comply with regulations (GDPR, etc.)

### Documentation

**Keep Records:**
- Document configuration changes
- Save monthly reports
- Note recurring issues
- Track maintenance

**Communication Log:**
- Log support requests
- Track resolutions
- Identify patterns
- Share learnings with team

### User Support

**Be Responsive:**
- Monitor for support requests
- Respond within 1 hour if possible
- Keep users informed of progress
- Follow up after resolution

**Be Proactive:**
- Communicate outages in advance
- Announce price changes early
- Share tips for users
- Provide self-service resources

**Build Knowledge:**
- Learn from each support case
- Update documentation
- Share with team
- Continuous improvement

---

## Training Checklist

Use this checklist to track your training progress:

### Module 1: Getting Started
- [ ] Successfully logged in
- [ ] Changed initial password
- [ ] Navigated all menu sections
- [ ] Located key features

### Module 2: OCPP Management
- [ ] Viewed Live Monitoring
- [ ] Added a charger
- [ ] Edited charger details
- [ ] Used Bulk Registration
- [ ] Sent Remote Start command
- [ ] Sent Remote Stop command
- [ ] Viewed Sessions Monitor
- [ ] Filtered sessions
- [ ] Viewed Message Logs
- [ ] Checked Health & Diagnostics
- [ ] Modified configuration key

### Module 3: Operations
- [ ] Added a station
- [ ] Edited station
- [ ] Added an operator
- [ ] Deactivated an operator
- [ ] Viewed operator details

### Module 4: Pricing
- [ ] Created simple rate structure
- [ ] Created time-of-use rate structure
- [ ] Applied rate to station
- [ ] Added fixed charge

### Module 5: Billing and Reports
- [ ] Viewed billing data
- [ ] Filtered sessions
- [ ] Viewed billing breakdown
- [ ] Accessed analytics
- [ ] Generated report in CSV
- [ ] Generated report in PDF

### Module 6: Troubleshooting
- [ ] Diagnosed offline charger
- [ ] Fixed stuck session
- [ ] Helped user with authorization issue
- [ ] Reset charger

### Module 7: Best Practices
- [ ] Completed daily routine
- [ ] Generated weekly report
- [ ] Maintained operator list
- [ ] Reviewed pricing

**Training Completion Date:** _______________

**Trainer Name:** _______________

**Trainee Name:** _______________

**Trainee Signature:** _______________

---

## Quick Reference

### Key URLs
- Login: [Your system URL]
- Support: [Support email/phone]
- Documentation: [Docs URL]

### Common Tasks Quick Links
- **Check chargers:** OCPP Management > Live Monitoring
- **Remote start:** OCPP Management > Remote Control
- **View sessions:** OCPP Management > Sessions Monitor
- **Add operator:** Operations > Operators > Add
- **Generate report:** Data > Reports

### Keyboard Shortcuts
- **Refresh page:** Ctrl+R (Cmd+R on Mac)
- **Hard refresh:** Ctrl+Shift+R
- **Search:** Ctrl+F
- **Open console:** F12

### Support Contacts
- **Technical Support:** [Email/Phone]
- **Billing Questions:** [Email/Phone]
- **Emergency:** [Emergency Contact]

---

## Appendix

### Glossary

**OCPP** - Open Charge Point Protocol, industry standard for charger communication

**Charger** - Physical charging station hardware

**Connector** - Individual charging port (chargers typically have 2)

**Session** - One complete charging event from start to finish

**Transaction** - OCPP term for session, includes unique ID

**Operator** - Person authorized to use chargers (RFID cardholder)

**RFID** - Radio-Frequency Identification, used for access cards

**kWh** - Kilowatt-hour, unit of energy

**kW** - Kilowatt, unit of power

**Rate Structure** - Pricing configuration

**Fixed Charge** - Non-energy fee (session fee, parking, etc.)

**Heartbeat** - Periodic message from charger to server

**Meter Values** - Energy and power measurements from charger

**Status Notification** - Connector status update message

**Remote Command** - Instruction sent from server to charger

**Configuration Key** - Charger setting parameter

### Resources

**OCPP Specification:**
- [OCPP 1.6J Documentation](https://www.openchargealliance.org/)

**ChargeCore Verde:**
- [Manufacturer Support](https://www.chargecore.com/)
- [User Manual](link)

**System Documentation:**
- [Technical Documentation](link)
- [API Documentation](link)
- [Video Tutorials](link)

### Training Resources

**Video Tutorials:**
- Getting Started (10 minutes)
- OCPP Management Overview (15 minutes)
- Remote Commands Demo (8 minutes)
- Billing and Reports (12 minutes)

**Interactive Guides:**
- Hands-on practice environment
- Sample data for learning
- Step-by-step walkthroughs

**Support:**
- Live training sessions available
- One-on-one coaching
- Team training workshops

---

## Conclusion

This guide covers all essential functionality of your EV Charging Management System. With practice, you'll become proficient in managing chargers, operators, pricing, and billing.

**Remember:**
- Start with basic tasks and build confidence
- Use the troubleshooting section when issues arise
- Follow best practices for optimal results
- Don't hesitate to contact support when needed

**Next Steps:**
1. Complete the training checklist
2. Practice with sample data
3. Shadow experienced user
4. Take on daily operations
5. Gradually expand responsibilities

**Welcome to the future of EV charging management!**

---

**Document Version:** 1.0
**Last Updated:** December 21, 2024
**Next Review:** January 2025

**Questions or Feedback:**
Contact: [Training Team Email]
