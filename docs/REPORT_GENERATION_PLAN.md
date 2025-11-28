# Call Analytics Report Generation Plan

## Overview
Generate PDF reports with comprehensive call analytics including call volume, answer rates, appointments, and performance metrics.

## Required Metrics

### 1. Call Volume
- Total calls made
- Breakdown by status (answered, missed, forwarded)
- Answer rate percentage (actual conversations, not voicemail)

### 2. Appointments
- Total appointments booked
- List of appointments with:
  - Phone number
  - Customer name
  - Appointment date
  - Appointment time
  - Quality score

### 3. Call Quality Metrics
- Total minutes (call duration sum)
- Average handling time per call
- Ended reason distribution

### 4. Answer Rate Details
- Calls with actual conversations (has transcript)
- Exclude voicemails
- Percentage calculation

## Technical Implementation

### Library: @react-pdf/renderer
**Why?**
- React component-based (matches our stack)
- Client-side generation (no backend load)
- Professional styling capabilities
- Active development and good docs
- Can export to File or Blob

### Installation
```bash
npm install @react-pdf/renderer
```

### Architecture

#### Option 1: Frontend Generation (Recommended)
```
User clicks "Generate Report" 
  → Frontend fetches aggregated data from API
  → @react-pdf/renderer creates PDF in browser
  → User downloads PDF file
```

**Pros:**
- No backend processing load
- Instant generation
- Works offline after data fetch
- No file storage needed

**Cons:**
- Larger frontend bundle
- Limited to browser capabilities

#### Option 2: Backend Generation
```
User clicks "Generate Report"
  → Backend aggregates data
  → Worker generates PDF
  → Returns PDF file or temporary URL
```

**Pros:**
- Smaller frontend
- Can schedule/email reports
- Better for large datasets

**Cons:**
- More complex Worker setup
- Cloudflare Workers have limited PDF libraries
- Would need Puppeteer or external service

**Recommendation: Start with Option 1 (Frontend)**

## Implementation Steps

### Step 1: Create API Endpoint for Report Data
**File:** `workers/index.ts`

New endpoint: `/api/reports/call-analytics`

Returns:
```typescript
{
  dateRange: { from: string, to: string },
  summary: {
    totalCalls: number,
    answeredCalls: number,
    missedCalls: number,
    forwardedCalls: number,
    answerRate: number,
    totalMinutes: number,
    avgHandlingTime: number
  },
  appointments: Array<{
    id: string,
    phone_number: string,
    customer_name: string,
    appointment_date: string,
    appointment_time: string,
    quality_score: number,
    created_at: number
  }>,
  endedReasons: Array<{
    reason: string,
    count: number,
    percentage: number
  }>,
  callsByStatus: {
    answered: number,
    missed: number,
    forwarded: number,
    voicemail: number
  }
}
```

### Step 2: Create PDF Report Component
**File:** `src/components/CallAnalyticsReport.tsx`

Structure:
```
- Header (Company logo, report title, date range)
- Executive Summary (key metrics cards)
- Call Volume Chart
- Appointments Table
- Call Quality Metrics
- Ended Reasons Chart
- Footer (generated date, page numbers)
```

### Step 3: Create Report Generator Service
**File:** `src/lib/reportGenerator.ts`

Functions:
- `generateCallAnalyticsReport(data)` - Creates PDF document
- `downloadReport(blob, filename)` - Triggers browser download
- `formatReportData(rawData)` - Formats data for display

### Step 4: Add Report Button to UI
**File:** `src/components/PerformanceDashboard.tsx` or new Reports page

Button with:
- Date range selector
- Loading state
- Download trigger
- Error handling

## Data Aggregation Logic

### Answer Rate Calculation
```typescript
const answerRate = (answeredCallsWithTranscript / totalCalls) * 100;

// Exclude:
// - Voicemails (no transcript or transcript < 50 words)
// - Missed calls
// - Forwarded calls without pickup
```

### Call Status Categorization
Use existing `categorizeCall()` function from `Recordings.tsx`

### Handling Time
```typescript
const avgHandlingTime = totalMinutes / answeredCalls;
// Display in format: "Xm Ys"
```

## UI/UX Design

### Report Configuration Modal
- Date range picker (default: last 30 days)
- Workspace selector (for admins)
- Report format: PDF (future: CSV, Excel)
- Include/exclude sections checkboxes

### Download Flow
1. User clicks "Generate Report"
2. Show loading modal with progress
3. Fetch data from API
4. Generate PDF in background
5. Auto-download file
6. Show success message with option to regenerate

## PDF Styling

### Brand Colors
Use existing dashboard theme:
- Primary: Blue (#3B82F6)
- Success: Green (#10B981)
- Warning: Orange (#F59E0B)
- Danger: Red (#EF4444)

### Layout
- Page size: A4
- Margins: 20mm
- Font: Helvetica (built-in PDF font)
- Charts: Simple bar/line charts using SVG

## File Naming Convention
```
CallAnalytics_[WorkspaceName]_[StartDate]_[EndDate].pdf

Example:
CallAnalytics_HomeGeniusExteriors_2025-11-01_2025-11-18.pdf
```

## Future Enhancements

### Phase 2
- Email reports (scheduled)
- CSV export option
- Custom date ranges with presets (Today, Yesterday, Last 7 days, etc.)
- Compare periods (vs last month)

### Phase 3
- Scheduled reports (daily/weekly/monthly)
- Multiple recipient emails
- Report templates (customizable sections)
- White-label branding

## Dependencies

```json
{
  "@react-pdf/renderer": "^3.1.0"
}
```

Optional (for charts):
```json
{
  "recharts": "^2.10.0" // If we want to include visual charts
}
```

## Estimated Development Time
- API endpoint: 2 hours
- PDF component: 4 hours
- UI integration: 2 hours
- Testing & refinement: 2 hours
- **Total: ~10 hours** (1-2 days)

## Next Steps
1. Confirm report design/layout with client
2. Install @react-pdf/renderer
3. Create API endpoint for aggregated data
4. Build PDF component
5. Add "Generate Report" button to dashboard
6. Test with real data
7. Deploy and gather feedback

