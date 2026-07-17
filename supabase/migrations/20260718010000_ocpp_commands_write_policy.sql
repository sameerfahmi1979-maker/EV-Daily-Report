-- Allow approved authenticated users to insert remote commands (stop, start, reset, etc.)
CREATE POLICY "auth_insert_ocpp_commands"
  ON ocpp_remote_commands
  FOR INSERT
  TO authenticated
  WITH CHECK (current_user_is_approved());

-- Allow approved authenticated users to cancel their own pending commands
CREATE POLICY "auth_update_ocpp_commands"
  ON ocpp_remote_commands
  FOR UPDATE
  TO authenticated
  USING (current_user_is_approved())
  WITH CHECK (current_user_is_approved());
