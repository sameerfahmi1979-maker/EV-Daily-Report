// admin-user-management
//
// Server-side proxy for the Supabase Auth Admin API, which requires the
// service-role key and therefore can never run in the browser. Only two
// actions are supported, both restricted to callers whose user_profiles.role
// is system_admin (or the legacy alias global_admin):
//
//   - delete_user: hard-deletes the target's auth identity (auth.users row;
//     Supabase cascades related auth schema rows) and their user_profiles row.
//     Refuses to delete the caller's own account or the last active admin.
//   - set_password: sets a new password for the target user (admin-typed, not
//     generated) and stores whether the user must change it before their next
//     dashboard access (user_profiles.must_change_password).
//
// Every action is written to audit_log (never the password itself).

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ADMIN_ROLES = new Set(["system_admin", "global_admin"]);

// The browser sends a CORS preflight (OPTIONS) before the real POST because
// the request carries an Authorization header. Without these headers on
// every response (including the preflight), the browser blocks the request
// before it ever reaches this code, and supabase-js reports it as
// "Failed to send a request to the Edge Function".
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return json({ ok: false, error: "Missing authorization" }, 401);
  }

  // Bound to the caller's own JWT — used only to identify who is calling.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData?.user) {
    return json({ ok: false, error: "Invalid session" }, 401);
  }
  const callerId = callerData.user.id;

  // Service-role client — bypasses RLS for the privileged operations below.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile, error: profileErr } = await admin
    .from("user_profiles")
    .select("role, approval_status, is_active")
    .eq("id", callerId)
    .maybeSingle();

  if (profileErr || !callerProfile) {
    return json({ ok: false, error: "Caller profile not found" }, 403);
  }
  if (
    !ADMIN_ROLES.has(callerProfile.role) ||
    callerProfile.approval_status !== "approved" ||
    callerProfile.is_active === false
  ) {
    return json({ ok: false, error: "Denied: system admin role required" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const action = body?.action;
  const targetUserId = body?.targetUserId;
  if (typeof action !== "string" || typeof targetUserId !== "string" || !targetUserId) {
    return json({ ok: false, error: "action and targetUserId are required" }, 400);
  }

  if (action === "delete_user") {
    if (targetUserId === callerId) {
      return json({ ok: false, error: "You cannot delete your own account" }, 400);
    }

    const { data: targetProfile } = await admin
      .from("user_profiles")
      .select("role, email, full_name")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetProfile && ADMIN_ROLES.has(targetProfile.role)) {
      const { count } = await admin
        .from("user_profiles")
        .select("id", { count: "exact", head: true })
        .in("role", Array.from(ADMIN_ROLES))
        .eq("is_active", true);
      if ((count ?? 0) <= 1) {
        return json({ ok: false, error: "Cannot delete the last active system admin" }, 400);
      }
    }

    const { error: deleteErr } = await admin.auth.admin.deleteUser(targetUserId);
    if (deleteErr) {
      return json({ ok: false, error: deleteErr.message }, 400);
    }

    // Defensive cleanup in case the row didn't cascade for any reason.
    await admin.from("user_profiles").delete().eq("id", targetUserId);

    await admin.from("audit_log").insert({
      user_id: callerId,
      action: "admin_delete_user",
      entity_type: "user_profiles",
      entity_id: targetUserId,
      details: {
        deleted_email: targetProfile?.email ?? null,
        deleted_full_name: targetProfile?.full_name ?? null,
        deleted_role: targetProfile?.role ?? null,
      },
    });

    return json({ ok: true });
  }

  if (action === "set_password") {
    const newPassword = body?.newPassword;
    const forceChange = Boolean(body?.forceChange);

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return json({ ok: false, error: "Password must be at least 8 characters" }, 400);
    }

    const { error: pwErr } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });
    if (pwErr) {
      return json({ ok: false, error: pwErr.message }, 400);
    }

    const { error: flagErr } = await admin
      .from("user_profiles")
      .update({ must_change_password: forceChange, updated_at: new Date().toISOString() })
      .eq("id", targetUserId);
    if (flagErr) {
      return json({ ok: false, error: flagErr.message }, 400);
    }

    await admin.from("audit_log").insert({
      user_id: callerId,
      action: "admin_set_password",
      entity_type: "user_profiles",
      entity_id: targetUserId,
      details: { force_change: forceChange },
    });

    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown action" }, 400);
});
