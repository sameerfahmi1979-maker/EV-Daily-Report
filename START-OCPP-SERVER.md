# Start OCPP Server - Quick Guide

## Server is Ready!

The OCPP server has been configured and built. Everything is ready to go.

## Start the Server

### Option 1: Using the Start Script

```bash
cd ocpp-server
./start-server.sh
```

### Option 2: Using npm directly

```bash
cd ocpp-server
npm start
```

The server will start and display:
```
OCPP Server listening on port 9000
Health check available at http://localhost:9000/health
WebSocket endpoint: ws://localhost:9000/ocpp/{chargePointId}
```

## Verify Server is Running

Open a new terminal and run:

```bash
curl http://localhost:9000/health
```

You should see:
```json
{
  "status": "healthy",
  "uptime": 10,
  "connections": {
    "total": 0,
    "online": 0,
    "offline": 0
  }
}
```

## Connect Your Charger

Configure your EV charger to connect to:

```
ws://YOUR_SERVER_IP:9000/ocpp/CHARGER_ID
```

**Example:**
- Local testing: `ws://localhost:9000/ocpp/CHARGER_001`
- Same network: `ws://192.168.1.100:9000/ocpp/CHARGER_001`
- Remote: `ws://your-domain.com:9000/ocpp/CHARGER_001`

Replace:
- `YOUR_SERVER_IP` with your actual server IP address
- `CHARGER_ID` with your charger's unique identifier

## Monitor Connection

Once your charger connects, you'll see logs in the server terminal:

```
New charger connection { chargePointId: 'CHARGER_001' }
Handling OCPP Call { action: 'BootNotification' }
```

And in your web dashboard:
- Go to "OCPP Monitoring" > "Live Monitoring"
- You'll see the charger appear with its status
- View real-time messages in "Message Logs"

## Troubleshooting

### Can't Connect from External Network

1. Find your server's IP address:
   ```bash
   hostname -I
   ```

2. Make sure port 9000 is open:
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 9000/tcp

   # CentOS/RHEL
   sudo firewall-cmd --permanent --add-port=9000/tcp
   sudo firewall-cmd --reload
   ```

3. Check if router port forwarding is needed for external access

### Server Not Starting

- Verify .env file exists and has correct credentials
- Check if port 9000 is already in use
- Review server logs for error messages

### Charger Won't Connect

- Verify charger WebSocket URL is correct
- Check charger configuration for authentication settings
- Ensure charger and server are on same network (for local testing)
- Review firewall rules

## Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

## Running in Background (Production)

For production, use PM2:

```bash
npm install -g pm2
cd ocpp-server
pm2 start npm --name "ocpp-server" -- start
pm2 save
pm2 startup
```

Monitor with:
```bash
pm2 status
pm2 logs ocpp-server
```

## Next Steps

1. Start the server
2. Configure your charger with the WebSocket URL
3. Test the connection
4. Monitor in the web dashboard
5. Start charging!

For detailed production deployment, see `/ocpp-server/DEPLOYMENT.md`
