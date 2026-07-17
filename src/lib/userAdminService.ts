// =============================================
// userAdminService.ts
// Password management + admin-only user deletion.
//
// Deleting another user's auth identity or setting their password requires
// the Supabase Auth Admin API (service-role key), which must never run in
// the browser. Those two actions are proxied through the `admin-user-management`
// Edge Function, which re-checks the caller is an approved system_admin
// server-side before doing anything. Self-service password changes don't need
// that — they just call supabase.auth.updateUser() with the user's own session.
// =============================================
import { supabase } from './supabase';

interface EdgeFunctionResult {
  ok: boolean;
  error?: string;
}

async function callAdminUserManagement(body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke<EdgeFunctionResult>(
    'admin-user-management',
    { body }
  );
  if (error) {
    throw new Error(error.message || 'Request failed');
  }
  if (!data?.ok) {
    throw new Error(data?.error || 'Request failed');
  }
}

/** System admin only (enforced server-side). Hard-deletes the target user's login and profile. */
export async function adminDeleteUser(targetUserId: string): Promise<void> {
  await callAdminUserManagement({ action: 'delete_user', targetUserId });
}

/**
 * System admin only (enforced server-side). Sets a new (typically temporary)
 * password for another user. When `forceChange` is true, the target user is
 * blocked from the dashboard until they set their own new password.
 */
export async function adminSetUserPassword(
  targetUserId: string,
  newPassword: string,
  forceChange: boolean
): Promise<void> {
  await callAdminUserManagement({ action: 'set_password', targetUserId, newPassword, forceChange });
}

/**
 * Self-service password change for the currently logged-in user. Re-verifies
 * the current password first (defense in depth against a hijacked session
 * silently locking the real owner out), then updates it and clears any
 * pending "must change password" flag.
 */
export async function changeMyPassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters');
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthError) {
    throw new Error('Current password is incorrect');
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;

  await supabase.rpc('self_mark_password_changed');
}

/**
 * Completes a forced password change (ForceChangePasswordScreen). The user
 * is already authenticated via the temporary password they just logged in
 * with, so no re-verification step is needed here.
 */
export async function completeForcedPasswordChange(newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters');
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw updateError;

  await supabase.rpc('self_mark_password_changed');
}
