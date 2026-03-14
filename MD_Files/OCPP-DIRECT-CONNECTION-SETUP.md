# OCPP Direct Connection Setup - Complete

This document summarizes the changes made to enable direct OCPP connections using your Bolt domain without requiring Nginx.

## What Was Fixed

### 1. Supabase RLS Policies

**Problem**: The OCPP server couldn't write data to Supabase because:
- RLS policies required authenticated users with `user_id`
- The OCPP server uses service role key but chargers don't have user accounts
- The `user_id` field was required (NOT NULL) in `ocpp_chargers` table

**Solution**: Created migration `fix_ocpp_rls_for_service_role.sql` that:

1. **Made `user_id` nullable** in `ocpp_chargers` table
   - Chargers can now be registered without being assigned to a user
   - Users can claim/assign chargers later through the dashboard

2. **Added service role policies** for all OCPP tables:
   - `ocpp_chargers` - Full access for service role
   - `ocpp_connectors` - Full access for service role
   - `ocpp_charging_sessions` - Full access for service role
   - `ocpp_meter_values` - Full access for service role
   - `ocpp_messages` - Full access for service role
   - `ocpp_configuration_keys` - Full access for service role
   - `ocpp_firmware_updates` - Full access for service role
   - `ocpp_reservations` - Full access for service role
   - `ocpp_charger_availability` - Full access for service role
   - `ocpp_remote_commands` - Updated to allow service role

3. **Updated existing user policies** to handle NULL `user_id`:
   - Users can only see/edit chargers where `user_id` IS NOT NULL AND matches their auth.uid()
   - Unassigned chargers (user_id = NULL) are only accessible via service role

### 2. Removed Nginx Configuration

**Removed Files**:
- `/ocpp-server/nginx/` directory (configuration files)
- `NGINX-SSL-IMPLEMENTATION.md`
- `PRODUCTION-DEPLOYMENT-GUIDE.md`

**Why**: You're using your Bolt domain for direct connections, so Nginx reverse proxy is not needed.

### 3. Updated Documentation

**Updated Files**:
- `ocpp-server/DEPLOYMENT.md` - Removed Nginx sections, focused on direct connection
- `ocpp-server/README.md` - Simplified production deployment, removed Nginx references

**Key Changes**:
- Removed SSL/WSS configuration instructions
- Simplified to direct WebSocket connection on port 9000
- Updated charger configuration examples
- Added firewall configuration for port 9000

## How It Works Now

### Architecture

```
Charging Station → ws://your-bolt-domain.com:9000 → OCPP Server → Supabase (service role)
```

### OCPP Server Connection

The OCPP server:
1. Uses Supabase service role key (from `.env` file)
2. Service role has full access to all OCPP tables (bypasses user-based RLS)
3. Creates charger records without `user_id` when chargers connect
4. Writes all OCPP data (messages, sessions, meter values) directly to Supabase

### Charger Registration Flow

1. **Charger connects** to OCPP server via WebSocket
2. **Sends BootNotification** with charger details
3. **OCPP server** creates/updates record in `ocpp_chargers` table with `user_id = NULL`
4. **Charger is registered** and can start charging sessions
5. **Later**: Admin can assign charger to a user via dashboard by setting `user_id`

### Data Access Control

**Service Role (OCPP Server)**:
- Full read/write access to all OCPP tables
- Can create chargers without user_id
- Can log messages, sessions, meter values for any charger

**Authenticated Users (Dashboard)**:
- Can only see/edit chargers where `user_id` matches their account
- Cannot see unassigned chargers (user_id = NULL)
- Can perform operations on their assigned chargers

## Configuration

### OCPP Server Setup

1. **Environment Variables** (`.env` file):
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key
   OCPP_PORT=9000
   NODE_ENV=production
   LOG_LEVEL=info
   ```

2. **Start Server**:
   ```bash
   cd ocpp-server
   npm install
   npm run build
   npm start
   ```

### Charger Configuration

Configure your ChargeCore Verde chargers with:
- **URL**: `ws://crm.energy-stream.net:9000/{chargePointId}`
- **Port**: 9000
- **Protocol**: OCPP 1.6J

Example for charger 244901000006:
```
ws://crm.energy-stream.net:9000/244901000006
```

### Firewall Configuration

Open port 9000 for WebSocket connections:

**UFW**:
```bash
sudo ufw allow 9000/tcp
```

**firewalld**:
```bash
sudo firewall-cmd --permanent --add-port=9000/tcp
sudo firewall-cmd --reload
```

## Testing

### Verify RLS Policies

Check that service role has access:
```sql
SELECT * FROM ocpp_chargers LIMIT 1;
```
This should work when using service role key.

### Test Charger Connection

1. Start OCPP server
2. Monitor logs: `npm start` or `pm2 logs ocpp-server`
3. Configure charger with your WebSocket URL
4. Reboot charger
5. Watch for BootNotification in logs
6. Verify charger appears in `ocpp_chargers` table

### Database Verification

After first charger connection:

```sql
-- Check charger was created
SELECT charge_point_id, vendor, model, connection_status, user_id
FROM ocpp_chargers
ORDER BY created_at DESC
LIMIT 5;

-- Check messages logged
SELECT action, direction, timestamp
FROM ocpp_messages
ORDER BY timestamp DESC
LIMIT 10;
```

## Security Notes

1. **Service Role Key**: Keep it secure, never commit to version control
2. **Port 9000**: Consider restricting to known IP addresses if possible
3. **User Assignment**: Assign chargers to users after registration for proper access control
4. **RFID Authorization**: Cards are validated against `operators` table
5. **SSL/TLS**: If needed, configure at your hosting provider or load balancer level

## Benefits of This Setup

1. **Simple Deployment**: No Nginx to configure or maintain
2. **Direct Connection**: One less component in the chain
3. **Flexible User Assignment**: Chargers auto-register, assign users later
4. **Service Role Bypass**: OCPP server has full database access
5. **User Security**: Dashboard users still restricted to their own chargers

## Migration Summary

**Database Changes**:
- `ocpp_chargers.user_id` is now nullable
- Added 9 service role policies (one per OCPP table)
- Updated 4 user policies to handle NULL user_id
- No data loss or breaking changes

**Code Changes**:
- None required (OCPP server already used service role key)

**Configuration Changes**:
- Removed Nginx files
- Updated documentation

## Troubleshooting

### Charger Can't Connect

1. **Check OCPP server is running**: `pm2 status` or `ps aux | grep node`
2. **Check firewall**: `sudo ufw status` or test with `wscat -c ws://your-domain:9000/TEST`
3. **Check logs**: `pm2 logs ocpp-server` or check server console output
4. **Verify URL**: Ensure charger has correct WebSocket URL with port 9000

### Data Not Appearing in Database

1. **Check service role key**: Verify it's set correctly in `.env`
2. **Check RLS policies**: Run the SQL query above to verify service role access
3. **Check logs**: Look for database errors in server logs
4. **Test connection**: Use Supabase dashboard to query tables directly

### Dashboard Shows No Chargers

This is expected if:
- Chargers have `user_id = NULL` (not assigned to any user)
- User is logged in but doesn't own any chargers

**Solution**: Admin needs to assign chargers to users by updating `user_id` field.

## Next Steps

1. **Deploy OCPP Server**: Deploy to your hosting platform (Railway, Render, VPS, etc.)
2. **Configure Domain**: Point your Bolt domain to the server
3. **Test Connection**: Connect one charger first to verify everything works
4. **Assign Users**: Update chargers with appropriate user_id values
5. **Monitor**: Watch logs for successful connections and data flow

## Support

Your OCPP system is now configured for direct connections. The chargers can register and send data automatically through the OCPP server using the service role key.

For issues:
1. Check OCPP server logs
2. Verify database RLS policies
3. Test with wscat or OCPP testing tool
4. Ensure service role key is correct
