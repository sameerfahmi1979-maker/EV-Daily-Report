#!/bin/bash

echo "========================================"
echo "Starting OCPP Server"
echo "========================================"
echo ""

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file first"
    exit 1
fi

if [ ! -d "dist" ]; then
    echo "❌ Error: dist directory not found!"
    echo "Please run: npm run build"
    exit 1
fi

echo "Starting OCPP server on port 9000..."
echo ""

npm start

echo ""
echo "Server stopped"
