#!/bin/bash

echo "========================================"
echo "OCPP Server Setup Script"
echo "========================================"
echo ""

if [ -f ".env" ]; then
    echo "✓ .env file already exists"
else
    echo "Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your Supabase service role key"
    echo "   File location: ocpp-server/.env"
    echo "   You need to set: SUPABASE_SERVICE_KEY"
    echo ""
fi

echo "Installing dependencies..."
npm install

echo ""
echo "Building server..."
npm run build

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit ocpp-server/.env and add your SUPABASE_SERVICE_KEY"
echo "2. Start the server with: npm start"
echo "3. Verify it's running: curl http://localhost:9000/health"
echo ""
echo "Server will listen on port 9000"
echo "WebSocket endpoint: ws://localhost:9000/ocpp/{CHARGE_POINT_ID}"
echo ""
