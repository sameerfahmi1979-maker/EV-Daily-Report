# Phase 10: Integration Testing Guide

## Overview

This document provides comprehensive testing procedures to verify the complete OCPP management system before first charger onboarding. Follow these tests sequentially to ensure all components are working correctly.

---

## Pre-Testing Checklist

### Database Verification

- [ ] All OCPP tables exist and have correct schema
- [ ] Row Level Security (RLS) policies are active on all tables
- [ ] Foreign key relationships are properly configured
- [ ] Indexes are created for performance optimization
- [ ] Test user account exists

### OCPP Server Verification

- [ ] OCPP server is deployed and running
- [ ] WebSocket endpoint is accessible
- [ ] SSL certificate is valid
- [ ] Environment variables are configured
- [ ] Database connection is working
- [ ] Logging is operational

### Frontend Verification

- [ ] Application builds without errors
- [ ] All OCPP menu items are visible
- [ ] All 7 OCPP dashboards load correctly
- [ ] No console errors on page load
- [ ] User authentication works

---

## Test Suite 1: Database Operations

### 1.1 Charger Management

**Test: Create Charger**
```sql
-- Insert test charger
INSERT INTO ocpp_chargers (
  user_id,
  charge_point_id,
  vendor,
  model,
  serial_number,
  firmware_version,
  protocol_version,
  registration_status,
  connection_status
) VALUES (
  'YOUR_USER_ID',
  'TEST-CHARGER-001',
  'ChargeCore Verde',
  'Test Model',
  'SN-TEST-001',
  '1.0.0',
  '1.6J',
  'Accepted',
  'Offline'
);
```

**Expected Result:**
- ✅ Charger created successfully
- ✅ Visible in Charger Management dashboard
- ✅ Shows "Offline" status
- ✅ All fields populated correctly

**Test: Create Connectors**
```sql
-- Insert test connectors (2 per charger)
INSERT INTO ocpp_connectors (charger_id, connector_id, connector_type, power_kw, status)
SELECT
  id,
  1,
  'Type2',
  22,
  'Available'
FROM ocpp_chargers WHERE charge_point_id = 'TEST-CHARGER-001'
UNION ALL
SELECT
  id,
  2,
  'Type2',
  22,
  'Available'
FROM ocpp_chargers WHERE charge_point_id = 'TEST-CHARGER-001';
```

**Expected Result:**
- ✅ 2 connectors created
- ✅ Both show "Available" status
- ✅ Visible in Live Monitoring dashboard
- ✅ Connectors linked to correct charger

### 1.2 Configuration Keys

**Test: Add Configuration Keys**
```sql
INSERT INTO ocpp_configuration_keys (charger_id, key_name, value, readonly, last_updated)
SELECT
  id,
  unnest(ARRAY[
    'AuthorizeRemoteTxRequests',
    'ClockAlignedDataInterval',
    'ConnectionTimeOut',
    'HeartbeatInterval',
    'MeterValueSampleInterval'
  ]),
  unnest(ARRAY['true', '900', '30', '60', '60']),
  unnest(ARRAY[false, false, false, false, false]),
  now()
FROM ocpp_chargers WHERE charge_point_id = 'TEST-CHARGER-001';
```

**Expected Result:**
- ✅ 5 configuration keys created
- ✅ Visible in OCPP Configuration dashboard
- ✅ All marked as writable (not readonly)
- ✅ Correct values displayed

### 1.3 Operators (for Authorization)

**Test: Create Test Operator**
```sql
INSERT INTO operators (
  user_id,
  name,
  email,
  rfid_card_number,
  status
) VALUES (
  'YOUR_USER_ID',
  'Test Operator',
  'test@example.com',
  'TEST-RFID-12345',
  'Active'
);
```

**Expected Result:**
- ✅ Operator created successfully
- ✅ Visible in Operators list
- ✅ RFID card number stored
- ✅ Status shows "Active"
- ✅ Appears in Authorization List in OCPP Configuration

---

## Test Suite 2: Frontend Dashboard Testing

### 2.1 Live Monitoring Dashboard

**Test Steps:**
1. Navigate to OCPP Management > Live Monitoring
2. Verify charger grid displays
3. Check charger card shows correct information
4. Verify connector status displays
5. Check real-time status indicators

**Expected Results:**
- ✅ Dashboard loads without errors
- ✅ Test charger visible in grid
- ✅ Status shows "Offline" (red)
- ✅ 2 connectors visible
- ✅ Both connectors show "Available"
- ✅ Last heartbeat shows "Never" or "N/A"
- ✅ Firmware version displays correctly

### 2.2 Charger Management Dashboard

**Test Steps:**
1. Navigate to OCPP Management > Charger Management
2. Verify charger list displays
3. Click on test charger
4. Review charger details
5. Test edit functionality

**Expected Results:**
- ✅ Charger list loads
- ✅ Test charger in list
- ✅ Details view shows all information
- ✅ Station linking available
- ✅ Edit form opens correctly
- ✅ Can update charger details
- ✅ Changes save successfully

### 2.3 Remote Control Dashboard

**Test Steps:**
1. Navigate to OCPP Management > Remote Control
2. Select test charger
3. Review available commands
4. Verify command interface

**Expected Results:**
- ✅ Dashboard loads
- ✅ Charger selector works
- ✅ All command types available
- ✅ Remote Start form displays
- ✅ Remote Stop option available
- ✅ Reset commands available
- ✅ Unlock connector option present
- ✅ Commands disabled for offline charger

### 2.4 Sessions Monitor Dashboard

**Test Steps:**
1. Navigate to OCPP Management > Sessions Monitor
2. Review active sessions section
3. Check recent sessions section
4. Test filters and search

**Expected Results:**
- ✅ Dashboard loads
- ✅ "No active sessions" shows (expected)
- ✅ Recent sessions empty (expected)
- ✅ Filters work correctly
- ✅ Empty states display properly

### 2.5 Message Logs Dashboard

**Test Steps:**
1. Navigate to OCPP Management > Message Logs
2. Review message log interface
3. Check filters
4. Test search functionality

**Expected Results:**
- ✅ Dashboard loads
- ✅ No messages yet (expected)
- ✅ Filter interface works
- ✅ Charger filter available
- ✅ Message type filter available
- ✅ Search box functional
- ✅ Empty state displays

### 2.6 Health & Diagnostics Dashboard

**Test Steps:**
1. Navigate to OCPP Management > Health & Diagnostics
2. Select test charger
3. Review diagnostics information
4. Check configuration keys
5. Review recent commands

**Expected Results:**
- ✅ Dashboard loads
- ✅ Charger selector works
- ✅ Configuration keys display
- ✅ Recent commands section shows
- ✅ Recent messages section present
- ✅ Error count shows 0

### 2.7 OCPP Configuration Dashboard

**Test Steps:**
1. Navigate to OCPP Management > OCPP Configuration
2. Review summary metrics
3. Expand Configuration Keys section
4. Test search and filter
5. Try editing a configuration key
6. Expand Firmware Versions section
7. Expand Authorization List section

**Expected Results:**
- ✅ Dashboard loads
- ✅ Summary shows: 1 charger, 1 configured, 5 keys, operators count
- ✅ Configuration keys display in table
- ✅ Search filters keys
- ✅ Charger dropdown works
- ✅ Edit icon enabled for writable keys
- ✅ Edit mode opens input field
- ✅ Save/Cancel buttons work
- ✅ Firmware version displays
- ✅ Authorization list shows test operator

---

## Test Suite 3: OCPP Service Layer Testing

### 3.1 Charger Services

**Test: Get All Chargers**
```typescript
// In browser console
const { user } = useAuth();
const chargers = await ocppService.getAllChargers(user.id);
console.log('Chargers:', chargers);
```

**Expected Result:**
- ✅ Returns array with test charger
- ✅ Charger has all properties
- ✅ Connectors included
- ✅ No errors thrown

**Test: Get Charger By ID**
```typescript
const charger = await ocppService.getChargerById(chargerId, user.id);
console.log('Charger:', charger);
```

**Expected Result:**
- ✅ Returns single charger object
- ✅ All fields populated
- ✅ Matches database record

### 3.2 Session Services

**Test: Get Active Sessions**
```typescript
const sessions = await ocppService.getActiveSessions(user.id);
console.log('Active Sessions:', sessions);
```

**Expected Result:**
- ✅ Returns empty array (no active sessions yet)
- ✅ No errors thrown

**Test: Get Recent Sessions**
```typescript
const sessions = await ocppService.getRecentSessions(user.id, 10);
console.log('Recent Sessions:', sessions);
```

**Expected Result:**
- ✅ Returns empty array
- ✅ No errors thrown

### 3.3 Configuration Services

**Test: Get Configuration Keys**
```typescript
const keys = await ocppService.getConfigurationKeys(user.id, chargerId);
console.log('Config Keys:', keys);
```

**Expected Result:**
- ✅ Returns array of 5 keys
- ✅ All keys have name, value, readonly, last_updated
- ✅ Matches database records

**Test: Get Configuration Summary**
```typescript
const summary = await ocppService.getConfigurationKeySummary(user.id);
console.log('Summary:', summary);
```

**Expected Result:**
- ✅ Returns object with totalChargers, chargersWithConfig, totalKeys
- ✅ Numbers match database state
- ✅ commonKeys array present

### 3.4 Message Services

**Test: Get Recent Messages**
```typescript
const messages = await ocppService.getRecentMessages(user.id, chargerId, 10);
console.log('Messages:', messages);
```

**Expected Result:**
- ✅ Returns empty array (no messages yet)
- ✅ No errors thrown

### 3.5 Remote Command Services

**Test: Create Remote Command**
```typescript
const command = await ocppService.sendRemoteCommand(
  user.id,
  chargerId,
  connectorId,
  'RemoteStartTransaction',
  { idTag: 'TEST-RFID-12345' }
);
console.log('Command:', command);
```

**Expected Result:**
- ✅ Command created in database
- ✅ Status is 'Pending'
- ✅ Command ID returned
- ✅ Parameters stored correctly
- ⚠️ Command won't execute (charger offline)

---

## Test Suite 4: OCPP Server Testing

### 4.1 Server Health Check

**Test: Verify Server is Running**
```bash
curl https://your-ocpp-server.com/health
```

**Expected Result:**
- ✅ Returns 200 OK
- ✅ JSON response with status: "healthy"
- ✅ Includes uptime information
- ✅ Database connection confirmed

### 4.2 WebSocket Connection Test

**Test: Connect with WebSocket Client**
```javascript
// Using a WebSocket testing tool or browser console
const ws = new WebSocket('wss://your-ocpp-server.com/ocpp/TEST-CHARGER-001');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  console.log('Message:', event.data);
};

ws.onerror = (error) => {
  console.error('Error:', error);
};
```

**Expected Result:**
- ✅ Connection establishes
- ✅ No immediate errors
- ✅ Server accepts connection
- ✅ Can send/receive messages

### 4.3 OCPP Message Format Test

**Test: Send BootNotification**
```javascript
const bootNotification = [
  2,
  "test-message-001",
  "BootNotification",
  {
    "chargePointVendor": "ChargeCore Verde",
    "chargePointModel": "Test Model",
    "chargePointSerialNumber": "SN-TEST-001",
    "firmwareVersion": "1.0.0"
  }
];

ws.send(JSON.stringify(bootNotification));
```

**Expected Result:**
- ✅ Server responds with CallResult
- ✅ Status "Accepted"
- ✅ CurrentTime and interval provided
- ✅ Database updated with registration
- ✅ Message logged in ocpp_messages table

### 4.4 Heartbeat Test

**Test: Send Heartbeat**
```javascript
const heartbeat = [
  2,
  "test-message-002",
  "Heartbeat",
  {}
];

ws.send(JSON.stringify(heartbeat));
```

**Expected Result:**
- ✅ Server responds immediately
- ✅ CurrentTime provided
- ✅ last_heartbeat_at updated in database
- ✅ Connection status changes to "Online"

---

## Test Suite 5: Integration Scenarios

### 5.1 Complete Session Flow (Simulated)

**Scenario: Full charging session from start to finish**

**Step 1: Authorize RFID**
```javascript
const authorize = [
  2,
  "msg-authorize-001",
  "Authorize",
  {
    "idTag": "TEST-RFID-12345"
  }
];
ws.send(JSON.stringify(authorize));
```

**Expected Result:**
- ✅ Server checks operators table
- ✅ Responds with "Accepted" (operator exists and active)
- ✅ Message logged

**Step 2: Status Notification (Preparing)**
```javascript
const preparing = [
  2,
  "msg-status-001",
  "StatusNotification",
  {
    "connectorId": 1,
    "status": "Preparing",
    "errorCode": "NoError",
    "timestamp": new Date().toISOString()
  }
];
ws.send(JSON.stringify(preparing));
```

**Expected Result:**
- ✅ Connector status updated to "Preparing"
- ✅ Visible in Live Monitoring
- ✅ Message logged

**Step 3: Start Transaction**
```javascript
const startTx = [
  2,
  "msg-start-001",
  "StartTransaction",
  {
    "connectorId": 1,
    "idTag": "TEST-RFID-12345",
    "meterStart": 1000,
    "timestamp": new Date().toISOString()
  }
];
ws.send(JSON.stringify(startTx));
```

**Expected Result:**
- ✅ Session created in ocpp_charging_sessions
- ✅ Transaction ID assigned
- ✅ Authorization status "Accepted"
- ✅ Operator linked to session
- ✅ Start meter value stored
- ✅ Session visible in Sessions Monitor
- ✅ Session status "Active"

**Step 4: Status Notification (Charging)**
```javascript
const charging = [
  2,
  "msg-status-002",
  "StatusNotification",
  {
    "connectorId": 1,
    "status": "Charging",
    "errorCode": "NoError",
    "timestamp": new Date().toISOString()
  }
];
ws.send(JSON.stringify(charging));
```

**Expected Result:**
- ✅ Connector status updated to "Charging"
- ✅ Visible in Live Monitoring
- ✅ Green charging indicator

**Step 5: Meter Values (During Charging)**
```javascript
const meterValues = [
  2,
  "msg-meter-001",
  "MeterValues",
  {
    "connectorId": 1,
    "transactionId": 1,
    "meterValue": [
      {
        "timestamp": new Date().toISOString(),
        "sampledValue": [
          {
            "value": "5000",
            "context": "Sample.Periodic",
            "measurand": "Energy.Active.Import.Register",
            "unit": "Wh"
          },
          {
            "value": "22.5",
            "context": "Sample.Periodic",
            "measurand": "Power.Active.Import",
            "unit": "kW"
          }
        ]
      }
    ]
  }
];
ws.send(JSON.stringify(meterValues));
```

**Expected Result:**
- ✅ Meter values stored in ocpp_meter_values
- ✅ Energy value recorded
- ✅ Power value recorded
- ✅ Session updated with latest metrics
- ✅ Visible in Sessions Monitor

**Step 6: Stop Transaction**
```javascript
const stopTx = [
  2,
  "msg-stop-001",
  "StopTransaction",
  {
    "transactionId": 1,
    "meterStop": 15000,
    "timestamp": new Date().toISOString(),
    "reason": "Local",
    "transactionData": []
  }
];
ws.send(JSON.stringify(stopTx));
```

**Expected Result:**
- ✅ Session end_timestamp set
- ✅ End meter value stored
- ✅ Energy consumed calculated (14 kWh)
- ✅ Duration calculated
- ✅ Billing calculation triggered
- ✅ Cost calculated
- ✅ Session status changed to "Completed"
- ✅ Visible in recent sessions
- ✅ No longer in active sessions

**Step 7: Status Notification (Available)**
```javascript
const available = [
  2,
  "msg-status-003",
  "StatusNotification",
  {
    "connectorId": 1,
    "status": "Available",
    "errorCode": "NoError",
    "timestamp": new Date().toISOString()
  }
];
ws.send(JSON.stringify(available));
```

**Expected Result:**
- ✅ Connector status back to "Available"
- ✅ Ready for next session
- ✅ Green available indicator

### 5.2 Remote Command Flow

**Scenario: Remote start transaction from dashboard**

**Step 1: Create Command in Frontend**
1. Go to Remote Control dashboard
2. Select test charger
3. Choose connector 1
4. Select "Remote Start Transaction"
5. Enter RFID: TEST-RFID-12345
6. Click "Send Command"

**Expected Result:**
- ✅ Command created in ocpp_remote_commands table
- ✅ Status: "Pending"
- ✅ Command visible in command history

**Step 2: Server Processes Command**
- Server detects new pending command
- Formats OCPP RemoteStartTransaction message
- Sends to charger via WebSocket

**Expected Result:**
- ✅ Command status changes to "Sent"
- ✅ executed_at timestamp set
- ✅ Message logged

**Step 3: Charger Responds**
```javascript
const response = [
  3,
  "msg-remote-start-response",
  {
    "status": "Accepted"
  }
];
// Server receives this from charger
```

**Expected Result:**
- ✅ Command status changes to "Accepted"
- ✅ completed_at timestamp set
- ✅ command_result stored
- ✅ Visible in command history with success

**Step 4: Transaction Starts**
- Charger begins transaction
- Sends StartTransaction message
- Normal session flow continues

### 5.3 Configuration Change Flow

**Scenario: Change heartbeat interval**

**Step 1: Edit Configuration in Frontend**
1. Go to OCPP Configuration dashboard
2. Find "HeartbeatInterval" key
3. Click edit icon
4. Change value from "60" to "30"
5. Click save

**Expected Result:**
- ✅ ChangeConfiguration command created
- ✅ Status: "Pending"
- ✅ Saving indicator shows

**Step 2: Server Sends Command**
```javascript
const changeConfig = [
  2,
  "msg-change-config-001",
  "ChangeConfiguration",
  {
    "key": "HeartbeatInterval",
    "value": "30"
  }
];
// Server sends to charger
```

**Expected Result:**
- ✅ Command sent to charger
- ✅ Status: "Sent"

**Step 3: Charger Responds**
```javascript
const response = [
  3,
  "msg-change-config-response",
  {
    "status": "Accepted"
  }
];
```

**Expected Result:**
- ✅ Command status: "Accepted"
- ✅ Configuration key value updated in database
- ✅ last_updated timestamp updated
- ✅ Table refreshes showing new value

---

## Test Suite 6: Error Handling

### 6.1 Invalid RFID Authorization

**Test: Authorize with unknown RFID**
```javascript
const authorize = [
  2,
  "msg-auth-invalid",
  "Authorize",
  {
    "idTag": "UNKNOWN-RFID"
  }
];
ws.send(JSON.stringify(authorize));
```

**Expected Result:**
- ✅ Server responds with "Invalid"
- ✅ No session created
- ✅ Message logged with error

### 6.2 Inactive Operator

**Test: Set operator to inactive, try to authorize**
```sql
UPDATE operators SET status = 'Inactive' WHERE rfid_card_number = 'TEST-RFID-12345';
```

Then send Authorize message.

**Expected Result:**
- ✅ Authorization rejected
- ✅ IdTagInfo status: "Blocked"
- ✅ Cannot start transaction

### 6.3 Connection Loss

**Test: Disconnect charger suddenly**
```javascript
ws.close();
```

**Expected Result:**
- ✅ Server detects disconnection
- ✅ Connection status changes to "Offline"
- ✅ Last heartbeat timestamp retained
- ✅ Visible in Live Monitoring as offline
- ✅ Active sessions marked appropriately

### 6.4 Malformed OCPP Message

**Test: Send invalid JSON**
```javascript
ws.send('invalid json {{{');
```

**Expected Result:**
- ✅ Server handles gracefully
- ✅ Doesn't crash
- ✅ Error logged
- ✅ No database changes

### 6.5 Missing Required Fields

**Test: StartTransaction without idTag**
```javascript
const startTx = [
  2,
  "msg-start-invalid",
  "StartTransaction",
  {
    "connectorId": 1,
    "meterStart": 1000,
    "timestamp": new Date().toISOString()
  }
];
ws.send(JSON.stringify(startTx));
```

**Expected Result:**
- ✅ Server validates message
- ✅ Responds with CallError
- ✅ Error code: "FormationViolation"
- ✅ Descriptive error message
- ✅ No session created

---

## Test Suite 7: Performance Testing

### 7.1 Multiple Concurrent Connections

**Test: Connect multiple simulated chargers**
- Open 9 WebSocket connections (simulating 9 chargers)
- Send BootNotification from each
- Send Heartbeat every 60 seconds

**Expected Result:**
- ✅ All connections accepted
- ✅ All chargers registered
- ✅ No performance degradation
- ✅ All heartbeats acknowledged
- ✅ Dashboard shows all 9 chargers

### 7.2 High-Frequency Meter Values

**Test: Send meter values every 5 seconds**
- Create active session
- Send MeterValues every 5 seconds for 5 minutes
- Total: 60 messages

**Expected Result:**
- ✅ All meter values stored
- ✅ No message loss
- ✅ Database handles load
- ✅ Response time <100ms
- ✅ Dashboard updates smoothly

### 7.3 Concurrent Sessions

**Test: Start 18 sessions simultaneously**
- Start transaction on all 18 connectors (9 chargers × 2)
- Send meter values from all
- Monitor system performance

**Expected Result:**
- ✅ All sessions created correctly
- ✅ All in ocpp_charging_sessions table
- ✅ Live Monitoring shows all
- ✅ Sessions Monitor displays all
- ✅ No performance issues
- ✅ Message processing <100ms

### 7.4 Dashboard Load Testing

**Test: Load dashboards with large datasets**
- Create 100 completed sessions
- Create 1000 meter value records
- Create 500 messages
- Load each dashboard

**Expected Result:**
- ✅ All dashboards load in <3 seconds
- ✅ Pagination works correctly
- ✅ Filters perform well
- ✅ Search is responsive
- ✅ No browser lag

---

## Test Suite 8: Data Integrity

### 8.1 Session Billing Accuracy

**Test: Verify billing calculation**
```sql
-- After completing a test session
SELECT
  transaction_id,
  start_meter_value,
  end_meter_value,
  energy_consumed_wh,
  (end_meter_value - start_meter_value) as calculated_energy,
  calculated_cost
FROM ocpp_charging_sessions
WHERE transaction_id = 1;
```

**Expected Result:**
- ✅ energy_consumed_wh = end_meter_value - start_meter_value
- ✅ calculated_cost matches rate structure
- ✅ All values consistent
- ✅ Matches billing records

### 8.2 Message Logging Completeness

**Test: Verify all messages logged**
```sql
-- Count messages for test session
SELECT
  action,
  COUNT(*) as message_count,
  direction
FROM ocpp_messages
WHERE charger_id = (SELECT id FROM ocpp_chargers WHERE charge_point_id = 'TEST-CHARGER-001')
GROUP BY action, direction
ORDER BY action;
```

**Expected Result:**
- ✅ All sent messages logged (Outgoing)
- ✅ All received messages logged (Incoming)
- ✅ No gaps in message sequence
- ✅ Timestamps sequential

### 8.3 Status Synchronization

**Test: Verify status consistency**
```sql
-- Check connector status matches latest StatusNotification
SELECT
  c.connector_id,
  c.status as connector_status,
  m.payload->>'status' as last_message_status
FROM ocpp_connectors c
LEFT JOIN ocpp_messages m ON m.charger_id = c.charger_id
  AND m.action = 'StatusNotification'
  AND (m.payload->>'connectorId')::int = c.connector_id
WHERE c.charger_id = (SELECT id FROM ocpp_chargers WHERE charge_point_id = 'TEST-CHARGER-001')
ORDER BY m.timestamp DESC
LIMIT 2;
```

**Expected Result:**
- ✅ Connector status matches latest message
- ✅ Status updates applied correctly
- ✅ No stale data

---

## Test Suite 9: Security Testing

### 9.1 RLS Policy Verification

**Test: Attempt to access other user's data**
```sql
-- As different user, try to query another user's chargers
SELECT * FROM ocpp_chargers WHERE user_id != auth.uid();
```

**Expected Result:**
- ✅ Query returns 0 rows
- ✅ RLS blocks access
- ✅ No data leakage

### 9.2 Authorization Validation

**Test: Try to create command for other user's charger**
- Switch to different user account
- Try to send remote command to test charger

**Expected Result:**
- ✅ Command creation fails
- ✅ Authorization error
- ✅ No command created

### 9.3 WebSocket Authentication

**Test: Connect without proper charge point ID**
```javascript
const ws = new WebSocket('wss://your-ocpp-server.com/ocpp/INVALID-ID');
```

**Expected Result:**
- ✅ Connection rejected or limited
- ✅ No database access granted
- ✅ Security maintained

---

## Test Suite 10: User Interface Testing

### 10.1 Responsive Design

**Test: View on different screen sizes**
- Desktop (1920x1080)
- Laptop (1366x768)
- Tablet (768x1024)
- Mobile (375x667)

**Expected Result:**
- ✅ All dashboards responsive
- ✅ Tables scroll horizontally on mobile
- ✅ Buttons accessible
- ✅ No layout breaks
- ✅ Readable on all sizes

### 10.2 Real-Time Updates

**Test: Multi-tab behavior**
- Open dashboard in 2 browser tabs
- Trigger status change
- Observe both tabs

**Expected Result:**
- ✅ Both tabs show updates (if real-time enabled)
- ✅ Or refresh updates data
- ✅ No data conflicts

### 10.3 Error Message Display

**Test: Trigger various errors**
- Network disconnection
- API timeout
- Invalid input
- Authorization failure

**Expected Result:**
- ✅ User-friendly error messages
- ✅ Red alert boxes displayed
- ✅ Clear explanation of issue
- ✅ Guidance for resolution
- ✅ No stack traces shown

---

## Test Results Documentation

### Test Execution Log Template

```markdown
## Test Execution: [Date]
**Tester:** [Name]
**Environment:** [Production/Staging/Local]

### Database Operations
- [ ] Create Charger: PASS/FAIL - Notes: ___
- [ ] Create Connectors: PASS/FAIL - Notes: ___
- [ ] Add Configuration Keys: PASS/FAIL - Notes: ___
- [ ] Create Operator: PASS/FAIL - Notes: ___

### Frontend Dashboards
- [ ] Live Monitoring: PASS/FAIL - Notes: ___
- [ ] Charger Management: PASS/FAIL - Notes: ___
- [ ] Remote Control: PASS/FAIL - Notes: ___
- [ ] Sessions Monitor: PASS/FAIL - Notes: ___
- [ ] Message Logs: PASS/FAIL - Notes: ___
- [ ] Health & Diagnostics: PASS/FAIL - Notes: ___
- [ ] OCPP Configuration: PASS/FAIL - Notes: ___

### OCPP Server
- [ ] Health Check: PASS/FAIL - Notes: ___
- [ ] WebSocket Connection: PASS/FAIL - Notes: ___
- [ ] Message Handling: PASS/FAIL - Notes: ___
- [ ] Command Processing: PASS/FAIL - Notes: ___

### Integration Scenarios
- [ ] Complete Session Flow: PASS/FAIL - Notes: ___
- [ ] Remote Command Flow: PASS/FAIL - Notes: ___
- [ ] Configuration Change: PASS/FAIL - Notes: ___

### Issues Found
1. [Description] - Severity: [High/Medium/Low] - Status: [Open/Fixed]
2. ...

### Overall Status: READY / NOT READY

**Sign-off:** ______________ Date: __________
```

---

## Success Criteria

Before proceeding to first charger onboarding, verify:

### Critical (Must Pass)
- [ ] All database tables created and accessible
- [ ] RLS policies active and working
- [ ] OCPP server running and accessible
- [ ] WebSocket connections accepted
- [ ] All 7 dashboards load without errors
- [ ] Basic OCPP message handling works
- [ ] Session creation and completion works
- [ ] Billing calculation accurate
- [ ] Authorization validation works

### Important (Should Pass)
- [ ] All service functions working
- [ ] Remote commands can be created
- [ ] Configuration management works
- [ ] Message logging complete
- [ ] Status updates propagate
- [ ] Error handling graceful
- [ ] Performance acceptable (<3s load, <100ms processing)

### Optional (Nice to Have)
- [ ] Real-time updates working
- [ ] Advanced filters all functional
- [ ] Export features working
- [ ] Mobile responsive perfect
- [ ] All edge cases handled

---

## Next Steps After Testing

Once all critical and important tests pass:

1. **Document Test Results**
   - Fill out test execution log
   - Note any issues found
   - Record performance metrics
   - Sign off on readiness

2. **Prepare for First Charger**
   - Review onboarding procedures
   - Prepare charger configuration
   - Set up monitoring alerts
   - Train operations team

3. **Go/No-Go Decision**
   - Review all test results
   - Assess risk factors
   - Confirm team readiness
   - Proceed to Phase 11 if ready

---

## Troubleshooting Common Issues

### Issue: Chargers not visible in dashboard
**Solution:** Check RLS policies, verify user_id matches, refresh page

### Issue: Sessions not billing correctly
**Solution:** Verify rate structures exist, check station linkage, review billing service logs

### Issue: WebSocket connection fails
**Solution:** Check SSL certificate, verify domain configuration, check firewall rules

### Issue: Messages not logging
**Solution:** Check OCPP server logs, verify database connection, check message format

### Issue: Remote commands not executing
**Solution:** Verify charger online, check command parameters, review server logs

---

## Conclusion

This comprehensive integration testing guide ensures the OCPP management system is production-ready before connecting real chargers. Complete all tests systematically and document results thoroughly.

**Remember:** It's better to discover issues in testing than in production!
