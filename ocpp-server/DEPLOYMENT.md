# OCPP Server Deployment Guide

This guide provides step-by-step instructions for deploying the OCPP WebSocket server to production.

## Pre-Deployment Checklist

- [ ] Supabase database is set up with OCPP schema
- [ ] Environment variables are configured
- [ ] Charger connection URLs are prepared
- [ ] Monitoring and alerting are set up
- [ ] Backup strategy is defined

## Quick Start - Railway Deployment

Railway is the recommended platform for quick deployment with minimal configuration.

### Step 1: Prepare Your Project

1. Ensure your code is pushed to GitHub
2. Navigate to [Railway](https://railway.app)
3. Sign in with GitHub

### Step 2: Create New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Railway will detect the Dockerfile automatically

### Step 3: Configure Environment Variables

Add the following environment variables:

```
SUPABASE_URL=https://qflxupfeyktdrpilctyo.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
OCPP_PORT=9000
NODE_ENV=production
LOG_LEVEL=info
```

### Step 4: Configure Service

1. Go to Settings
2. Set "Port" to 9000
3. Enable "Public Networking"
4. Railway will provide a public URL like `your-service.railway.app`

### Step 5: Deploy

1. Railway automatically builds and deploys
2. Monitor logs for successful startup
3. Note your WebSocket URL: `ws://your-service.railway.app:9000/{chargePointId}`

### Step 6: Configure Chargers

Update each charger's OCPP server URL to point to your Railway deployment.

## Alternative: Render Deployment

### Step 1: Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your Git repository

### Step 2: Configure Service

- **Name**: ocpp-server
- **Environment**: Docker
- **Region**: Choose closest to your chargers
- **Instance Type**: Starter ($7/month minimum)

### Step 3: Add Environment Variables

```
SUPABASE_URL=https://qflxupfeyktdrpilctyo.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
OCPP_PORT=9000
NODE_ENV=production
LOG_LEVEL=info
```

### Step 4: Deploy

Render automatically builds from Dockerfile and deploys.

WebSocket URL: `ws://your-service.onrender.com/{chargePointId}`

## Production Deployment with Custom Server

### Prerequisites

- Ubuntu 20.04+ server
- Docker and Docker Compose installed
- Domain name configured
- SSL certificate (Let's Encrypt recommended)

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Create application directory
sudo mkdir -p /opt/ocpp-server
cd /opt/ocpp-server
```

### Step 2: Clone Repository

```bash
git clone https://github.com/your-repo/ocpp-server.git .
```

### Step 3: Configure Environment

```bash
# Create .env file
cat > .env << EOF
SUPABASE_URL=https://qflxupfeyktdrpilctyo.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
OCPP_PORT=9000
NODE_ENV=production
LOG_LEVEL=info
EOF

# Secure the file
chmod 600 .env
```

### Step 4: Create Docker Compose File

```yaml
version: '3.8'

services:
  ocpp-server:
    build: .
    container_name: ocpp-server
    ports:
      - "9000:9000"
    env_file:
      - .env
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Step 5: Deploy with Docker Compose

```bash
# Build and start
sudo docker-compose up -d

# View logs
sudo docker-compose logs -f

# Check status
sudo docker-compose ps
```

### Step 6: Configure Firewall

Open the WebSocket port for OCPP connections:

**For UFW:**
```bash
sudo ufw allow 9000/tcp
```

**For firewalld:**
```bash
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload
```

### Step 7: Connect Your Domain

Your domain `crm.energy-stream.net` should be configured to forward WebSocket traffic to your server on port 9000. The OCPP server will be accessible at:

```
ws://crm.energy-stream.net:9000/{chargePointId}
```

For secure connections, configure your domain provider or hosting platform to provide SSL/TLS termination if needed.

## Post-Deployment

### 1. Verify Server is Running

```bash
# Check Docker container
docker ps | grep ocpp-server

# View logs
docker logs ocpp-server -f

# Test WebSocket connection
wscat -c ws://your-server:9000/TEST
```

### 2. Configure Chargers

Update each charger's OCPP configuration:

- **URL**: `ws://crm.energy-stream.net:9000/{chargePointId}`
- **Port**: 9000
- **Protocol**: OCPP 1.6J

Example for charger 244901000006:
```
ws://crm.energy-stream.net:9000/244901000006
```

### 3. Monitor First Connection

1. Watch server logs during first charger connection
2. Verify BootNotification is received and accepted
3. Check database for new charger record
4. Confirm heartbeat messages are received

### 4. Set Up Monitoring

#### Log Monitoring

```bash
# Real-time logs
docker logs -f ocpp-server

# Last 100 lines
docker logs --tail 100 ocpp-server

# Logs with timestamps
docker logs -t ocpp-server
```

#### Health Checks

Create a systemd service for health monitoring:

```bash
sudo nano /etc/systemd/system/ocpp-health-check.service
```

```ini
[Unit]
Description=OCPP Server Health Check
After=docker.service

[Service]
Type=oneshot
ExecStart=/usr/bin/docker exec ocpp-server node -e "console.log('healthy')"

[Install]
WantedBy=multi-user.target
```

### 5. Database Verification

Check that data is being stored correctly:

```sql
-- Check chargers table
SELECT * FROM ocpp_chargers ORDER BY created_at DESC LIMIT 10;

-- Check recent messages
SELECT * FROM ocpp_messages ORDER BY timestamp DESC LIMIT 20;

-- Check active sessions
SELECT * FROM ocpp_charging_sessions WHERE session_status = 'Active';
```

## Scaling Considerations

### Horizontal Scaling

For multiple chargers (100+):

1. Use load balancer (AWS ALB, Nginx)
2. Deploy multiple server instances
3. Implement sticky sessions (same charger → same server)
4. Use Redis for shared state (future enhancement)

### Vertical Scaling

For high-frequency meter values:

- Increase server memory
- Optimize database indexes
- Batch meter value inserts
- Use connection pooling

## Backup Strategy

### Database Backups

Supabase provides automatic backups. For additional safety:

1. Enable Point-in-Time Recovery (PITR)
2. Schedule regular exports
3. Test restoration procedures

### Configuration Backups

```bash
# Backup environment variables
cp .env .env.backup

# Backup Docker compose
cp docker-compose.yml docker-compose.yml.backup

# Store in secure location
```

## Troubleshooting

### Server Won't Start

```bash
# Check logs
docker logs ocpp-server

# Verify environment variables
docker exec ocpp-server env | grep SUPABASE

# Test database connection
docker exec ocpp-server node -e "require('./dist/config/index.js').validateConfig()"
```

### Chargers Can't Connect

1. Check firewall allows port 9000
2. Verify server is publicly accessible
3. Test with wscat from external network
4. Check Nginx configuration if using reverse proxy

### High Memory Usage

```bash
# Check container stats
docker stats ocpp-server

# Increase memory limit in docker-compose.yml
services:
  ocpp-server:
    mem_limit: 512m
```

## Rollback Procedure

If issues occur:

```bash
# Stop current version
docker-compose down

# Checkout previous version
git checkout previous-tag

# Rebuild and restart
docker-compose up -d --build

# Verify logs
docker-compose logs -f
```

## Maintenance

### Updating the Server

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Monitor logs
docker-compose logs -f
```

### Database Migrations

When schema changes are required:

1. Test migration in staging environment
2. Schedule maintenance window
3. Backup database
4. Apply migration
5. Restart server
6. Verify all functions work

## Security Checklist

- [ ] SSL/TLS enabled for WebSocket connections
- [ ] Supabase service key is kept secure
- [ ] Firewall configured to allow only necessary ports
- [ ] Server is kept updated with security patches
- [ ] Logs are monitored for suspicious activity
- [ ] Backup and recovery procedures are tested

## Support

For deployment issues:
- Check server logs first
- Review this deployment guide
- Test with simple WebSocket client
- Verify database connectivity
- Check network and firewall settings
