# Production Deployment Guide for crm.energy-stream.net

## Quick Deployment Steps

### 1. Upload OCPP Server to Your Server

From your local machine, upload the `ocpp-server` folder:

```bash
# Replace 'user' with your SSH username
scp -r ocpp-server user@crm.energy-stream.net:/var/www/
```

### 2. SSH into Your Server

```bash
ssh user@crm.energy-stream.net
cd /var/www/ocpp-server
```

### 3. Choose Deployment Method

#### Option A: PM2 (Easiest, Recommended)

```bash
# Run the deployment script
bash deploy-pm2.sh
```

That's it! The script will:
- Install dependencies
- Build TypeScript
- Start the server with PM2
- Configure auto-restart on boot

#### Option B: Systemd (System Service)

```bash
# Run with sudo
sudo bash deploy-systemd.sh
```

#### Option C: Docker

```bash
# Build and run
docker build -t ocpp-server .
docker run -d --name ocpp-server --restart unless-stopped -p 9000:9000 --env-file .env ocpp-server
```

### 4. Open Firewall Port

```bash
# Allow port 9000
sudo ufw allow 9000/tcp
```

### 5. Test the Server

```bash
# From the server
curl http://localhost:9000/health

# From your local machine (replace with your server IP)
curl http://crm.energy-stream.net:9000/health
```

You should see:
```json
{
  "status": "healthy",
  "uptime": 12,
  "connections": {...},
  ...
}
```

### 6. Configure Your Charger

Update your Autel MaxiCharger AC Elite (244901000006) to connect to:

```
ws://crm.energy-stream.net:9000/244901000006
```

**Connection details:**
- Protocol: `ws://` (or `wss://` if using SSL)
- Host: `crm.energy-stream.net`
- Port: `9000` (or `443` if using Nginx with SSL)
- Path: `/244901000006` (your charger ID)

## Optional: Setup SSL with Nginx (Highly Recommended)

### 1. Install Nginx and Certbot

```bash
sudo apt-get update
sudo apt-get install nginx certbot python3-certbot-nginx
```

### 2. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/ocpp
```

Copy the content from `nginx-config-example.conf` (provided in ocpp-server folder)

### 3. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/ocpp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Get SSL Certificate

```bash
sudo certbot --nginx -d ocpp.crm.energy-stream.net
```

### 5. Update Charger to Use WSS

```
wss://ocpp.crm.energy-stream.net/244901000006
```

## Monitoring Commands

### PM2

```bash
pm2 status              # Show all processes
pm2 logs ocpp-server    # View logs
pm2 restart ocpp-server # Restart server
pm2 stop ocpp-server    # Stop server
```

### Systemd

```bash
sudo systemctl status ocpp-server          # Show status
sudo journalctl -u ocpp-server -f         # View logs (live)
sudo systemctl restart ocpp-server        # Restart server
```

### Docker

```bash
docker ps                      # Show running containers
docker logs -f ocpp-server     # View logs (live)
docker restart ocpp-server     # Restart server
```

## Verification Checklist

- [ ] Server is running (check with `pm2 status` or `systemctl status`)
- [ ] Health endpoint responds: `curl http://localhost:9000/health`
- [ ] Port 9000 is open in firewall
- [ ] Server is accessible from outside: `curl http://crm.energy-stream.net:9000/health`
- [ ] Charger is configured with correct WebSocket URL
- [ ] (Optional) SSL certificate is installed
- [ ] (Optional) Nginx proxy is configured

## Troubleshooting

### Server won't start

```bash
# Check logs
pm2 logs ocpp-server
# or
sudo journalctl -u ocpp-server -n 50

# Verify .env file exists and has correct values
cat /var/www/ocpp-server/.env
```

### Can't connect from outside

```bash
# Check if server is listening on 0.0.0.0 (not 127.0.0.1)
sudo netstat -tulpn | grep 9000

# Check firewall
sudo ufw status
sudo iptables -L -n | grep 9000
```

### Charger can't connect

1. Test WebSocket with wscat:
   ```bash
   npm install -g wscat
   wscat -c ws://crm.energy-stream.net:9000/244901000006
   ```

2. Check server logs for connection attempts:
   ```bash
   pm2 logs ocpp-server
   ```

3. Verify charger configuration matches exactly

## Update Frontend to Use Production Server

In your React app, update the OCPP WebSocket URL:

```typescript
// In src/lib/ocppService.ts or similar
const OCPP_SERVER_URL = import.meta.env.PROD
  ? 'wss://ocpp.crm.energy-stream.net'  // Production with SSL
  : 'ws://localhost:9000';               // Local development
```

## Files Included for Deployment

- `DEPLOY-TO-PRODUCTION.md` - Detailed deployment guide
- `deploy-pm2.sh` - Automated PM2 deployment script
- `deploy-systemd.sh` - Automated Systemd deployment script
- `nginx-config-example.conf` - Nginx reverse proxy configuration
- `Dockerfile` - Docker containerization
- `.env.example` - Environment variables template

## Need Help?

If you encounter issues:
1. Check the detailed guide in `ocpp-server/DEPLOY-TO-PRODUCTION.md`
2. Review logs using the commands above
3. Verify all prerequisites are met
4. Test each step individually

## Security Notes

- Keep your `.env` file secure (contains Supabase service key)
- Use SSL/TLS in production (`wss://` instead of `ws://`)
- Keep Node.js and dependencies updated
- Monitor logs regularly for suspicious activity
- Consider setting up log rotation
