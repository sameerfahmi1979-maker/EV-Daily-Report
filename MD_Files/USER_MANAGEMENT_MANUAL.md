# EV CSMS — User Management Manual

> **System:** Energy Stream — EV Charging Station Management System  
> **Version:** 1.0 — March 2026  
> **Audience:** Global Admin users

---

## Table of Contents

1. [Overview](#1-overview)
2. [Accessing User Management](#2-accessing-user-management)
3. [Creating a New User](#3-creating-a-new-user)
4. [Editing a User](#4-editing-a-user)
5. [Changing User Role](#5-changing-user-role)
6. [Assigning a Station](#6-assigning-a-station)
7. [Suspending / Deactivating a User](#7-suspending--deactivating-a-user)
8. [Reactivating a User](#8-reactivating-a-user)
9. [Resetting a User's Password](#9-resetting-a-users-password)
10. [Changing Your Own Password](#10-changing-your-own-password)
11. [Roles & Permissions Reference](#11-roles--permissions-reference)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Overview

The EV CSMS uses **Supabase Authentication** for user login and a **user_profiles** table for role-based access control (RBAC). Each user has:

| Field | Description |
|-------|-------------|
| **Email** | Login email (set during creation) |
| **Full Name** | Display name |
| **Role** | Determines what the user can access |
| **Station** | Assigned station (for Station Managers) |
| **Status** | Active or Inactive |

Only **Global Admin** users can manage other users.

---

## 2. Accessing User Management

1. Log in to the system with a **Global Admin** account.
2. In the left sidebar, click **⚙ Settings**.
3. Select the **Users** tab.

You will see the **User Management** page with:
- **Role summary cards** — count of users per role
- **User table** — list of all users with email, role, station, status, and join date
- **Search bar** — filter by name, email, or role

---

## 3. Creating a New User

New users are created through the **Supabase Dashboard** (the authentication backend).

### Step-by-Step:

1. **Open Supabase Dashboard**
   - Go to: `https://supabase.com/dashboard`
   - Log in with the project owner account
   - Select the **EV CSMS** project (`uybnsfgnghpcmpjcfrig`)

2. **Navigate to Authentication**
   - In the left sidebar, click **Authentication** → **Users**

3. **Add a New User**
   - Click the **"Add user"** button (top right)
   - Choose **"Create new user"**
   - Fill in:
     - **Email**: The user's email address
     - **Password**: A strong temporary password (min 6 characters)
     - ✅ Check **"Auto Confirm User"** so the user can log in immediately
   - Click **"Create user"**

4. **Share Credentials**
   - Provide the user with their email and temporary password
   - Instruct them to log in and change their password (see Section 10)

5. **Set Role in the App**
   - Once the user logs in for the first time, their profile is automatically created with the default role (**Station Manager**)
   - Go to **Settings → Users** in the EV CSMS app
   - Find the new user and click **Edit** to assign the correct role (see Section 5)

> **Important:** The user must log in at least once before their profile appears in the User Management page. The system automatically creates a profile on first login.

---

## 4. Editing a User

1. Go to **Settings → Users**
2. Find the user in the table (use the search bar if needed)
3. Click the **"Edit"** button in the Actions column
4. The Edit User modal will open showing:
   - User email and name (read-only)
   - Role selection
   - Station assignment (for Station Managers)
   - Active/Inactive toggle
   - Permission preview for the selected role
5. Make your changes
6. Click **"Save Changes"**

---

## 5. Changing User Role

The system has **4 roles** with different access levels:

| Role | Access Level |
|------|-------------|
| 🔴 **Global Admin** | Full system access — all features, settings, and user management |
| 🟣 **Company Manager** | View all stations, reports, analytics, and audit logs |
| 🔵 **Station Manager** | Manage assigned station — upload data, manage shifts, operators |
| 🟢 **Accountant** | View financial reports, billing, and analytics (read-only) |

### To Change a User's Role:

1. Go to **Settings → Users**
2. Click **Edit** on the target user
3. In the **Role** section, click the desired role card
4. The **permission preview** at the bottom will update to show what the user can/cannot do
5. Click **"Save Changes"**

> **⚠ Warning:** Changing a user from Global Admin to a lower role will immediately restrict their access. Be careful not to remove the last Global Admin.

---

## 6. Assigning a Station

Station assignment is relevant for **Station Manager** role only. Global Admins and Company Managers have access to all stations.

1. Click **Edit** on a user who has the **Station Manager** role
2. In the **Assigned Station** dropdown, select the station
3. Click **"Save Changes"**

If "No specific station" is selected, the Station Manager will have access to all stations.

---

## 7. Suspending / Deactivating a User

Deactivating a user prevents them from accessing the system without deleting their account.

### From the App:

1. Go to **Settings → Users**
2. Click **Edit** on the user
3. Toggle **"Account Active"** to **OFF** (grey position)
4. Click **"Save Changes"**

The user's status will change to **❌ Inactive** in the user table.

### From Supabase Dashboard (Full Block):

For a complete block (including preventing password resets):

1. Go to **Supabase Dashboard → Authentication → Users**
2. Find the user by email
3. Click the **three dots menu** (⋮) on the right
4. Select **"Ban user"**

> **Note:** App-level deactivation (`is_active = false`) is usually sufficient. Use the Supabase ban only for security-critical cases.

---

## 8. Reactivating a User

1. Go to **Settings → Users**
2. Find the inactive user (they will show ❌ Inactive)
3. Click **Edit**
4. Toggle **"Account Active"** to **ON** (green position)
5. Click **"Save Changes"**

The user can now log in again with their existing credentials.

If the user was also banned in Supabase Dashboard, you must **unban** them there as well:
1. Supabase Dashboard → Authentication → Users
2. Find the user → Click ⋮ → **"Unban user"**

---

## 9. Resetting a User's Password

If a user forgets their password:

### Option A: User Self-Service (Recommended)

1. On the login screen, the user clicks **"Forgot Password?"**
2. They enter their email address
3. A password reset email is sent automatically
4. The user clicks the link in the email and sets a new password

### Option B: Admin Reset via Supabase Dashboard

1. Go to **Supabase Dashboard → Authentication → Users**
2. Find the user by email
3. Click the **three dots menu** (⋮)
4. Select **"Send password recovery"**
5. The user will receive a password reset email

### Option C: Admin Sets New Password Directly

1. Go to **Supabase Dashboard → Authentication → Users**
2. Find the user by email
3. Click the **three dots menu** (⋮)
4. Select **"Update user"**
5. Enter a new password in the password field
6. Click **"Save"**
7. Communicate the new password to the user securely

---

## 10. Changing Your Own Password

Any user can change their own password:

### Via Email Reset:

1. Log out of the system
2. On the login page, click **"Forgot Password?"**
3. Enter your email and click **"Send Reset Link"**
4. Check your email for the reset link
5. Click the link and enter your new password

---

## 11. Roles & Permissions Reference

Below is the complete permission matrix:

| Permission | Global Admin | Company Manager | Station Manager | Accountant |
|-----------|:---:|:---:|:---:|:---:|
| **View Dashboard** | ✅ | ✅ | ✅ | ✅ |
| **View Analytics** | ✅ | ✅ | ✅ | ✅ |
| **View Reports** | ✅ | ✅ | ✅ | ✅ |
| **View Handover Reports** | ✅ | ✅ | ✅ | ✅ |
| **Export PDF** | ✅ | ✅ | ✅ | ✅ |
| **Export CDR** | ✅ | ✅ | ✅ | ✅ |
| **View System Settings** | ✅ | ✅ | ✅ | ✅ |
| **View Session Notes** | ✅ | ✅ | ✅ | ✅ |
| **Upload Shift Data** | ✅ | ❌ | ✅ | ❌ |
| **Delete Import Batch** | ✅ | ❌ | ✅ | ❌ |
| **Manage Shifts** | ✅ | ❌ | ✅ | ❌ |
| **Update Handover** | ✅ | ❌ | ✅ | ❌ |
| **Manage Operators** | ✅ | ❌ | ✅ | ❌ |
| **Add Session Notes** | ✅ | ❌ | ✅ | ❌ |
| **Manage Maintenance Log** | ✅ | ❌ | ✅ | ❌ |
| **Manage Roster** | ✅ | ❌ | ✅ | ❌ |
| **View Audit Log** | ✅ | ✅ | ❌ | ❌ |
| **View Maintenance Log** | ✅ | ✅ | ✅ | ❌ |
| **View Roster** | ✅ | ✅ | ✅ | ❌ |
| **Manage Stations** | ✅ | ❌ | ❌ | ❌ |
| **Manage Rates** | ✅ | ❌ | ❌ | ❌ |
| **Manage Users** | ✅ | ❌ | ❌ | ❌ |
| **Edit System Settings** | ✅ | ❌ | ❌ | ❌ |

---

## 12. Troubleshooting

### "User not showing in User Management"
- The user must log in at least once. The system creates a profile on first login.
- Verify the user was created in Supabase Dashboard → Authentication → Users.

### "User can't log in"
- Check if the user's account is **Active** in Settings → Users.
- Check if the user is **banned** in Supabase Dashboard.
- Verify the email and password are correct.
- Try resetting the password (see Section 9).

### "User sees restricted access"
- Verify the user has the correct **role** assigned (Settings → Users → Edit).
- Check the permission table in Section 11 to confirm the role has the needed permission.

### "Cannot edit another admin"
- All Global Admins can edit each other. If you're locked out, use the Supabase Dashboard to directly update the `user_profiles` table.

---

> **Document maintained by:** System Administrator  
> **Last updated:** March 14, 2026
