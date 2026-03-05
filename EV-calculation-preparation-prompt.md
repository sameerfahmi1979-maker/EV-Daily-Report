# EV Charging Station Analytics & Billing System
## Complete System Plan & Preparation Prompt

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose
A comprehensive web application for managing electric vehicle charging stations, including:
- Excel-based data import for charging sessions
- Automated billing calculations based on complex rate structures
- Real-time analytics and reporting
- Multi-station management
- User account management with role-based access

### 1.2 Core Features
1. **Data Import System**
   - Excel file upload and parsing
   - Data validation and error handling
   - Bulk processing of charging sessions
   - Historical data import support

2. **Rate Management**
   - Dynamic pricing structures
   - Time-of-use (TOU) rates
   - Seasonal pricing
   - Demand charges
   - Fixed connection fees
   - Tax and surcharge application

3. **Billing Engine**
   - Automated invoice generation
   - Pro-rated calculations
   - Multi-rate period support
   - Payment tracking
   - Receipt generation

4. **Analytics Dashboard**
   - Energy consumption trends
   - Revenue analytics
   - Station utilization metrics
   - Peak demand analysis
   - Cost breakdowns
   - Comparative reports

5. **Station Management**
   - Multiple charging station profiles
   - Station-specific rate configurations
   - Maintenance tracking
   - Status monitoring

---

## 2. DATABASE SCHEMA DESIGN

### 2.1 Core Tables

#### `stations`
```sql
- id (uuid, primary key)
- name (text, not null)
- location (text)
- address (text)
- capacity_kw (decimal)
- station_code (text, unique)
- status (text) -- active, maintenance, inactive
- installation_date (date)
- notes (text)
- created_at (timestamptz)
- updated_at (timestamptz)
- user_id (uuid, foreign key to auth.users)
```

#### `rate_structures`
```sql
- id (uuid, primary key)
- station_id (uuid, foreign key)
- name (text, not null)
- description (text)
- effective_from (date, not null)
- effective_to (date)
- is_active (boolean, default true)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### `rate_periods`
```sql
- id (uuid, primary key)
- rate_structure_id (uuid, foreign key)
- period_name (text) -- Peak, Off-Peak, Super Off-Peak
- start_time (time)
- end_time (time)
- days_of_week (text[]) -- array: ['monday', 'tuesday', ...]
- season (text) -- summer, winter, spring, fall, all
- energy_rate_per_kwh (decimal, not null)
- demand_charge_per_kw (decimal, default 0)
- priority (integer) -- for overlapping periods
- created_at (timestamptz)
```

#### `charging_sessions`
```sql
- id (uuid, primary key)
- station_id (uuid, foreign key)
- transaction_id (text, unique, not null) -- from Excel: Transaction ID
- charge_id (text, unique, not null) -- from Excel: Charge ID
- card_number (text, not null) -- from Excel: Card Number

-- Start DateTime (three-column approach)
- start_date (date, not null) -- date portion only
- start_time (time, not null) -- time portion only
- start_ts (timestamptz, not null) -- full timestamp with timezone

-- End DateTime (three-column approach)
- end_date (date, not null) -- date portion only
- end_time (time, not null) -- time portion only
- end_ts (timestamptz, not null) -- full timestamp with timezone

- duration_minutes (integer) -- calculated: (end_ts - start_ts)
- energy_consumed_kwh (decimal, not null)
- calculated_cost (decimal, not null) -- from Excel: Cost
- max_demand_kw (decimal)
- station_code (text) -- from Excel: Station Code
- user_identifier (text) -- from Excel: User/Vehicle ID
- import_batch_id (uuid, foreign key)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
```

#### `billing_calculations`
```sql
- id (uuid, primary key)
- session_id (uuid, foreign key to charging_sessions)
- rate_structure_id (uuid, foreign key)
- calculation_date (timestamptz, not null)
- breakdown (jsonb) -- detailed calculation breakdown
- subtotal (decimal, not null)
- taxes (decimal, default 0)
- fees (decimal, default 0)
- total_amount (decimal, not null)
- currency (text, default 'USD')
- created_at (timestamptz)
```

#### `billing_breakdown_items`
```sql
- id (uuid, primary key)
- billing_calculation_id (uuid, foreign key)
- rate_period_id (uuid, foreign key)
- period_name (text)
- start_time (timestamptz)
- end_time (timestamptz)
- duration_minutes (decimal)
- energy_kwh (decimal)
- rate_per_kwh (decimal)
- demand_kw (decimal)
- demand_charge (decimal)
- energy_charge (decimal)
- line_total (decimal)
- created_at (timestamptz)
```

#### `import_batches`
```sql
- id (uuid, primary key)
- filename (text, not null)
- upload_date (timestamptz, not null)
- records_total (integer)
- records_success (integer)
- records_failed (integer)
- status (text) -- processing, completed, failed
- error_log (jsonb)
- user_id (uuid, foreign key to auth.users)
- created_at (timestamptz)
```

#### `fixed_charges`
```sql
- id (uuid, primary key)
- station_id (uuid, foreign key)
- charge_name (text, not null)
- charge_type (text) -- monthly, daily, per_session
- amount (decimal, not null)
- effective_from (date)
- effective_to (date)
- is_active (boolean, default true)
- created_at (timestamptz)
```

#### `tax_configurations`
```sql
- id (uuid, primary key)
- station_id (uuid, foreign key)
- tax_name (text, not null)
- tax_rate (decimal, not null) -- percentage
- applies_to (text) -- energy, demand, all
- effective_from (date)
- effective_to (date)
- is_active (boolean, default true)
- created_at (timestamptz)
```

---

## 3. EXCEL FILE FORMAT SPECIFICATIONS

### 3.1 Required Columns (Real-World Excel Format)

| Excel Column Name | Database Field | Data Type | Required | Description | Example |
|-------------------|----------------|-----------|----------|-------------|---------|
| Transaction ID | transaction_id | Text | Yes | Unique transaction identifier | TXN-2024-001234 |
| Charge ID | charge_id | Text | Yes | Unique charge session identifier | CHG-2024-001234 |
| Card Number | card_number | Text | Yes | Payment card or RFID identifier | 1234567890123456 |
| Start DateTime | start_ts, start_date, start_time | DateTime | Yes | Session start timestamp | 2025-12-20 07:54:18 |
| End DateTime | end_ts, end_date, end_time | DateTime | Yes | Session end timestamp | 2025-12-20 09:32:45 |
| Energy (kWh) | energy_consumed_kwh | Decimal | Yes | Total energy consumed | 45.67 |
| Cost | calculated_cost | Decimal | Yes | Total session cost | 125.50 |
| Station Code | station_code | Text | No | Station identifier | STATION-A1 |
| Max Demand (kW) | max_demand_kw | Decimal | No | Peak power demand | 50.0 |
| User/Vehicle ID | user_identifier | Text | No | Customer or vehicle identifier | CUST-9876 |

### 3.2 DateTime Storage Strategy (Three-Column Approach)

**CRITICAL**: To support proper timezone handling and flexible querying, datetime values are stored in THREE separate columns:

1. **date column** (`DATE`): Just the date portion (YYYY-MM-DD)
   - Example: `2025-12-20`
   - Used for: Date-based filtering, daily aggregations

2. **time column** (`TIME`): Just the time portion (HH:MM:SS)
   - Example: `07:54:18`
   - Used for: Time-of-use rate matching, time-based queries

3. **timestamp column** (`TIMESTAMPTZ`): Full timestamp with timezone
   - Example: `2025-12-20 07:54:18+03` (stored in UTC, displayed in local timezone)
   - Used for: Precise calculations, duration computation, chronological ordering

**Example for Start DateTime:**
- Input from Excel: `2025-12-20 07:54:18`
- Storage:
  - `start_date`: `2025-12-20`
  - `start_time`: `07:54:18`
  - `start_ts`: `2025-12-20 07:54:18` (interpreted in Asia/Amman timezone, stored as UTC)

**Benefits:**
- Fast time-of-use rate lookups using just the TIME column
- Easy date-based filtering without timestamp parsing
- Precise calculations using full TIMESTAMPTZ
- Timezone-aware storage and display

### 3.3 File Format Rules
- File formats accepted: .xlsx, .xls, .csv
- Header row must be present in row 1
- **DateTime format**: `YYYY-MM-DD HH:MM:SS` (24-hour format)
  - Example: `2025-12-20 07:54:18`
  - Alternative accepted: `MM/DD/YYYY HH:MM:SS`
- Decimal separator: period (.)
- Currency: JOD (Jordanian Dinar)
- Timezone: Asia/Amman (UTC+3 in summer, UTC+2 in winter)
- Maximum file size: 10MB
- Maximum rows per import: 10,000
- Encoding: UTF-8

### 3.4 Validation Rules
1. Transaction ID must be unique
2. Charge ID must be unique
3. Card Number must be present (valid format)
4. End DateTime must be after Start DateTime
5. Energy (kWh) must be positive and non-zero
6. Cost must be non-negative
7. Station Code must match existing station (if provided)
8. Duration calculation: (End - Start) must be reasonable (1 min to 24 hours)
9. DateTime must be valid and parseable
10. All required fields must have non-empty values

### 3.5 Sample Excel Template (Real Format)

```
Transaction ID | Charge ID    | Card Number      | Start DateTime       | End DateTime         | Energy (kWh) | Cost (JOD) | Station Code | Max Demand (kW) | User ID
TXN-001       | CHG-001      | 1234567890123456 | 2025-12-20 07:54:18 | 2025-12-20 09:32:45 | 45.50        | 125.50    | STATION-A1   | 50.0           | CUST-001
TXN-002       | CHG-002      | 9876543210987654 | 2025-12-20 14:15:00 | 2025-12-20 15:42:30 | 28.75        | 87.25     | STATION-A1   | 48.0           | CUST-002
TXN-003       | CHG-003      | 5555666677778888 | 2025-12-20 22:30:00 | 2025-12-21 02:15:00 | 62.30        | 156.80    | STATION-B2   | 52.0           | CUST-003
```

### 3.6 Import Processing Flow

1. **File Upload**: User uploads Excel file
2. **Parse Headers**: Validate column names match expected format
3. **Row-by-Row Processing**:
   - Extract all fields
   - Parse DateTime string: `2025-12-20 07:54:18`
   - Split into three components:
     - `start_date` = `2025-12-20`
     - `start_time` = `07:54:18`
     - `start_ts` = `2025-12-20 07:54:18` (converted to UTC for storage)
   - Validate all fields
   - Check for duplicates
4. **Batch Insert**: Insert validated records into database
5. **Error Reporting**: Log any failed rows with specific error messages
6. **Success Summary**: Display import statistics

---

## 4. RATE CALCULATION LOGIC

### 4.1 Time-of-Use (TOU) Rate Structure

**Example Rate Structure:**

| Period | Time | Days | Season | Energy Rate | Demand Charge |
|--------|------|------|--------|-------------|---------------|
| Super Off-Peak | 12:00 AM - 6:00 AM | All Days | All | $0.08/kWh | $0.00/kW |
| Off-Peak | 6:00 AM - 2:00 PM | All Days | All | $0.12/kWh | $2.00/kW |
| Peak | 2:00 PM - 9:00 PM | Weekdays | Summer | $0.25/kWh | $15.00/kW |
| Peak | 2:00 PM - 9:00 PM | Weekdays | Winter | $0.20/kWh | $10.00/kW |
| Off-Peak | 9:00 PM - 12:00 AM | All Days | All | $0.12/kWh | $2.00/kW |

### 4.2 Calculation Steps

**Step 1: Split Session into Rate Periods**
```
Session: 2024-01-15 13:30:00 to 2024-01-15 16:45:00
Total Duration: 195 minutes (3.25 hours)
Total Energy: 45.67 kWh
Max Demand: 50 kW

Period Breakdown:
- Off-Peak: 13:30-14:00 (30 min) = 0.5 hours
- Peak: 14:00-16:45 (165 min) = 2.75 hours
```

**Step 2: Allocate Energy Proportionally**
```
Off-Peak Energy = 45.67 × (0.5 / 3.25) = 7.03 kWh
Peak Energy = 45.67 × (2.75 / 3.25) = 38.64 kWh
```

**Step 3: Calculate Energy Charges**
```
Off-Peak Charge = 7.03 kWh × $0.12 = $0.84
Peak Charge = 38.64 kWh × $0.25 = $9.66
Total Energy Charge = $10.50
```

**Step 4: Calculate Demand Charges**
```
Off-Peak Demand = 50 kW × $2.00 = $100.00
Peak Demand = 50 kW × $15.00 = $750.00
Total Demand Charge = $850.00
```

**Step 5: Add Fixed Charges**
```
Connection Fee = $2.50
Session Fee = $1.00
Total Fixed Charges = $3.50
```

**Step 6: Calculate Subtotal**
```
Subtotal = $10.50 + $850.00 + $3.50 = $864.00
```

**Step 7: Apply Taxes**
```
Sales Tax (8.5%) = $864.00 × 0.085 = $73.44
Total Amount = $864.00 + $73.44 = $937.44
```

### 4.3 Complex Scenarios

**Scenario 1: Midnight Crossing**
```
Session: 2024-01-15 23:30:00 to 2024-01-16 01:30:00
- Split into two date calculations
- Apply appropriate rate for each day
```

**Scenario 2: Multi-Day Session**
```
Session: 2024-01-15 20:00:00 to 2024-01-17 08:00:00
- Calculate each day separately
- Sum all charges
```

**Scenario 3: Seasonal Rate Change**
```
Session: 2024-05-31 23:00:00 to 2024-06-01 02:00:00
- May 31: Spring rates
- June 1: Summer rates (new season)
```

### 4.4 Calculation Formula Summary

```
Total Charge = Σ(Period Energy Charges) + Σ(Period Demand Charges) + Fixed Charges + Taxes

Where:
Period Energy Charge = (Energy in Period × Rate per kWh)
Period Demand Charge = (Max Demand × Demand Rate per kW)
Fixed Charges = Σ(All applicable fixed fees)
Taxes = (Subtotal × Tax Rate)
```

---

## 5. JORDAN-SPECIFIC CONFIGURATION

### 5.1 Regional Settings

**Currency**: JOD (Jordanian Dinar)
- Symbol: JOD or د.ا
- Decimal places: 3 (e.g., 125.500 JOD)
- Format: "125.500 JOD" or "JOD 125.500"

**Timezone**: Asia/Amman
- Standard Time: UTC+2 (winter)
- Daylight Saving Time: UTC+3 (summer)
- DST Period: Typically late March to late October (varies by year)
- **IMPORTANT**: All timestamps must be stored with timezone awareness

**Date/Time Format**:
- Date: YYYY-MM-DD (ISO 8601)
- Time: HH:MM:SS (24-hour format)
- DateTime: YYYY-MM-DD HH:MM:SS
- Example: 2025-12-20 07:54:18

**Language**: English (primary), Arabic (optional future enhancement)

### 5.2 Jordan Electricity Rates (EDCO - Electricity Distribution Company)

**Typical Time-of-Use Periods** (verify with current EDCO rates):

| Period | Time | Months | Rate (JOD/kWh) |
|--------|------|--------|----------------|
| Super Off-Peak | 12:00 AM - 6:00 AM | All Year | 0.085 |
| Off-Peak | 6:00 AM - 12:00 PM | All Year | 0.120 |
| Mid-Peak | 12:00 PM - 6:00 PM | All Year | 0.165 |
| Peak | 6:00 PM - 12:00 AM | Summer (Jun-Sep) | 0.220 |
| Peak | 6:00 PM - 12:00 AM | Winter (Oct-May) | 0.180 |

**Demand Charges** (if applicable):
- Super Off-Peak: 0.00 JOD/kW
- Off-Peak: 2.50 JOD/kW
- Mid-Peak: 8.00 JOD/kW
- Peak (Summer): 18.00 JOD/kW
- Peak (Winter): 12.00 JOD/kW

**Fixed Charges**:
- Connection Fee: 2.000 JOD per session
- Service Fee: 1.500 JOD per session
- Minimum Charge: 5.000 JOD (if total is less)

**Taxes & Surcharges**:
- General Sales Tax (GST): 16% (verify current rate)
- Electricity Tax: 7%
- Total Tax Rate: 23% (applied to subtotal)

### 5.3 Database Timezone Configuration

**PostgreSQL Timezone Settings**:
```sql
-- Set default timezone for database
ALTER DATABASE your_db_name SET timezone TO 'Asia/Amman';

-- Verify timezone setting
SHOW timezone;

-- Example: Converting input to timestamptz
-- Input: '2025-12-20 07:54:18'
-- Stored as: '2025-12-20 07:54:18+03' (UTC+3 during DST)
-- Stored internally: '2025-12-20 04:54:18+00' (converted to UTC)
```

### 5.4 Calculation Example (Jordan Context)

**Session Details**:
- Transaction ID: TXN-2025-001
- Start: 2025-12-20 17:30:00 (Asia/Amman, UTC+2 winter time)
- End: 2025-12-20 20:15:00 (Asia/Amman)
- Duration: 2 hours 45 minutes (165 minutes)
- Energy: 55.750 kWh
- Max Demand: 45 kW

**Rate Period Breakdown**:
1. **Mid-Peak** (17:30-18:00): 30 minutes = 0.5 hours
   - Energy: 55.750 × (0.5/2.75) = 10.136 kWh
   - Energy Charge: 10.136 × 0.165 = 1.672 JOD
   - Demand Charge: 45 × 8.00 = 360.000 JOD

2. **Peak (Winter)** (18:00-20:15): 135 minutes = 2.25 hours
   - Energy: 55.750 × (2.25/2.75) = 45.614 kWh
   - Energy Charge: 45.614 × 0.180 = 8.211 JOD
   - Demand Charge: 45 × 12.00 = 540.000 JOD

**Subtotal Calculation**:
- Total Energy Charges: 1.672 + 8.211 = 9.883 JOD
- Total Demand Charges: 360.000 + 540.000 = 900.000 JOD
- Connection Fee: 2.000 JOD
- Service Fee: 1.500 JOD
- **Subtotal**: 913.383 JOD

**Tax Calculation**:
- Electricity Tax (7%): 913.383 × 0.07 = 63.937 JOD
- GST (16%): 913.383 × 0.16 = 146.141 JOD
- Total Taxes: 210.078 JOD

**Final Total**: 913.383 + 210.078 = **1,123.461 JOD**

**Display Format**: "JOD 1,123.461" or "1,123.461 د.ا"

### 5.5 Import Considerations

**Excel File from Jordan Context**:
- Ensure datetime strings are interpreted in Asia/Amman timezone
- Currency values should be in JOD
- Decimal separator: period (.)
- Thousands separator: comma (,) for display only
- Card numbers may include local payment cards
- Station codes may follow local naming conventions

**Validation Adjustments**:
- Check reasonable energy consumption for Jordan (typical EV battery: 40-100 kWh)
- Validate cost ranges based on Jordan electricity rates
- Ensure times are within realistic charging windows
- Handle Jordan-specific holidays and rate exceptions

---

## 6. IMPLEMENTATION GUIDE

### 6.1 Phase 1: Database Setup
- Create all database tables using migrations
- Set up Row Level Security (RLS) policies
- Configure Asia/Amman timezone
- Create database functions for calculations
- Seed sample rate structures with Jordan rates

### 6.2 Phase 2: Authentication
- Implement Supabase email/password auth
- Create user registration flow
- Add login/logout functionality
- Set up protected routes

### 6.3 Phase 3: Station Management
- Build station CRUD interface
- Add station selection dropdown
- Implement station details page

### 6.4 Phase 4: Rate Configuration
- Create rate structure management UI
- Build rate period editor with Jordan TOU rates
- Add rate validation logic
- Implement rate effective date handling
- Configure JOD currency display

### 6.5 Phase 5: Excel Import System
- Build file upload component
- Create Excel parser utility
- Implement datetime parsing (YYYY-MM-DD HH:MM:SS format)
- Add three-column datetime storage logic
- Implement data validation
- Add batch processing
- Create import history view
- Handle Asia/Amman timezone conversion

### 6.6 Phase 6: Billing Calculation Engine
- Build time-splitting algorithm
- Implement energy allocation logic
- Create demand charge calculator
- Add Jordan-specific tax calculations (7% + 16%)
- Add fixed charge calculations (connection + service fees)
- Generate billing breakdowns in JOD
- Handle three-column datetime for rate period matching

### 6.7 Phase 7: Analytics Dashboard
- Create main dashboard layout
- Build energy consumption charts
- Add revenue analytics in JOD
- Implement station comparison views
- Create export functionality
- Format numbers with 3 decimal places for JOD

### 6.8 Phase 8: Reporting & Export
- Generate PDF invoices with JOD formatting
- Create Excel export for billing
- Build summary reports
- Add email notifications
- Include Arabic currency symbol (د.ا) option

---

## 7. FEATURE REQUIREMENTS

### 7.1 User Interface Requirements

**Dashboard (Home Page)**
- Summary cards: Total Energy, Total Revenue, Active Sessions, Station Count
- Line chart: Energy consumption over time
- Bar chart: Revenue by station
- Recent activity feed
- Quick actions: Upload Data, View Reports, Manage Stations

**Stations Page**
- Grid/List view of all stations
- Add/Edit/Delete station functionality
- Station status indicators
- Search and filter options
- Station details modal with full information

**Rate Management Page**
- List of all rate structures
- Create new rate structure wizard
- Rate period configuration interface
- Visual timeline of rate periods
- Copy/duplicate rate structures
- Rate effective date calendar

**Import Data Page**
- Drag-and-drop file upload
- File format instructions
- Upload history table
- Import status tracking
- Error log viewer
- Download template button

**Billing Page**
- Session list with calculation status
- Filter by date range, station, user
- Calculation detail modal
- Recalculate button
- Export to Excel/PDF
- Bulk actions

**Analytics Page**
- Date range selector
- Multiple chart types: line, bar, pie, area
- Metrics: kWh consumed, revenue, session count, avg duration
- Comparison tools: period-over-period, station-vs-station
- Export charts as images
- Download data as CSV

**Settings Page**
- User profile management
- Tax configuration (Jordan: 7% electricity tax + 16% GST)
- Fixed charge settings (connection fee, service fee)
- Currency settings (JOD with 3 decimal places)
- Timezone settings (Asia/Amman)
- Notification preferences

### 7.2 Functional Requirements

**FR-1: Excel Import**
- System shall accept Excel files (.xlsx, .xls) and CSV files
- System shall validate all required fields
- System shall provide detailed error messages for invalid data
- System shall process up to 10,000 rows per import
- System shall create import batch records
- System shall handle duplicate session IDs

**FR-2: Rate Calculation**
- System shall split sessions across multiple rate periods
- System shall allocate energy proportionally by duration
- System shall apply time-of-use rates correctly
- System shall calculate demand charges based on peak power
- System shall handle midnight and multi-day sessions
- System shall apply seasonal rates automatically
- System shall support overlapping rate periods with priority

**FR-3: Billing Generation**
- System shall generate itemized billing breakdowns
- System shall calculate and apply all taxes
- System shall include all fixed charges
- System shall store calculation history
- System shall allow recalculation with different rate structures
- System shall support multiple currencies

**FR-4: Data Export**
- System shall export billing data to Excel
- System shall generate PDF invoices
- System shall export charts as PNG/JPG
- System shall create CSV reports
- System shall include all calculation details in exports

**FR-5: Analytics**
- System shall aggregate data by day, week, month, year
- System shall calculate key metrics automatically
- System shall provide comparison tools
- System shall update charts in real-time
- System shall support custom date ranges

**FR-6: Timezone & Currency**
- System shall store all timestamps with timezone awareness (Asia/Amman)
- System shall display all times in local timezone (Asia/Amman)
- System shall format all currency values in JOD with 3 decimal places
- System shall handle DST transitions correctly
- System shall parse Excel datetime strings as Asia/Amman timezone

### 7.3 Non-Functional Requirements

**NFR-1: Performance**
- Excel import shall process 1,000 rows in under 10 seconds
- Billing calculations shall complete in under 2 seconds per session
- Dashboard shall load in under 3 seconds
- Charts shall render in under 1 second

**NFR-2: Security**
- All data shall be protected by Row Level Security
- Users shall only access their own data
- Passwords shall be hashed and salted
- API keys shall never be exposed to client
- All database queries shall use parameterized statements

**NFR-3: Usability**
- Interface shall be intuitive and require no training
- Error messages shall be clear and actionable
- Forms shall provide inline validation
- Loading states shall be shown for all async operations
- Mobile responsive design for all pages

**NFR-4: Reliability**
- System shall handle import errors gracefully
- Failed calculations shall not affect other sessions
- Data integrity shall be maintained at all times
- Automatic retry for transient failures

---

## 8. UI/UX SPECIFICATIONS

### 8.1 Design Principles
- Clean, modern interface with professional aesthetics
- Card-based layouts for content organization
- Consistent spacing using 8px grid system
- Clear visual hierarchy with typography
- Accessible color contrast ratios (WCAG AA compliant)
- Smooth transitions and micro-interactions
- Responsive design: mobile, tablet, desktop

### 8.2 Color Palette
```
Primary: Blue (#2563EB) - Actions, links, primary buttons
Secondary: Slate (#64748B) - Secondary text, icons
Success: Green (#10B981) - Success states, positive metrics
Warning: Amber (#F59E0B) - Warnings, alerts
Error: Red (#EF4444) - Errors, critical issues
Neutral: Gray scale (#F8FAFC to #0F172A)

Avoid: Purple, Indigo, Violet hues (unless user requests)
```

### 8.3 Typography
```
Headings:
  - H1: 2.5rem (40px), font-weight: 700
  - H2: 2rem (32px), font-weight: 600
  - H3: 1.5rem (24px), font-weight: 600

Body:
  - Large: 1.125rem (18px), line-height: 1.5
  - Regular: 1rem (16px), line-height: 1.5
  - Small: 0.875rem (14px), line-height: 1.5

Font Family: System font stack (default)
```

### 8.4 Component Specifications

**Cards**
- Border radius: 8px
- Shadow: subtle drop shadow
- Padding: 24px
- White background with border

**Buttons**
- Primary: Solid blue background, white text
- Secondary: White background, blue text, blue border
- Ghost: Transparent, blue text on hover
- Sizes: Small (32px), Medium (40px), Large (48px)
- Border radius: 6px
- Hover states: Slight darkening/lightening

**Tables**
- Striped rows for better readability
- Hover state on rows
- Sortable column headers
- Sticky header on scroll
- Pagination at bottom
- Row actions: Edit, Delete, View

**Forms**
- Input height: 40px
- Border radius: 6px
- Label above input
- Inline validation messages
- Required field indicators
- Help text below inputs

**Charts**
- Consistent color scheme
- Clear axis labels
- Hover tooltips with details
- Legend positioning
- Responsive sizing
- Loading skeletons

### 8.5 Page Layouts

**Dashboard Layout**
```
[Navigation Bar - Top]
├── [Logo] [Home] [Stations] [Rates] [Import] [Billing] [Analytics] [User Menu]

[Main Content Area]
├── [Page Title & Breadcrumbs]
├── [Summary Cards Row - 4 cards]
├── [Charts Row - 2 charts side by side]
└── [Recent Activity Table]
```

**List Page Layout**
```
[Page Title]
[Action Bar: Search, Filters, Add New Button]
[Table: Data with columns, pagination]
```

**Detail Page Layout**
```
[Page Title with Back Button]
[Details Card]
[Related Information Tabs]
[Action Buttons: Edit, Delete, Export]
```

---

## 9. TECHNICAL STACK

### 9.1 Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts or Chart.js
- **File Handling**: SheetJS (xlsx) for Excel parsing
- **Date Handling**: date-fns
- **Forms**: React Hook Form
- **State Management**: React Context + Hooks
- **Timezone Handling**: date-fns-tz for Asia/Amman timezone

### 9.2 Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email/password)
- **API**: Supabase Client SDK
- **Storage**: Supabase Storage (for file uploads)
- **Real-time**: Supabase Realtime (optional)
- **Timezone**: Database timezone set to Asia/Amman

### 9.3 Development Tools
- **Type Checking**: TypeScript
- **Linting**: ESLint
- **Formatting**: Prettier (if needed)
- **Version Control**: Git

---

## 10. API DESIGN

### 10.1 Data Access Patterns

**Stations**
```typescript
// Get all user stations
const { data: stations } = await supabase
  .from('stations')
  .select('*')
  .eq('user_id', userId);

// Create new station
const { data, error } = await supabase
  .from('stations')
  .insert([{ name, location, capacity_kw, user_id }]);
```

**Charging Sessions**
```typescript
// Get sessions by station and date range
const { data: sessions } = await supabase
  .from('charging_sessions')
  .select('*, stations(name)')
  .eq('station_id', stationId)
  .gte('start_time', startDate)
  .lte('end_time', endDate);
```

**Billing Calculations**
```typescript
// Get calculation with breakdown
const { data } = await supabase
  .from('billing_calculations')
  .select(`
    *,
    charging_sessions(*),
    billing_breakdown_items(*)
  `)
  .eq('session_id', sessionId)
  .maybeSingle();
```

### 10.2 Database Functions

**Function: calculate_session_billing(session_id UUID)**
- Input: Session ID
- Output: Billing calculation record
- Purpose: Perform complete billing calculation for a session

**Function: split_session_into_periods(session_id UUID)**
- Input: Session ID
- Output: Array of period segments
- Purpose: Split session across rate periods

**Function: get_applicable_rates(station_id UUID, datetime TIMESTAMPTZ)**
- Input: Station ID and datetime
- Output: Applicable rate structure
- Purpose: Determine which rates apply at a given time

---

## 11. TESTING SCENARIOS

### 11.1 Excel Import Tests

**Test Case 1: Valid Import**
- Upload Excel file with 100 valid rows
- Expected: All 100 rows imported successfully
- Verify: Database contains 100 new charging_sessions records

**Test Case 2: Invalid Data**
- Upload Excel with missing required fields
- Expected: Import fails with clear error messages
- Verify: No partial data saved

**Test Case 3: Duplicate Session IDs**
- Upload Excel with duplicate session IDs
- Expected: Error identifying duplicate rows
- Verify: User can choose to skip or update

**Test Case 4: Large File**
- Upload Excel with 10,000 rows
- Expected: Import completes within 2 minutes
- Verify: Progress indicator updates, batch record created

### 11.2 Rate Calculation Tests

**Test Case 1: Single Period**
- Session: 8:00 AM - 10:00 AM (Off-Peak only)
- Energy: 30 kWh
- Expected: 30 kWh × $0.12 = $3.60

**Test Case 2: Two Periods**
- Session: 1:00 PM - 3:00 PM (1 hour Off-Peak, 1 hour Peak)
- Energy: 40 kWh
- Expected: (20 × $0.12) + (20 × $0.25) = $7.40

**Test Case 3: Midnight Crossing**
- Session: 11:00 PM - 1:00 AM (crosses midnight)
- Expected: Correctly split into two periods

**Test Case 4: Demand Charge**
- Session: Peak period with 50 kW demand
- Expected: Demand charge = 50 × $15.00 = $750.00

**Test Case 5: Tax Application**
- Subtotal: 100.000 JOD, Tax rate: 23% (7% + 16%)
- Expected: Total = 123.000 JOD

### 11.3 UI/UX Tests

**Test Case 1: Responsive Design**
- View dashboard on mobile, tablet, desktop
- Expected: Layout adapts appropriately

**Test Case 2: Form Validation**
- Submit form with empty required fields
- Expected: Inline error messages appear

**Test Case 3: Loading States**
- Trigger async operation
- Expected: Loading spinner/skeleton shown

**Test Case 4: Error Handling**
- Simulate network error
- Expected: User-friendly error message displayed

### 11.4 Security Tests

**Test Case 1: RLS Enforcement**
- User A attempts to access User B's data
- Expected: Access denied, no data returned

**Test Case 2: Authentication Required**
- Unauthenticated user attempts to access protected route
- Expected: Redirected to login page

**Test Case 3: SQL Injection**
- Submit malicious input in search field
- Expected: Input sanitized, no SQL execution

---

## 12. DATA MIGRATION & SEEDING

### 12.1 Sample Data Sets

**Stations**
```
Station A1 - Downtown Location - 150 kW
Station B2 - Highway Rest Stop - 200 kW
Station C3 - Shopping Mall - 100 kW
```

**Rate Structures**
```
Standard TOU (Time of Use)
- Super Off-Peak: 12 AM - 6 AM: $0.08/kWh
- Off-Peak: 6 AM - 2 PM, 9 PM - 12 AM: $0.12/kWh
- Peak: 2 PM - 9 PM: $0.25/kWh (Summer) / $0.20/kWh (Winter)

Flat Rate
- All times: $0.15/kWh
```

**Sample Sessions**
```
100 sessions across 3 stations
Date range: Last 90 days
Various durations: 30 min to 8 hours
Energy range: 10 kWh to 80 kWh
```

---

## 13. DEPLOYMENT CHECKLIST

### 13.1 Pre-Deployment
- [ ] All migrations applied successfully
- [ ] RLS policies tested and verified
- [ ] Environment variables configured
- [ ] Sample data seeded
- [ ] Build completes without errors
- [ ] All tests passing
- [ ] Database timezone set to Asia/Amman
- [ ] Jordan TOU rates configured

### 13.2 Post-Deployment
- [ ] Database accessible
- [ ] Authentication working
- [ ] File uploads functional
- [ ] Calculations accurate
- [ ] Charts rendering correctly
- [ ] Export features working
- [ ] JOD currency formatting correct (3 decimal places)
- [ ] Timezone conversions working properly

---

## 14. FUTURE ENHANCEMENTS

### 14.1 Phase 2 Features
- Real-time session monitoring
- Mobile app for station operators
- Automated email invoicing
- Payment gateway integration
- Multi-language support (English/Arabic)
- Customer portal for end users
- SMS notifications in Arabic

### 14.2 Advanced Analytics
- Predictive analytics for demand forecasting
- Machine learning for optimal pricing
- Carbon footprint tracking
- Comparison with grid energy costs (EDCO rates)

### 14.3 Integration Options
- OCPP (Open Charge Point Protocol) integration
- Smart grid connectivity
- Vehicle-to-Grid (V2G) support
- Renewable energy source tracking

---

## 15. GLOSSARY

**kWh (Kilowatt-hour)**: Unit of energy consumption
**kW (Kilowatt)**: Unit of power (demand)
**SOC (State of Charge)**: Battery charge level as percentage
**TOU (Time of Use)**: Variable pricing based on time
**Demand Charge**: Fee based on peak power usage
**RLS (Row Level Security)**: Database access control
**JOD (Jordanian Dinar)**: Official currency of Jordan
**EDCO**: Electricity Distribution Company (Jordan utility)
**GST**: General Sales Tax (16% in Jordan)
**DST**: Daylight Saving Time
**TIMESTAMPTZ**: PostgreSQL timestamp with timezone data type
**Asia/Amman**: IANA timezone identifier for Jordan

---

## 16. IMPLEMENTATION PRIORITY

### Priority 1 (Must Have - MVP)
1. Database schema with core tables
2. User authentication
3. Station management (CRUD)
4. Basic rate structure (single TOU)
5. Excel import (basic validation)
6. Simple billing calculation (energy only)
7. Basic dashboard with summary

### Priority 2 (Should Have)
1. Advanced rate periods (multiple rates)
2. Demand charge calculations
3. Tax configurations
4. Detailed billing breakdowns
5. Analytics charts
6. PDF invoice generation
7. Import history and error logging

### Priority 3 (Nice to Have)
1. Advanced analytics
2. Rate comparison tools
3. Bulk operations
4. Email notifications
5. Advanced filters and search
6. Export to multiple formats
7. Audit logging

---

## IMPLEMENTATION NOTES

This document serves as the complete blueprint for building the EV Charging Station Analytics & Billing System. When implementing:

1. Start with database migrations (Priority 1 tables)
2. Set up authentication immediately after database
3. Build UI components progressively
4. Test each feature thoroughly before moving to next
5. Keep calculations simple initially, add complexity incrementally
6. Focus on data accuracy above all else
7. Maintain clear separation of concerns in code
8. Document all calculation logic thoroughly

The system should be production-ready with Priority 1 and 2 features implemented. Priority 3 features can be added based on user feedback and usage patterns.

---

## REVISION HISTORY

### Version 1.1 - 2025-12-20
**Updates Made:**
- Added real-world Excel column structure (Transaction ID, Charge ID, Card Number, etc.)
- Documented three-column datetime storage approach (date, time, timestamp)
- Added comprehensive Jordan-specific configuration section
  - JOD currency formatting (3 decimal places)
  - Asia/Amman timezone handling with DST support
  - Jordan electricity rates (EDCO TOU structure)
  - Tax configuration (7% electricity tax + 16% GST)
- Updated database schema for `charging_sessions` table with new fields
- Enhanced Excel import specifications with datetime parsing details
- Added Jordan-specific calculation examples
- Updated implementation guide with timezone and currency requirements
- Enhanced glossary with Jordan and timezone-specific terms
- All sections renumbered after adding new Jordan configuration section

### Version 1.0 - 2024-12-20
**Initial Creation:**
- Complete system blueprint for EV Charging Analytics & Billing System
- Database schema design with all core tables
- Rate calculation logic and TOU implementation
- Excel import specifications
- UI/UX specifications
- Testing scenarios

---

**Document Version**: 1.1
**Last Updated**: 2025-12-20
**Status**: Ready for Implementation - Jordan Edition
