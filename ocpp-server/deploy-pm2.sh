#!/bin/bash

# OCPP Server - PM2 Deployment Script
# Run this script on your production server after uploading files

set -e

echo "🚀 Starting OCPP Server Deployment with PM2"

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

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
else
    echo "✓ PM2 is already installed"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npx tsc

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Creating .env from .env.example..."

    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "⚠️  Please edit .env file with your configuration before continuing"
        exit 1
    else
        echo "❌ Error: .env.example not found"
        exit 1
    fi
fi

# Stop existing PM2 process if running
if pm2 list | grep -q "ocpp-server"; then
    echo "🔄 Stopping existing OCPP server..."
    pm2 stop ocpp-server
    pm2 delete ocpp-server
fi

# Start server with PM2
echo "🚀 Starting OCPP server with PM2..."
pm2 start dist/server.js --name ocpp-server

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup script
echo "⚙️  Setting up PM2 startup script..."
pm2 startup | tail -n 1 | bash || true

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
pm2 status

echo ""
echo "📊 View logs with: pm2 logs ocpp-server"
echo "🔄 Restart with: pm2 restart ocpp-server"
echo "⏹️  Stop with: pm2 stop ocpp-server"
echo ""

# Test health endpoint
echo "🏥 Testing health endpoint..."
sleep 3
curl -s http://localhost:9000/health | head -20 || echo "⚠️  Health check failed - server may still be starting"

echo ""
echo "🎉 OCPP Server is now running!"
echo ""
echo "📝 Next steps:"
echo "1. Open firewall: sudo ufw allow 9000/tcp"
echo "2. Test from outside: curl http://$(hostname -I | awk '{print $1}'):9000/health"
echo "3. Configure your charger to connect to: ws://crm.energy-stream.net:9000/244901000006"
