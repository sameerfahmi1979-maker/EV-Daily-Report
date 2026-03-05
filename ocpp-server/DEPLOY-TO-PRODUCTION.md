# Deploy OCPP Server to crm.energy-stream.net

This guide will help you deploy the OCPP server to your production server at `crm.energy-stream.net`.

## Prerequisites

- SSH access to crm.energy-stream.net
- Node.js 18+ installed on the server
- PM2 or systemd for process management
- Port 9000 available (or configure a different port)
- Domain/subdomain configured to point to your server

## Option 1: Deploy with PM2 (Recommended)

### Step 1: Upload Files to Server

```bash
# From your local machine, upload the ocpp-server folder
scp -r ocpp-server user@crm.energy-stream.net:/var/www/
```

### Step 2: SSH into Server

```bash
ssh user@crm.energy-stream.net
cd /var/www/ocpp-server
```

### Step 3: Install Dependencies

```bash
npm install
npm install -g pm2  # If not already installed
```

### Step 4: Create Production .env File

```bash
cat > .env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://qflxupfeyktdrpilctyo.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmbHh1cGZleWt0ZHJwaWxjdHlvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI1NjE4NSwiZXhwIjoyMDgxODMyMTg1fQ.oGE3Ij1pVUcPHq-k6CJWKRzzfj-6J0SYH3TvDLhH5iE

# OCPP Server Configuration
PORT=9000
HOST=0.0.0.0
NODE_ENV=production

# Logging
LOG_LEVEL=info
EOF
```

### Step 5: Build and Start

```bash
# Build TypeScript
npx tsc

# Start with PM2
pm2 start dist/server.js --name ocpp-server

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
```

### Step 6: Verify Server is Running

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs ocpp-server

# Test health endpoint
curl http://localhost:9000/health
```

## Option 2: Deploy with Docker

### Step 1: Upload Files

```bash
scp -r ocpp-server user@crm.energy-stream.net:/var/www/
```

### Step 2: SSH and Build

```bash
ssh user@crm.energy-stream.net
cd /var/www/ocpp-server

# Build Docker image
docker build -t ocpp-server .

# Run container
docker run -d \
  --name ocpp-server \
  --restart unless-stopped \
  -p 9000:9000 \
  --env-file .env \
  ocpp-server
```

### Step 3: Verify

```bash
docker ps
docker logs ocpp-server
curl http://localhost:9000/health
```

## Option 3: Deploy with Systemd

### Step 1: Upload and Build

```bash
scp -r ocpp-server user@crm.energy-stream.net:/var/www/
ssh user@crm.energy-stream.net
cd /var/www/ocpp-server
npm install
npx tsc
```

### Step 2: Create Systemd Service

```bash
sudo nano /etc/systemd/system/ocpp-server.service
```

Paste this content:

```ini
[Unit]
Description=OCPP Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/ocpp-server
ExecStart=/usr/bin/node /var/www/ocpp-server/dist/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ocpp-server
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Step 3: Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable ocpp-server
sudo systemctl start ocpp-server
sudo systemctl status ocpp-server
```

## Firewall Configuration

Make sure port 9000 is open:

```bash
# For UFW
sudo ufw allow 9000/tcp

# For iptables
sudo iptables -A INPUT -p tcp --dport 9000 -j ACCEPT
sudo iptables-save
```

## Nginx Reverse Proxy (Optional but Recommended)

Create WebSocket proxy for better security:

```bash
sudo nano /etc/nginx/sites-available/ocpp
```

```nginx
upstream ocpp_backend {
    server 127.0.0.1:9000;
}

server {
    listen 80;
    server_name ocpp.crm.energy-stream.net;

    location / {
        proxy_pass http://ocpp_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/ocpp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL/TLS with Let's Encrypt (Recommended)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d ocpp.crm.energy-stream.net
```

## Configure Charger Connection

Once deployed, update your charger configuration to:

**Without SSL:**
```
ws://crm.energy-stream.net:9000/244901000006
```

**With Nginx + SSL (Recommended):**
```
wss://ocpp.crm.energy-stream.net/244901000006
```

## Monitoring

### PM2 Monitoring

```bash
# View logs
pm2 logs ocpp-server

# Monitor in real-time
pm2 monit

# Restart server
pm2 restart ocpp-server
```

### Docker Monitoring

```bash
# View logs
docker logs -f ocpp-server

# Restart
docker restart ocpp-server
```

### Systemd Monitoring

```bash
# View logs
sudo journalctl -u ocpp-server -f

# Restart
sudo systemctl restart ocpp-server
```

## Health Check

Test the server is accessible:

```bash
# From server
curl http://localhost:9000/health

# From external
curl http://crm.energy-stream.net:9000/health
```

## Update Frontend Configuration

Update your React app's OCPP service to point to production:

```typescript
// In src/lib/ocppService.ts or wherever OCPP_SERVER_URL is defined
const OCPP_SERVER_URL = 'wss://ocpp.crm.energy-stream.net';
// or
const OCPP_SERVER_URL = 'ws://crm.energy-stream.net:9000';
```

## Troubleshooting

### Server won't start

```bash
# Check logs
pm2 logs ocpp-server --lines 100

# Verify .env file exists
cat /var/www/ocpp-server/.env

# Test configuration
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"
```

### Port already in use

```bash
# Find what's using port 9000
sudo lsof -i :9000
sudo netstat -tulpn | grep 9000

# Kill the process or change PORT in .env
```

### Connection refused from charger

```bash
# Check firewall
sudo ufw status
sudo iptables -L -n | grep 9000

# Test WebSocket connection
npm install -g wscat
wscat -c ws://localhost:9000/244901000006
```

### Can't reach from outside

```bash
# Verify server is listening on 0.0.0.0
sudo netstat -tulpn | grep 9000

# Should show: 0.0.0.0:9000, not 127.0.0.1:9000
```

## Maintenance

### Update Server

```bash
# Pull latest code
cd /var/www/ocpp-server
# ... upload new files ...

# Rebuild
npx tsc

# Restart
pm2 restart ocpp-server
# or
sudo systemctl restart ocpp-server
# or
docker restart ocpp-server
```

### Backup

```bash
# Backup logs
cp -r /var/www/ocpp-server/logs /backup/ocpp-logs-$(date +%Y%m%d)

# Database is in Supabase (already backed up)
```

## Security Recommendations

1. **Use SSL/TLS** - Always use `wss://` in production
2. **Firewall** - Only allow necessary ports
3. **Authentication** - OCPP has basic auth if needed
4. **Monitor logs** - Watch for suspicious activity
5. **Keep updated** - Regularly update Node.js and dependencies
6. **Backup .env** - Keep service keys secure

## Need Help?

If you encounter issues:
1. Check server logs
2. Verify firewall settings
3. Test health endpoint
4. Check Supabase connectivity
5. Review charger configuration
