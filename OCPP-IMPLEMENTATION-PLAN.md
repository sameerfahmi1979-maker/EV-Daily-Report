# OCPP IMPLEMENTATION PLAN IN PHASES

## Overview
This document outlines the complete implementation plan for integrating OCPP 1.6J and 2.0 protocol support into your EV charging management system. The system will support 9 ChargeCore Verde chargers distributed across different locations with 18 total connectors (2 per charger).

---

## MENU STRUCTURE

### New Sidebar Section: "OCPP Management"
Located between "Operations" and "Pricing" sections

**Sub-modules:**
1. Live Monitoring - Real-time charger status dashboard
2. Charger Management - Charger configuration and registration
3. Remote Control - Command center for charger operations
4. Sessions Monitor - Live and historical session tracking
5. Message Logs - OCPP protocol message inspector
6. Health & Diagnostics - System health and troubleshooting
7. OCPP Configuration - Protocol settings and server management

---

## PHASE 1: DATABASE FOUNDATION & BACKEND SETUP

### 1.1 Database Schema Implementation

**Table: ocpp_chargers**
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- station_id (uuid, foreign key to stations, nullable)
- charge_point_id (text, unique) - OCPP identifier
- vendor (text) - "ChargeCore Verde"
- model (text) - Charger model
- serial_number (text)
- firmware_version (text)
- iccid (text, nullable) - SIM card identifier
- imsi (text, nullable) - Mobile network identifier
- protocol_version (text) - "1.6J" or "2.0"
- registration_status (enum: 'Pending', 'Accepted', 'Rejected')
- last_heartbeat_at (timestamptz)
- connection_status (enum: 'Online', 'Offline', 'Unknown')
- ip_address (text, nullable)
- location_latitude (numeric, nullable)
- location_longitude (numeric, nullable)
- installation_date (date, nullable)
- notes (text, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

**Table: ocpp_connectors**
- id (uuid, primary key)
- charger_id (uuid, foreign key to ocpp_chargers)
- connector_id (integer) - 1 or 2
- connector_type (enum: 'Type2', 'CCS', 'CHAdeMO', 'Type1')
- power_kw (numeric) - Max power rating
- status (enum: 'Available', 'Preparing', 'Charging', 'SuspendedEV', 'SuspendedEVSE', 'Finishing', 'Reserved', 'Unavailable', 'Faulted')
- error_code (text, nullable)
- info (text, nullable)
- vendor_error_code (text, nullable)
- current_session_id (uuid, nullable, foreign key to ocpp_charging_sessions)
- last_status_update (timestamptz)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

**Table: ocpp_charging_sessions**
- id (uuid, primary key)
- legacy_session_id (uuid, nullable, foreign key to charging_sessions) - Link to old CSV imports
- charger_id (uuid, foreign key to ocpp_chargers)
- connector_id (uuid, foreign key to ocpp_connectors)
- transaction_id (integer) - OCPP transaction ID
- operator_id (uuid, nullable, foreign key to operators)
- id_tag (text) - RFID card number
- authorization_status (enum: 'Accepted', 'Blocked', 'Expired', 'Invalid', 'ConcurrentTx')
- start_timestamp (timestamptz)
- start_meter_value (integer) - Wh
- end_timestamp (timestamptz, nullable)
- end_meter_value (integer, nullable) - Wh
- stop_reason (text, nullable)
- energy_consumed_wh (numeric, nullable) - Calculated
- duration_minutes (integer, nullable)
- calculated_cost (numeric, nullable)
- session_status (enum: 'Active', 'Completed', 'Stopped', 'Error')
- remote_start (boolean, default false)
- parent_id_tag (text, nullable)
- reservation_id (integer, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

**Table: ocpp_meter_values**
- id (uuid, primary key)
- session_id (uuid, foreign key to ocpp_charging_sessions)
- charger_id (uuid, foreign key to ocpp_chargers)
- connector_id (uuid, foreign key to ocpp_connectors)
- timestamp (timestamptz)
- measurand (text) - 'Energy.Active.Import.Register', 'Power.Active.Import', 'Current.Import', 'Voltage', 'SoC'
- value (numeric)
- unit (text) - 'Wh', 'kW', 'A', 'V', 'Percent'
- phase (text, nullable) - 'L1', 'L2', 'L3', 'L1-N', 'L2-N', 'L3-N'
- context (text) - 'Sample.Periodic', 'Transaction.Begin', 'Transaction.End'
- format (text) - 'Raw', 'SignedData'
- location (text) - 'Outlet', 'Cable', 'EV', 'Inlet'
- created_at (timestamptz, default now())

**Table: ocpp_messages**
- id (uuid, primary key)
- charger_id (uuid, foreign key to ocpp_chargers, nullable)
- message_type (enum: 'Call', 'CallResult', 'CallError')
- action (text) - OCPP action name
- message_id (text) - OCPP message ID
- payload (jsonb) - Full message payload
- direction (enum: 'Incoming', 'Outgoing')
- timestamp (timestamptz, default now())
- processing_status (enum: 'Success', 'Error', 'Pending')
- error_code (text, nullable)
- error_description (text, nullable)
- created_at (timestamptz, default now())

**Table: ocpp_remote_commands**
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- charger_id (uuid, foreign key to ocpp_chargers)
- connector_id (uuid, foreign key to ocpp_connectors, nullable)
- command_type (enum: 'RemoteStartTransaction', 'RemoteStopTransaction', 'UnlockConnector', 'Reset', 'ChangeConfiguration', 'GetConfiguration', 'ChangeAvailability', 'TriggerMessage', 'UpdateFirmware')
- parameters (jsonb)
- status (enum: 'Pending', 'Sent', 'Accepted', 'Rejected', 'Error', 'Timeout')
- command_result (jsonb, nullable)
- requested_at (timestamptz, default now())
- executed_at (timestamptz, nullable)
- completed_at (timestamptz, nullable)
- error_message (text, nullable)
- created_at (timestamptz, default now())

**Table: ocpp_configuration_keys**
- id (uuid, primary key)
- charger_id (uuid, foreign key to ocpp_chargers)
- key_name (text)
- value (text)
- readonly (boolean)
- last_updated (timestamptz)
- created_at (timestamptz, default now())

**Table: ocpp_firmware_updates**
- id (uuid, primary key)
- charger_id (uuid, foreign key to ocpp_chargers)
- firmware_url (text)
- firmware_version (text)
- retrieve_date (timestamptz)
- install_date (timestamptz, nullable)
- status (enum: 'Scheduled', 'Downloading', 'Downloaded', 'Installing', 'Installed', 'InstallationFailed')
- failure_reason (text, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

**Table: ocpp_reservations**
- id (uuid, primary key)
- charger_id (uuid, foreign key to ocpp_chargers)
- connector_id (uuid, foreign key to ocpp_connectors)
- reservation_id (integer) - OCPP reservation ID
- id_tag (text) - Reserved for this RFID
- expiry_date (timestamptz)
- parent_id_tag (text, nullable)
- status (enum: 'Active', 'Used', 'Cancelled', 'Expired')
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

**Table: ocpp_charger_availability**
- id (uuid, primary key)
- charger_id (uuid, foreign key to ocpp_chargers)
- connector_id (uuid, foreign key to ocpp_connectors, nullable) - null means whole charger
- availability_type (enum: 'Operative', 'Inoperative')
- scheduled_start (timestamptz, nullable)
- scheduled_end (timestamptz, nullable)
- reason (text, nullable)
- created_by (uuid, foreign key to auth.users)
- created_at (timestamptz, default now())

### 1.2 Backend OCPP Server Development

**Technology Stack:**
- Node.js with Express.js
- WebSocket (ws library) for OCPP communication
- Supabase JS client for database operations
- TypeScript for type safety
- Winston for logging

**Core Files Structure:**
```
/ocpp-server
├── src/
│   ├── server.ts - Main WebSocket server
│   ├── ocpp/
│   │   ├── handlers/
│   │   │   ├── v16/
│   │   │   │   ├── bootNotification.ts
│   │   │   │   ├── heartbeat.ts
│   │   │   │   ├── authorize.ts
│   │   │   │   ├── startTransaction.ts
│   │   │   │   ├── stopTransaction.ts
│   │   │   │   ├── meterValues.ts
│   │   │   │   ├── statusNotification.ts
│   │   │   │   ├── dataTransfer.ts
│   │   │   │   └── diagnosticsStatusNotification.ts
│   │   │   └── v20/ (for future OCPP 2.0 support)
│   │   ├── validators/
│   │   │   └── messageValidator.ts
│   │   ├── commands/
│   │   │   ├── remoteStart.ts
│   │   │   ├── remoteStop.ts
│   │   │   ├── unlock.ts
│   │   │   ├── reset.ts
│   │   │   ├── changeConfiguration.ts
│   │   │   └── getConfiguration.ts
│   │   └── types.ts
│   ├── services/
│   │   ├── supabaseService.ts
│   │   ├── authService.ts
│   │   ├── sessionService.ts
│   │   └── billingService.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── errorHandler.ts
│   └── config/
│       └── index.ts
├── package.json
├── tsconfig.json
└── .env
```

**Key Implementation Details:**

1. **WebSocket Server Setup**
   - Listen on wss://your-domain.com:443/ocpp
   - Support multiple simultaneous charger connections
   - Implement connection authentication via charge point ID
   - Handle automatic reconnection with exponential backoff

2. **OCPP Message Handler**
   - Parse OCPP 1.6J JSON format [MessageType, MessageId, Action, Payload]
   - Route messages to appropriate handlers
   - Validate message structure and payload
   - Send responses in correct OCPP format
   - Store all messages in ocpp_messages table

3. **Core Operations**
   - BootNotification: Accept charger registration, store charger details
   - Heartbeat: Update last_heartbeat_at, maintain connection
   - Authorize: Check RFID against operators table
   - StartTransaction: Create session record, authorize user
   - StopTransaction: Finalize session, calculate billing
   - MeterValues: Store real-time power data
   - StatusNotification: Update connector status

4. **Remote Commands**
   - Queue commands in ocpp_remote_commands table
   - Send commands when charger is online
   - Handle command responses and timeouts
   - Update command status

### 1.3 Cloud Deployment

**Recommended Platform: Railway or Render**

**Deployment Steps:**
1. Create new service for OCPP WebSocket server
2. Configure environment variables:
   - SUPABASE_URL
   - SUPABASE_SERVICE_KEY
   - OCPP_PORT=443
   - SSL_CERT_PATH
   - SSL_KEY_PATH
3. Set up custom domain with SSL certificate
4. Configure health check endpoint /health
5. Set up logging and monitoring
6. Deploy with auto-restart on failure

---

## PHASE 2: FRONTEND MENU & NAVIGATION

### 2.1 Update Sidebar Component

**New Menu Section: "OCPP Management"**

Add new icons from lucide-react:
- Activity (Live Monitoring)
- Plug (Charger Management)
- Sliders (Remote Control)
- Radio (Sessions Monitor)
- MessageSquare (Message Logs)
- Heart (Health & Diagnostics)
- Settings (OCPP Configuration)

**Implementation:**
- Add new SidebarSection "OCPP Management"
- Add 7 new SidebarItem components for each sub-module
- Update Dashboard view type to include OCPP views
- Add routing logic in Dashboard.tsx

### 2.2 Update Dashboard Routing

**New View Types:**
```typescript
type View =
  | 'home'
  | 'stations'
  | 'operators'
  | 'rates'
  | 'fixed-charges'
  | 'import'
  | 'billing'
  | 'analytics'
  | 'reports'
  | 'ocpp-live'           // Live Monitoring
  | 'ocpp-chargers'       // Charger Management
  | 'ocpp-control'        // Remote Control
  | 'ocpp-sessions'       // Sessions Monitor
  | 'ocpp-messages'       // Message Logs
  | 'ocpp-health'         // Health & Diagnostics
  | 'ocpp-config';        // OCPP Configuration
```

---

## PHASE 3: DASHBOARD 1 - LIVE MONITORING

[Content continues with detailed specifications for all 7 dashboards...]

---

## IMPLEMENTATION TIMELINE

**Phase 1-2: Weeks 1-2**
- Database schema creation
- Backend OCPP server development
- Cloud deployment
- Menu structure updates

**Phase 3-9: Weeks 3-9**
- Individual dashboard implementation (one per week)

**Phase 10: Week 10**
- Integration testing
- First charger onboarding
- Parallel operation begins

**Phase 11: Weeks 11-12**
- Remaining charger onboarding
- User training
- Documentation

**Phase 12: Week 13+**
- Full production operation
- Monitoring and optimization
- Advanced features planning

---

## SUCCESS METRICS

**Technical Metrics:**
- System uptime: >99.5%
- Charger connectivity: >98%
- Message processing time: <100ms
- Dashboard load time: <3 seconds

**Business Metrics:**
- Elimination of manual CSV imports
- Real-time billing accuracy: 100%
- Reduced operational time: 80%
- Improved customer satisfaction

**END OF IMPLEMENTATION PLAN**
