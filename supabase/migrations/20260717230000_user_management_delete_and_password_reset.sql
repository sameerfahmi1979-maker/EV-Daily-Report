-- User Management: delete user, admin-set/temporary password, self-service change
--
-- Adds the "must change password" gate flag and a self-service RPC that lets an
-- authenticated user clear that flag on their OWN row after they successfully
-- change their password (user_profiles UPDATE is otherwise system_admin-only
-- per users_update_admin_only, so a plain client update would be denied).
--
-- The actual privileged operations (deleting a user's auth identity, setting a
-- password on someone else's behalf) require the Supabase Auth Admin API,
-- which needs the service-role key. Those are implemented in the
-- `admin-user-management` Edge Function, not in SQL — this migration only
-- adds the schema/RPC support those flows need.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.must_change_password IS
  'User Management: true when an admin set a temporary password with "force change" — blocks dashboard access (via ProtectedRoute) until the user sets their own new password, which clears this via self_mark_password_changed().';

CREATE OR REPLACE FUNCTION public.self_mark_password_changed()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE user_profiles
  SET must_change_password = false, updated_at = now()
  WHERE id = auth.uid();

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'self_password_change', 'user_profiles', auth.uid(), '{}'::jsonb);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.self_mark_password_changed() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.self_mark_password_changed() FROM anon;
GRANT EXECUTE ON FUNCTION public.self_mark_password_changed() TO authenticated;

COMMENT ON FUNCTION public.self_mark_password_changed() IS
  'User Management: self-service — clears must_change_password on the caller''s own row and logs the change. Called by the client immediately after supabase.auth.updateUser({ password }) succeeds.';
