# ChargeCore Verde Charger Onboarding Guide

## Overview

This document provides step-by-step procedures for onboarding ChargeCore Verde OCPP chargers to your EV charging management system. Follow these instructions carefully for each charger deployment.

---

## Pre-Onboarding Requirements

### System Readiness

- [ ] Integration testing completed successfully
- [ ] OCPP server deployed and running
- [ ] WebSocket endpoint accessible
- [ ] SSL certificate valid
- [ ] Database ready and performant
- [ ] All dashboards tested
- [ ] Operations team trained

### Charger Requirements

- [ ] ChargeCore Verde charger received
- [ ] Power supply verified (adequate capacity)
- [ ] Network connectivity available (Ethernet or 4G)
- [ ] Installation location prepared
- [ ] Mounting hardware available
- [ ] Electrical permits obtained

### Information Gathering

Before beginning onboarding, collect:

**Required Information:**
1. **Charge Point ID** - Unique identifier (e.g., "CV-LOC001-CP01")
2. **Serial Number** - From charger label
3. **Firmware Version** - Check charger display or documentation
4. **Model Number** - ChargeCore Verde model
5. **Network Details:**
   - IP address (if static)
   - MAC address
   - SIM card details (if 4G)
6. **Location Details:**
   - Physical address
   - GPS coordinates (if available)
   - Station association (if applicable)
7. **Power Specifications:**
   - Max power per connector (typically 22 kW)
   - Connector types (Type 2, CCS, etc.)
   - Number of connectors (typically 2)

---

## Phase 1: Physical Installation

### Step 1.1: Site Preparation

1. **Verify Power Supply**
   - Confirm adequate electrical capacity
   - Check circuit breaker sizing
   - Verify grounding
   - Test voltage and phase balance

2. **Network Preparation**
   - Run Ethernet cable (if wired)
   - Test network connectivity
   - Configure static IP (if required)
   - Open required ports (443 for WSS)
   - OR insert and activate SIM card (if 4G)

3. **Mounting Location**
   - Clear installation area
   - Verify ADA compliance (if applicable)
   - Ensure good cell signal (if 4G)
   - Check for weather protection

### Step 1.2: Physical Installation

1. **Mount Charger**
   - Follow manufacturer mounting instructions
   - Use appropriate anchors for wall type
   - Ensure level installation
   - Allow clearance for cables

2. **Electrical Connection**
   - **⚠️ DANGER: High Voltage - Licensed Electrician Required**
   - Connect to dedicated circuit
   - Verify proper grounding
   - Test voltage before connecting charger
   - Connect charger following wiring diagram
   - Secure all connections

3. **Network Connection**
   - Connect Ethernet cable (if wired)
   - Verify link light activity
   - OR verify SIM card installed (if 4G)
   - Test connectivity with ping

4. **Initial Power-On**
   - Close and secure charger enclosure
   - Enable circuit breaker
   - Observe charger startup sequence
   - Check for error indicators
   - Record any startup messages

### Step 1.3: Physical Verification

- [ ] Charger powers on successfully
- [ ] Display shows normal status
- [ ] No error lights illuminated
- [ ] Network connection established
- [ ] Connectors properly seated
- [ ] Emergency stop functional (test)
- [ ] RFID reader responds to card
- [ ] All physical connections secure

---

## Phase 2: Charger Configuration

### Step 2.1: Access Charger Configuration

**Method 1: Charger Display (if available)**
1. Access configuration menu
2. Navigate to Settings
3. Find OCPP Configuration

**Method 2: Web Interface**
1. Connect to charger's IP address
2. Login with admin credentials
3. Navigate to OCPP settings

**Method 3: Configuration Tool**
1. Use ChargeCore Verde configuration utility
2. Connect via USB or network
3. Open OCPP settings

### Step 2.2: Configure OCPP Settings

**Required Configuration:**

1. **OCPP Server URL**
   ```
   wss://your-ocpp-server.com/ocpp/[CHARGE_POINT_ID]
   ```
   - Replace `your-ocpp-server.com` with your domain
   - Replace `[CHARGE_POINT_ID]` with unique identifier
   - Example: `wss://ocpp.mycompany.com/ocpp/CV-LOC001-CP01`

2. **Protocol Version**
   - Set to: `OCPP 1.6J`
   - (Or `OCPP 2.0` if supported and desired)

3. **Security Profile**
   - Enable: `TLS/SSL`
   - Certificate validation: `Enabled`
   - Use secure connection: `Yes`

4. **Authentication** (if required by server)
   - Basic Auth username: (if using basic auth)
   - Basic Auth password: (if using basic auth)
   - Client certificate: (if using cert-based auth)

5. **Heartbeat Interval**
   - Set to: `60` seconds (recommended starting point)
   - Can be adjusted later via ChangeConfiguration

6. **Connection Settings**
   - Auto-reconnect: `Enabled`
   - Reconnect interval: `30` seconds
   - Maximum reconnect attempts: `Unlimited` or high number

7. **Clock Sync**
   - Enable NTP: `Yes`
   - NTP server: (use reliable NTP server)
   - Timezone: (set to local timezone)

8. **Authorization Settings**
   - Authorization cache: `Enabled`
   - Offline authorization: `Local list` (if supported)
   - Remote authorization: `Required`

### Step 2.3: Save and Apply Configuration

1. **Save Settings**
   - Save configuration to charger
   - Verify all settings saved correctly
   - Export configuration backup

2. **Reboot Charger**
   - Perform graceful reboot
   - Or power cycle if required
   - Wait for complete startup

3. **Verify Boot Sequence**
   - Watch startup messages
   - Check for configuration errors
   - Verify network connection
   - Observe OCPP connection attempt

---

## Phase 3: System Registration

### Step 3.1: Pre-Register in Management System

**Before charger connects, pre-register it:**

1. **Login to Management System**
   - Navigate to OCPP Management > Charger Management
   - Click "Add Charger"

2. **Enter Charger Details**
   ```
   Charge Point ID: CV-LOC001-CP01
   Vendor: ChargeCore Verde
   Model: [Model Number]
   Serial Number: [From Label]
   Firmware Version: [Current Version]
   Protocol Version: 1.6J
   Registration Status: Pending
   Connection Status: Offline
   ```

3. **Add Location Information**
   ```
   Station: [Link to existing station if applicable]
   Latitude: [GPS Coordinate]
   Longitude: [GPS Coordinate]
   Installation Date: [Today's Date]
   IP Address: [If static]
   ```

4. **Add Network Information** (in notes if needed)
   ```
   ICCID: [SIM Card Number] (if 4G)
   IMSI: [Mobile Identity] (if 4G)
   MAC Address: [Network MAC]
   ```

5. **Add Connectors**
   ```
   Connector 1:
     - Connector ID: 1
     - Type: Type2
     - Power: 22 kW
     - Status: Unknown (will update on connect)

   Connector 2:
     - Connector ID: 2
     - Type: Type2
     - Power: 22 kW
     - Status: Unknown (will update on connect)
   ```

6. **Save Charger**
   - Click "Create Charger"
   - Verify charger appears in list
   - Status should show "Offline"

### Step 3.2: First Connection

**Monitor for BootNotification:**

1. **Watch Message Logs**
   - Navigate to OCPP Management > Message Logs
   - Filter to show Incoming messages
   - Watch for BootNotification

2. **Expected First Messages:**
   ```
   1. BootNotification (Incoming)
      - chargePointVendor: ChargeCore Verde
      - chargePointModel: [Model]
      - chargePointSerialNumber: [Serial]
      - firmwareVersion: [Version]

   2. BootNotification Response (Outgoing)
      - status: Accepted
      - currentTime: [Server Time]
      - interval: 60 (heartbeat interval)
   ```

3. **Verify Registration**
   - Registration Status changes to "Accepted"
   - Connection Status changes to "Online"
   - Last Heartbeat shows current time
   - Vendor/Model/Serial auto-populated

4. **Watch for Status Notifications**
   ```
   StatusNotification for each connector:
   - Connector 1: Available or Unavailable
   - Connector 2: Available or Unavailable
   ```

### Step 3.3: Verify Initial Status

**Check Live Monitoring Dashboard:**

1. **Charger Card Should Show:**
   - Green "Online" indicator
   - Correct model and serial number
   - Last heartbeat: "Just now" or "<1 minute ago"
   - Firmware version

2. **Connector Status:**
   - Both connectors visible
   - Status: "Available" (if ready to charge)
   - No error codes
   - Power capacity shown

3. **Health Indicators:**
   - All green check marks
   - No warnings
   - Communication normal

---

## Phase 4: Configuration Verification

### Step 4.1: Request Configuration

1. **Navigate to OCPP Configuration**
   - Go to OCPP Management > OCPP Configuration
   - Select newly onboarded charger
   - Configuration Keys section

2. **Refresh Configuration**
   - Click "Refresh" button
   - Wait for GetConfiguration command
   - Wait 3-5 seconds for response

3. **Verify Keys Retrieved**
   - Should see 20-50 configuration keys
   - Common keys include:
     - `HeartbeatInterval`
     - `MeterValueSampleInterval`
     - `ClockAlignedDataInterval`
     - `ConnectionTimeOut`
     - `AuthorizeRemoteTxRequests`
     - Many others

4. **Review Important Settings**
   ```
   HeartbeatInterval: 60 (or your desired value)
   MeterValueSampleInterval: 60 (data reporting frequency)
   ClockAlignedDataInterval: 900 (aligned meter values)
   AuthorizeRemoteTxRequests: true (for remote start)
   LocalAuthListEnabled: true (if using local list)
   ```

### Step 4.2: Adjust Key Settings (if needed)

**Recommended Initial Settings:**

1. **Heartbeat Interval**
   - Value: `60` seconds
   - Keeps connection alive
   - Not too frequent to cause overhead

2. **Meter Value Sample Interval**
   - Value: `60` seconds
   - Balance between data granularity and traffic
   - Can adjust based on needs

3. **Authorize Remote Tx Requests**
   - Value: `true`
   - Required for remote start functionality

4. **Clock Aligned Data Interval**
   - Value: `900` seconds (15 minutes)
   - Provides time-aligned meter values

**To Change a Setting:**
1. Find key in Configuration Keys table
2. Click Edit icon
3. Enter new value
4. Click Save
5. Wait for ChangeConfiguration command
6. Verify "Accepted" response
7. Confirm new value updated

### Step 4.3: Test Configuration Changes

**Verify charger accepts and applies changes:**

1. Change a non-critical value
2. Wait for confirmation
3. Refresh configuration
4. Verify change persisted
5. Restore original value if testing

---

## Phase 5: Functional Testing

### Step 5.1: Create Test Operator

**If not already created:**

1. **Navigate to Operators**
   - Go to Operations > Operators
   - Click "Add Operator"

2. **Create Test Operator**
   ```
   Name: Test User
   Email: test@company.com
   RFID Card: [Test RFID Number]
   Status: Active
   Notes: For charger testing
   ```

3. **Save and Verify**
   - Operator appears in list
   - Status: Active
   - RFID number recorded

### Step 5.2: Test RFID Authorization

**Physical Test:**

1. **Present RFID Card**
   - Place test RFID card on reader
   - Wait for charger response
   - Should show "Authorized" or green light

2. **Monitor Backend**
   - Check Message Logs
   - Should see Authorize message:
     ```
     Authorize (Incoming)
     - idTag: [Test RFID Number]

     Authorize Response (Outgoing)
     - idTagInfo.status: Accepted
     ```

3. **If Rejected:**
   - Verify RFID number matches exactly
   - Check operator status is Active
   - Review authorization service logs
   - Test with different card if available

### Step 5.3: Test Charging Session

**Complete Session Flow:**

1. **Start Session**
   - Present RFID card
   - Plug in vehicle (or test load)
   - Wait for charging to begin
   - LED should indicate charging

2. **Monitor Session Start**
   - Check Sessions Monitor dashboard
   - Should see new active session:
     ```
     Transaction ID: [Auto-assigned]
     Operator: Test User
     Charger: CV-LOC001-CP01
     Connector: 1 (or 2)
     Status: Active
     Start Time: [Current Time]
     Start Meter: [Wh value]
     ```

3. **Observe During Charging**
   - Check Live Monitoring
   - Connector status: "Charging"
   - Power value updating
   - Energy accumulating
   - No errors

4. **Check Meter Values**
   - Navigate to Sessions Monitor
   - Click on active session
   - View meter values
   - Should see periodic updates:
     ```
     Energy: Increasing Wh value
     Power: Current kW (if vehicle drawing power)
     Voltage, Current (if reported)
     ```

5. **Stop Session**
   - Remove vehicle plug (or test load)
   - Or present RFID card again
   - Wait for session to end

6. **Monitor Session End**
   - Check Sessions Monitor
   - Session should change to "Completed":
     ```
     End Time: [Current Time]
     End Meter: [Final Wh value]
     Energy Consumed: [Calculated kWh]
     Duration: [Minutes]
     Cost: [Calculated based on rates]
     ```

7. **Verify Billing**
   - Check calculated cost
   - Verify rate applied correctly
   - Confirm energy calculation accurate
   - Review billing breakdown

### Step 5.4: Test Remote Commands

**Remote Start:**

1. **Initiate Remote Start**
   - Go to Remote Control dashboard
   - Select charger and connector
   - Choose "Remote Start Transaction"
   - Enter test RFID number
   - Click "Send Command"

2. **Verify Execution**
   - Check command status: "Sent" → "Accepted"
   - Plug in vehicle
   - Charging should begin automatically
   - Session appears in Sessions Monitor

**Remote Stop:**

1. **Initiate Remote Stop**
   - During active session
   - Go to Remote Control
   - Select "Remote Stop Transaction"
   - Enter transaction ID
   - Click "Send Command"

2. **Verify Execution**
   - Command status: "Sent" → "Accepted"
   - Charging stops
   - Session completes
   - Vehicle can be unplugged

**Unlock Connector:**

1. **Test Unlock**
   - Select "Unlock Connector"
   - Choose connector
   - Send command

2. **Verify**
   - Command accepted
   - Connector releases if locked
   - No errors

### Step 5.5: Test Error Handling

**Connector Error Simulation (if possible):**

1. **Create Error Condition**
   - May require manufacturer tool
   - Or wait for natural error

2. **Verify Error Reporting**
   - Check Live Monitoring
   - Connector should show "Faulted"
   - Error code visible
   - Health dashboard shows error

3. **Clear Error**
   - Resolve error condition
   - Reset if needed
   - Verify status returns to "Available"

---

## Phase 6: Integration Verification

### Step 6.1: Station Linkage (if applicable)

**Link to Existing Station:**

1. **Update Charger**
   - Edit charger in Charger Management
   - Select appropriate Station
   - Save changes

2. **Verify Linkage**
   - Sessions now associated with station
   - Billing uses station-specific rates
   - Reports include station context

### Step 6.2: Rate Structure Verification

**Ensure correct rates applied:**

1. **Check Rate Assignment**
   - Verify station has rate structure
   - Or default rates in place
   - Rates active and valid

2. **Test Billing Calculation**
   - Complete test session
   - Verify cost calculated correctly
   - Check rate structure applied
   - Confirm time-based rates work (if applicable)

### Step 6.3: Reporting Integration

**Verify data flows to reports:**

1. **Check Analytics**
   - Sessions appear in analytics
   - Energy totals updating
   - Revenue calculated
   - Charger included in metrics

2. **Generate Test Report**
   - Create date range report
   - Include test sessions
   - Verify data accuracy
   - Confirm charger data included

---

## Phase 7: Production Readiness

### Step 7.1: Final Configuration

**Optimize for Production:**

1. **Review All Settings**
   - Heartbeat interval appropriate
   - Meter value frequency reasonable
   - Authorization settings correct
   - Time sync working

2. **Set Descriptive Names**
   - Update charger name/description
   - Add helpful notes
   - Document any special considerations

3. **Configure Alerts** (if available)
   - Offline notifications
   - Error alerts
   - Session anomaly detection

### Step 7.2: Documentation

**Document Charger Deployment:**

1. **Installation Record**
   ```
   Charger: CV-LOC001-CP01
   Location: [Address]
   Installed: [Date]
   Installed By: [Technician Name]
   Power Circuit: [Breaker Number]
   Network: [IP or SIM]
   Tests Completed: [Date]
   Status: Production Ready
   ```

2. **Configuration Backup**
   - Export configuration settings
   - Save to documentation system
   - Include OCPP URL and parameters

3. **Photos**
   - Installation location
   - Charger serial number label
   - Electrical connections (before closing)
   - Network connections
   - Final installed state

### Step 7.3: User Communication

**Inform Stakeholders:**

1. **Operations Team**
   - Charger now operational
   - Location and access details
   - Monitoring procedures
   - Escalation contacts

2. **End Users** (if applicable)
   - New charger available
   - Location and how to use
   - Pricing information
   - Support contact

3. **Management**
   - Deployment complete
   - Testing successful
   - Charger in production
   - Next steps

---

## Phase 8: Monitoring Period

### First 24 Hours

**Intensive Monitoring:**

- [ ] Check connectivity every 2 hours
- [ ] Monitor all sessions
- [ ] Review all error messages
- [ ] Verify billing accuracy
- [ ] Test remote commands
- [ ] Check performance metrics

**Watch For:**
- Connection drops
- Authentication failures
- Session start/stop issues
- Billing calculation errors
- Performance degradation
- User complaints

### First Week

**Daily Checks:**

- [ ] Review daily session count
- [ ] Check error log
- [ ] Verify uptime >98%
- [ ] Confirm billing working
- [ ] Monitor user feedback

### First Month

**Weekly Reviews:**

- [ ] Analyze usage patterns
- [ ] Review performance trends
- [ ] Check for recurring issues
- [ ] Optimize configuration if needed
- [ ] Plan preventive maintenance

---

## Troubleshooting Common Issues

### Issue: Charger Won't Connect

**Symptoms:** Charger stays offline, no BootNotification

**Checks:**
1. Verify network connectivity (ping OCPP server)
2. Check OCPP URL configured correctly
3. Verify SSL/TLS certificate valid
4. Check firewall rules allow outbound 443
5. Review charger logs for errors
6. Verify charge point ID matches

**Solutions:**
- Correct OCPP URL if wrong
- Update SSL certificate if expired
- Open firewall port 443 outbound
- Reboot charger after changes

### Issue: Authentication Failures

**Symptoms:** RFID cards rejected, authorization denied

**Checks:**
1. Verify operator exists and active
2. Check RFID number matches exactly
3. Review Authorize message logs
4. Check authorization service working

**Solutions:**
- Update RFID number if mismatch
- Activate operator if inactive
- Verify no typos in RFID number
- Check operator linked to correct user

### Issue: Sessions Not Starting

**Symptoms:** RFID accepted but charging doesn't begin

**Checks:**
1. Verify connector status "Available"
2. Check if remote start required
3. Review StartTransaction messages
4. Check meter values initializing

**Solutions:**
- Reset connector if faulted
- Present RFID card correctly
- Check vehicle charging compatibility
- Verify power supply adequate

### Issue: Sessions Not Ending

**Symptoms:** Session continues after unplug, or won't stop

**Checks:**
1. Check if plug still connected
2. Review StopTransaction messages
3. Verify meter values stopping
4. Check session status in database

**Solutions:**
- Ensure vehicle properly unplugged
- Present RFID card to stop
- Use remote stop if needed
- Contact support if persistent

### Issue: Billing Incorrect

**Symptoms:** Session cost wrong or missing

**Checks:**
1. Verify station has rate structure
2. Check energy calculation
3. Review meter start/stop values
4. Confirm rate applied correctly

**Solutions:**
- Link to station with rates
- Recalculate billing if needed
- Verify rate structure dates valid
- Check for fixed charges

### Issue: Poor Connectivity

**Symptoms:** Frequent disconnections, missed heartbeats

**Checks:**
1. Check network signal strength (if 4G)
2. Verify network stability
3. Review heartbeat interval
4. Check for network congestion

**Solutions:**
- Improve network signal (antenna, relocate)
- Switch to Ethernet if possible
- Adjust heartbeat interval
- Check for network issues

---

## Onboarding Checklist

### Pre-Installation
- [ ] Site prepared and ready
- [ ] Power supply verified adequate
- [ ] Network connectivity confirmed
- [ ] Required information collected
- [ ] Permits obtained
- [ ] Tools and materials ready

### Installation
- [ ] Charger mounted securely
- [ ] Electrical connections complete
- [ ] Grounding verified
- [ ] Network connected
- [ ] Charger powers on
- [ ] No error indicators

### Configuration
- [ ] OCPP URL configured
- [ ] Protocol version set
- [ ] Security enabled
- [ ] Heartbeat interval set
- [ ] Clock sync configured
- [ ] Settings saved and applied

### Registration
- [ ] Charger pre-registered in system
- [ ] Connectors added
- [ ] BootNotification received
- [ ] Registration accepted
- [ ] Connection status online
- [ ] Configuration retrieved

### Testing
- [ ] Test operator created
- [ ] RFID authorization works
- [ ] Charging session completes
- [ ] Billing calculates correctly
- [ ] Remote start works
- [ ] Remote stop works
- [ ] Error handling verified

### Integration
- [ ] Station linked (if applicable)
- [ ] Rate structure verified
- [ ] Reporting confirmed
- [ ] Analytics updated
- [ ] Alerts configured

### Production
- [ ] Final configuration set
- [ ] Documentation complete
- [ ] Photos taken
- [ ] Stakeholders notified
- [ ] Monitoring initiated
- [ ] Sign-off obtained

### Sign-Off

**Charger ID:** _____________________

**Installation Date:** _____________________

**Tested By:** _____________________ Date: _____

**Approved By:** _____________________ Date: _____

**Status:** ☐ Production Ready ☐ Issues Found (see notes)

**Notes:** ________________________________________
_________________________________________________
_________________________________________________

---

## Next Charger

Once first charger is successfully onboarded:

1. **Document Lessons Learned**
   - What went well
   - What could be improved
   - Time required
   - Common issues

2. **Refine Process**
   - Update procedures
   - Streamline steps
   - Create checklists
   - Train additional team members

3. **Schedule Remaining Chargers**
   - Plan deployment calendar
   - Allocate resources
   - Coordinate with stakeholders
   - Pace appropriately (not too fast)

4. **Scale Operations**
   - Consider parallel onboarding
   - Assign team members
   - Monitor overall fleet
   - Maintain documentation

---

## Support Contacts

**Technical Support:**
- OCPP System: [Your Team Contact]
- Charger Hardware: ChargeCore Verde Support
- Network/Connectivity: [ISP/Network Provider]

**Escalation:**
- Critical Issues: [On-Call Contact]
- After Hours: [Emergency Contact]
- Management: [Manager Contact]

**Documentation:**
- System Documentation: [Link]
- ChargeCore Manual: [Link]
- OCPP Specification: [Link]

---

## Success Criteria

Charger is considered successfully onboarded when:

✅ All checklist items completed
✅ Charger online and stable (>98% uptime)
✅ Sessions start and complete correctly
✅ Billing calculates accurately
✅ Remote commands work
✅ Monitoring shows healthy status
✅ 24-hour burn-in period passed
✅ Documentation complete
✅ Team signed off

---

**Congratulations on successful charger onboarding!** 🎉

Proceed to next charger or begin parallel operation monitoring.
