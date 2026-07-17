# Connection Guide for Charger 244901000006

## Current Status

Your charger **244901000006** is already registered in the database with the following details:

- **Charger ID**: 244901000006
- **Vendor**: ChargeCore Verde
- **Model**: nuclue-600-720-12-lc--n
- **Firmware Version**: 1.0.0
- **Registration Status**: Pending (waiting for first connection)
- **Connection Status**: Unknown (never connected to OCPP server)
- **User ID**: Assigned to user `8845fcbe-0f8f-42d9-9a65-988acbb54f3c`
- **Created**: December 22, 2025

**Status**: Charger has been registered but has NOT yet connected to the OCPP server. No messages or charging sessions recorded.

---

## OCPP Server Setup

### Step 1: Configure Environment Variables

The OCPP server needs the Supabase service role key. Create the `.env` file:

```bash
cd ocpp-server
cat > .env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://qflxupfeyktdrpilctyo.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY_HERE

# Server Configuration
OCPP_PORT=9000

# Environment
NODE_ENV=production

# Logging
LOG_LEVEL=info
EOF
```

**To get your Supabase Service Role Key:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy the `service_role` key (not the anon key!)
5. Replace `YOUR_SERVICE_ROLE_KEY_HERE` in the .env file

### Step 2: Install Dependencies and Build

```bash
cd ocpp-server
npm install
npm run build
```

### Step 3: Start the OCPP Server

```bash
npm start
```

Or use PM2 for production:
```bash
npm install -g pm2
pm2 start npm --name "ocpp-server" -- start
pm2 save
pm2 startup
```

### Step 4: Verify Server is Running

The server should display:
```
========================================
OCPP Server Started
========================================
Port: 9000
WebSocket URL: ws://0.0.0.0:9000
Environment: production
========================================
Server ready for connections...
```

Test the WebSocket connection:
```bash
# Install wscat if you don't have it
npm install -g wscat

# Test connection
wscat -c ws://localhost:9000/TEST
```

---

## Charger Configuration

### Access Charger Settings

1. **Physical Access**: Use the charger's admin interface (touchscreen or web interface)
2. **Network Access**: Ensure the charger can reach `crm.energy-stream.net` on port 9000

### Configure OCPP Settings

Set the following parameters in your ChargeCore Verde charger:

| Parameter | Value |
|-----------|-------|
| **OCPP URL** | `ws://crm.energy-stream.net:9000/244901000006` |
| **Port** | 9000 |
| **Protocol** | OCPP 1.6J |
| **Charge Point ID** | 244901000006 |
| **Connection Type** | WebSocket (WS) |

### Configuration Steps

1. Access charger admin interface
2. Navigate to **Settings** → **Network** → **OCPP**
3. Set **OCPP Central System URL**: `ws://crm.energy-stream.net:9000/244901000006`
4. Set **Protocol Version**: OCPP 1.6J
5. Enable **OCPP**
6. **Save** settings
7. **Reboot** the charger

---

## Network Requirements

### Firewall Rules

Ensure your server allows incoming connections on port 9000:

**UFW (Ubuntu/Debian)**:
```bash
sudo ufw allow 9000/tcp
sudo ufw reload
```

**firewalld (CentOS/RHEL)**:
```bash
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload
```

### Domain Configuration

Ensure `crm.energy-stream.net` is configured to:
- Point to your OCPP server IP address
- Allow WebSocket connections on port 9000
- Forward traffic to the OCPP server

Test domain resolution:
```bash
# Check DNS
nslookup crm.energy-stream.net

# Test connectivity
nc -zv crm.energy-stream.net 9000
```

---

## Testing the Connection

### Monitor Server Logs

Watch the OCPP server logs for incoming connections:

```bash
# If using npm start
# Logs appear in console

# If using PM2
pm2 logs ocpp-server

# If using Docker
docker logs -f ocpp-server
```

### Expected Connection Flow

When the charger connects, you should see:

1. **WebSocket Connection**:
   ```
   [INFO] New WebSocket connection from <charger-ip>
   [INFO] Charger ID: 244901000006
   ```

2. **BootNotification**:
   ```
   [INFO] Received BootNotification from 244901000006
   [INFO] Vendor: ChargeCore Verde
   [INFO] Model: nuclue-600-720-12-lc--n
   [INFO] Firmware: 1.0.0
   [INFO] Sending BootNotification response: Accepted
   ```

3. **Heartbeat Messages** (every 60 seconds):
   ```
   [INFO] Received Heartbeat from 244901000006
   [INFO] Sending Heartbeat response
   ```

4. **Status Notifications**:
   ```
   [INFO] Received StatusNotification from 244901000006
   [INFO] Connector 1: Available
   [INFO] Connector 2: Available
   ```

### Verify in Database

After connection, check the database:

```sql
-- Check charger status updated
SELECT
  charge_point_id,
  connection_status,
  registration_status,
  last_heartbeat_at,
  updated_at
FROM ocpp_chargers
WHERE charge_point_id = '244901000006';
```

Expected results:
- `connection_status`: Online
- `registration_status`: Accepted
- `last_heartbeat_at`: Recent timestamp

```sql
-- Check OCPP messages logged
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

Expected actions:
- BootNotification
- Heartbeat
- StatusNotification

```sql
-- Check connectors created
SELECT
  connector_id,
  connector_type,
  status,
  power_kw
FROM ocpp_connectors conn
JOIN ocpp_chargers ch ON conn.charger_id = ch.id
WHERE ch.charge_point_id = '244901000006';
```

---

## Troubleshooting

### Charger Cannot Connect

**Problem**: Charger shows "Connection Failed" or "Offline"

**Solutions**:

1. **Check Network Connectivity**:
   ```bash
   # From the charger's network, test:
   ping crm.energy-stream.net
   telnet crm.energy-stream.net 9000
   ```

2. **Verify OCPP Server is Running**:
   ```bash
   # Check if port is listening
   netstat -tulpn | grep 9000
   # or
   ss -tulpn | grep 9000
   ```

3. **Check Firewall**:
   ```bash
   sudo ufw status
   # Ensure port 9000 is allowed
   ```

4. **Verify URL Configuration**:
   - Ensure URL is exactly: `ws://crm.energy-stream.net:9000/244901000006`
   - Protocol is `ws://` not `wss://` (unless you have SSL configured)
   - Port is included: `:9000`
   - Charger ID matches: `244901000006`

5. **Check DNS Resolution**:
   ```bash
   nslookup crm.energy-stream.net
   # Should return your server's IP
   ```

### No Messages in Database

**Problem**: Charger connected but no data in database

**Solutions**:

1. **Check Service Role Key**:
   ```bash
   cd ocpp-server
   grep SUPABASE_SERVICE_KEY .env
   # Verify the key is correct and starts with 'eyJ'
   ```

2. **Check RLS Policies**:
   ```sql
   -- Verify service role has access
   SELECT tablename, policyname, roles
   FROM pg_policies
   WHERE tablename = 'ocpp_chargers'
     AND 'service_role' = ANY(roles);
   ```

3. **Check Server Logs for Errors**:
   ```bash
   pm2 logs ocpp-server --lines 100
   # Look for database errors
   ```

### Connection Drops Frequently

**Problem**: Charger connects but disconnects after a few seconds/minutes

**Solutions**:

1. **Check Heartbeat Interval**:
   - Default is 60 seconds
   - Charger should send heartbeat every 60 seconds
   - Server timeout is 120 seconds

2. **Network Stability**:
   - Check for network issues
   - Verify router/firewall doesn't close long connections
   - Consider enabling TCP keep-alive

3. **Load Balancer/Proxy Settings**:
   - If using a reverse proxy, ensure WebSocket timeout is set to at least 3600 seconds
   - Check proxy logs for timeout errors

---

## Testing Charging Session

Once connected, test a charging session:

### Start a Charge

1. **Swipe RFID Card** on the charger
2. **Plug in Vehicle** to connector
3. **Watch Logs** for:
   - Authorize request
   - StartTransaction
   - StatusNotification (Preparing → Charging)
   - MeterValues (periodic energy readings)

### Monitor Session in Database

```sql
-- Check active sessions
SELECT
  cs.transaction_id,
  cs.start_timestamp,
  cs.id_tag,
  cs.session_status,
  oc.charge_point_id
FROM ocpp_charging_sessions cs
JOIN ocpp_chargers oc ON cs.charger_id = oc.id
WHERE oc.charge_point_id = '244901000006'
  AND cs.session_status = 'Active'
ORDER BY cs.start_timestamp DESC;
```

```sql
-- Check meter values
SELECT
  timestamp,
  measurand,
  value,
  unit
FROM ocpp_meter_values mv
JOIN ocpp_charging_sessions cs ON mv.session_id = cs.id
JOIN ocpp_chargers oc ON cs.charger_id = oc.id
WHERE oc.charge_point_id = '244901000006'
ORDER BY timestamp DESC
LIMIT 20;
```

### Stop the Charge

1. **Unplug Vehicle** or **Swipe RFID Card** again
2. **Watch Logs** for:
   - StatusNotification (Finishing)
   - StopTransaction
   - StatusNotification (Available)

---

## Quick Reference

### Charger Details
- **Charger ID**: 244901000006
- **OCPP URL**: `ws://crm.energy-stream.net:9000/244901000006`
- **Protocol**: OCPP 1.6J
- **Port**: 9000

### Server Commands

```bash
# Start server
cd ocpp-server && npm start

# Start with PM2
pm2 start npm --name "ocpp-server" -- start

# View logs
pm2 logs ocpp-server

# Restart server
pm2 restart ocpp-server

# Stop server
pm2 stop ocpp-server
```

### Database Checks

```sql
-- Charger status
SELECT charge_point_id, connection_status, last_heartbeat_at
FROM ocpp_chargers WHERE charge_point_id = '244901000006';

-- Recent messages
SELECT action, direction, timestamp FROM ocpp_messages om
JOIN ocpp_chargers oc ON om.charger_id = oc.id
WHERE oc.charge_point_id = '244901000006'
ORDER BY timestamp DESC LIMIT 10;

-- Active sessions
SELECT transaction_id, start_timestamp, session_status
FROM ocpp_charging_sessions cs
JOIN ocpp_chargers oc ON cs.charger_id = oc.id
WHERE oc.charge_point_id = '244901000006' AND session_status = 'Active';
```

---

## Connection Result

### Current State: NOT CONNECTED

Your charger **244901000006** is registered in the database but has **never connected** to the OCPP server.

**To establish connection:**

1. **Set up OCPP server** (follow Step 1-4 above)
2. **Configure charger** with URL: `ws://crm.energy-stream.net:9000/244901000006`
3. **Reboot charger**
4. **Monitor logs** for BootNotification
5. **Verify in database** that status changes to "Online"

**Once connected, you should see:**
- Connection Status: Online
- Registration Status: Accepted
- Last Heartbeat: Recent timestamp
- OCPP messages logged in database
- Connectors status: Available

---

## Support

If you need help with the connection, check:
1. Server logs for connection attempts
2. Charger display for error messages
3. Database for any partial data
4. Network connectivity between charger and server

The system is ready to accept your charger - you just need to complete the OCPP server setup and configure the charger to connect to `ws://crm.energy-stream.net:9000/244901000006`.
