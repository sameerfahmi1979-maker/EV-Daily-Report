-- CPMS Extensions: RFID tag management + additional remote command types
-- Adds the rfid_tags management table and extends the remote_command_type enum
-- with SetChargingProfile, ClearChargingProfile, GetDiagnostics, and other
-- OCPP 1.6 commands not included in the original infrastructure migration.

-- Extend the remote_command_type enum with missing OCPP 1.6 operations
ALTER TYPE remote_command_type ADD VALUE IF NOT EXISTS 'SetChargingProfile';
ALTER TYPE remote_command_type ADD VALUE IF NOT EXISTS 'ClearChargingProfile';
ALTER TYPE remote_command_type ADD VALUE IF NOT EXISTS 'GetDiagnostics';
ALTER TYPE remote_command_type ADD VALUE IF NOT EXISTS 'SendLocalList';
ALTER TYPE remote_command_type ADD VALUE IF NOT EXISTS 'GetLocalListVersion';
ALTER TYPE remote_command_type ADD VALUE IF NOT EXISTS 'ReserveNow';
ALTER TYPE remote_command_type ADD VALUE IF NOT EXISTS 'CancelReservation';
ALTER TYPE remote_command_type ADD VALUE IF NOT EXISTS 'DataTransfer';

-- RFID Tag / Charging Card management table
-- Tracks the physical RFID cards used for EV charger authorization.
CREATE TABLE IF NOT EXISTS rfid_tags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_number      text UNIQUE NOT NULL,
  operator_id      uuid REFERENCES operators(id) ON DELETE SET NULL,
  account_name     text,
  card_reader      text,
  card_type        text NOT NULL DEFAULT 'Standard',
  status           text NOT NULL DEFAULT 'Unbound'
                   CHECK (status IN ('Active', 'Blocked', 'Expired', 'Unbound')),
  expiration_date  timestamptz NOT NULL DEFAULT '2099-01-01T00:00:00Z',
  max_count        integer NOT NULL DEFAULT 1,
  balance          numeric(10,3) NOT NULL DEFAULT 0,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rfid_tags ENABLE ROW LEVEL SECURITY;

-- Read: any approved authenticated user
CREATE POLICY "rfid_tags_select" ON rfid_tags
  FOR SELECT TO authenticated
  USING (current_user_is_approved());

-- Write: admin / manager roles only (no direct inserts/updates by anon/readonly roles)
CREATE POLICY "rfid_tags_insert" ON rfid_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_is_approved() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('system_admin','global_admin','operations_manager','company_manager')
    )
  );

CREATE POLICY "rfid_tags_update" ON rfid_tags
  FOR UPDATE TO authenticated
  USING (
    current_user_is_approved() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('system_admin','global_admin','operations_manager','company_manager')
    )
  )
  WITH CHECK (
    current_user_is_approved() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('system_admin','global_admin','operations_manager','company_manager')
    )
  );

CREATE POLICY "rfid_tags_delete" ON rfid_tags
  FOR DELETE TO authenticated
  USING (
    current_user_is_approved() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('system_admin','global_admin','operations_manager','company_manager')
    )
  );

REVOKE ALL ON rfid_tags FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON rfid_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rfid_tags TO service_role;

DO $$ BEGIN
  CREATE TRIGGER update_rfid_tags_updated_at
    BEFORE UPDATE ON rfid_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
