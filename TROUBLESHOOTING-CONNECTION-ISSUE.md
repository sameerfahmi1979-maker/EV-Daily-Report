# Troubleshooting: Charger 244901000006 Connection Failed

**Issue**: Charger cannot connect to `ws://crm.energy-stream.net:9000/244901000006`

**Date**: December 22, 2025

---

## PROBLEM IDENTIFIED: OCPP Server Not Running

### Current Status Check

✅ Charger registered in database
✅ URL configured in charger
❌ **OCPP server NOT started**
❌ **.env file NOT created**
❌ **Server NOT built**
❌ **Port 9000 NOT listening**

**Root Cause**: The OCPP server has never been started. The charger cannot connect because there's no server listening on port 9000.

---

## SOLUTION: Start the OCPP Server

Follow these steps in order:

### Step 1: Get Supabase Service Role Key

1. Go to https://supabase.com/dashboard
2. Select your project: `qflxupfeyktdrpilctyo`
3. Click **Settings** (gear icon in left sidebar)
4. Click **API**
5. Find **Service role** section
6. Click **Reveal** to show the key
7. **Copy** the entire key (starts with `eyJ...`)

**IMPORTANT**: You need the `service_role` key, NOT the `anon` key!

---

### Step 2: Create .env File

Run these commands on your server where you want to host the OCPP server:

```bash
cd /tmp/cc-agent/61720874/project/ocpp-server

# Create .env file
cat > .env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://qflxupfeyktdrpilctyo.supabase.co
SUPABASE_SERVICE_KEY=PASTE_YOUR_SERVICE_ROLE_KEY_HERE

# Server Configuration
OCPP_PORT=9000

# Environment
NODE_ENV=production

# Logging
LOG_LEVEL=info
EOF
```

**Replace** `PASTE_YOUR_SERVICE_ROLE_KEY_HERE` with the actual service role key from Step 1.

---

### Step 3: Install Dependencies

```bash
cd /tmp/cc-agent/61720874/project/ocpp-server

# Install Node.js packages
npm install
```

This will install:
- ws (WebSocket server)
- @supabase/supabase-js (database client)
- Other dependencies

---

### Step 4: Build the Server

```bash
cd /tmp/cc-agent/61720874/project/ocpp-server

# Compile TypeScript to JavaScript
npm run build
```

This creates the `dist/` directory with compiled code.

---

### Step 5: Open Firewall Port

**On Ubuntu/Debian (UFW)**:
```bash
sudo ufw allow 9000/tcp
sudo ufw reload
sudo ufw status
```

**On CentOS/RHEL (firewalld)**:
```bash
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

**On Cloud Provider** (AWS, GCP, Azure):
- Add inbound rule for TCP port 9000
- Source: 0.0.0.0/0 (or restrict to your charger's IP)

---

### Step 6: Start the OCPP Server

**Option A: Direct Start (for testing)**
```bash
cd /tmp/cc-agent/61720874/project/ocpp-server
npm start
```

Keep this terminal open. You'll see logs in real-time.

**Option B: PM2 (for production - recommended)**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start server with PM2
cd /tmp/cc-agent/61720874/project/ocpp-server
pm2 start npm --name "ocpp-server" -- start

# Save PM2 configuration
pm2 save

# Set up auto-start on boot
pm2 startup
# Follow the command it gives you (sudo ...)

# View logs
pm2 logs ocpp-server

# Check status
pm2 status
```

**Option C: Docker (alternative)**
```bash
cd /tmp/cc-agent/61720874/project/ocpp-server
docker build -t ocpp-server .
docker run -d --name ocpp-server -p 9000:9000 --env-file .env ocpp-server
docker logs -f ocpp-server
```

---

### Step 7: Verify Server is Running

**Check port is listening**:
```bash
# Using netstat
netstat -tulpn | grep 9000

# Using ss
ss -tulpn | grep 9000

# Using lsof
sudo lsof -i :9000
```

Expected output:
```
tcp  0  0.0.0.0:9000  0.0.0.0:*  LISTEN  12345/node
```

**Check logs**:
```bash
# If using npm start
# Logs are in the terminal

# If using PM2
pm2 logs ocpp-server --lines 50

# If using Docker
docker logs ocpp-server --tail 50
```

Expected logs:
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

---

## Step 8: Test Local Connection

Before testing from the charger, test locally:

**Install wscat**:
```bash
npm install -g wscat
```

**Test connection**:
```bash
wscat -c ws://localhost:9000/TEST
```

Expected response:
```
Connected (press CTRL+C to quit)
```

Then you can type OCPP messages to test. Press CTRL+C to exit.

---

## Step 9: Configure DNS/Domain

### Option A: Direct IP (Quickest Test)

If `crm.energy-stream.net` is not resolving or routing correctly, try using your server's **direct IP address** first:

**Find your server's public IP**:
```bash
curl ifconfig.me
```

**Configure charger with IP**:
```
ws://YOUR_SERVER_IP:9000/244901000006
```

Example:
```
ws://203.0.113.45:9000/244901000006
```

This bypasses DNS issues and confirms the server is working.

### Option B: Configure Domain DNS

If using domain, ensure DNS is set up:

**Check DNS resolution**:
```bash
nslookup crm.energy-stream.net
dig crm.energy-stream.net
```

Should return your server's IP address.

**Set DNS A Record**:
- Domain: `crm.energy-stream.net`
- Type: A
- Value: Your server's public IP
- TTL: 300 (5 minutes)

Wait 5-10 minutes for DNS propagation.

**Test from charger's network**:
```bash
# From a device on the same network as the charger
ping crm.energy-stream.net
telnet crm.energy-stream.net 9000
```

---

## Step 10: Configure Charger Again

Now that the server is running, configure your charger:

**ChargeCore Verde Admin Interface**:
1. Log into charger admin (touchscreen or web interface)
2. Go to: **Settings** → **Network** → **OCPP**
3. Set these values:
   - **Central System URL**: `ws://crm.energy-stream.net:9000/244901000006`
     (or use IP: `ws://YOUR_IP:9000/244901000006`)
   - **Protocol**: OCPP 1.6J
   - **Charge Point Identity**: 244901000006
   - **WebSocket**: Enabled
4. **Save** settings
5. **Reboot** charger

---

## Step 11: Monitor Connection

Watch the server logs for incoming connection:

```bash
pm2 logs ocpp-server --lines 100
```

You should see:

**1. WebSocket Connection**
```
[INFO] New WebSocket connection from <charger-ip>
[INFO] URL: /244901000006
[INFO] Charger ID extracted: 244901000006
```

**2. BootNotification**
```
[INFO] Received message from 244901000006
[INFO] Action: BootNotification
[INFO] Charger Info:
  - Vendor: ChargeCore Verde
  - Model: nuclue-600-720-12-lc--n
  - Serial: ...
  - Firmware: 1.0.0
[INFO] Updating charger in database
[INFO] Sending BootNotification response: Accepted
```

**3. StatusNotification**
```
[INFO] Received message from 244901000006
[INFO] Action: StatusNotification
[INFO] Connector 1: Available
[INFO] Connector 2: Available
```

**4. Heartbeat**
```
[INFO] Received message from 244901000006
[INFO] Action: Heartbeat
[INFO] Sending Heartbeat response
```

---

## Step 12: Verify in Database

After successful connection:

```sql
-- Check charger is online
SELECT
  charge_point_id,
  connection_status,
  registration_status,
  last_heartbeat_at,
  updated_at
FROM ocpp_chargers
WHERE charge_point_id = '244901000006';
```

Expected:
- `connection_status`: Online
- `registration_status`: Accepted
- `last_heartbeat_at`: Recent timestamp (within last 60 seconds)

```sql
-- Check messages are being logged
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
- BootNotification
- StatusNotification
- Heartbeat (multiple entries)

---

## Common Issues and Solutions

### Issue 1: "Connection Refused"

**Symptoms**: Charger shows "Connection Refused" or "Cannot connect"

**Causes**:
- OCPP server not running
- Firewall blocking port 9000
- Wrong IP/domain

**Solutions**:
```bash
# Check server is running
pm2 status
ps aux | grep node

# Check port is listening
netstat -tulpn | grep 9000

# Check firewall
sudo ufw status
sudo firewall-cmd --list-ports

# Test local connection
wscat -c ws://localhost:9000/TEST
```

---

### Issue 2: "Connection Timeout"

**Symptoms**: Charger tries to connect but times out

**Causes**:
- Network routing issue
- Firewall dropping packets
- Domain not resolving

**Solutions**:
```bash
# Test from charger's network location
ping crm.energy-stream.net
telnet crm.energy-stream.net 9000

# Check server logs for connection attempts
pm2 logs ocpp-server

# Try direct IP instead of domain
# Configure charger with: ws://YOUR_SERVER_IP:9000/244901000006
```

---

### Issue 3: "DNS Resolution Failed"

**Symptoms**: Charger cannot resolve `crm.energy-stream.net`

**Causes**:
- DNS not configured
- DNS propagation delay
- DNS server issue

**Solutions**:
```bash
# Check DNS from server
nslookup crm.energy-stream.net
dig crm.energy-stream.net

# Check DNS from charger's network
# (use another device on same network)
nslookup crm.energy-stream.net

# Temporary fix: Use IP address instead
ws://YOUR_IP:9000/244901000006
```

---

### Issue 4: Server Starts But No Logs Appear

**Symptoms**: Server seems running but no logs when charger connects

**Causes**:
- Charger not configured correctly
- Charger using wrong URL
- Network isolation

**Solutions**:
```bash
# Verify server is actually listening
sudo lsof -i :9000
netstat -tulpn | grep 9000

# Test with wscat from external machine
wscat -c ws://crm.energy-stream.net:9000/TEST

# Check charger logs/display for error messages

# Verify charger URL exactly matches:
ws://crm.energy-stream.net:9000/244901000006
# (no extra spaces, correct protocol ws:// not wss://)
```

---

### Issue 5: "No Data in Database"

**Symptoms**: Charger connects but database stays empty

**Causes**:
- Wrong Supabase service key
- Database connection error
- RLS policy blocking writes

**Solutions**:
```bash
# Check .env file
cd /tmp/cc-agent/61720874/project/ocpp-server
cat .env | grep SUPABASE_SERVICE_KEY

# Test database connection
node -e "const {createClient} = require('@supabase/supabase-js'); require('dotenv').config(); const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); s.from('ocpp_chargers').select('id').limit(1).then(d => console.log('DB OK:', d.data)).catch(e => console.error('DB ERROR:', e.message));"

# Check server logs for database errors
pm2 logs ocpp-server --lines 100 | grep -i error
```

---

## Network Architecture Checklist

```
☐ Server accessible from internet
☐ Port 9000 open in firewall
☐ OCPP server process running
☐ Domain DNS pointing to server IP
☐ Charger has internet access
☐ Charger can reach server IP
☐ No proxy/NAT blocking WebSocket
☐ .env file has correct credentials
```

---

## Quick Diagnostic Commands

Run these to quickly diagnose issues:

```bash
# 1. Is server running?
pm2 status | grep ocpp-server
# Expected: online

# 2. Is port listening?
netstat -tulpn | grep 9000
# Expected: LISTEN on 0.0.0.0:9000

# 3. Can server connect to database?
cd /tmp/cc-agent/61720874/project/ocpp-server
node -e "require('dotenv').config(); const {createClient} = require('@supabase/supabase-js'); createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY).from('ocpp_chargers').select('count').single().then(console.log);"
# Expected: { count: ... }

# 4. Is firewall allowing port 9000?
sudo ufw status | grep 9000
# Expected: 9000/tcp ALLOW

# 5. Does domain resolve?
nslookup crm.energy-stream.net
# Expected: Your server's IP

# 6. Can you connect locally?
wscat -c ws://localhost:9000/TEST
# Expected: Connected

# 7. Can you connect via domain?
wscat -c ws://crm.energy-stream.net:9000/TEST
# Expected: Connected

# 8. Recent logs?
pm2 logs ocpp-server --lines 20
# Check for errors
```

---

## Alternative: Test on Local Network First

If you're having internet/domain issues, test locally first:

### Setup 1: Server and Charger on Same Network

1. **Start server on local machine**:
   ```bash
   cd /tmp/cc-agent/61720874/project/ocpp-server
   npm start
   ```

2. **Get local IP**:
   ```bash
   # Linux/Mac
   ip addr show | grep inet
   # or
   ifconfig | grep inet

   # Look for IP like: 192.168.1.100
   ```

3. **Configure charger with local IP**:
   ```
   ws://192.168.1.100:9000/244901000006
   ```

4. **Test connection**:
   - Charger should connect immediately
   - Watch terminal for logs
   - If this works, problem is with public domain/internet access

---

## Summary Checklist

Before charger will connect:

- [ ] **.env file created** in ocpp-server directory
- [ ] **Service role key** added to .env (not anon key!)
- [ ] **Dependencies installed**: `npm install`
- [ ] **Server built**: `npm run build`
- [ ] **Server started**: `npm start` or `pm2 start`
- [ ] **Port 9000 open** in firewall
- [ ] **Domain DNS configured** (or using direct IP)
- [ ] **Charger URL correct**: `ws://crm.energy-stream.net:9000/244901000006`
- [ ] **Charger OCPP enabled** and saved
- [ ] **Charger rebooted** after configuration

---

## What to Provide for More Help

If still having issues, provide:

1. **Server logs**:
   ```bash
   pm2 logs ocpp-server --lines 100
   ```

2. **Port check**:
   ```bash
   netstat -tulpn | grep 9000
   ```

3. **DNS check**:
   ```bash
   nslookup crm.energy-stream.net
   ```

4. **Local WebSocket test**:
   ```bash
   wscat -c ws://localhost:9000/TEST
   ```

5. **Charger error message** (photo of screen or exact text)

6. **Network topology**:
   - Where is server hosted? (AWS, local, etc.)
   - Where is charger located?
   - Same network or different?

---

## Next Steps

1. **Start the OCPP server** (Step 1-6 above)
2. **Verify it's running** (Step 7)
3. **Test locally** (Step 8)
4. **Configure charger** (Step 10)
5. **Monitor logs** (Step 11)
6. **Verify in database** (Step 12)

The charger will connect once the OCPP server is running and accessible!
