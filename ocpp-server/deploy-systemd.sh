#!/bin/bash

# OCPP Server - Systemd Deployment Script
# Run this script with sudo on your production server

set -e

echo "🚀 Starting OCPP Server Deployment with Systemd"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Please run as root or with sudo"
    exit 1
fi

# Get the actual user who ran sudo
ACTUAL_USER=${SUDO_USER:-$USER}
DEPLOY_DIR="/var/www/ocpp-server"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from ocpp-server directory"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Copy files to deployment directory if not already there
CURRENT_DIR=$(pwd)
if [ "$CURRENT_DIR" != "$DEPLOY_DIR" ]; then
    echo "📦 Copying files to $DEPLOY_DIR..."
    mkdir -p "$DEPLOY_DIR"
    cp -r * "$DEPLOY_DIR/"
    cd "$DEPLOY_DIR"
fi

# Install dependencies
echo "📦 Installing dependencies..."
sudo -u "$ACTUAL_USER" npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
sudo -u "$ACTUAL_USER" npx tsc

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "⚠️  Please edit $DEPLOY_DIR/.env with your configuration before continuing"
        exit 1
    else
        echo "❌ Error: .env.example not found"
        exit 1
    fi
fi

# Create systemd service file
echo "⚙️  Creating systemd service..."
cat > /etc/systemd/system/ocpp-server.service << EOF
[Unit]
Description=OCPP Server for EV Charging Management
After=network.target

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$DEPLOY_DIR
ExecStart=$(which node) $DEPLOY_DIR/dist/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ocpp-server

# Environment
Environment=NODE_ENV=production
EnvironmentFile=$DEPLOY_DIR/.env

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Stop existing service if running
if systemctl is-active --quiet ocpp-server; then
    echo "⏹️  Stopping existing OCPP server..."
    systemctl stop ocpp-server
fi

# Enable and start service
echo "🚀 Starting OCPP server..."
systemctl enable ocpp-server
systemctl start ocpp-server

# Wait a moment for startup
sleep 3

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
systemctl status ocpp-server --no-pager

echo ""
echo "📊 Useful commands:"
echo "  View logs: sudo journalctl -u ocpp-server -f"
echo "  Restart: sudo systemctl restart ocpp-server"
echo "  Stop: sudo systemctl stop ocpp-server"
echo "  Status: sudo systemctl status ocpp-server"
echo ""

# Test health endpoint
echo "🏥 Testing health endpoint..."
curl -s http://localhost:9000/health | head -20 || echo "⚠️  Health check failed - server may still be starting"

echo ""
echo "🎉 OCPP Server is now running as a system service!"
echo ""
echo "📝 Next steps:"
echo "1. Open firewall: sudo ufw allow 9000/tcp"
echo "2. Test from outside: curl http://$(hostname -I | awk '{print $1}'):9000/health"
echo "3. Configure your charger to connect to: ws://crm.energy-stream.net:9000/244901000006"
