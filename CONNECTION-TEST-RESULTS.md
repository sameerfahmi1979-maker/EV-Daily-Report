# Connection Test Results for Charger 244901000006

**Test Date**: December 22, 2025
**Domain**: crm.energy-stream.net
**Charger ID**: 244901000006

---

## Database Check Results

### ✅ Charger Registered in Database

Your charger **244901000006** was found in the database:

```
Charger ID:         244901000006
Vendor:             ChargeCore Verde
Model:              nuclue-600-720-12-lc--n
Firmware Version:   1.0.0
Registration:       Pending
Connection Status:  Unknown
Last Heartbeat:     NULL (never connected)
User Assigned:      Yes (8845fcbe-0f8f-42d9-9a65-988acbb54f3c)
Created Date:       2025-12-22 00:39:51
```

### ❌ No OCPP Messages Found

**Result**: No OCPP messages in the database for this charger.

This means:
- The charger has never successfully connected to the OCPP server
- No BootNotification received
- No Heartbeat messages logged
- No status notifications recorded

### ❌ No Charging Sessions Found

**Result**: No charging sessions recorded for this charger.

This means:
- The charger has never processed a charging transaction via OCPP
- No StartTransaction messages received
- No meter values recorded

---

## Connection Status: NOT CONNECTED

### Summary

Your charger **244901000006** is:
- ✅ **Registered** in the database
- ✅ **Assigned** to a user account
- ✅ **Ready** to accept connections
- ❌ **Not connected** to the OCPP server
- ❌ **No communication** history

### What This Means

The charger record exists (likely created manually or via bulk import), but the physical charger has **never connected** to your OCPP server at `crm.energy-stream.net`.

---

## Required Actions

To establish connection, you need to:

### 1. Deploy OCPP Server

The OCPP server needs to be running and accessible at `crm.energy-stream.net:9000`.

**Quick Start**:
```bash
cd ocpp-server

# Create .env file with Supabase credentials
nano .env

# Install and build
npm install
npm run build

# Start server
npm start
```

**Required in .env file**:
```env
SUPABASE_URL=https://qflxupfeyktdrpilctyo.supabase.co
SUPABASE_SERVICE_KEY=<your-service-role-key>
OCPP_PORT=9000
NODE_ENV=production
LOG_LEVEL=info
```

### 2. Configure Charger

Set these parameters in your ChargeCore Verde charger (model nuclue-600-720-12-lc--n):

**OCPP Configuration**:
```
URL:      ws://crm.energy-stream.net:9000/244901000006
Port:     9000
Protocol: OCPP 1.6J
```

**Steps**:
1. Access charger admin interface
2. Go to Settings → Network → OCPP
3. Enter the URL above
4. Select OCPP 1.6J protocol
5. Enable OCPP
6. Save and reboot

### 3. Verify Network

Ensure network connectivity between charger and server:

```bash
# From charger's network, test:
ping crm.energy-stream.net
telnet crm.energy-stream.net 9000

# From server, verify port is open:
netstat -tulpn | grep 9000
```

### 4. Monitor First Connection

Watch the OCPP server logs:
```bash
pm2 logs ocpp-server
# or if using npm:
# npm start (logs show in console)
```

Look for:
- WebSocket connection from charger IP
- BootNotification message
- Heartbeat messages every 60 seconds

---

## Expected Connection Flow

Once configured, here's what should happen:

### Step 1: WebSocket Connection
```
[INFO] New WebSocket connection established
[INFO] Client IP: <charger-ip>
[INFO] Charger ID: 244901000006
```

### Step 2: BootNotification
```
[INFO] Received BootNotification from 244901000006
[INFO] Vendor: ChargeCore Verde
[INFO] Model: nuclue-600-720-12-lc--n
[INFO] Firmware: 1.0.0
[INFO] Response: Accepted (interval: 60s)
```

**Database Update**:
- `connection_status` → "Online"
- `registration_status` → "Accepted"
- `last_heartbeat_at` → current timestamp

### Step 3: StatusNotification
```
[INFO] Received StatusNotification from 244901000006
[INFO] Connector 1: Available
[INFO] Connector 2: Available
```

**Database Update**:
- Connectors created/updated in `ocpp_connectors` table

### Step 4: Heartbeat (every 60 seconds)
```
[INFO] Received Heartbeat from 244901000006
[INFO] Sending Heartbeat response
```

**Database Update**:
- `last_heartbeat_at` updated every 60 seconds

---

## Verification Queries

After connection, run these queries to verify:

### Check Charger Connected

```sql
SELECT
  charge_point_id,
  connection_status,  -- Should be 'Online'
  registration_status, -- Should be 'Accepted'
  last_heartbeat_at,  -- Should be recent timestamp
  updated_at
FROM ocpp_chargers
WHERE charge_point_id = '244901000006';
```

### Check Messages Logged

```sql
SELECT
  action,
  direction,
  timestamp,
  processing_status
FROM ocpp_messages om
JOIN ocpp_chargers oc ON om.charger_id = oc.id
WHERE oc.charge_point_id = '244901000006'
ORDER BY timestamp DESC
LIMIT 10;
```

Expected messages:
- BootNotification (Incoming)
- Heartbeat (Incoming)
- StatusNotification (Incoming)

### Check Connectors Created

```sql
SELECT
  connector_id,
  connector_type,
  status,
  power_kw,
  last_status_update
FROM ocpp_connectors conn
JOIN ocpp_chargers ch ON conn.charger_id = ch.id
WHERE ch.charge_point_id = '244901000006';
```

Expected: 2 connectors (typically for ChargeCore Verde)

---

## Troubleshooting Guide

### Problem: Charger Shows "Connection Failed"

**Possible Causes**:
1. OCPP server not running
2. Firewall blocking port 9000
3. Wrong URL in charger configuration
4. DNS not resolving crm.energy-stream.net
5. Network connectivity issues

**Solutions**:
```bash
# Check server is running
ps aux | grep node
pm2 status

# Check port is listening
netstat -tulpn | grep 9000

# Check firewall
sudo ufw status

# Test DNS
nslookup crm.energy-stream.net

# Test connectivity
telnet crm.energy-stream.net 9000
```

### Problem: Connected But No Data in Database

**Possible Causes**:
1. Wrong Supabase service role key
2. RLS policies blocking writes
3. Database connection error

**Solutions**:
```bash
# Verify .env file
cd ocpp-server
cat .env | grep SUPABASE_SERVICE_KEY

# Check server logs for errors
pm2 logs ocpp-server --lines 50

# Test database connection
node -e "const {createClient} = require('@supabase/supabase-js'); const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); s.from('ocpp_chargers').select('count').single().then(console.log);"
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ChargeCore Verde Charger (244901000006)                   │
│  Model: nuclue-600-720-12-lc--n                            │
│  Firmware: 1.0.0                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ ws://crm.energy-stream.net:9000/244901000006
                     │ (OCPP 1.6J WebSocket)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  OCPP Server                                                 │
│  Domain: crm.energy-stream.net                              │
│  Port: 9000                                                  │
│  Protocol: WebSocket (OCPP 1.6J)                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS API (Service Role)
                     ↓
┌─────────────────────────────────────────────────────────────┐
│  Supabase Database                                           │
│  URL: qflxupfeyktdrpilctyo.supabase.co                      │
│  Tables: ocpp_chargers, ocpp_messages, ocpp_sessions, etc.  │
│  RLS: Service role has full access                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema Ready

The database has all required tables and RLS policies configured:

✅ `ocpp_chargers` - Charger registration and status
✅ `ocpp_connectors` - Individual connector status
✅ `ocpp_charging_sessions` - Charging transactions
✅ `ocpp_meter_values` - Energy measurements
✅ `ocpp_messages` - Complete OCPP message log
✅ `ocpp_remote_commands` - Remote control commands
✅ `ocpp_configuration_keys` - Charger configuration
✅ `ocpp_firmware_updates` - Firmware management
✅ `ocpp_reservations` - Connector reservations
✅ `ocpp_charger_availability` - Availability scheduling

All tables have:
- ✅ RLS enabled
- ✅ Service role policies (full access)
- ✅ User policies (restricted to owned chargers)
- ✅ Indexes for performance
- ✅ Foreign key constraints

---

## Next Steps

1. **Get Supabase Service Role Key**:
   - Go to https://supabase.com/dashboard
   - Select your project
   - Settings → API → Copy `service_role` key

2. **Deploy OCPP Server**:
   - Create `.env` file with credentials
   - Install dependencies: `npm install`
   - Build: `npm run build`
   - Start: `npm start` or use PM2

3. **Configure Charger**:
   - Set URL: `ws://crm.energy-stream.net:9000/244901000006`
   - Enable OCPP 1.6J
   - Reboot charger

4. **Monitor Connection**:
   - Watch server logs
   - Check database for status updates
   - Verify BootNotification and Heartbeat

5. **Test Charging**:
   - Swipe RFID card
   - Plug in vehicle
   - Monitor charging session in database

---

## Detailed Guide

For complete step-by-step instructions, see:
**`CHARGER-244901000006-CONNECTION-GUIDE.md`**

---

## Summary

**Current Status**: ❌ NOT CONNECTED

Your charger 244901000006 is registered and ready, but needs:
1. OCPP server running at crm.energy-stream.net:9000
2. Charger configured with correct WebSocket URL
3. Network connectivity between charger and server

Once connected, you'll see:
- Connection status: Online
- Regular heartbeat messages
- Charging sessions recorded
- Real-time meter values

**Configuration URL**: `ws://crm.energy-stream.net:9000/244901000006`
