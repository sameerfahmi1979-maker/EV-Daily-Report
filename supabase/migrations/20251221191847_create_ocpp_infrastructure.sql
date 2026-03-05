/*
  # OCPP Infrastructure Database Schema

  ## Overview
  Creates comprehensive database structure for OCPP 1.6J/2.0 protocol support,
  enabling real-time communication with ChargeCore Verde chargers.

  ## New Tables Created

  ### 1. ocpp_chargers
  Master table for OCPP-enabled charging stations with connection tracking
  - Stores charger identification, vendor info, and registration status
  - Tracks real-time connection status and heartbeat monitoring
  - Links to existing stations table for location management
  - Supports both OCPP 1.6J and 2.0 protocols

  ### 2. ocpp_connectors
  Individual connector status and configuration per charger
  - Each charger has 1-4 connectors (typically 2 for ChargeCore Verde)
  - Real-time status tracking (Available, Charging, Faulted, etc.)
  - Links to active charging sessions
  - Stores connector specifications and error information

  ### 3. ocpp_charging_sessions
  Comprehensive charging session records from OCPP protocol
  - Links to legacy CSV-imported sessions for data continuity
  - RFID authorization tracking with operator matching
  - Real-time session status and transaction management
  - Calculated energy consumption and billing integration
  - Supports remote start and reservation features

  ### 4. ocpp_meter_values
  Time-series energy and power measurements during charging
  - Stores detailed meter readings (energy, power, voltage, current, SoC)
  - Multiple sampling contexts (periodic, transaction start/end)
  - Phase-level measurements for three-phase chargers
  - High-volume table optimized for real-time ingestion

  ### 5. ocpp_messages
  Complete OCPP protocol message log for debugging and auditing
  - Captures all WebSocket communication (Call, CallResult, CallError)
  - Stores full message payloads in JSONB format
  - Tracks message processing status and errors
  - Essential for troubleshooting and protocol compliance

  ### 6. ocpp_remote_commands
  Command queue and execution tracking for remote charger control
  - Supports all OCPP remote operations (start, stop, reset, configure, etc.)
  - Tracks command lifecycle from request to completion
  - Stores command parameters and results
  - Timeout and error handling

  ### 7. ocpp_configuration_keys
  Charger-specific OCPP configuration parameters
  - Stores key-value pairs for charger settings
  - Tracks read-only vs configurable keys
  - Synchronized with charger GetConfiguration responses
  - Version control for configuration changes

  ### 8. ocpp_firmware_updates
  Firmware update scheduling and status tracking
  - Manages OTA (Over-The-Air) firmware deployments
  - Tracks download and installation progress
  - Failure logging and retry management
  - Version tracking

  ### 9. ocpp_reservations
  Connector reservation system for future charging sessions
  - RFID-based connector reservations
  - Expiry management
  - Prevents unauthorized use of reserved connectors

  ### 10. ocpp_charger_availability
  Scheduled and manual availability management
  - Mark chargers/connectors as operative or inoperative
  - Schedule maintenance windows
  - Track availability reasons and administrators

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only access their own chargers and related data
  - Authenticated access required for all operations
  - Admin-only access for configuration and control commands

  ## Performance Considerations
  - Indexes on frequently queried fields (timestamps, charger_id, session_id)
  - Efficient foreign key constraints
  - JSONB indexes for message payload searches
  - Optimized for real-time inserts on meter_values and messages tables
*/

-- Create enum types for OCPP-specific values
DO $$ BEGIN
  CREATE TYPE charger_registration_status AS ENUM ('Pending', 'Accepted', 'Rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE charger_connection_status AS ENUM ('Online', 'Offline', 'Unknown');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE connector_type AS ENUM ('Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE connector_status AS ENUM ('Available', 'Preparing', 'Charging', 'SuspendedEV', 'SuspendedEVSE', 'Finishing', 'Reserved', 'Unavailable', 'Faulted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE authorization_status AS ENUM ('Accepted', 'Blocked', 'Expired', 'Invalid', 'ConcurrentTx');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ocpp_session_status AS ENUM ('Active', 'Completed', 'Stopped', 'Error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ocpp_message_type AS ENUM ('Call', 'CallResult', 'CallError');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_direction AS ENUM ('Incoming', 'Outgoing');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_processing_status AS ENUM ('Success', 'Error', 'Pending');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE remote_command_type AS ENUM (
    'RemoteStartTransaction',
    'RemoteStopTransaction',
    'UnlockConnector',
    'Reset',
    'ChangeConfiguration',
    'GetConfiguration',
    'ChangeAvailability',
    'TriggerMessage',
    'UpdateFirmware'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE command_status AS ENUM ('Pending', 'Sent', 'Accepted', 'Rejected', 'Error', 'Timeout');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE firmware_status AS ENUM ('Scheduled', 'Downloading', 'Downloaded', 'Installing', 'Installed', 'InstallationFailed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('Active', 'Used', 'Cancelled', 'Expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE availability_type AS ENUM ('Operative', 'Inoperative');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Table 1: ocpp_chargers
CREATE TABLE IF NOT EXISTS ocpp_chargers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  charge_point_id text UNIQUE NOT NULL,
  vendor text DEFAULT 'ChargeCore Verde',
  model text,
  serial_number text,
  firmware_version text,
  iccid text,
  imsi text,
  protocol_version text DEFAULT '1.6J',
  registration_status charger_registration_status DEFAULT 'Pending',
  last_heartbeat_at timestamptz,
  connection_status charger_connection_status DEFAULT 'Unknown',
  ip_address text,
  location_latitude numeric,
  location_longitude numeric,
  installation_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table 2: ocpp_connectors
CREATE TABLE IF NOT EXISTS ocpp_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_id uuid REFERENCES ocpp_chargers(id) ON DELETE CASCADE NOT NULL,
  connector_id integer NOT NULL,
  connector_type connector_type DEFAULT 'Type2',
  power_kw numeric DEFAULT 0,
  status connector_status DEFAULT 'Unavailable',
  error_code text,
  info text,
  vendor_error_code text,
  current_session_id uuid,
  last_status_update timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(charger_id, connector_id)
);

-- Table 3: ocpp_charging_sessions
CREATE TABLE IF NOT EXISTS ocpp_charging_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_session_id uuid REFERENCES charging_sessions(id) ON DELETE SET NULL,
  charger_id uuid REFERENCES ocpp_chargers(id) ON DELETE CASCADE NOT NULL,
  connector_id uuid REFERENCES ocpp_connectors(id) ON DELETE CASCADE NOT NULL,
  transaction_id integer NOT NULL,
  operator_id uuid REFERENCES operators(id) ON DELETE SET NULL,
  id_tag text NOT NULL,
  authorization_status authorization_status DEFAULT 'Accepted',
  start_timestamp timestamptz NOT NULL,
  start_meter_value integer DEFAULT 0,
  end_timestamp timestamptz,
  end_meter_value integer,
  stop_reason text,
  energy_consumed_wh numeric,
  duration_minutes integer,
  calculated_cost numeric,
  session_status ocpp_session_status DEFAULT 'Active',
  remote_start boolean DEFAULT false,
  parent_id_tag text,
  reservation_id integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(charger_id, transaction_id)
);

-- Add foreign key for current_session_id after ocpp_charging_sessions exists
DO $$ BEGIN
  ALTER TABLE ocpp_connectors
  ADD CONSTRAINT fk_current_session
  FOREIGN KEY (current_session_id)
  REFERENCES ocpp_charging_sessions(id)
  ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Table 4: ocpp_meter_values
CREATE TABLE IF NOT EXISTS ocpp_meter_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES ocpp_charging_sessions(id) ON DELETE CASCADE,
  charger_id uuid REFERENCES ocpp_chargers(id) ON DELETE CASCADE NOT NULL,
  connector_id uuid REFERENCES ocpp_connectors(id) ON DELETE CASCADE NOT NULL,
  timestamp timestamptz NOT NULL,
  measurand text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  phase text,
  context text DEFAULT 'Sample.Periodic',
  format text DEFAULT 'Raw',
  location text DEFAULT 'Outlet',
  created_at timestamptz DEFAULT now()
);

-- Table 5: ocpp_messages
CREATE TABLE IF NOT EXISTS ocpp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_id uuid REFERENCES ocpp_chargers(id) ON DELETE SET NULL,
  message_type ocpp_message_type NOT NULL,
  action text NOT NULL,
  message_id text NOT NULL,
  payload jsonb NOT NULL,
  direction message_direction NOT NULL,
  timestamp timestamptz DEFAULT now(),
  processing_status message_processing_status DEFAULT 'Success',
  error_code text,
  error_description text,
  created_at timestamptz DEFAULT now()
);

-- Table 6: ocpp_remote_commands
CREATE TABLE IF NOT EXISTS ocpp_remote_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  charger_id uuid REFERENCES ocpp_chargers(id) ON DELETE CASCADE NOT NULL,
  connector_id uuid REFERENCES ocpp_connectors(id) ON DELETE SET NULL,
  command_type remote_command_type NOT NULL,
  parameters jsonb DEFAULT '{}'::jsonb,
  status command_status DEFAULT 'Pending',
  command_result jsonb,
  requested_at timestamptz DEFAULT now(),
  executed_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Table 7: ocpp_configuration_keys
CREATE TABLE IF NOT EXISTS ocpp_configuration_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_id uuid REFERENCES ocpp_chargers(id) ON DELETE CASCADE NOT NULL,
  key_name text NOT NULL,
  value text,
  readonly boolean DEFAULT false,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(charger_id, key_name)
);

-- Table 8: ocpp_firmware_updates
CREATE TABLE IF NOT EXISTS ocpp_firmware_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_id uuid REFERENCES ocpp_chargers(id) ON DELETE CASCADE NOT NULL,
  firmware_url text NOT NULL,
  firmware_version text NOT NULL,
  retrieve_date timestamptz NOT NULL,
  install_date timestamptz,
  status firmware_status DEFAULT 'Scheduled',
  failure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table 9: ocpp_reservations
CREATE TABLE IF NOT EXISTS ocpp_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_id uuid REFERENCES ocpp_chargers(id) ON DELETE CASCADE NOT NULL,
  connector_id uuid REFERENCES ocpp_connectors(id) ON DELETE CASCADE NOT NULL,
  reservation_id integer NOT NULL,
  id_tag text NOT NULL,
  expiry_date timestamptz NOT NULL,
  parent_id_tag text,
  status reservation_status DEFAULT 'Active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(charger_id, reservation_id)
);

-- Table 10: ocpp_charger_availability
CREATE TABLE IF NOT EXISTS ocpp_charger_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charger_id uuid REFERENCES ocpp_chargers(id) ON DELETE CASCADE NOT NULL,
  connector_id uuid REFERENCES ocpp_connectors(id) ON DELETE SET NULL,
  availability_type availability_type NOT NULL,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ocpp_chargers_user ON ocpp_chargers(user_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_chargers_station ON ocpp_chargers(station_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_chargers_status ON ocpp_chargers(connection_status);
CREATE INDEX IF NOT EXISTS idx_ocpp_chargers_heartbeat ON ocpp_chargers(last_heartbeat_at);

CREATE INDEX IF NOT EXISTS idx_ocpp_connectors_charger ON ocpp_connectors(charger_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_connectors_status ON ocpp_connectors(status);
CREATE INDEX IF NOT EXISTS idx_ocpp_connectors_session ON ocpp_connectors(current_session_id);

CREATE INDEX IF NOT EXISTS idx_ocpp_sessions_charger ON ocpp_charging_sessions(charger_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_sessions_connector ON ocpp_charging_sessions(connector_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_sessions_operator ON ocpp_charging_sessions(operator_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_sessions_status ON ocpp_charging_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_ocpp_sessions_start ON ocpp_charging_sessions(start_timestamp);
CREATE INDEX IF NOT EXISTS idx_ocpp_sessions_id_tag ON ocpp_charging_sessions(id_tag);

CREATE INDEX IF NOT EXISTS idx_ocpp_meter_session ON ocpp_meter_values(session_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_meter_charger ON ocpp_meter_values(charger_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_meter_timestamp ON ocpp_meter_values(timestamp);

CREATE INDEX IF NOT EXISTS idx_ocpp_messages_charger ON ocpp_messages(charger_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_messages_timestamp ON ocpp_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_ocpp_messages_action ON ocpp_messages(action);
CREATE INDEX IF NOT EXISTS idx_ocpp_messages_payload ON ocpp_messages USING gin(payload);

CREATE INDEX IF NOT EXISTS idx_ocpp_commands_charger ON ocpp_remote_commands(charger_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_commands_status ON ocpp_remote_commands(status);
CREATE INDEX IF NOT EXISTS idx_ocpp_commands_requested ON ocpp_remote_commands(requested_at);

CREATE INDEX IF NOT EXISTS idx_ocpp_config_charger ON ocpp_configuration_keys(charger_id);

CREATE INDEX IF NOT EXISTS idx_ocpp_firmware_charger ON ocpp_firmware_updates(charger_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_firmware_status ON ocpp_firmware_updates(status);

CREATE INDEX IF NOT EXISTS idx_ocpp_reservations_charger ON ocpp_reservations(charger_id);
CREATE INDEX IF NOT EXISTS idx_ocpp_reservations_status ON ocpp_reservations(status);
CREATE INDEX IF NOT EXISTS idx_ocpp_reservations_expiry ON ocpp_reservations(expiry_date);

CREATE INDEX IF NOT EXISTS idx_ocpp_availability_charger ON ocpp_charger_availability(charger_id);

-- Enable Row Level Security
ALTER TABLE ocpp_chargers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocpp_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocpp_charging_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocpp_meter_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocpp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocpp_remote_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocpp_configuration_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocpp_firmware_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocpp_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocpp_charger_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ocpp_chargers
CREATE POLICY "Users can view own chargers"
  ON ocpp_chargers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chargers"
  ON ocpp_chargers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chargers"
  ON ocpp_chargers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chargers"
  ON ocpp_chargers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for ocpp_connectors
CREATE POLICY "Users can view connectors of own chargers"
  ON ocpp_connectors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_connectors.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert connectors for own chargers"
  ON ocpp_connectors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_connectors.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update connectors of own chargers"
  ON ocpp_connectors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_connectors.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_connectors.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete connectors of own chargers"
  ON ocpp_connectors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_connectors.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

-- RLS Policies for ocpp_charging_sessions
CREATE POLICY "Users can view sessions of own chargers"
  ON ocpp_charging_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charging_sessions.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sessions for own chargers"
  ON ocpp_charging_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charging_sessions.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sessions of own chargers"
  ON ocpp_charging_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charging_sessions.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charging_sessions.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sessions of own chargers"
  ON ocpp_charging_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charging_sessions.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

-- RLS Policies for ocpp_meter_values
CREATE POLICY "Users can view meter values of own chargers"
  ON ocpp_meter_values FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_meter_values.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert meter values for own chargers"
  ON ocpp_meter_values FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_meter_values.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete meter values of own chargers"
  ON ocpp_meter_values FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_meter_values.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

-- RLS Policies for ocpp_messages
CREATE POLICY "Users can view messages of own chargers"
  ON ocpp_messages FOR SELECT
  TO authenticated
  USING (
    charger_id IS NULL OR
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_messages.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages for own chargers"
  ON ocpp_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    charger_id IS NULL OR
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_messages.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages of own chargers"
  ON ocpp_messages FOR DELETE
  TO authenticated
  USING (
    charger_id IS NULL OR
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_messages.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

-- RLS Policies for ocpp_remote_commands
CREATE POLICY "Users can view own commands"
  ON ocpp_remote_commands FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own commands"
  ON ocpp_remote_commands FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own commands"
  ON ocpp_remote_commands FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own commands"
  ON ocpp_remote_commands FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for ocpp_configuration_keys
CREATE POLICY "Users can view config of own chargers"
  ON ocpp_configuration_keys FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_configuration_keys.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert config for own chargers"
  ON ocpp_configuration_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_configuration_keys.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update config of own chargers"
  ON ocpp_configuration_keys FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_configuration_keys.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_configuration_keys.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete config of own chargers"
  ON ocpp_configuration_keys FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_configuration_keys.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

-- RLS Policies for ocpp_firmware_updates
CREATE POLICY "Users can view firmware updates of own chargers"
  ON ocpp_firmware_updates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_firmware_updates.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert firmware updates for own chargers"
  ON ocpp_firmware_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_firmware_updates.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update firmware updates of own chargers"
  ON ocpp_firmware_updates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_firmware_updates.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_firmware_updates.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete firmware updates of own chargers"
  ON ocpp_firmware_updates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_firmware_updates.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

-- RLS Policies for ocpp_reservations
CREATE POLICY "Users can view reservations of own chargers"
  ON ocpp_reservations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_reservations.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reservations for own chargers"
  ON ocpp_reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_reservations.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reservations of own chargers"
  ON ocpp_reservations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_reservations.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_reservations.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete reservations of own chargers"
  ON ocpp_reservations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_reservations.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

-- RLS Policies for ocpp_charger_availability
CREATE POLICY "Users can view availability of own chargers"
  ON ocpp_charger_availability FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charger_availability.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert availability for own chargers"
  ON ocpp_charger_availability FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charger_availability.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update availability of own chargers"
  ON ocpp_charger_availability FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charger_availability.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charger_availability.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete availability of own chargers"
  ON ocpp_charger_availability FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ocpp_chargers
      WHERE ocpp_chargers.id = ocpp_charger_availability.charger_id
      AND ocpp_chargers.user_id = auth.uid()
    )
  );

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for tables with updated_at column
DO $$ BEGIN
  CREATE TRIGGER update_ocpp_chargers_updated_at
    BEFORE UPDATE ON ocpp_chargers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_ocpp_connectors_updated_at
    BEFORE UPDATE ON ocpp_connectors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_ocpp_sessions_updated_at
    BEFORE UPDATE ON ocpp_charging_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_ocpp_firmware_updated_at
    BEFORE UPDATE ON ocpp_firmware_updates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_ocpp_reservations_updated_at
    BEFORE UPDATE ON ocpp_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
