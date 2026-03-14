# OCPP System Troubleshooting Guide

## Overview

This guide provides systematic troubleshooting procedures for common issues encountered in the OCPP management system. Follow the diagnostic steps in order for efficient problem resolution.

---

## Quick Diagnostic Checklist

When experiencing any issue, start here:

- [ ] Check OCPP server status (visit `/health` endpoint)
- [ ] Verify charger online status in Live Monitoring
- [ ] Review recent error messages in Message Logs
- [ ] Check database connectivity
- [ ] Verify network connectivity
- [ ] Review application logs
- [ ] Check recent system changes

---

## Issue Category 1: Connectivity Problems

### 1.1 Charger Won't Connect to OCPP Server

**Symptoms:**
- Charger status shows "Offline"
- No BootNotification received
- No heartbeat messages
- Never connected or lost connection

**Diagnostic Steps:**

1. **Check Network Connectivity**
   ```bash
   # From charger network or similar location
   ping your-ocpp-server.com

   # Check DNS resolution
   nslookup your-ocpp-server.com

   # Test HTTPS connectivity
   curl https://your-ocpp-server.com/health
   ```

   **Expected Result:** All commands should succeed

2. **Verify OCPP Server Running**
   ```bash
   # Check health endpoint
   curl https://your-ocpp-server.com/health
   ```

   **Expected Response:**
   ```json
   {
     "status": "healthy",
     "uptime": 12345,
     "connections": {
       "total": 2,
       "online": 2
     }
   }
   ```

3. **Check Charger Configuration**
   - OCPP URL correct format: `wss://domain.com/ocpp/CHARGER-ID`
   - Protocol: OCPP 1.6J
   - Port: 443 (for WSS)
   - SSL/TLS enabled

4. **Review Server Logs**
   ```bash
   # Check OCPP server logs for connection attempts
   # Look for "Connection rejected" or error messages
   ```

5. **Check Firewall Rules**
   - Outbound port 443 open
   - WebSocket connections allowed
   - No proxy blocking WSS protocol

**Common Solutions:**

**Problem: Wrong OCPP URL**
```
Solution: Correct the URL in charger settings
Format: wss://your-domain.com/ocpp/[CHARGE_POINT_ID]
```

**Problem: SSL Certificate Invalid**
```
Solution:
1. Verify SSL certificate is valid and not expired
2. Check certificate includes correct domain
3. Renew certificate if needed
4. Restart OCPP server after certificate update
```

**Problem: Firewall Blocking**
```
Solution:
1. Open outbound port 443 (HTTPS/WSS)
2. Allow WebSocket upgrade requests
3. Whitelist OCPP server IP/domain
```

**Problem: Network Connectivity**
```
Solution:
1. Check physical network connection
2. Verify DHCP/static IP configuration
3. Test with ping and traceroute
4. Check for network outages
5. For 4G: Verify SIM card active, signal strong
```

### 1.2 Charger Connects Then Disconnects

**Symptoms:**
- Brief online status, then offline
- Repeated connection/disconnection cycles
- BootNotification received but no heartbeats

**Diagnostic Steps:**

1. **Check Heartbeat Interval**
   ```sql
   SELECT key_name, value
   FROM ocpp_configuration_keys
   WHERE charger_id = '[CHARGER_ID]'
     AND key_name = 'HeartbeatInterval';
   ```

   **Expected:** Value between 30-300 seconds

2. **Monitor Connection Duration**
   ```sql
   SELECT
     timestamp,
     action,
     direction
   FROM ocpp_messages
   WHERE charger_id = '[CHARGER_ID]'
   ORDER BY timestamp DESC
   LIMIT 20;
   ```

   **Look for:** Pattern of BootNotification → Heartbeat → nothing

3. **Check Network Stability**
   - Ping charger's network gateway continuously
   - Monitor for packet loss
   - Check for network congestion

4. **Review Server Connection Timeout**
   - Default: 120 seconds without heartbeat → offline
   - Verify heartbeat interval < timeout

**Common Solutions:**

**Problem: Heartbeat Interval Too Long**
```
Solution:
1. Reduce HeartbeatInterval to 60 seconds
2. Use ChangeConfiguration command
3. Verify charger accepts new value
```

**Problem: Network Instability**
```
Solution:
1. Switch from 4G to Ethernet if possible
2. Improve 4G signal (antenna, relocate)
3. Check for network interference
4. Contact ISP if persistent issues
```

**Problem: Server Restart or Maintenance**
```
Solution:
1. Schedule maintenance during low-usage periods
2. Implement graceful shutdown
3. Configure chargers to reconnect automatically
4. Monitor for successful reconnection
```

### 1.3 Intermittent Disconnections

**Symptoms:**
- Charger goes offline periodically
- Reconnects automatically
- Pattern may be time-based

**Diagnostic Steps:**

1. **Analyze Disconnection Pattern**
   ```sql
   SELECT
     DATE_TRUNC('hour', updated_at) as hour,
     connection_status,
     COUNT(*) as changes
   FROM (
     SELECT
       updated_at,
       connection_status,
       LAG(connection_status) OVER (ORDER BY updated_at) as prev_status
     FROM charger_status_history
     WHERE charger_id = '[CHARGER_ID]'
   ) changes
   WHERE connection_status != prev_status
   GROUP BY hour, connection_status
   ORDER BY hour;
   ```

2. **Check for Scheduled Events**
   - Network maintenance windows
   - Charger firmware updates
   - Server maintenance
   - ISP issues

3. **Monitor During Problem Period**
   - Real-time log monitoring
   - Network packet capture
   - Heartbeat timing analysis

**Common Solutions:**

**Problem: Scheduled Network Maintenance**
```
Solution:
1. Coordinate with network team
2. Schedule around maintenance windows
3. Implement redundant connectivity if critical
```

**Problem: Power Issues**
```
Solution:
1. Check power supply stability
2. Install UPS if power fluctuates
3. Verify electrical connections
4. Monitor voltage levels
```

---

## Issue Category 2: Session Problems

### 2.1 Sessions Won't Start

**Symptoms:**
- RFID card accepted but charging doesn't begin
- Connector stays "Available" instead of "Charging"
- No StartTransaction message

**Diagnostic Steps:**

1. **Check Authorization**
   ```sql
   SELECT *
   FROM ocpp_messages
   WHERE charger_id = '[CHARGER_ID]'
     AND action = 'Authorize'
   ORDER BY timestamp DESC
   LIMIT 5;
   ```

   **Expected:** IdTagInfo.status = "Accepted"

2. **Check Connector Status**
   ```sql
   SELECT
     connector_id,
     status,
     error_code,
     last_status_update
   FROM ocpp_connectors
   WHERE charger_id = '[CHARGER_ID]';
   ```

   **Expected:** Status should transition through Available → Preparing → Charging

3. **Review StartTransaction Messages**
   ```sql
   SELECT *
   FROM ocpp_messages
   WHERE charger_id = '[CHARGER_ID]'
     AND action = 'StartTransaction'
   ORDER BY timestamp DESC
   LIMIT 5;
   ```

4. **Check Vehicle Connection**
   - Is vehicle properly plugged in?
   - Is vehicle ready to charge?
   - Does vehicle require app activation?
   - Try different vehicle/cable

**Common Solutions:**

**Problem: Operator Not Active**
```sql
-- Check operator status
SELECT name, status, rfid_card_number
FROM operators
WHERE rfid_card_number = '[RFID_NUMBER]';

-- Activate if inactive
UPDATE operators
SET status = 'Active'
WHERE rfid_card_number = '[RFID_NUMBER]';
```

**Problem: Connector Faulted**
```
Solution:
1. Check connector for physical damage
2. Review error_code in ocpp_connectors
3. Reset connector using remote command
4. Clear fault condition
5. Try again
```

**Problem: Remote Start Required**
```
Solution:
1. Check if charger requires remote start
2. Use Remote Control dashboard
3. Send RemoteStartTransaction command
4. Include correct idTag
```

**Problem: Vehicle Not Ready**
```
Solution:
1. Ensure vehicle is in charging mode
2. Check vehicle charging schedule settings
3. Try unlocking/locking vehicle
4. Test with known-working vehicle
```

### 2.2 Sessions Won't Stop

**Symptoms:**
- Vehicle unplugged but session continues
- Session shows "Active" indefinitely
- No StopTransaction message

**Diagnostic Steps:**

1. **Check Current Session Status**
   ```sql
   SELECT
     id,
     transaction_id,
     start_timestamp,
     end_timestamp,
     session_status,
     stop_reason
   FROM ocpp_charging_sessions
   WHERE id = '[SESSION_ID]';
   ```

2. **Review StopTransaction Messages**
   ```sql
   SELECT *
   FROM ocpp_messages
   WHERE charger_id = '[CHARGER_ID]'
     AND action = 'StopTransaction'
   ORDER BY timestamp DESC
   LIMIT 5;
   ```

3. **Check Connector Status**
   - Should return to "Available" after unplugging
   - If stuck in "Charging", issue likely with charger

**Common Solutions:**

**Problem: Charger Not Detecting Unplug**
```
Solution:
1. Fully disconnect cable from vehicle
2. Ensure cable properly returned to holster
3. Check cable lock release
4. Try presenting RFID card again to stop
```

**Problem: Session Stuck in Database**
```
Solution (Remote Stop):
1. Go to Remote Control dashboard
2. Send RemoteStopTransaction command
3. Include transaction ID
4. Charger should stop and send StopTransaction
```

**Problem: Session Stuck After Charger Restart**
```sql
-- Manual session completion (last resort)
UPDATE ocpp_charging_sessions
SET
  end_timestamp = NOW(),
  session_status = 'Stopped',
  stop_reason = 'Other',
  end_meter_value = start_meter_value,  -- or last known value
  energy_consumed_wh = 0  -- Update with actual if known
WHERE id = '[SESSION_ID]'
  AND session_status = 'Active';

-- Note: This bypasses normal OCPP flow, use only when necessary
```

### 2.3 Incorrect Session Data

**Symptoms:**
- Energy values wrong or zero
- Billing calculation incorrect
- Missing meter values
- Duration incorrect

**Diagnostic Steps:**

1. **Review Session Details**
   ```sql
   SELECT
     transaction_id,
     start_meter_value,
     end_meter_value,
     energy_consumed_wh,
     (end_meter_value - start_meter_value) as calculated_energy,
     duration_minutes,
     calculated_cost
   FROM ocpp_charging_sessions
   WHERE id = '[SESSION_ID]';
   ```

2. **Check Meter Values Received**
   ```sql
   SELECT
     timestamp,
     measurand,
     value,
     unit,
     context
   FROM ocpp_meter_values
   WHERE session_id = '[SESSION_ID]'
   ORDER BY timestamp;
   ```

3. **Verify Rate Structure**
   ```sql
   SELECT *
   FROM rate_structures
   WHERE id = (
     SELECT rate_structure_id
     FROM stations
     WHERE id = (
       SELECT station_id
       FROM ocpp_chargers
       WHERE id = '[CHARGER_ID]'
     )
   );
   ```

**Common Solutions:**

**Problem: Energy Value Zero**
```
Solution:
1. Check if StopTransaction included meter stop value
2. Review meter value messages during session
3. Verify charger is reporting meter values
4. Check MeterValueSampleInterval configuration
5. May need charger firmware update
```

**Problem: Billing Incorrect**
```
Solution:
1. Verify correct rate structure linked to station
2. Check rate_periods for time-based rates
3. Confirm fixed charges applied correctly
4. Recalculate billing if needed using billingService
```

**Problem: Meter Values Not Received**
```
Solution:
1. Check MeterValueSampleInterval config key
2. Verify charger supports meter value reporting
3. Review message logs for MeterValues messages
4. May require ChangeConfiguration command
```

---

## Issue Category 3: Billing and Revenue

### 3.1 Missing or Incorrect Costs

**Symptoms:**
- Session cost shows $0 or NULL
- Cost doesn't match expected calculation
- Fixed charges not applied

**Diagnostic Steps:**

1. **Check Session Billing Status**
   ```sql
   SELECT
     transaction_id,
     energy_consumed_wh / 1000.0 as energy_kwh,
     calculated_cost,
     has_billing_calculation
   FROM ocpp_charging_sessions
   WHERE id = '[SESSION_ID]';
   ```

2. **Verify Station Linked**
   ```sql
   SELECT
     c.charge_point_id,
     c.station_id,
     s.name as station_name,
     s.rate_structure_id
   FROM ocpp_chargers c
   LEFT JOIN stations s ON c.station_id = s.id
   WHERE c.id = '[CHARGER_ID]';
   ```

3. **Check Rate Structure Exists**
   ```sql
   SELECT *
   FROM rate_structures
   WHERE id = '[RATE_STRUCTURE_ID]';
   ```

4. **Review Billing Breakdown**
   ```sql
   SELECT *
   FROM billing_breakdowns
   WHERE charging_session_id = '[SESSION_ID]';
   ```

**Common Solutions:**

**Problem: No Rate Structure Linked**
```sql
-- Link charger to station with rates
UPDATE ocpp_chargers
SET station_id = '[STATION_ID]'
WHERE id = '[CHARGER_ID]';

-- Or create default rate structure
INSERT INTO rate_structures (user_id, name, base_rate, is_default)
VALUES ('[USER_ID]', 'Default Rate', 0.30, true);
```

**Problem: Billing Not Calculated**
```typescript
// Trigger billing recalculation
import { billingService } from './lib/billingService';

// For single session
await billingService.calculateSessionBilling(sessionId);

// For date range
await billingService.recalculateBilling(userId, startDate, endDate);
```

**Problem: Fixed Charges Missing**
```sql
-- Check if fixed charges exist
SELECT *
FROM fixed_charges
WHERE station_id = '[STATION_ID]'
  AND start_date <= CURRENT_DATE
  AND (end_date IS NULL OR end_date >= CURRENT_DATE);

-- Create fixed charge if missing
INSERT INTO fixed_charges (
  user_id, station_id, charge_name,
  charge_type, amount, start_date
)
VALUES (
  '[USER_ID]', '[STATION_ID]', 'Session Fee',
  'PerSession', 1.00, CURRENT_DATE
);
```

### 3.2 Revenue Discrepancies

**Symptoms:**
- Total revenue doesn't match expectations
- Revenue reports inconsistent
- Missing sessions in reports

**Diagnostic Steps:**

1. **Count Sessions by Status**
   ```sql
   SELECT
     session_status,
     COUNT(*) as count,
     SUM(energy_consumed_wh)/1000.0 as total_kwh,
     SUM(calculated_cost) as total_revenue
   FROM ocpp_charging_sessions
   WHERE user_id = '[USER_ID]'
     AND start_timestamp >= '[START_DATE]'
     AND start_timestamp < '[END_DATE]'
   GROUP BY session_status;
   ```

2. **Compare OCPP vs Legacy Sessions**
   ```sql
   -- OCPP revenue
   SELECT
     SUM(calculated_cost) as ocpp_revenue
   FROM ocpp_charging_sessions
   WHERE session_status = 'Completed';

   -- Legacy revenue
   SELECT
     SUM(calculated_cost) as legacy_revenue
   FROM charging_sessions;
   ```

3. **Check for NULL Costs**
   ```sql
   SELECT COUNT(*)
   FROM ocpp_charging_sessions
   WHERE session_status = 'Completed'
     AND calculated_cost IS NULL;
   ```

**Common Solutions:**

**Problem: Sessions Missing Costs**
```sql
-- Find sessions without billing
SELECT id
FROM ocpp_charging_sessions
WHERE session_status = 'Completed'
  AND calculated_cost IS NULL;

-- Recalculate billing for these sessions
-- Use billingService.calculateSessionBilling() for each
```

**Problem: Duplicate Sessions**
```sql
-- Check for duplicates
SELECT
  transaction_id,
  COUNT(*) as count
FROM ocpp_charging_sessions
GROUP BY transaction_id
HAVING COUNT(*) > 1;

-- Remove duplicates (keep first)
DELETE FROM ocpp_charging_sessions
WHERE id NOT IN (
  SELECT MIN(id)
  FROM ocpp_charging_sessions
  GROUP BY transaction_id
);
```

---

## Issue Category 4: Remote Commands

### 4.1 Remote Commands Not Executing

**Symptoms:**
- Command status stays "Pending"
- Command never reaches charger
- No response received

**Diagnostic Steps:**

1. **Check Command Status**
   ```sql
   SELECT
     id,
     command_type,
     status,
     requested_at,
     executed_at,
     completed_at,
     error_message
   FROM ocpp_remote_commands
   WHERE id = '[COMMAND_ID]';
   ```

2. **Verify Charger Online**
   ```sql
   SELECT
     charge_point_id,
     connection_status,
     last_heartbeat_at
   FROM ocpp_chargers
   WHERE id = '[CHARGER_ID]';
   ```

3. **Check OCPP Server Processing**
   - Review server logs for command processing
   - Check if command was sent to charger
   - Look for WebSocket transmission

**Common Solutions:**

**Problem: Charger Offline**
```
Solution:
1. Wait for charger to come online
2. Commands will execute when connection restored
3. Or cancel command if no longer needed
```

**Problem: Invalid Command Parameters**
```
Solution:
1. Review command parameters in database
2. Check OCPP specification for required fields
3. Cancel and recreate command with correct parameters
```

**Problem: Command Timeout**
```sql
-- Mark command as timeout if stuck
UPDATE ocpp_remote_commands
SET
  status = 'Timeout',
  error_message = 'Command timed out after 5 minutes'
WHERE id = '[COMMAND_ID]'
  AND status = 'Sent'
  AND executed_at < NOW() - INTERVAL '5 minutes';
```

### 4.2 Remote Start Fails

**Symptoms:**
- RemoteStartTransaction rejected
- Status "Rejected" in command result
- Session doesn't start

**Diagnostic Steps:**

1. **Check Command Result**
   ```sql
   SELECT
     command_type,
     parameters,
     status,
     command_result
   FROM ocpp_remote_commands
   WHERE id = '[COMMAND_ID]';
   ```

2. **Verify RFID Tag Valid**
   ```sql
   SELECT *
   FROM operators
   WHERE rfid_card_number = '[ID_TAG]'
     AND status = 'Active';
   ```

3. **Check Connector Available**
   ```sql
   SELECT
     connector_id,
     status
   FROM ocpp_connectors
   WHERE id = '[CONNECTOR_ID]';
   ```

**Common Solutions:**

**Problem: Connector Not Available**
```
Solution:
1. Check connector status (must be "Available")
2. If "Faulted", clear error first
3. If "Occupied", wait for session to end
4. Try different connector
```

**Problem: Invalid ID Tag**
```
Solution:
1. Verify RFID number correct
2. Ensure operator status "Active"
3. Check authorization settings
4. Add to local authorization list if supported
```

**Problem: Vehicle Not Connected**
```
Solution:
1. Plug in vehicle first
2. Then send remote start command
3. Some chargers require vehicle connected
```

---

## Issue Category 5: Dashboard and UI

### 5.1 Dashboard Not Loading

**Symptoms:**
- Blank page or spinner forever
- Console errors
- Components not rendering

**Diagnostic Steps:**

1. **Check Browser Console**
   - F12 → Console tab
   - Look for error messages
   - Note the specific error

2. **Check Network Tab**
   - F12 → Network tab
   - Look for failed API requests
   - Check response codes (401, 403, 500)

3. **Verify Authentication**
   ```javascript
   // In browser console
   console.log(localStorage.getItem('supabase.auth.token'));
   ```

**Common Solutions:**

**Problem: Authentication Expired**
```
Solution:
1. Refresh page (may auto-refresh token)
2. If persists, log out and log in again
3. Check Supabase auth configuration
```

**Problem: API Request Failing**
```
Solution:
1. Check network connectivity
2. Verify Supabase URL correct in .env
3. Check RLS policies allow access
4. Review browser console for specific error
```

**Problem: JavaScript Error**
```
Solution:
1. Hard refresh (Ctrl+Shift+R)
2. Clear browser cache
3. Check if recent deployment introduced bugs
4. Review error message and fix code
```

### 5.2 Data Not Updating

**Symptoms:**
- Dashboard shows stale data
- Manual refresh required
- Real-time updates not working

**Diagnostic Steps:**

1. **Check Data Timestamp**
   - Look at "Last Updated" or similar
   - Compare to current time
   - Refresh manually

2. **Verify Database Data**
   ```sql
   -- Check latest data
   SELECT *
   FROM ocpp_charging_sessions
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. **Check for Errors**
   - Browser console
   - Network tab
   - React component errors

**Common Solutions:**

**Problem: No Auto-Refresh**
```
Solution:
1. Check if component has refresh interval
2. Add useEffect with polling if needed
3. Or implement Supabase real-time subscriptions
4. Manual refresh button as fallback
```

**Problem: Caching Issue**
```
Solution:
1. Hard refresh browser (Ctrl+Shift+R)
2. Disable cache in DevTools during development
3. Check service worker if PWA
```

**Problem: RLS Blocking Query**
```sql
-- Verify user can access data
SELECT * FROM ocpp_chargers
WHERE user_id = auth.uid();

-- If empty, check RLS policies
-- May need to add policies or fix user_id
```

---

## Issue Category 6: Performance

### 6.1 Slow Dashboard Loading

**Symptoms:**
- Dashboard takes >3 seconds to load
- Laggy interactions
- Browser freezes

**Diagnostic Steps:**

1. **Check Network Performance**
   - F12 → Network tab
   - Note request timing
   - Look for slow queries

2. **Review Database Queries**
   ```sql
   -- Enable query timing
   EXPLAIN ANALYZE
   SELECT * FROM ocpp_charging_sessions
   WHERE user_id = '[USER_ID]'
   ORDER BY start_timestamp DESC
   LIMIT 100;
   ```

3. **Check Data Volume**
   ```sql
   SELECT
     COUNT(*) as session_count,
     COUNT(*) FILTER (WHERE DATE(start_timestamp) = CURRENT_DATE) as today_count
   FROM ocpp_charging_sessions;
   ```

**Common Solutions:**

**Problem: Large Dataset**
```
Solution:
1. Implement pagination
2. Add date range filters
3. Limit default query results
4. Add database indexes
```

**Problem: Missing Indexes**
```sql
-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_timestamp
ON ocpp_charging_sessions(user_id, start_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_charger
ON ocpp_charging_sessions(charger_id);

CREATE INDEX IF NOT EXISTS idx_messages_charger_timestamp
ON ocpp_messages(charger_id, timestamp DESC);
```

**Problem: Inefficient Queries**
```
Solution:
1. Review query execution plans
2. Optimize WHERE clauses
3. Avoid N+1 queries
4. Use JOIN instead of multiple queries
5. Cache frequently accessed data
```

---

## Issue Category 7: OCPP Server

### 7.1 OCPP Server Not Responding

**Symptoms:**
- Health check fails
- No chargers can connect
- Server appears down

**Diagnostic Steps:**

1. **Check Server Process**
   ```bash
   # Check if process running
   ps aux | grep node

   # Check server port
   netstat -tuln | grep 443
   ```

2. **Check Health Endpoint**
   ```bash
   curl http://localhost:443/health
   ```

3. **Review Server Logs**
   ```bash
   # View recent logs
   tail -f /path/to/ocpp-server/logs/combined.log
   ```

**Common Solutions:**

**Problem: Server Crashed**
```bash
# Restart server
cd /path/to/ocpp-server
npm start

# Or if using PM2
pm2 restart ocpp-server
```

**Problem: Port Already in Use**
```bash
# Find process using port
lsof -i :443

# Kill process if needed
kill -9 [PID]

# Restart server
```

**Problem: Database Connection Lost**
```
Solution:
1. Check database server running
2. Verify connection string correct
3. Test database connection
4. Restart OCPP server
```

### 7.2 Memory or CPU Issues

**Symptoms:**
- Server slow to respond
- High memory usage
- CPU maxed out
- Frequent crashes

**Diagnostic Steps:**

1. **Check Resource Usage**
   ```bash
   # CPU and memory
   top -p [PID]

   # Or
   htop
   ```

2. **Review Connection Count**
   ```bash
   curl http://localhost:443/health | jq '.connections'
   ```

3. **Check for Memory Leaks**
   - Monitor memory over time
   - Look for steadily increasing memory
   - Review Node.js heap usage

**Common Solutions:**

**Problem: Too Many Connections**
```
Solution:
1. Review connection timeout settings
2. Implement connection limits
3. Close stale connections
4. Scale horizontally if needed
```

**Problem: Memory Leak**
```
Solution:
1. Restart server as temporary fix
2. Review code for memory leaks
3. Use memory profiling tools
4. Update to latest dependencies
```

**Problem: Inefficient Message Processing**
```
Solution:
1. Optimize message handlers
2. Implement async processing where possible
3. Add message queuing for high load
4. Cache frequently accessed data
```

---

## Emergency Procedures

### Complete System Failure

If the entire OCPP system is down:

1. **Immediate Actions**
   - Notify stakeholders
   - Switch to manual operations if possible
   - Document failure time and symptoms

2. **Triage**
   - Check OCPP server status
   - Verify database accessible
   - Test network connectivity
   - Review recent changes

3. **Recovery**
   - Restart OCPP server
   - Verify chargers reconnecting
   - Check for data integrity
   - Test sample transaction

4. **Rollback Plan**
   - If new deployment caused issue, rollback
   - Restore database from backup if corrupted
   - Revert configuration changes

### Data Corruption

If database corruption suspected:

1. **Stop Writes**
   - Set system to read-only if possible
   - Prevent further corruption

2. **Assess Damage**
   - Identify corrupted records
   - Determine scope of impact
   - Check backup recency

3. **Restore**
   - Restore from latest good backup
   - Replay transactions if possible
   - Verify data integrity

4. **Prevent Recurrence**
   - Identify root cause
   - Implement safeguards
   - Increase backup frequency

---

## Escalation Procedures

### Level 1: Self-Service
- Use this troubleshooting guide
- Review documentation
- Check logs and dashboards
- Attempt common solutions

### Level 2: Team Support
- Contact operations team
- Provide detailed issue description
- Include relevant logs and screenshots
- Follow team guidance

### Level 3: Technical Lead
- Complex technical issues
- System-wide problems
- Performance issues
- Architecture decisions

### Level 4: Critical Incident
- Complete system down
- Data loss
- Security breach
- Safety concern

**Escalation Contact:**
- Level 2: support@company.com
- Level 3: tech-lead@company.com
- Level 4: emergency@company.com / [Emergency Phone]

---

## Logging and Diagnostics

### Enable Debug Logging

**OCPP Server:**
```javascript
// config/index.ts
export const config = {
  logging: {
    level: 'debug',  // Change from 'info' to 'debug'
  }
};
```

**Frontend:**
```javascript
// Enable verbose logging
localStorage.setItem('debug', 'ocpp:*');
```

### Collecting Diagnostic Information

When reporting issues, include:

1. **Issue Description**
   - What happened
   - When it happened
   - How often it occurs

2. **Steps to Reproduce**
   - Detailed steps
   - Expected vs actual behavior

3. **System Information**
   - Browser version (if frontend)
   - Server version
   - Database version
   - Affected charger IDs

4. **Logs**
   - OCPP server logs
   - Browser console logs
   - Database query logs
   - Network traces

5. **Relevant Data**
   - Session IDs
   - Transaction IDs
   - Message IDs
   - Timestamps

---

## Preventive Maintenance

### Daily Checks
- Review health dashboard
- Check error logs
- Monitor active sessions
- Verify billing calculations

### Weekly Tasks
- Analyze error trends
- Review performance metrics
- Update documentation
- Test backup restoration

### Monthly Tasks
- Full system testing
- Security updates
- Database optimization
- Capacity planning

### Quarterly Tasks
- Comprehensive audit
- Disaster recovery drill
- Documentation review
- Training refresher

---

## Additional Resources

**Documentation:**
- OCPP 1.6J Specification
- System Architecture Document
- API Documentation
- Database Schema Reference

**Tools:**
- Health Check: http://your-server.com/health
- Database Admin: Supabase Dashboard
- Log Viewer: [Log Management Tool]
- Monitoring: [Monitoring Dashboard]

**Contacts:**
- Operations: operations@company.com
- Technical Support: support@company.com
- Emergency: [Phone Number]

---

## Conclusion

This troubleshooting guide covers the most common issues. For issues not covered here, contact technical support with detailed diagnostic information. Always document solutions to new issues to improve this guide.

**Remember:** Safety first! If any electrical or safety issue is suspected, immediately disable the affected charger and contact qualified personnel.
