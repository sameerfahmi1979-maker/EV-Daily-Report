#!/bin/bash

echo "========================================"
echo "OCPP Server Status Check"
echo "========================================"
echo ""

# Check if .env exists
echo "1. Checking .env file..."
if [ -f ".env" ]; then
    echo "   ✓ .env file exists"

    # Check if service key is set
    if grep -q "PASTE_YOUR_SERVICE_ROLE_KEY_HERE\|your_service_role_key_here" .env 2>/dev/null; then
        echo "   ❌ Service key not configured in .env"
        echo "      Edit .env and add your Supabase service role key"
    else
        if grep -q "SUPABASE_SERVICE_KEY=" .env; then
            echo "   ✓ Service key appears to be configured"
        else
            echo "   ❌ SUPABASE_SERVICE_KEY not found in .env"
        fi
    fi
else
    echo "   ❌ .env file missing"
    echo "      Run: cp .env.example .env"
    echo "      Then edit .env with your Supabase credentials"
fi

echo ""

# Check if dist folder exists
echo "2. Checking build..."
if [ -d "dist" ]; then
    echo "   ✓ Server is built (dist/ folder exists)"
else
    echo "   ❌ Server not built"
    echo "      Run: npm run build"
fi

echo ""

# Check if node_modules exists
echo "3. Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✓ Dependencies installed"
else
    echo "   ❌ Dependencies not installed"
    echo "      Run: npm install"
fi

echo ""

# Check if server is running
echo "4. Checking if server is running..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ocpp-server.*online"; then
        echo "   ✓ Server is running (PM2)"
        pm2 info ocpp-server 2>/dev/null | grep -E "status|uptime|restarts"
    elif pm2 list | grep -q "ocpp-server"; then
        echo "   ❌ Server exists in PM2 but not running"
        echo "      Run: pm2 restart ocpp-server"
    else
        echo "   ℹ  Server not running in PM2"
    fi
else
    echo "   ℹ  PM2 not installed"
fi

# Check if port 9000 is listening
if netstat -tuln 2>/dev/null | grep -q ":9000 "; then
    echo "   ✓ Port 9000 is listening"
elif ss -tuln 2>/dev/null | grep -q ":9000 "; then
    echo "   ✓ Port 9000 is listening"
else
    echo "   ❌ Port 9000 is NOT listening"
    echo "      Server may not be running"
fi

echo ""

# Check firewall
echo "5. Checking firewall..."
if command -v ufw &> /dev/null; then
    if sudo ufw status 2>/dev/null | grep -q "9000.*ALLOW"; then
        echo "   ✓ UFW: Port 9000 is allowed"
    elif sudo ufw status 2>/dev/null | grep -q "Status: inactive"; then
        echo "   ℹ  UFW is inactive"
    else
        echo "   ⚠  UFW: Port 9000 may not be allowed"
        echo "      Run: sudo ufw allow 9000/tcp"
    fi
elif command -v firewall-cmd &> /dev/null; then
    if sudo firewall-cmd --list-ports 2>/dev/null | grep -q "9000/tcp"; then
        echo "   ✓ firewalld: Port 9000 is open"
    else
        echo "   ⚠  firewalld: Port 9000 may not be open"
        echo "      Run: sudo firewall-cmd --permanent --add-port=9000/tcp"
        echo "           sudo firewall-cmd --reload"
    fi
else
    echo "   ℹ  No firewall detected (or not accessible)"
fi

echo ""

# Check DNS resolution
echo "6. Checking domain resolution..."
if command -v nslookup &> /dev/null; then
    echo "   Testing crm.energy-stream.net..."
    if nslookup crm.energy-stream.net 2>/dev/null | grep -q "Address:"; then
        IP=$(nslookup crm.energy-stream.net 2>/dev/null | grep "Address:" | tail -1 | awk '{print $2}')
        echo "   ✓ Domain resolves to: $IP"
    else
        echo "   ❌ Domain does not resolve"
        echo "      Configure DNS A record for crm.energy-stream.net"
    fi
elif command -v dig &> /dev/null; then
    echo "   Testing crm.energy-stream.net..."
    if dig crm.energy-stream.net +short 2>/dev/null | grep -q "[0-9]"; then
        IP=$(dig crm.energy-stream.net +short 2>/dev/null | head -1)
        echo "   ✓ Domain resolves to: $IP"
    else
        echo "   ❌ Domain does not resolve"
    fi
else
    echo "   ℹ  DNS tools not available"
fi

echo ""

# Check database connectivity (if server is built)
if [ -d "dist" ] && [ -f ".env" ]; then
    echo "7. Testing database connection..."

    # Try to load .env and test connection
    if command -v node &> /dev/null; then
        node -e "
        try {
            require('dotenv').config();
            const {createClient} = require('@supabase/supabase-js');
            const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
            supabase.from('ocpp_chargers').select('count').limit(1).then(result => {
                if (result.error) {
                    console.log('   ❌ Database connection failed:', result.error.message);
                } else {
                    console.log('   ✓ Database connection successful');
                }
                process.exit(0);
            }).catch(err => {
                console.log('   ❌ Database connection error:', err.message);
                process.exit(0);
            });
        } catch (err) {
            console.log('   ❌ Error:', err.message);
            process.exit(0);
        }
        " 2>&1 | head -1
    else
        echo "   ℹ  Node.js not available for testing"
    fi
else
    echo "7. Database connection test skipped (build .env or dist/ missing)"
fi

echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo ""

# Count issues
ISSUES=0

[ ! -f ".env" ] && ISSUES=$((ISSUES + 1))
[ ! -d "dist" ] && ISSUES=$((ISSUES + 1))
[ ! -d "node_modules" ] && ISSUES=$((ISSUES + 1))

if [ $ISSUES -eq 0 ]; then
    if netstat -tuln 2>/dev/null | grep -q ":9000 " || ss -tuln 2>/dev/null | grep -q ":9000 "; then
        echo "✓ Server appears to be running correctly!"
        echo ""
        echo "Charger should connect to:"
        echo "  ws://crm.energy-stream.net:9000/244901000006"
        echo ""
        echo "View logs: pm2 logs ocpp-server"
    else
        echo "⚠  Setup complete but server not running"
        echo ""
        echo "Start with:"
        echo "  npm start"
        echo ""
        echo "Or with PM2:"
        echo "  pm2 start npm --name 'ocpp-server' -- start"
    fi
else
    echo "❌ Issues found: $ISSUES"
    echo ""
    echo "Required actions:"
    [ ! -f ".env" ] && echo "  1. Create .env file: cp .env.example .env"
    [ ! -f ".env" ] && echo "     Then edit it with your Supabase service key"
    [ ! -d "node_modules" ] && echo "  2. Install dependencies: npm install"
    [ ! -d "dist" ] && echo "  3. Build server: npm run build"
    echo "  4. Start server: npm start"
fi

echo ""
echo "For detailed troubleshooting, see:"
echo "  - QUICK-START.md"
echo "  - ../TROUBLESHOOTING-CONNECTION-ISSUE.md"
echo ""
