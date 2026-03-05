# OCPP 1.6J WebSocket Server

A production-ready OCPP 1.6J WebSocket server for managing EV charging stations. This server handles real-time communication with ChargeCore Verde chargers and integrates with Supabase for data persistence.

## Features

- Full OCPP 1.6J protocol support
- WebSocket-based communication
- Real-time charger status monitoring
- Transaction management (start/stop charging sessions)
- Authorization via RFID cards
- Meter values collection
- Comprehensive logging with Winston
- Docker support for easy deployment
- TypeScript for type safety

## Supported OCPP Messages

### Charger to Server (Incoming)
- BootNotification
- Heartbeat
- Authorize
- StartTransaction
- StopTransaction
- StatusNotification
- MeterValues
- DataTransfer
- DiagnosticsStatusNotification

### Server to Charger (Outgoing)
- RemoteStartTransaction
- RemoteStopTransaction
- Reset
- UnlockConnector
- ChangeConfiguration
- GetConfiguration
- ChangeAvailability
- TriggerMessage
- UpdateFirmware

## Prerequisites

- Node.js 18 or higher
- Supabase account with database setup
- OCPP database schema deployed (see project migrations)

## Installation

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
OCPP_PORT=9000
NODE_ENV=development
LOG_LEVEL=info
```

3. Build the project:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Docker Deployment

### Build Docker Image

```bash
docker build -t ocpp-server:latest .
```

### Run with Docker

```bash
docker run -d \
  --name ocpp-server \
  -p 9000:9000 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SERVICE_KEY=your-service-role-key \
  -e OCPP_PORT=9000 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=info \
  ocpp-server:latest
```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  ocpp-server:
    build: .
    ports:
      - "9000:9000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - OCPP_PORT=9000
      - NODE_ENV=production
      - LOG_LEVEL=info
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
```

Run with:
```bash
docker-compose up -d
```

## Production Deployment

### Using Your Own Domain

If you have a custom domain configured (e.g., from Bolt.new or your hosting provider):

1. Ensure your domain forwards WebSocket traffic to your OCPP server
2. Configure your server's firewall to allow port 9000
3. The OCPP server will be accessible at: `ws://your-domain.com:9000/{chargePointId}`

For SSL/WSS support, configure SSL termination at your domain provider or load balancer level.

### Production Architecture

```
Charging Station → ws://your-domain.com:9000 → OCPP Server → Supabase
```

## Cloud Deployment Options

### Option 1: Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your Git repository
3. Add environment variables in Railway dashboard
4. Railway will automatically deploy using the Dockerfile
5. Get your deployment URL (e.g., `your-app.railway.app`)
6. Configure chargers to connect to: `ws://your-app.railway.app:9000/{chargePointId}`

### Option 2: Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your Git repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables
6. Configure port: 9000
7. Get your deployment URL
8. Configure chargers to connect to: `ws://your-service.onrender.com/{chargePointId}`

### Option 3: DigitalOcean App Platform

1. Create a new app on [DigitalOcean](https://cloud.digitalocean.com/apps)
2. Connect your Git repository
3. Select Dockerfile for build
4. Add environment variables
5. Configure HTTP port: 9000
6. Enable WebSocket support
7. Deploy and get your URL

### Option 4: AWS ECS with Fargate

1. Push Docker image to Amazon ECR
2. Create ECS cluster
3. Define task with environment variables
4. Create service with load balancer
5. Configure WebSocket support on ALB
6. Use ALB DNS name for charger connections

## Charger Configuration

Configure your ChargeCore Verde chargers to connect to your OCPP server:

### URL Format
```
ws://crm.energy-stream.net:9000/{chargePointId}
```

### Example
For charger with ID `244901000006`:
```
ws://crm.energy-stream.net:9000/244901000006
```

### Configuration Steps
1. Access your charger's admin interface
2. Navigate to OCPP settings
3. Set the WebSocket URL to your domain with port 9000
4. Set Protocol to OCPP 1.6J
5. Save and reboot the charger

## Architecture

```
┌─────────────────┐
│  ChargeCore     │
│  Verde Charger  │
└────────┬────────┘
         │ WebSocket
         │ OCPP 1.6J
         ▼
┌─────────────────┐
│  OCPP Server    │
│  (Node.js/WS)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Supabase DB   │
│   (PostgreSQL)  │
└─────────────────┘
```

## Database Integration

The server integrates with the following Supabase tables:

- `ocpp_chargers` - Charger registration and status
- `ocpp_connectors` - Connector status per charger
- `ocpp_charging_sessions` - Active and completed sessions
- `ocpp_meter_values` - Energy consumption data
- `ocpp_messages` - Message logs for debugging
- `ocpp_remote_commands` - Remote control commands
- `ocpp_configuration_keys` - Charger configurations
- `operators` - RFID card authorization

## Monitoring

### Health Check

The server automatically monitors charger heartbeats. Chargers that don't send a heartbeat within 300 seconds (5 minutes) are marked as offline.

### Logs

Logs are written to:
- Console (all environments)
- `logs/combined.log` (production)
- `logs/error.log` (production, errors only)

### Log Levels
- `error` - Critical errors
- `warn` - Warnings
- `info` - General information
- `debug` - Detailed debugging (not recommended for production)

## Testing

### Manual Testing with wscat

Install wscat:
```bash
npm install -g wscat
```

Connect to server:
```bash
wscat -c ws://localhost:9000/TEST_CHARGER_001
```

Send BootNotification:
```json
[2,"123456","BootNotification",{"chargePointVendor":"ChargeCore","chargePointModel":"Verde","chargePointSerialNumber":"CC001"}]
```

## Troubleshooting

### Charger won't connect
1. Check server is running and accessible
2. Verify firewall allows WebSocket connections on port 9000
3. Check charger configuration has correct URL
4. Review server logs for connection attempts

### Authorization fails
1. Verify RFID card is registered in `operators` table
2. Check `is_active` is true for the operator
3. Review server logs for authorization attempts

### Sessions not recorded
1. Verify database connection is working
2. Check StartTransaction and StopTransaction logs
3. Ensure meter values are being received

## Security

### Production Recommendations

1. **Use WSS (WebSocket Secure)**: Configure SSL termination at your load balancer or domain provider
2. **Firewall**: Configure firewall to allow port 9000 only from trusted IPs if possible
3. **Service Key**: Protect Supabase service key (never commit to version control)
4. **Monitoring**: Set up alerts for connection issues
5. **Authentication**: RFID cards are validated against the `operators` table in Supabase
6. **Network Security**: Use VPN or private network if connecting chargers over public internet

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| SUPABASE_URL | Yes | - | Supabase project URL |
| SUPABASE_SERVICE_KEY | Yes | - | Supabase service role key |
| OCPP_PORT | No | 9000 | WebSocket server port |
| NODE_ENV | No | development | Environment (development/production) |
| LOG_LEVEL | No | info | Logging level (error/warn/info/debug) |

## Support

For issues or questions:
1. Check server logs
2. Review OCPP message logs in database
3. Verify database schema is up to date
4. Consult OCPP 1.6J specification

## License

MIT
