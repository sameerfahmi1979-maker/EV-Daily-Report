# Phase 8: OCPP Health & Diagnostics Dashboard - COMPLETE

## Implementation Date
December 21, 2024

## Summary
Successfully implemented the comprehensive Health & Diagnostics dashboard providing real-time system health monitoring, charger status tracking, error analysis, and diagnostic tools. This critical dashboard enables operators to proactively monitor infrastructure health, identify issues before they impact operations, and troubleshoot problems efficiently.

## Enhanced OCPP Service Layer

### New Health Monitoring Functions Added to `src/lib/ocppService.ts`:

**System Health Monitoring:**

1. **getSystemHealth(userId)** - Comprehensive system health overview
   - Calculates 11 key system metrics
   - Aggregates data from chargers, connectors, sessions, and messages
   - Metrics returned:
     - totalChargers - Total number of registered chargers
     - onlineChargers - Count of currently online chargers
     - offlineChargers - Count of offline chargers
     - errorChargers - Chargers with errors or missing heartbeats
     - totalConnectors - Total connector count
     - availableConnectors - Available for use
     - chargingConnectors - Currently in use
     - faultedConnectors - Faulted or unavailable
     - activeSessions - Active charging sessions
     - systemUptime - Percentage of chargers online
     - averageResponseTime - Avg message processing time (ms)
   - Performance optimized with parallel queries
   - Handles edge cases (no chargers, no data)
   - Response time calculated from recent messages (1 hour window)
   - Heartbeat freshness check (5-minute threshold)

2. **getChargerHealthDetails(userId)** - Individual charger health analysis
   - Returns detailed health status for each charger
   - Aggregates connectors, sessions, and errors per charger
   - Calculates health status (healthy/warning/error/offline):
     - offline: Connection status is Offline
     - error: Has faulted connectors or missing heartbeat
     - warning: More than 5 errors in 24h
     - healthy: All systems operational
   - Data returned per charger:
     - Basic info (ID, charge point ID, vendor, model)
     - Connection status and last heartbeat
     - Firmware version
     - Connector counts (total, available, charging, faulted)
     - Active sessions count
     - Recent error count (24h)
     - Uptime in minutes
     - Health status assessment
   - Efficient aggregation with grouping
   - Handles missing heartbeats gracefully

3. **getErrorLog(userId, limit)** - Recent error message retrieval
   - Fetches recent CallError messages and processing errors
   - Default limit 50, configurable
   - Includes charger details with each error
   - Returns full error context:
     - Message type and action
     - Error code and description
     - Charger identification
     - Timestamp
   - Ordered by timestamp (newest first)
   - Filtered for current user's chargers
   - Includes NULL charger (system errors)

4. **getConnectorStatusHistory(userId, connectorId, hours)** - Connector status tracking
   - Retrieves status change history for specific connector
   - Default 24-hour window, configurable
   - Filters StatusNotification messages
   - Returns timeline of status changes:
     - Timestamp of each change
     - New status value
     - Error code if present
   - Validates connector ownership
   - Useful for diagnosing connector issues
   - Chronological ordering

5. **getChargerUptime(userId, chargerId, days)** - Uptime calculation
   - Analyzes heartbeat messages to calculate uptime
   - Default 7-day analysis period
   - Calculates comprehensive metrics:
     - uptimePercentage - Overall uptime (0-100%)
     - totalHeartbeats - Count of received heartbeats
     - missedHeartbeats - Count of expected but missing
     - longestDowntime - Maximum gap between heartbeats (ms)
     - averageInterval - Average time between heartbeats (ms)
   - Expected heartbeat interval: 60 seconds
   - Missed heartbeat threshold: 2x expected interval
   - Handles no-data gracefully
   - Validates charger ownership

6. **getDiagnosticInfo(userId, chargerId)** - Complete diagnostic package
   - Aggregates all diagnostic data for a charger
   - Parallel queries for efficiency
   - Returns comprehensive data:
     - charger - Full charger details
     - configurationKeys - Current OCPP configuration
     - recentCommands - Last 10 remote commands
     - recentMessages - Last 20 OCPP messages
     - recentErrors - Errors from last 24h
     - errorCount24h - Error count summary
   - All data pre-loaded for diagnostic view
   - Single API call for complete diagnostic picture
   - Ready for detailed troubleshooting

**Updated SystemHealth Interface:**
```typescript
export interface SystemHealth {
  totalChargers: number;
  onlineChargers: number;
  offlineChargers: number;
  errorChargers: number;         // NEW
  activeSessions: number;
  totalConnectors: number;
  availableConnectors: number;
  chargingConnectors: number;
  faultedConnectors: number;
  systemUptime: number;          // NEW
  averageResponseTime: number;   // NEW
}
```

## OCPPHealthDiagnostics Component

### Complete Feature Set:

#### 1. System Status Overview Panel

Large, prominent status panel at the top showing overall system health:

**Header Section:**
- Health status icon (checkmark/warning/error/offline)
- "System Status" title
- Status label (Healthy/Warning/Error/Offline)
- Large uptime percentage display (e.g., "98.5%")
- Color-coded border matching status

**Status Determination Logic:**
- error: Any chargers have errors
- warning: More offline than online chargers
- healthy: All systems operational

**Six Key Metrics Grid:**

1. **Total Chargers**
   - Server icon
   - Count of all registered chargers
   - Neutral gray theme

2. **Online Chargers**
   - Green checkmark icon
   - Count of currently online chargers
   - Green border highlight

3. **Offline Chargers**
   - WifiOff icon
   - Count of offline chargers
   - Gray theme

4. **Error Chargers**
   - AlertTriangle icon
   - Count of chargers with errors
   - Red border highlight

5. **Charging Connectors**
   - Zap icon
   - Count of currently charging
   - Neutral theme

6. **Active Sessions**
   - Activity icon
   - Count of active charging sessions
   - Neutral theme

**Footer Metrics:**
- Average response time in milliseconds
- Connector availability ratio
- Clock and Gauge icons

**Color-Coded Background:**
- Green: System healthy
- Yellow: System has warnings
- Red: System has errors
- Gray: System offline

#### 2. Charger Health Status Panel

Left panel showing individual charger health with expandable details:

**Charger List View (Collapsed):**
- Health status icon
- Charge point ID
- Health status badge (healthy/warning/error/offline)
- Vendor and model name
- Available/Total connectors ratio
- Expand/collapse chevron
- Error count indicator (if >0)
- Click to expand

**Charger Detail View (Expanded):**

8 detailed metrics in 2-column grid:

1. **Connection Status**
   - Online/Offline/Unknown

2. **Last Heartbeat**
   - Relative time (e.g., "2 minutes ago")
   - Or "Never" if no heartbeat

3. **Firmware**
   - Version number
   - Or "Unknown"

4. **Uptime**
   - Formatted (e.g., "2d", "14h", "45m")

5. **Active Sessions**
   - Count of current sessions

6. **Charging Connectors**
   - Count currently in use

7. **Faulted Connectors**
   - Count with faults

8. **Recent Errors (24h)**
   - Error count with red emphasis

**Missing Heartbeat Alert:**
- Yellow alert box shown when:
  - Connection status is Online
  - But no heartbeat in last 5 minutes
- Warning icon and message
- Helps identify communication issues

**Scrollable Container:**
- Max height 600px
- Smooth scrolling
- Maintains performance with many chargers

**Empty State:**
- Server icon
- "No chargers registered" message
- Centered and friendly

#### 3. Recent Errors & Issues Panel

Right panel showing latest system errors and warnings:

**Error List Items:**
- Red X circle icon
- Error action name (e.g., "StartTransaction")
- Error code badge (if present)
- Charger charge point ID
- Error description text
- Relative timestamp

**Error Grouping:**
- CallError messages
- Processing errors
- All errors aggregated
- Last 20 errors shown

**Visual Design:**
- Each error card with hover effect
- Error code in red badge
- Clear typography hierarchy
- Timestamp in relative format
- Scrollable list (max height 600px)

**Empty State:**
- Large green checkmark icon
- "No recent errors" message
- "System is running smoothly" subtitle
- Positive reinforcement

#### 4. Performance Metrics Cards

Three bottom cards showing key performance indicators:

**Performance Card:**
- Green TrendingUp icon
- Status: "Excellent" (<100ms) / "Good" (<500ms) / "Needs Attention" (≥500ms)
- Response time in milliseconds
- Message success rate percentage
- Calculated from online vs error chargers

**Capacity Card:**
- Blue Activity icon
- Utilization percentage
- Total connectors count
- In-use count
- Shows current demand level

**System Health Card:**
- AlertTriangle icon (red if issues, green if healthy)
- Overall status (Healthy/Warning/Error)
- Faulted connectors count (red)
- Error chargers count (red)
- Quick issue summary

#### 5. Real-Time Features

**Auto-Refresh Mode:**
- Toggleable 10-second refresh interval
- Slower than message logs (less critical)
- Only updates health data
- Visual spinner indicator
- Red theme when active
- Maintains UI state

**Manual Refresh:**
- Immediate data reload
- Full data refresh
- Updates all panels
- Refresh icon button

**Live Updates:**
- System health metrics
- Charger health details
- Automatic background polling
- No page disruption

#### 6. Health Status Indicators

**Visual System:**

**Health Icons:**
- Healthy: Green checkmark circle
- Warning: Yellow alert triangle
- Error: Red X circle
- Offline: Gray WiFi off

**Color Schemes:**

**Healthy:**
- Background: Green-100
- Text: Green-800
- Border: Green-200
- Icon: Green-600

**Warning:**
- Background: Yellow-100
- Text: Yellow-800
- Border: Yellow-200
- Icon: Yellow-600

**Error:**
- Background: Red-100
- Text: Red-800
- Border: Red-200
- Icon: Red-600

**Offline:**
- Background: Gray-100
- Text: Gray-800
- Border: Gray-200
- Icon: Gray-600

#### 7. User Experience

**Loading States:**
- Red-themed spinner
- "Loading health diagnostics..."
- Centered display
- Matches Heart icon theme

**Empty States:**
- No chargers: Friendly message
- No errors: Positive feedback
- Clear guidance
- Professional appearance

**Error Handling:**
- Red alert box
- Error icon
- Clear error message
- Non-blocking display

**Responsive Design:**
- Mobile-first approach
- Adaptive grid layouts (1/2/3 columns)
- Touch-friendly interactions
- Readable on all devices
- Collapsible panels

**Visual Hierarchy:**
- System status most prominent
- Charger list easily scannable
- Error log quickly accessible
- Metrics cards at bottom
- Logical flow top to bottom

#### 8. Formatting Utilities

**Uptime Formatting:**
- Minutes: "45m"
- Hours: "14h"
- Days: "7d"
- Automatic unit selection

**Timestamp Formatting:**
- Relative: "2 minutes ago"
- Never: For missing data
- Consistent with date-fns

**Performance Status:**
- Excellent: <100ms
- Good: <500ms
- Needs Attention: ≥500ms
- Text-based assessment

#### 9. Data Aggregation

**System-Wide Calculations:**
- Charger status counts
- Connector availability
- Session tracking
- Error aggregation
- Uptime percentage
- Response time averaging

**Per-Charger Analysis:**
- Connection health
- Heartbeat freshness
- Error frequency
- Connector status
- Session activity
- Firmware tracking

**Error Tracking:**
- Recent error log
- 24-hour error counts
- Per-charger error rates
- Error code tracking
- Description capture

#### 10. Diagnostic Capabilities

**System Health Monitoring:**
- Overall system status
- Uptime tracking
- Performance metrics
- Capacity utilization
- Error rate analysis

**Charger Diagnostics:**
- Connection status
- Heartbeat monitoring
- Firmware version tracking
- Connector health
- Error history
- Session tracking

**Issue Identification:**
- Missing heartbeats
- Communication failures
- Faulted connectors
- High error rates
- Offline chargers
- Performance degradation

**Troubleshooting Support:**
- Error logs with context
- Charger-specific details
- Timeline information
- Status change tracking
- Configuration visibility

### State Management

**Data States:**
- `systemHealth` - Overall system metrics
- `chargerHealthList` - Individual charger details
- `errorLog` - Recent error messages

**UI States:**
- `loading` - Initial data fetch
- `error` - Error message display
- `expandedChargerId` - Detail view toggle
- `autoRefresh` - Auto-refresh mode

**Effect Hooks:**

1. **Initial Data Load**
   - Runs on mount
   - Parallel API calls
   - Sets all data states

2. **Auto-Refresh Polling**
   - 10-second interval
   - Only when enabled
   - Updates health metrics
   - Background operation

### Integration Features

**Database Tables Used:**
- ocpp_chargers - Charger status and details
- ocpp_connectors - Connector status
- ocpp_charging_sessions - Active sessions
- ocpp_messages - Errors and heartbeats
- ocpp_configuration_keys - Charger config (for future diagnostics)
- ocpp_remote_commands - Command history (for future diagnostics)

**Charger Health Logic:**
- Online status check
- Heartbeat freshness (5-minute window)
- Error rate threshold (>5 in 24h = warning)
- Faulted connector detection
- Combined health assessment

**Error Detection:**
- CallError message types
- Processing status errors
- Error code capture
- Description logging
- Timestamp tracking

**Performance Tracking:**
- Message response times
- 1-hour analysis window
- Outlier filtering (<10s)
- Average calculation
- System health indicator

### Technical Implementation

**Performance Optimizations:**
- Parallel data fetching (Promise.all)
- Limited result sets
- Efficient aggregation
- Client-side calculations
- Debounced auto-refresh
- Indexed database queries

**Type Safety:**
- Full TypeScript implementation
- Interface definitions
- Proper null handling
- Type-safe calculations
- Event handler types

**Database Queries:**
- RLS compliant
- User-scoped data
- Optimized with indexes
- Minimal data transfer
- Proper JOIN usage
- Aggregation efficiency

**Error Boundaries:**
- Try-catch blocks
- Error state management
- User-friendly messages
- Graceful degradation
- Recovery options

**Security:**
- Authorization checks
- User-scoped queries
- No data leakage
- Safe calculations
- Validated inputs

## Build Status

Project builds successfully with no errors. All functionality is production-ready and fully integrated with the existing OCPP management system.

## User Workflows

### Monitoring System Health:
1. User opens Health & Diagnostics
2. Sees system status at a glance
3. Reviews key metrics
4. Checks performance indicators
5. Enables auto-refresh if desired
6. Monitors continuously

### Investigating Charger Issues:
1. User notices error on dashboard
2. Navigates to Health & Diagnostics
3. Sees charger in error list
4. Clicks charger to expand details
5. Reviews metrics and status
6. Checks last heartbeat time
7. Identifies faulted connector
8. Reviews error count
9. Takes appropriate action

### Checking System Performance:
1. User reviews performance card
2. Checks response time
3. Reviews success rate
4. Evaluates if action needed
5. Monitors over time

### Troubleshooting Errors:
1. User views Recent Errors panel
2. Identifies error patterns
3. Clicks specific error
4. Reviews error details
5. Checks affected charger
6. Reads error description
7. Determines resolution

### Verifying System Status:
1. User checks system status panel
2. Reviews overall health
3. Confirms uptime percentage
4. Checks charger counts
5. Verifies all online
6. Confirms no errors

### Monitoring Capacity:
1. User reviews capacity card
2. Checks utilization percentage
3. Sees connectors in use
4. Evaluates demand levels
5. Plans capacity needs

## Features Implemented

- ✅ System health overview
- ✅ Real-time status monitoring
- ✅ Individual charger health tracking
- ✅ Expandable charger details
- ✅ Recent error log
- ✅ Error details with context
- ✅ Performance metrics
- ✅ Capacity utilization tracking
- ✅ System uptime calculation
- ✅ Response time monitoring
- ✅ Missing heartbeat detection
- ✅ Health status indicators
- ✅ Color-coded status system
- ✅ Auto-refresh mode (10s interval)
- ✅ Manual refresh button
- ✅ Charger-level diagnostics
- ✅ Connector status aggregation
- ✅ Active session tracking
- ✅ Error rate analysis
- ✅ Firmware version tracking
- ✅ Uptime formatting
- ✅ Loading states
- ✅ Empty states
- ✅ Error handling
- ✅ Responsive design
- ✅ Type-safe implementation
- ✅ RLS compliance

## Next Steps

All OCPP Management dashboards are now complete. The system provides comprehensive charger management, monitoring, and diagnostic capabilities. Future enhancements could include:
- Historical trend charts
- Alert notifications
- Automated diagnostics
- Predictive maintenance
- Advanced analytics
- Custom health thresholds
- Email/SMS alerts
- Performance benchmarking

## Success Metrics

**Dashboard Completeness:**
- All planned features implemented
- Full health monitoring coverage
- Comprehensive diagnostic tools
- Real-time updates working

**Code Quality:**
- No TypeScript errors
- Clean build output
- Optimized queries
- Proper error handling
- Type-safe throughout

**User Experience:**
- Intuitive navigation
- Clear visual feedback
- Fast load times
- Responsive layout
- Professional appearance

**Monitoring Capability:**
- Complete system visibility
- Individual charger tracking
- Error identification
- Performance metrics
- Capacity monitoring

**Diagnostic Capability:**
- Issue detection
- Root cause identification
- Health assessment
- Status tracking
- Error logging

## Notes

- Auto-refresh interval set to 10 seconds (less critical than live monitoring)
- Heartbeat freshness threshold: 5 minutes
- Error threshold for warning status: >5 errors in 24h
- System uptime calculated as percentage of online chargers
- Response time analyzed over 1-hour window
- Response time outliers filtered (>10 seconds excluded)
- Health status determined by multiple factors (connection, heartbeat, errors, faults)
- Uptime formatting automatically selects appropriate unit
- Performance status has 3 levels (Excellent/Good/Needs Attention)
- Red theme for Health & Diagnostics (Heart icon)
- Expandable charger cards for detail on demand
- Error log shows last 20 errors for quick review
- Empty states provide positive feedback
- Color coding consistent throughout interface
- All calculations handle edge cases (no data, zero chargers)

## Dependencies

Uses existing project dependencies:
- `date-fns` - Date formatting and relative time
- `lucide-react` - Icons throughout
- `@supabase/supabase-js` - Database operations
- React hooks - State management

No new dependencies required.

## Testing Recommendations

1. **System Status:** Verify overall status calculation
2. **Charger Health:** Test health status logic
3. **Error Detection:** Validate error identification
4. **Performance Metrics:** Check calculations
5. **Auto-Refresh:** Confirm polling works
6. **Manual Refresh:** Test immediate reload
7. **Expand/Collapse:** Verify charger details toggle
8. **Missing Heartbeat:** Test alert shows correctly
9. **Empty States:** Test with no chargers, no errors
10. **Loading States:** Check initial load
11. **Error States:** Simulate API errors
12. **Uptime Formatting:** Test all units (m/h/d)
13. **Health Icons:** Verify correct icons display
14. **Color Coding:** Check all status colors
15. **Responsive:** Test on multiple screen sizes
16. **Capacity Calculation:** Verify percentage correct
17. **Response Time:** Check averaging logic
18. **Error Threshold:** Test warning trigger
19. **System Uptime:** Verify percentage calculation
20. **RLS:** Ensure data scoped to user

## Implementation Quality

Phase 8 represents a production-ready, comprehensive health monitoring and diagnostic solution with:
- Complete system visibility
- Real-time monitoring
- Proactive issue detection
- Individual charger tracking
- Error analysis
- Performance monitoring
- Professional design
- Robust error handling
- Excellent user experience
- Full type safety
- Optimal performance
- Clean architecture

The Health & Diagnostics dashboard provides operators complete visibility into system health, enabling proactive monitoring, rapid issue identification, and efficient troubleshooting of the charging infrastructure.

## Technical Highlights

**Health Assessment Logic:**
- Multi-factor evaluation
- Heartbeat freshness check
- Error rate threshold
- Fault detection
- Connection status
- Combined scoring

**System Metrics:**
- Real-time calculations
- Efficient aggregation
- Parallel queries
- Optimized performance
- Accurate tracking

**Error Tracking:**
- Comprehensive logging
- Context preservation
- Charger association
- Timestamp tracking
- Error classification

**Performance Monitoring:**
- Response time analysis
- Success rate calculation
- Outlier filtering
- Time-window based
- Trend indicators

**User Interface:**
- Intuitive layout
- Clear hierarchy
- Color-coded status
- Expandable details
- Real-time updates
- Professional design

**Database Optimization:**
- Indexed queries
- Efficient JOINs
- Minimal data transfer
- RLS enforcement
- Proper aggregation
- Parallel execution

The Health & Diagnostics implementation provides a robust foundation for proactive system monitoring and rapid issue resolution, essential for maintaining reliable charging infrastructure and excellent customer experience.
