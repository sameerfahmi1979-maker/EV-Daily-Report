# OCPP Server Setup Guide

## Issue Summary
The OCPP server is not running, which is why chargers cannot connect. The server needs to be started on port 9000.

## Quick Fix Steps

### 1. Get Supabase Service Key

You need your Supabase service role key. Get it from:
- Go to your Supabase project dashboard
- Navigate to Settings > API
- Copy the `service_role` key (NOT the anon key)

### 2. Create OCPP Server Environment File

Create `/ocpp-server/.env` with the following:

```env
SUPABASE_URL=https://qflxupfeyktdrpilctyo.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
OCPP_PORT=9000
NODE_ENV=production
LOG_LEVEL=info
```

Replace `your_service_role_key_here` with your actual service role key.

### 3. Install Dependencies

```bash
cd ocpp-server
npm install
```

### 4. Build the Server

```bash
npm run build
```

### 5. Start the Server

```bash
npm start
```

The server will start on port 9000.

## Verify Server is Running

### Check Health Endpoint

```bash
curl http://localhost:9000/health
```

You should see a JSON response with server status.

### Check Server Logs

The server will log all connections and messages. Watch for:
- "OCPP Server listening on port 9000"
- Connection attempts from chargers

## Charger Connection

Once the server is running, chargers should connect using WebSocket:

```
ws://YOUR_SERVER_IP:9000/ocpp/{CHARGE_POINT_ID}
```

For local testing:
```
ws://localhost:9000/ocpp/CHARGER_001
```

## Port Configuration

The server uses port 9000 by default. If you need a different port:

1. Update `OCPP_PORT` in `/ocpp-server/.env`
2. Restart the server
3. Update charger configurations to point to the new port

## Firewall Rules

Make sure port 9000 is open in your firewall:

```bash
# For UFW (Ubuntu)
sudo ufw allow 9000/tcp

# For firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload
```

## Production Deployment

For production:

1. Use a process manager (PM2, systemd)
2. Set up reverse proxy (nginx) with SSL
3. Use secure WebSocket (wss://)
4. Configure proper firewall rules
5. Monitor logs and health endpoint

See `/ocpp-server/DEPLOYMENT.md` for detailed production setup.

## Troubleshooting

### Server Won't Start

- Check if port 9000 is already in use
- Verify Supabase credentials are correct
- Check server logs for errors

### Chargers Can't Connect

- Verify server is running (check health endpoint)
- Confirm port 9000 is accessible
- Check firewall rules
- Verify charger is configured with correct WebSocket URL

### Messages Not Appearing

- Check message logs in the web interface
- Verify RLS policies allow access
- Check server logs for errors
