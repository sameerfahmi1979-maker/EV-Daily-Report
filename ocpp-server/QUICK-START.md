# Quick Start Guide - OCPP Server for Charger 244901000006

**Goal**: Get your charger connected to the OCPP server in 10 minutes

---

## THE PROBLEM

Your charger **cannot connect** because the **OCPP server is not running**.

Currently:
- ❌ No .env file
- ❌ Server not built
- ❌ Server not started
- ❌ Port 9000 not listening

---

## THE SOLUTION - 6 SIMPLE STEPS

### Step 1: Get Your Supabase Service Key (2 minutes)

1. Open https://supabase.com/dashboard
2. Select your project
3. Click **Settings** → **API**
4. Find **Service role** key
5. Click **Reveal** and **Copy** it

**Important**: Use `service_role` key, not `anon` key!

---

### Step 2: Create .env File (1 minute)

```bash
cd /tmp/cc-agent/61720874/project/ocpp-server

# Create the file
nano .env
```

Paste this (replace the key):
```
SUPABASE_URL=https://qflxupfeyktdrpilctyo.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
OCPP_PORT=9000
NODE_ENV=production
LOG_LEVEL=info
```

Save: CTRL+X, then Y, then Enter

---

### Step 3: Install & Build (2 minutes)

```bash
cd /tmp/cc-agent/61720874/project/ocpp-server

# Install packages
npm install

# Build the server
npm run build
```

Wait for it to complete.

---

### Step 4: Open Firewall (1 minute)

```bash
# Ubuntu/Debian
sudo ufw allow 9000/tcp
sudo ufw reload

# OR CentOS/RHEL
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload
```

---

### Step 5: Start Server (1 minute)

**Option A - Simple (for testing)**:
```bash
cd /tmp/cc-agent/61720874/project/ocpp-server
npm start
```

Keep terminal open. Logs appear here.

**Option B - Production (recommended)**:
```bash
# Install PM2
sudo npm install -g pm2

# Start server
cd /tmp/cc-agent/61720874/project/ocpp-server
pm2 start npm --name "ocpp-server" -- start

# Save configuration
pm2 save

# Set up auto-start
pm2 startup
# Run the command it shows you

# View logs
pm2 logs ocpp-server
```

---

### Step 6: Verify Server is Running (1 minute)

```bash
# Check port is listening
netstat -tulpn | grep 9000
```

Expected output:
```
tcp  0  0.0.0.0:9000  0.0.0.0:*  LISTEN
```

**Test connection**:
```bash
# Install wscat
npm install -g wscat

# Test
wscat -c ws://localhost:9000/TEST
```

Should say: `Connected`

---

## CONFIGURE YOUR CHARGER (2 minutes)

### On ChargeCore Verde Admin Interface:

1. Go to: **Settings** → **Network** → **OCPP**

2. Set these values:
   ```
   OCPP URL:          ws://crm.energy-stream.net:9000/244901000006
   Port:              9000
   Protocol:          OCPP 1.6J
   Charge Point ID:   244901000006
   ```

3. **Save** settings

4. **Reboot** charger

---

## WATCH IT CONNECT

View server logs:
```bash
pm2 logs ocpp-server
# or if using npm start, just watch the terminal
```

You should see:
```
[INFO] New WebSocket connection from <charger-ip>
[INFO] Charger ID: 244901000006
[INFO] Received BootNotification
[INFO] Vendor: ChargeCore Verde
[INFO] Sending response: Accepted
[INFO] Received Heartbeat
```

**Success!** Your charger is now connected.

---

## IF IT DOESN'T WORK

### Problem: Server won't start

**Check .env file exists**:
```bash
ls -la /tmp/cc-agent/61720874/project/ocpp-server/.env
```

**Check the service key is correct**:
```bash
cat /tmp/cc-agent/61720874/project/ocpp-server/.env
```

Should show the full service role key starting with `eyJ...`

---

### Problem: Charger says "Connection Failed"

**Option 1: Use Direct IP Instead of Domain**

Find your server's IP:
```bash
curl ifconfig.me
```

Configure charger with:
```
ws://YOUR_SERVER_IP:9000/244901000006
```

Example:
```
ws://203.0.113.45:9000/244901000006
```

This bypasses DNS issues.

**Option 2: Check Domain DNS**

```bash
nslookup crm.energy-stream.net
```

Should return your server's IP. If not, configure DNS:
- Type: A Record
- Name: crm.energy-stream.net
- Value: Your server IP
- TTL: 300

---

### Problem: No logs appear when charger connects

**Check charger URL is exactly**:
```
ws://crm.energy-stream.net:9000/244901000006
```

Not:
- ❌ `wss://` (that's for SSL)
- ❌ Missing `:9000`
- ❌ Wrong charger ID
- ❌ Extra spaces

**Test from another device**:
```bash
wscat -c ws://crm.energy-stream.net:9000/TEST
```

If this doesn't connect, the problem is network/firewall.

---

## VERIFY IN DATABASE

After connection, check database:

```sql
SELECT
  charge_point_id,
  connection_status,
  last_heartbeat_at
FROM ocpp_chargers
WHERE charge_point_id = '244901000006';
```

Should show:
- `connection_status`: Online
- `last_heartbeat_at`: Recent timestamp

---

## QUICK DIAGNOSTIC

Run this to check everything:

```bash
# 1. Server running?
pm2 status | grep ocpp

# 2. Port listening?
netstat -tulpn | grep 9000

# 3. Firewall open?
sudo ufw status | grep 9000

# 4. DNS resolves?
nslookup crm.energy-stream.net

# 5. Can connect locally?
wscat -c ws://localhost:9000/TEST
```

All should show positive results.

---

## TEST WITH LOCAL IP FIRST

If domain issues, test locally:

1. **Get server's local IP**:
   ```bash
   ip addr show | grep inet
   # Look for 192.168.x.x or 10.x.x.x
   ```

2. **Configure charger with local IP**:
   ```
   ws://192.168.1.100:9000/244901000006
   ```

3. **If this works**: Problem is domain/internet. Use IP for now.

4. **If this doesn't work**: Check firewall, server running, correct port.

---

## SUMMARY

**You must do these 6 things in order**:

1. ✓ Get Supabase service role key
2. ✓ Create .env file with the key
3. ✓ Run `npm install` and `npm run build`
4. ✓ Open firewall port 9000
5. ✓ Start server with `npm start` or PM2
6. ✓ Configure charger and reboot

**After that**:
- Server should show connection logs
- Database should update with "Online" status
- Charger should show "Connected" or "Online"

---

## GETTING HELP

If still not working, provide:

```bash
# Run these commands and share output:

# 1. Server logs
pm2 logs ocpp-server --lines 50

# 2. Port status
netstat -tulpn | grep 9000

# 3. .env exists?
ls -la /tmp/cc-agent/61720874/project/ocpp-server/.env

# 4. Build exists?
ls -la /tmp/cc-agent/61720874/project/ocpp-server/dist

# 5. DNS check
nslookup crm.energy-stream.net

# 6. Local connection test
wscat -c ws://localhost:9000/TEST
```

Also provide:
- Charger error message (exact text or photo)
- Where is server hosted? (AWS, local server, etc.)
- Can you ping crm.energy-stream.net from charger's network?

---

## YOUR CONFIGURATION

**Your Details**:
- Charger ID: `244901000006`
- Model: ChargeCore Verde nuclue-600-720-12-lc--n
- Domain: `crm.energy-stream.net`
- Port: `9000`
- Protocol: OCPP 1.6J

**Charger URL**:
```
ws://crm.energy-stream.net:9000/244901000006
```

**Alternative (if domain doesn't work)**:
```
ws://YOUR_SERVER_IP:9000/244901000006
```

---

## READY TO START?

```bash
# Go to ocpp-server directory
cd /tmp/cc-agent/61720874/project/ocpp-server

# Follow Step 1-6 above
# Then configure your charger
# Watch the magic happen!
```

Good luck! The charger will connect once the server is running.
