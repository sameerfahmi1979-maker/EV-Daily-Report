# EV Charging Station Analytics & Billing System
## Detailed Implementation Phases

---

## IMPORTANT BILLING POLICY

**NO TAX CHARGED TO CUSTOMERS**

This system does NOT apply any taxes to customer billing. The total amount charged equals the subtotal (energy charges + demand charges + fixed charges). While the database includes a `tax_configurations` table for future flexibility, it is not used in billing calculations by default.

**Final Bill = Energy Charges + Demand Charges + Fixed Charges**

---

## TABLE OF CONTENTS
1. [Phase 1: Foundation & Database Setup](#phase-1-foundation--database-setup)
2. [Phase 2: Authentication System](#phase-2-authentication-system)
3. [Phase 3: Station Management](#phase-3-station-management)
4. [Phase 4: Rate Configuration System](#phase-4-rate-configuration-system)
5. [Phase 5: Excel Import Engine](#phase-5-excel-import-engine)
6. [Phase 6: Billing Calculation Engine](#phase-6-billing-calculation-engine)
7. [Phase 7: Analytics Dashboard](#phase-7-analytics-dashboard)
8. [Phase 8: Reporting & Export](#phase-8-reporting--export)
9. [Testing & Quality Assurance](#testing--quality-assurance)
10. [Deployment Checklist](#deployment-checklist)

---

## PHASE 1: FOUNDATION & DATABASE SETUP

### 1.1 Environment Configuration
**Tasks:**
- Configure Supabase connection in `.env`
- Set up database timezone to `Asia/Amman`
- Verify Supabase client initialization
- Configure JOD currency display settings

**Deliverables:**
- Environment variables configured
- Database connection tested
- Timezone settings verified

### 1.2 Database Schema Creation

#### Migration 1: Core Tables Structure
**Tables to Create:**
1. **stations**
   ```sql
   - id (uuid, primary key, default: gen_random_uuid())
   - name (text, not null)
   - location (text)
   - address (text)
   - capacity_kw (decimal)
   - station_code (text, unique)
   - status (text, default: 'active')
   - installation_date (date)
   - notes (text)
   - created_at (timestamptz, default: now())
   - updated_at (timestamptz, default: now())
   - user_id (uuid, foreign key to auth.users)
   ```

2. **rate_structures**
   ```sql
   - id (uuid, primary key)
   - station_id (uuid, foreign key to stations)
   - name (text, not null)
   - description (text)
   - effective_from (date, not null)
   - effective_to (date)
   - is_active (boolean, default: true)
   - created_at (timestamptz, default: now())
   - updated_at (timestamptz, default: now())
   ```

3. **rate_periods**
   ```sql
   - id (uuid, primary key)
   - rate_structure_id (uuid, foreign key to rate_structures)
   - period_name (text, not null)
   - start_time (time, not null)
   - end_time (time, not null)
   - days_of_week (text[], not null)
   - season (text, default: 'all')
   - energy_rate_per_kwh (decimal, not null)
   - demand_charge_per_kw (decimal, default: 0)
   - priority (integer, default: 1)
   - created_at (timestamptz, default: now())
   ```

4. **charging_sessions** (with three-column datetime approach)
   ```sql
   - id (uuid, primary key)
   - station_id (uuid, foreign key to stations)
   - transaction_id (text, unique, not null)
   - charge_id (text, unique, not null)
   - card_number (text, not null)

   -- Start DateTime (three columns)
   - start_date (date, not null)
   - start_time (time, not null)
   - start_ts (timestamptz, not null)

   -- End DateTime (three columns)
   - end_date (date, not null)
   - end_time (time, not null)
   - end_ts (timestamptz, not null)

   - duration_minutes (integer, not null)
   - energy_consumed_kwh (decimal, not null)
   - calculated_cost (decimal, not null)
   - max_demand_kw (decimal)
   - station_code (text)
   - user_identifier (text)
   - import_batch_id (uuid, foreign key)
   - created_at (timestamptz, default: now())
   - updated_at (timestamptz, default: now())
   ```

5. **import_batches**
   ```sql
   - id (uuid, primary key)
   - filename (text, not null)
   - upload_date (timestamptz, not null, default: now())
   - records_total (integer, default: 0)
   - records_success (integer, default: 0)
   - records_failed (integer, default: 0)
   - status (text, default: 'processing')
   - error_log (jsonb)
   - user_id (uuid, foreign key to auth.users)
   - created_at (timestamptz, default: now())
   ```

6. **billing_calculations**
   ```sql
   - id (uuid, primary key)
   - session_id (uuid, foreign key to charging_sessions)
   - rate_structure_id (uuid, foreign key to rate_structures)
   - calculation_date (timestamptz, not null, default: now())
   - breakdown (jsonb)
   - subtotal (decimal, not null)
   - taxes (decimal, default: 0)
   - fees (decimal, default: 0)
   - total_amount (decimal, not null)
   - currency (text, default: 'JOD')
   - created_at (timestamptz, default: now())
   ```

7. **billing_breakdown_items**
   ```sql
   - id (uuid, primary key)
   - billing_calculation_id (uuid, foreign key to billing_calculations)
   - rate_period_id (uuid, foreign key to rate_periods)
   - period_name (text, not null)
   - start_time (timestamptz, not null)
   - end_time (timestamptz, not null)
   - duration_minutes (decimal, not null)
   - energy_kwh (decimal, not null)
   - rate_per_kwh (decimal, not null)
   - demand_kw (decimal)
   - demand_charge (decimal, default: 0)
   - energy_charge (decimal, not null)
   - line_total (decimal, not null)
   - created_at (timestamptz, default: now())
   ```

8. **fixed_charges**
   ```sql
   - id (uuid, primary key)
   - station_id (uuid, foreign key to stations)
   - charge_name (text, not null)
   - charge_type (text, not null)
   - amount (decimal, not null)
   - effective_from (date)
   - effective_to (date)
   - is_active (boolean, default: true)
   - created_at (timestamptz, default: now())
   ```

9. **tax_configurations** (OPTIONAL - Not used by default)
   ```sql
   - id (uuid, primary key)
   - station_id (uuid, foreign key to stations)
   - tax_name (text, not null)
   - tax_rate (decimal, not null)
   - applies_to (text, default: 'all')
   - effective_from (date)
   - effective_to (date)
   - is_active (boolean, default: true)
   - created_at (timestamptz, default: now())
   ```
   **Note:** This table is available for future use but taxes are NOT applied to customer billing by default.

### 1.3 Row Level Security (RLS) Policies

**Security Requirements:**
- All tables MUST have RLS enabled
- Users can only access their own data
- Policies must check `auth.uid()` for ownership
- Separate policies for SELECT, INSERT, UPDATE, DELETE

**RLS Policies for Each Table:**

**stations:**
```sql
-- Enable RLS
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- Users can view their own stations
CREATE POLICY "Users can view own stations"
  ON stations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own stations
CREATE POLICY "Users can create own stations"
  ON stations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own stations
CREATE POLICY "Users can update own stations"
  ON stations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own stations
CREATE POLICY "Users can delete own stations"
  ON stations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

**Similar patterns for all other tables** with appropriate ownership checks via foreign keys.

### 1.4 Database Functions & Triggers

**Function 1: Update `updated_at` timestamp**
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Function 2: Calculate session duration**
```sql
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_ts - NEW.start_ts)) / 60;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Apply triggers to relevant tables**

### 1.5 Seed Data - Jordan Configuration

**Sample Stations:**
```sql
INSERT INTO stations (name, location, capacity_kw, station_code, user_id)
VALUES
  ('Downtown Amman Station', 'Downtown Amman', 150, 'STATION-A1', auth.uid()),
  ('Highway Rest Stop', 'Amman-Aqaba Highway', 200, 'STATION-B2', auth.uid()),
  ('Mall of Jordan', 'Amman', 100, 'STATION-C3', auth.uid());
```

**Jordan TOU Rate Structure:**
```sql
-- Create rate structure
INSERT INTO rate_structures (station_id, name, description, effective_from, is_active)
VALUES
  (<station_id>, 'Jordan EDCO TOU Rates', 'Standard Time-of-Use rates for Jordan', '2025-01-01', true);

-- Create rate periods
INSERT INTO rate_periods (rate_structure_id, period_name, start_time, end_time, days_of_week, season, energy_rate_per_kwh, demand_charge_per_kw)
VALUES
  -- Super Off-Peak
  (<rate_id>, 'Super Off-Peak', '00:00:00', '06:00:00',
   ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   'all', 0.085, 0.00),

  -- Off-Peak Morning
  (<rate_id>, 'Off-Peak', '06:00:00', '12:00:00',
   ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   'all', 0.120, 2.50),

  -- Mid-Peak
  (<rate_id>, 'Mid-Peak', '12:00:00', '18:00:00',
   ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   'all', 0.165, 8.00),

  -- Peak Summer
  (<rate_id>, 'Peak', '18:00:00', '24:00:00',
   ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   'summer', 0.220, 18.00),

  -- Peak Winter
  (<rate_id>, 'Peak', '18:00:00', '24:00:00',
   ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],
   'winter', 0.180, 12.00);
```

**Jordan Fixed Charges:**
```sql
INSERT INTO fixed_charges (station_id, charge_name, charge_type, amount, is_active)
VALUES
  (<station_id>, 'Connection Fee', 'per_session', 2.000, true),
  (<station_id>, 'Service Fee', 'per_session', 1.500, true);
```

**Jordan Tax Configuration (OPTIONAL - Skip by default):**
```sql
-- Tax configuration is available but NOT used by default
-- Customers are NOT charged taxes
-- Uncomment below if you want to enable tax charging in the future:

-- INSERT INTO tax_configurations (station_id, tax_name, tax_rate, applies_to, is_active)
-- VALUES
--   (<station_id>, 'Electricity Tax', 7.00, 'all', false),
--   (<station_id>, 'General Sales Tax (GST)', 16.00, 'all', false);
```

**Completion Criteria:**
- ✅ All tables created successfully
- ✅ RLS enabled on all tables
- ✅ All RLS policies created and tested
- ✅ Database functions deployed
- ✅ Seed data inserted
- ✅ Database timezone set to Asia/Amman
- ✅ Jordan-specific rates configured

---

## PHASE 2: AUTHENTICATION SYSTEM

### 2.1 Supabase Auth Setup
**Requirements:**
- Email/password authentication
- No magic links or social providers
- No email confirmation required (disabled by default)

### 2.2 Authentication Components

**Component 1: Login Form**
```typescript
- Email input (validated)
- Password input (secure)
- Login button
- Link to registration
- Error message display
- Loading state
```

**Component 2: Registration Form**
```typescript
- Email input (validated)
- Password input (min 8 chars, validated)
- Confirm password
- Terms acceptance
- Register button
- Link to login
- Error handling
```

**Component 3: Auth Context**
```typescript
interface AuthContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email, password) => Promise<void>;
  signUp: (email, password) => Promise<void>;
  signOut: () => Promise<void>;
}
```

### 2.3 Protected Routes
- Implement route guards
- Redirect unauthenticated users to login
- Store intended destination for post-login redirect

### 2.4 Session Management
- Set up `onAuthStateChange` listener (using async blocks)
- Handle session refresh
- Manage auth state in React Context
- Persist session in localStorage

**Completion Criteria:**
- ✅ Login functionality working
- ✅ Registration functionality working
- ✅ Protected routes implemented
- ✅ Session management functional
- ✅ Logout working correctly

---

## PHASE 3: STATION MANAGEMENT

### 3.1 Station List Page

**UI Components:**
- Page header with "Add Station" button
- Search bar for filtering stations
- Grid/Card view of stations
- Station status badges (active, maintenance, inactive)
- Quick action buttons (Edit, Delete, View Details)

**Data Display:**
- Station name
- Location
- Capacity (kW)
- Station code
- Status
- Installation date

### 3.2 Add/Edit Station Form

**Form Fields:**
- Name (required, text input)
- Location (text input)
- Address (textarea)
- Capacity (kW) (number input, positive)
- Station Code (text input, unique)
- Status (dropdown: active, maintenance, inactive)
- Installation Date (date picker)
- Notes (textarea)

**Validation:**
- All required fields must be filled
- Capacity must be positive number
- Station code must be unique
- Proper error messages

### 3.3 Station Details Page

**Sections:**
- Station information card
- Associated rate structures
- Recent charging sessions
- Statistics summary (total sessions, total energy, total revenue)
- Edit and Delete buttons

### 3.4 Database Operations

**CRUD Functions:**
```typescript
// Create
const createStation = async (stationData) => {
  const { data, error } = await supabase
    .from('stations')
    .insert([{ ...stationData, user_id: user.id }])
    .select()
    .single();
};

// Read
const getStations = async () => {
  const { data, error } = await supabase
    .from('stations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
};

// Update
const updateStation = async (id, updates) => {
  const { data, error } = await supabase
    .from('stations')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
};

// Delete
const deleteStation = async (id) => {
  const { error } = await supabase
    .from('stations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
};
```

**Completion Criteria:**
- ✅ Station list page displays all stations
- ✅ Add station form working
- ✅ Edit station form working
- ✅ Delete station with confirmation
- ✅ Station details page functional
- ✅ Search and filter working
- ✅ Responsive design on all devices

---

## PHASE 4: RATE CONFIGURATION SYSTEM

### 4.1 Rate Structure Management

**Rate Structure List Page:**
- Display all rate structures
- Show effective dates
- Active/inactive status
- Associated station
- Quick actions (Edit, Duplicate, Deactivate)

**Create Rate Structure Form:**
- Structure name (required)
- Description
- Station selection (dropdown)
- Effective from date (required)
- Effective to date (optional)
- Active status (checkbox)

### 4.2 Rate Period Configuration

**Rate Period Editor:**
- Visual timeline showing 24-hour day
- Add period button
- Period configuration form:
  - Period name (Super Off-Peak, Off-Peak, Mid-Peak, Peak)
  - Start time (time picker)
  - End time (time picker)
  - Days of week (multi-select checkboxes)
  - Season (dropdown: all, summer, winter, spring, fall)
  - Energy rate per kWh (JOD, 3 decimal places)
  - Demand charge per kW (JOD, 3 decimal places)
  - Priority (for overlapping periods)

**Visual Features:**
- Color-coded periods on timeline
- Drag and resize periods
- Overlap detection and warnings
- Period summary table

### 4.3 Jordan-Specific Rate Templates

**Pre-configured Templates:**
1. **Standard Jordan EDCO TOU**
   - Super Off-Peak: 00:00-06:00, 0.085 JOD/kWh
   - Off-Peak: 06:00-12:00, 0.120 JOD/kWh
   - Mid-Peak: 12:00-18:00, 0.165 JOD/kWh
   - Peak Summer: 18:00-24:00, 0.220 JOD/kWh
   - Peak Winter: 18:00-24:00, 0.180 JOD/kWh

2. **Flat Rate**
   - All times: 0.150 JOD/kWh

**Template Selection:**
- User can select template
- System pre-fills rate periods
- User can customize after selection

### 4.4 Fixed Charges Configuration

**Fixed Charges Management:**
- List of all fixed charges
- Add/Edit/Delete functionality
- Fields:
  - Charge name
  - Charge type (monthly, daily, per_session)
  - Amount (JOD, 3 decimals)
  - Effective dates
  - Active status

**Jordan Default Charges:**
- Connection Fee: 2.000 JOD per session
- Service Fee: 1.500 JOD per session

### 4.5 Tax Configuration (OPTIONAL - Not Implemented by Default)

**IMPORTANT:** Tax charging is NOT enabled by default. Customers are billed without taxes.

**Tax Management (Future Feature):**
- List of all taxes
- Add/Edit/Delete functionality
- Fields:
  - Tax name
  - Tax rate (percentage)
  - Applies to (energy, demand, all)
  - Effective dates
  - Active status (default: false)

**Note:** The tax_configurations table exists for future use but is not integrated into billing calculations by default. All calculations skip tax application.

**Completion Criteria:**
- ✅ Rate structure CRUD operational
- ✅ Rate period editor functional
- ✅ Visual timeline working
- ✅ Jordan templates available
- ✅ Fixed charges configurable
- ✅ Tax configuration table exists (but not used in billing)
- ✅ JOD currency formatting correct (3 decimals)
- ✅ Validation and error handling complete

---

## PHASE 5: EXCEL IMPORT ENGINE

### 5.1 File Upload Interface

**Upload Component:**
- Drag-and-drop zone
- File browser button
- Accepted formats: .xlsx, .xls, .csv
- Maximum file size: 10MB
- File format instructions display
- Download sample template button

**Sample Template Structure:**
```
Transaction ID | Charge ID | Card Number | Start DateTime | End DateTime | Energy (kWh) | Cost (JOD) | Station Code | Max Demand (kW) | User ID
```

### 5.2 Excel Parser Implementation

**Dependencies:**
- Install `xlsx` package: `npm install xlsx`
- Install `date-fns` for datetime parsing: `npm install date-fns`
- Install `date-fns-tz` for timezone handling: `npm install date-fns-tz`

**Parser Function:**
```typescript
interface ParsedSession {
  transactionId: string;
  chargeId: string;
  cardNumber: string;
  startDateTime: string; // "2025-12-20 07:54:18"
  endDateTime: string;
  energyKwh: number;
  cost: number;
  stationCode?: string;
  maxDemandKw?: number;
  userIdentifier?: string;
}

const parseExcelFile = async (file: File): Promise<ParsedSession[]> => {
  // Read file
  // Parse headers
  // Validate column names
  // Extract rows
  // Return parsed data
};
```

### 5.3 DateTime Parsing & Three-Column Storage

**Parsing Logic:**
```typescript
import { parse } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';

const parseDateTimeString = (dateTimeStr: string) => {
  // Input: "2025-12-20 07:54:18"
  const parsed = parse(dateTimeStr, 'yyyy-MM-dd HH:mm:ss', new Date());

  // Convert to Asia/Amman timezone-aware timestamp
  const tzAware = zonedTimeToUtc(parsed, 'Asia/Amman');

  return {
    date: format(tzAware, 'yyyy-MM-dd'),      // "2025-12-20"
    time: format(tzAware, 'HH:mm:ss'),        // "07:54:18"
    timestamp: tzAware.toISOString()          // Full UTC timestamp
  };
};
```

**Database Insert:**
```typescript
const insertSession = async (session: ParsedSession) => {
  const start = parseDateTimeString(session.startDateTime);
  const end = parseDateTimeString(session.endDateTime);

  const { data, error } = await supabase
    .from('charging_sessions')
    .insert([{
      transaction_id: session.transactionId,
      charge_id: session.chargeId,
      card_number: session.cardNumber,
      start_date: start.date,
      start_time: start.time,
      start_ts: start.timestamp,
      end_date: end.date,
      end_time: end.time,
      end_ts: end.timestamp,
      energy_consumed_kwh: session.energyKwh,
      calculated_cost: session.cost,
      station_code: session.stationCode,
      max_demand_kw: session.maxDemandKw,
      user_identifier: session.userIdentifier,
      import_batch_id: batchId
    }]);
};
```

### 5.4 Data Validation

**Validation Rules:**
```typescript
const validateSession = (session: ParsedSession): string[] => {
  const errors: string[] = [];

  // Required fields
  if (!session.transactionId) errors.push('Transaction ID is required');
  if (!session.chargeId) errors.push('Charge ID is required');
  if (!session.cardNumber) errors.push('Card Number is required');
  if (!session.startDateTime) errors.push('Start DateTime is required');
  if (!session.endDateTime) errors.push('End DateTime is required');
  if (!session.energyKwh) errors.push('Energy (kWh) is required');
  if (session.cost === undefined) errors.push('Cost is required');

  // Data type validation
  if (session.energyKwh <= 0) errors.push('Energy must be positive');
  if (session.cost < 0) errors.push('Cost cannot be negative');

  // DateTime validation
  const start = new Date(session.startDateTime);
  const end = new Date(session.endDateTime);
  if (isNaN(start.getTime())) errors.push('Invalid Start DateTime format');
  if (isNaN(end.getTime())) errors.push('Invalid End DateTime format');
  if (end <= start) errors.push('End DateTime must be after Start DateTime');

  // Duration check (1 min to 24 hours)
  const durationMs = end.getTime() - start.getTime();
  const durationMin = durationMs / (1000 * 60);
  if (durationMin < 1 || durationMin > 1440) {
    errors.push('Session duration must be between 1 minute and 24 hours');
  }

  return errors;
};
```

### 5.5 Batch Processing

**Import Batch Creation:**
```typescript
const createImportBatch = async (filename: string, totalRecords: number) => {
  const { data, error } = await supabase
    .from('import_batches')
    .insert([{
      filename,
      records_total: totalRecords,
      records_success: 0,
      records_failed: 0,
      status: 'processing',
      user_id: user.id
    }])
    .select()
    .single();

  return data;
};
```

**Batch Insert with Progress:**
```typescript
const processBatch = async (sessions: ParsedSession[], batchId: string) => {
  let successCount = 0;
  let failCount = 0;
  const errors: any[] = [];

  for (const session of sessions) {
    const validationErrors = validateSession(session);

    if (validationErrors.length > 0) {
      failCount++;
      errors.push({ session, errors: validationErrors });
      continue;
    }

    try {
      await insertSession(session, batchId);
      successCount++;
    } catch (error) {
      failCount++;
      errors.push({ session, errors: [error.message] });
    }
  }

  // Update batch record
  await supabase
    .from('import_batches')
    .update({
      records_success: successCount,
      records_failed: failCount,
      status: failCount > 0 ? 'completed_with_errors' : 'completed',
      error_log: errors
    })
    .eq('id', batchId);
};
```

### 5.6 Import History & Error Logging

**Import History Page:**
- Table showing all imports
- Columns: Filename, Date, Total Records, Success, Failed, Status
- View Details button to see error log
- Download error report button

**Error Log Viewer:**
- Modal/page showing failed records
- Display validation errors for each failed row
- Option to download error report as CSV
- Option to fix and re-import failed rows

**Completion Criteria:**
- ✅ File upload interface functional
- ✅ Excel parsing working for .xlsx, .xls, .csv
- ✅ DateTime parsing handles "YYYY-MM-DD HH:MM:SS" format
- ✅ Three-column datetime storage implemented
- ✅ Timezone conversion to Asia/Amman working
- ✅ All validation rules implemented
- ✅ Batch processing functional
- ✅ Progress indicator working
- ✅ Import history page complete
- ✅ Error logging and reporting working
- ✅ Sample template downloadable

---

## PHASE 6: BILLING CALCULATION ENGINE

### 6.1 Core Calculation Algorithm

**Step 1: Session Time-Splitting**
```typescript
interface PeriodSegment {
  periodId: string;
  periodName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  ratePerKwh: number;
  demandChargePerKw: number;
}

const splitSessionIntoPeriods = async (
  sessionId: string,
  stationId: string,
  startTs: Date,
  endTs: Date
): Promise<PeriodSegment[]> => {
  // 1. Get applicable rate structure for station
  const rateStructure = await getActiveRateStructure(stationId, startTs);

  // 2. Get all rate periods for the structure
  const ratePeriods = await getRatePeriods(rateStructure.id);

  // 3. Split session across periods
  const segments: PeriodSegment[] = [];
  let currentTime = startTs;

  while (currentTime < endTs) {
    // Find applicable rate period for current time
    const period = findApplicablePeriod(ratePeriods, currentTime);

    // Calculate segment end (either period end or session end)
    const segmentEnd = min([
      getNextPeriodBoundary(currentTime, period),
      endTs
    ]);

    // Calculate segment duration
    const durationMs = segmentEnd.getTime() - currentTime.getTime();
    const durationMin = durationMs / (1000 * 60);

    segments.push({
      periodId: period.id,
      periodName: period.period_name,
      startTime: currentTime,
      endTime: segmentEnd,
      durationMinutes: durationMin,
      ratePerKwh: period.energy_rate_per_kwh,
      demandChargePerKw: period.demand_charge_per_kw
    });

    currentTime = segmentEnd;
  }

  return segments;
};
```

**Step 2: Energy Allocation**
```typescript
const allocateEnergyToSegments = (
  totalEnergy: number,
  segments: PeriodSegment[]
): PeriodSegment[] => {
  const totalDuration = segments.reduce((sum, s) => sum + s.durationMinutes, 0);

  return segments.map(segment => ({
    ...segment,
    energyKwh: totalEnergy * (segment.durationMinutes / totalDuration)
  }));
};
```

**Step 3: Calculate Charges**
```typescript
interface BillingBreakdown {
  periodCharges: PeriodCharge[];
  subtotal: number;
  fixedCharges: number;
  taxes: number; // Always 0 - no tax charged
  total: number; // Same as subtotal
}

interface PeriodCharge {
  periodName: string;
  duration: number;
  energy: number;
  ratePerKwh: number;
  energyCharge: number;
  demand: number;
  demandRate: number;
  demandCharge: number;
  lineTotal: number;
}

const calculateSessionBilling = async (
  sessionId: string
): Promise<BillingBreakdown> => {
  // Get session data
  const session = await getSession(sessionId);

  // Split into periods
  const segments = await splitSessionIntoPeriods(
    sessionId,
    session.station_id,
    session.start_ts,
    session.end_ts
  );

  // Allocate energy
  const segmentsWithEnergy = allocateEnergyToSegments(
    session.energy_consumed_kwh,
    segments
  );

  // Calculate period charges
  const periodCharges: PeriodCharge[] = segmentsWithEnergy.map(segment => {
    const energyCharge = segment.energyKwh * segment.ratePerKwh;
    const demandCharge = (session.max_demand_kw || 0) * segment.demandChargePerKw;

    return {
      periodName: segment.periodName,
      duration: segment.durationMinutes,
      energy: segment.energyKwh,
      ratePerKwh: segment.ratePerKwh,
      energyCharge,
      demand: session.max_demand_kw || 0,
      demandRate: segment.demandChargePerKw,
      demandCharge,
      lineTotal: energyCharge + demandCharge
    };
  });

  // Calculate subtotal
  const periodSubtotal = periodCharges.reduce((sum, p) => sum + p.lineTotal, 0);

  // Get fixed charges
  const fixedCharges = await getActiveFixedCharges(session.station_id, session.start_ts);
  const fixedChargesTotal = fixedCharges.reduce((sum, c) => sum + c.amount, 0);

  // Calculate subtotal
  const subtotal = periodSubtotal + fixedChargesTotal;

  // NO TAX APPLIED - customers are not charged taxes
  const taxTotal = 0;

  // Calculate final total (same as subtotal since no tax)
  const total = subtotal;

  return {
    periodCharges,
    subtotal,
    fixedCharges: fixedChargesTotal,
    taxes: taxTotal,
    total
  };
};
```

### 6.2 Complex Scenario Handling

**Midnight Crossing:**
```typescript
const handleMidnightCrossing = (startTs: Date, endTs: Date) => {
  // Check if session crosses midnight
  if (startTs.getDate() !== endTs.getDate()) {
    // Split into separate day calculations
    const daySegments = splitIntoDays(startTs, endTs);
    return daySegments;
  }
  return [{ start: startTs, end: endTs }];
};
```

**Seasonal Rate Changes:**
```typescript
const determineSeason = (date: Date): string => {
  const month = date.getMonth() + 1; // 1-12

  // Jordan seasons (adjust as needed)
  if (month >= 6 && month <= 9) return 'summer';
  if (month >= 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  return 'fall';
};
```

### 6.3 Jordan-Specific Calculations

**NO TAX APPLICATION:**
```typescript
// Taxes are NOT applied to customer billing
// The total amount equals the subtotal (period charges + fixed charges)
const calculateFinalTotal = (subtotal: number): number => {
  return subtotal; // No tax added
};
```

**JOD Currency Formatting:**
```typescript
const formatJOD = (amount: number): string => {
  return amount.toFixed(3) + ' JOD';
};

// Example: 1123.461 JOD
```

### 6.4 Billing Record Storage

**Save Calculation to Database:**
```typescript
const saveBillingCalculation = async (
  sessionId: string,
  rateStructureId: string,
  breakdown: BillingBreakdown
) => {
  // Insert main billing record
  const { data: billing, error } = await supabase
    .from('billing_calculations')
    .insert([{
      session_id: sessionId,
      rate_structure_id: rateStructureId,
      breakdown: breakdown,
      subtotal: breakdown.subtotal,
      taxes: breakdown.taxes,
      fees: breakdown.fixedCharges,
      total_amount: breakdown.total,
      currency: 'JOD'
    }])
    .select()
    .single();

  // Insert breakdown items
  for (const periodCharge of breakdown.periodCharges) {
    await supabase
      .from('billing_breakdown_items')
      .insert([{
        billing_calculation_id: billing.id,
        period_name: periodCharge.periodName,
        duration_minutes: periodCharge.duration,
        energy_kwh: periodCharge.energy,
        rate_per_kwh: periodCharge.ratePerKwh,
        demand_kw: periodCharge.demand,
        demand_charge: periodCharge.demandCharge,
        energy_charge: periodCharge.energyCharge,
        line_total: periodCharge.lineTotal
      }]);
  }

  return billing;
};
```

### 6.5 Recalculation Support

**Trigger Recalculation:**
```typescript
const recalculateSession = async (sessionId: string) => {
  // Delete existing calculation
  const { data: existing } = await supabase
    .from('billing_calculations')
    .select('id')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (existing) {
    // Delete breakdown items first
    await supabase
      .from('billing_breakdown_items')
      .delete()
      .eq('billing_calculation_id', existing.id);

    // Delete calculation
    await supabase
      .from('billing_calculations')
      .delete()
      .eq('id', existing.id);
  }

  // Perform new calculation
  const breakdown = await calculateSessionBilling(sessionId);
  await saveBillingCalculation(sessionId, rateStructureId, breakdown);
};
```

**Completion Criteria:**
- ✅ Time-splitting algorithm working correctly
- ✅ Energy allocation proportional by duration
- ✅ Period charges calculated accurately
- ✅ Demand charges applied correctly
- ✅ Fixed charges included
- ✅ NO tax applied (taxes field set to 0)
- ✅ JOD formatting with 3 decimals
- ✅ Midnight crossing handled
- ✅ Multi-day sessions supported
- ✅ Seasonal rates applied correctly
- ✅ Billing records saved to database
- ✅ Recalculation functionality working
- ✅ Calculation breakdown detailed and accurate

---

## PHASE 7: ANALYTICS DASHBOARD

### 7.1 Dashboard Layout

**Main Dashboard Components:**
1. Summary Cards (Top Row)
2. Energy Chart (Line/Area Chart)
3. Revenue Chart (Bar Chart)
4. Station Comparison (Pie/Bar Chart)
5. Recent Activity Table

### 7.2 Summary Cards

**Card 1: Total Energy Consumed**
```typescript
interface MetricCard {
  title: string;
  value: number;
  unit: string;
  change: number; // percentage change from previous period
  icon: string;
}

// Query
const getTotalEnergy = async (startDate: Date, endDate: Date) => {
  const { data } = await supabase
    .from('charging_sessions')
    .select('energy_consumed_kwh')
    .gte('start_date', format(startDate, 'yyyy-MM-dd'))
    .lte('end_date', format(endDate, 'yyyy-MM-dd'));

  const total = data.reduce((sum, s) => sum + s.energy_consumed_kwh, 0);
  return total;
};
```

**Card 2: Total Revenue**
```typescript
const getTotalRevenue = async (startDate: Date, endDate: Date) => {
  const { data } = await supabase
    .from('billing_calculations')
    .select('total_amount')
    .gte('calculation_date', startDate.toISOString())
    .lte('calculation_date', endDate.toISOString());

  const total = data.reduce((sum, b) => sum + b.total_amount, 0);
  return total;
};
```

**Card 3: Total Sessions**
```typescript
const getTotalSessions = async (startDate: Date, endDate: Date) => {
  const { count } = await supabase
    .from('charging_sessions')
    .select('*', { count: 'exact', head: true })
    .gte('start_date', format(startDate, 'yyyy-MM-dd'))
    .lte('end_date', format(endDate, 'yyyy-MM-dd'));

  return count;
};
```

**Card 4: Active Stations**
```typescript
const getActiveStations = async () => {
  const { count } = await supabase
    .from('stations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  return count;
};
```

### 7.3 Energy Consumption Chart

**Chart Library:** Recharts or Chart.js

**Data Structure:**
```typescript
interface ChartDataPoint {
  date: string;
  energy: number;
  sessions: number;
}

const getEnergyTrend = async (
  startDate: Date,
  endDate: Date,
  groupBy: 'day' | 'week' | 'month'
) => {
  // Query sessions grouped by date
  const { data } = await supabase
    .from('charging_sessions')
    .select('start_date, energy_consumed_kwh')
    .gte('start_date', format(startDate, 'yyyy-MM-dd'))
    .lte('start_date', format(endDate, 'yyyy-MM-dd'))
    .order('start_date');

  // Group data by period
  const grouped = groupDataByPeriod(data, groupBy);

  return grouped;
};
```

**Chart Component:**
```typescript
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={energyData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis label={{ value: 'Energy (kWh)', angle: -90 }} />
    <Tooltip />
    <Legend />
    <Line
      type="monotone"
      dataKey="energy"
      stroke="#2563EB"
      strokeWidth={2}
      dot={{ r: 4 }}
      activeDot={{ r: 6 }}
    />
  </LineChart>
</ResponsiveContainer>
```

### 7.4 Revenue Chart

**Data Structure:**
```typescript
interface RevenueDataPoint {
  station: string;
  revenue: number;
  sessions: number;
}

const getRevenueByStation = async (startDate: Date, endDate: Date) => {
  const { data } = await supabase
    .from('billing_calculations')
    .select(`
      total_amount,
      charging_sessions (
        station_id,
        stations (name)
      )
    `)
    .gte('calculation_date', startDate.toISOString())
    .lte('calculation_date', endDate.toISOString());

  // Group by station
  const grouped = groupByStation(data);

  return grouped;
};
```

**Bar Chart Component:**
```typescript
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={revenueData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="station" />
    <YAxis label={{ value: 'Revenue (JOD)', angle: -90 }} />
    <Tooltip formatter={(value) => formatJOD(value)} />
    <Legend />
    <Bar dataKey="revenue" fill="#10B981" />
  </BarChart>
</ResponsiveContainer>
```

### 7.5 Station Comparison

**Pie Chart for Station Distribution:**
```typescript
const getStationUtilization = async (startDate: Date, endDate: Date) => {
  const { data } = await supabase
    .from('charging_sessions')
    .select(`
      station_id,
      energy_consumed_kwh,
      stations (name)
    `)
    .gte('start_date', format(startDate, 'yyyy-MM-dd'))
    .lte('end_date', format(endDate, 'yyyy-MM-dd'));

  // Calculate totals per station
  const stationTotals = calculateStationTotals(data);

  return stationTotals;
};
```

### 7.6 Recent Activity Feed

**Activity Table:**
- Display last 10 charging sessions
- Columns: Transaction ID, Station, Energy, Cost, Status, Date
- Quick action: View Details

### 7.7 Date Range Selector

**Date Range Component:**
```typescript
interface DateRange {
  startDate: Date;
  endDate: Date;
}

const DateRangePicker = ({ onChange }) => {
  return (
    <div>
      <select onChange={(e) => handlePreset(e.target.value)}>
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="last7days">Last 7 Days</option>
        <option value="last30days">Last 30 Days</option>
        <option value="thisMonth">This Month</option>
        <option value="lastMonth">Last Month</option>
        <option value="custom">Custom Range</option>
      </select>

      {/* Custom date inputs if selected */}
    </div>
  );
};
```

### 7.8 Export Functionality

**Export Charts as Images:**
```typescript
const exportChartAsImage = (chartRef: RefObject<HTMLDivElement>) => {
  // Use html2canvas or similar library
  html2canvas(chartRef.current).then(canvas => {
    const link = document.createElement('a');
    link.download = 'chart-export.png';
    link.href = canvas.toDataURL();
    link.click();
  });
};
```

**Export Data as CSV:**
```typescript
const exportDataAsCSV = (data: any[], filename: string) => {
  const csv = convertToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
};
```

**Completion Criteria:**
- ✅ Dashboard layout responsive and attractive
- ✅ All summary cards displaying correct data
- ✅ Energy trend chart functional
- ✅ Revenue chart showing station breakdown
- ✅ Station comparison visualization working
- ✅ Recent activity feed displaying
- ✅ Date range selector functional
- ✅ All charts rendering smoothly
- ✅ JOD formatting consistent (3 decimals)
- ✅ Export to image working
- ✅ Export to CSV working
- ✅ Loading states for all async data
- ✅ Error handling for data fetching

---

## PHASE 8: REPORTING & EXPORT

### 8.1 Billing Report Generation

**Invoice Template:**
```typescript
interface Invoice {
  invoiceNumber: string;
  invoiceDate: Date;
  session: ChargingSession;
  billing: BillingCalculation;
  breakdown: BillingBreakdownItem[];
  customer: {
    name: string;
    cardNumber: string;
  };
  station: Station;
}
```

**Invoice Layout:**
- Header with logo and company info
- Invoice number and date
- Customer information
- Station information
- Session details (start, end, duration, energy)
- Billing breakdown table
  - Period | Duration | Energy | Rate | Energy Charge | Demand | Demand Charge | Total
- Subtotal
- Fixed charges breakdown
- **Grand total in JOD (NO TAX APPLIED)**
- Footer with terms and conditions

### 8.2 PDF Generation

**Library:** jsPDF or react-pdf

**PDF Generation Function:**
```typescript
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const generateInvoicePDF = (invoice: Invoice) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text('EV Charging Invoice', 20, 20);

  // Invoice details
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 35);
  doc.text(`Date: ${format(invoice.invoiceDate, 'yyyy-MM-dd')}`, 20, 42);

  // Customer & Station info
  doc.text(`Station: ${invoice.station.name}`, 20, 55);
  doc.text(`Card: ${invoice.customer.cardNumber}`, 20, 62);

  // Session details
  doc.text('Session Details:', 20, 75);
  doc.text(`Start: ${format(invoice.session.start_ts, 'yyyy-MM-dd HH:mm:ss')}`, 25, 82);
  doc.text(`End: ${format(invoice.session.end_ts, 'yyyy-MM-dd HH:mm:ss')}`, 25, 89);
  doc.text(`Duration: ${invoice.session.duration_minutes} minutes`, 25, 96);
  doc.text(`Energy: ${invoice.session.energy_consumed_kwh.toFixed(3)} kWh`, 25, 103);

  // Billing breakdown table
  const tableData = invoice.breakdown.map(item => [
    item.period_name,
    item.duration_minutes.toFixed(2),
    item.energy_kwh.toFixed(3),
    item.rate_per_kwh.toFixed(3),
    item.energy_charge.toFixed(3),
    item.demand_kw?.toFixed(2) || '-',
    item.demand_charge?.toFixed(3) || '-',
    item.line_total.toFixed(3)
  ]);

  doc.autoTable({
    startY: 115,
    head: [['Period', 'Duration (min)', 'Energy (kWh)', 'Rate', 'Energy Charge', 'Demand (kW)', 'Demand Charge', 'Total']],
    body: tableData,
    theme: 'striped'
  });

  // Totals (NO TAX APPLIED)
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.text(`Subtotal: ${formatJOD(invoice.billing.subtotal)}`, 140, finalY);
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Total: ${formatJOD(invoice.billing.total_amount)}`, 140, finalY + 10);

  // Save
  doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
};
```

### 8.3 Excel Export

**Export Sessions to Excel:**
```typescript
import * as XLSX from 'xlsx';

const exportSessionsToExcel = (sessions: ChargingSession[]) => {
  // Prepare data
  const exportData = sessions.map(session => ({
    'Transaction ID': session.transaction_id,
    'Charge ID': session.charge_id,
    'Card Number': session.card_number,
    'Start DateTime': format(session.start_ts, 'yyyy-MM-dd HH:mm:ss'),
    'End DateTime': format(session.end_ts, 'yyyy-MM-dd HH:mm:ss'),
    'Duration (minutes)': session.duration_minutes,
    'Energy (kWh)': session.energy_consumed_kwh,
    'Cost (JOD)': session.calculated_cost,
    'Station Code': session.station_code,
    'Max Demand (kW)': session.max_demand_kw || '',
    'User ID': session.user_identifier || ''
  }));

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Charging Sessions');

  // Save
  XLSX.writeFile(wb, `charging-sessions-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};
```

**Export Billing Report to Excel:**
```typescript
const exportBillingToExcel = (billingData: BillingCalculation[]) => {
  const exportData = billingData.map(billing => ({
    'Session ID': billing.session_id,
    'Calculation Date': format(billing.calculation_date, 'yyyy-MM-dd HH:mm:ss'),
    'Subtotal (JOD)': billing.subtotal.toFixed(3),
    'Taxes (JOD)': billing.taxes.toFixed(3),
    'Fees (JOD)': billing.fees.toFixed(3),
    'Total (JOD)': billing.total_amount.toFixed(3),
    'Currency': billing.currency
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Billing Report');

  XLSX.writeFile(wb, `billing-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};
```

### 8.4 Summary Reports

**Monthly Summary Report:**
```typescript
interface MonthlySummary {
  month: string;
  totalSessions: number;
  totalEnergy: number;
  totalRevenue: number;
  averageSessionDuration: number;
  averageEnergyPerSession: number;
  averageRevenuePerSession: number;
  stationBreakdown: {
    stationName: string;
    sessions: number;
    energy: number;
    revenue: number;
  }[];
}

const generateMonthlySummary = async (month: Date): Promise<MonthlySummary> => {
  // Query data for the month
  // Aggregate statistics
  // Return summary object
};
```

### 8.5 Bulk Export Options

**Export Page UI:**
- Date range selector
- Export type selector (Sessions, Billing, Summary)
- Format selector (PDF, Excel, CSV)
- Station filter (optional)
- Export button
- Download progress indicator

**Completion Criteria:**
- ✅ Invoice PDF generation working
- ✅ Invoice template professional and complete
- ✅ Excel export for sessions functional
- ✅ Excel export for billing functional
- ✅ CSV export working
- ✅ Summary reports accurate
- ✅ Bulk export options available
- ✅ JOD formatting consistent (3 decimals)
- ✅ All exports include proper headers
- ✅ Export UI intuitive and responsive

---

## TESTING & QUALITY ASSURANCE

### Test Suite 1: Excel Import
- Valid file import (100 rows)
- Invalid data handling
- Duplicate detection
- Large file processing (10,000 rows)
- DateTime parsing verification
- Timezone conversion testing

### Test Suite 2: Billing Calculations
- Single period calculation
- Multi-period calculation
- Midnight crossing
- Multi-day sessions
- Demand charge application
- NO tax application (verify taxes = 0)
- Fixed charge inclusion
- JOD formatting (3 decimals)
- Verify total equals subtotal (no tax added)

### Test Suite 3: UI/UX
- Responsive design (mobile, tablet, desktop)
- Form validation
- Loading states
- Error handling
- Navigation flow

### Test Suite 4: Security
- RLS policy enforcement
- Authentication guards
- Data isolation between users
- SQL injection prevention

### Test Suite 5: Performance
- Dashboard load time < 3 seconds
- Chart rendering < 1 second
- Excel import (1000 rows) < 10 seconds
- Billing calculation < 2 seconds per session

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All database migrations applied
- [ ] RLS policies active and tested
- [ ] Environment variables configured
- [ ] Database timezone set to Asia/Amman
- [ ] Jordan rate structures seeded
- [ ] Sample data available
- [ ] Build completes without errors
- [ ] All tests passing
- [ ] No console errors
- [ ] TypeScript type checking passes

### Post-Deployment
- [ ] Database accessible
- [ ] Authentication working
- [ ] File uploads functional
- [ ] Excel import processing correctly
- [ ] Calculations accurate
- [ ] Charts rendering
- [ ] Export features working
- [ ] JOD currency formatting correct (3 decimals)
- [ ] Timezone displays correct (Asia/Amman)
- [ ] PDF generation working
- [ ] Excel exports functional

---

## PRIORITY SUMMARY

### MVP (Must Have) - Phases 1-5
- Database with core tables
- Authentication
- Station management
- Basic rate configuration
- Excel import with validation
- Three-column datetime storage
- Timezone handling (Asia/Amman)

### Enhanced (Should Have) - Phases 6-7
- Full billing calculation engine
- Demand charges
- Fixed charges
- Detailed billing breakdowns (NO TAX)
- Analytics dashboard
- JOD currency formatting (3 decimals)

### Advanced (Nice to Have) - Phase 8
- PDF invoice generation
- Excel/CSV exports
- Summary reports
- Bulk operations
- Advanced analytics

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-12-20
**Total Implementation Time Estimate:** 6-8 weeks for MVP + Enhanced features

---

## NOTES FOR IMPLEMENTATION

1. **Start with Phase 1** - Database is foundation for everything
2. **Test RLS thoroughly** - Security cannot be compromised
3. **Jordan timezone critical** - All datetime handling must account for Asia/Amman
4. **JOD formatting mandatory** - Always 3 decimal places
5. **Three-column datetime** - Essential for rate period matching
6. **Validate early** - Catch errors during import, not calculation
7. **Keep calculations accurate** - Double-check all math logic
8. **NO TAX CHARGED** - Customers are NOT charged any taxes. Total = Subtotal
9. **Document complex logic** - Future maintenance will thank you
10. **Test with real data** - Use actual Jordan electricity rates
11. **Progressive enhancement** - Build MVP first, add features incrementally
