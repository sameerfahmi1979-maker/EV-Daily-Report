/*
  # Create Operators Table

  1. New Tables
    - `operators`
      - `id` (uuid, primary key) - Unique operator identifier
      - `user_id` (uuid) - Reference to auth.users for multi-tenancy
      - `name` (text, required) - Operator full name
      - `photo_url` (text) - URL to operator photo in storage
      - `phone_number` (text) - Operator phone number
      - `id_number` (text) - Government ID number
      - `national_number` (text) - National identification number
      - `card_number` (text, required) - RFID card number for charging sessions
      - `email` (text) - Operator email address
      - `status` (text, default 'active') - Operator status (active/inactive)
      - `notes` (text) - Additional notes about the operator
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record last update timestamp

  2. Security
    - Enable RLS on `operators` table
    - Add policy for users to view their own operators
    - Add policy for users to insert their own operators
    - Add policy for users to update their own operators
    - Add policy for users to delete their own operators

  3. Indexes
    - Index on user_id for fast filtering
    - Index on card_number for fast operator lookup during imports
    - Index on name for search performance
    - Unique constraint on (user_id, card_number) to prevent duplicates

  4. Triggers
    - Automatic updated_at timestamp trigger
*/

-- Create operators table
CREATE TABLE IF NOT EXISTS operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  photo_url text,
  phone_number text,
  id_number text,
  national_number text,
  card_number text NOT NULL,
  email text,
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique constraint on user_id and card_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'operators' AND constraint_name = 'operators_user_card_unique'
  ) THEN
    ALTER TABLE operators ADD CONSTRAINT operators_user_card_unique UNIQUE (user_id, card_number);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_operators_user_id ON operators(user_id);
CREATE INDEX IF NOT EXISTS idx_operators_card_number ON operators(card_number);
CREATE INDEX IF NOT EXISTS idx_operators_name ON operators(name);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_operators_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS operators_updated_at_trigger ON operators;
CREATE TRIGGER operators_updated_at_trigger
  BEFORE UPDATE ON operators
  FOR EACH ROW
  EXECUTE FUNCTION update_operators_updated_at();

-- Enable Row Level Security
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own operators
DROP POLICY IF EXISTS "Users can view own operators" ON operators;
CREATE POLICY "Users can view own operators"
  ON operators
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own operators
DROP POLICY IF EXISTS "Users can insert own operators" ON operators;
CREATE POLICY "Users can insert own operators"
  ON operators
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own operators
DROP POLICY IF EXISTS "Users can update own operators" ON operators;
CREATE POLICY "Users can update own operators"
  ON operators
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own operators
DROP POLICY IF EXISTS "Users can delete own operators" ON operators;
CREATE POLICY "Users can delete own operators"
  ON operators
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);