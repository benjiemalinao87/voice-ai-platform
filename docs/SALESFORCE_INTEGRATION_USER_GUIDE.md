# Salesforce Integration Guide

## 🎯 What This Integration Does

When you connect Salesforce to your Voice AI Dashboard, every incoming call is automatically logged in Salesforce. Here's what happens:

1. **Search by Phone Number** - We find the existing Lead or Contact in Salesforce using the caller's phone number
2. **Create Call Log** - We create a Task (call log) on that Lead/Contact record with the full call details
3. **Schedule Appointments** - If your Voice AI schedules an appointment during the call, we create an Event (appointment) in Salesforce automatically

**Best Part**: Zero programming required on your Salesforce side - just a simple OAuth connection!

---

## 📋 How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SALESFORCE INTEGRATION                            │
└─────────────────────────────────────────────────────────────────────────┘

   One-Time Setup                      Automatic (Every Call)
   ==============                      ======================

   ┌──────────────┐                   ┌──────────────────────┐
   │   You Click  │                   │  Customer Calls      │
   │  "Connect    │                   └──────────┬───────────┘
   │ Salesforce"  │                              │
   └──────┬───────┘                              │
          │                                      ▼
          │                          ┌─────────────────────────────┐
          ▼                          │ 1. Search Salesforce        │
   ┌──────────────┐                 │    by Phone Number          │
   │  Salesforce  │                 └─────────────┬───────────────┘
   │  Login Page  │                               │
   │  Opens       │                               │
   └──────┬───────┘                    ┌──────────▼──────────┐
          │                            │ Lead/Contact Found? │
          │                            └──────────┬──────────┘
          ▼                                       │
   ┌──────────────┐                              YES
   │  Click       │                               │
   │  "Allow"     │                               ▼
   └──────┬───────┘                   ┌─────────────────────────────┐
          │                           │ 2. Create Task (Call Log)   │
          │                           │    on that record           │
          ▼                           └─────────────┬───────────────┘
   ┌──────────────┐                               │
   │  ✅ Connected│                               │
   │  Done!       │                    ┌──────────▼──────────┐
   └──────────────┘                    │ Appointment booked? │
                                       └──────────┬──────────┘
                                                  │
                                         ┌────────┴────────┐
                                         │                 │
                                        YES               NO
                                         │                 │
                                         ▼                 ▼
                              ┌──────────────────┐  ┌──────────┐
                              │ 3. Create Event  │  │  Done ✓  │
                              │    (Appointment) │  └──────────┘
                              └──────────────────┘

                                  ✅ All Done!
                          Call log + Appointment in Salesforce

```

---

## 🔐 Simple OAuth Connection

### Why This Is Easy

No manual API key copying, no developer console needed. Just click and authorize!

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         OAUTH SETUP FLOW                                     │
└────────────────────────────────────────────────────────────────────────────┘

 Your Dashboard              Salesforce               Result
 ==============              ==========               ======

      │                         │                       │
      │  1. Click "Connect      │                       │
      │     Salesforce"         │                       │
      ├────────────────────────►│                       │
      │                         │                       │
      │  2. Popup Opens         │                       │
      │     Login to Salesforce │                       │
      │                         │                       │
      │  3. See Permission      │                       │
      │     Request:            │                       │
      │     "Allow Voice AI     │                       │
      │      to access your     │                       │
      │      data?"             │                       │
      │                         │                       │
      │  4. Click "Allow"       │                       │
      ├────────────────────────►│                       │
      │                         │                       │
      │                         │  5. Authorization     │
      │                         │     Granted           │
      │                         ├──────────────────────►│
      │                         │                       │
      │  6. Connected! ✅       │                       │  ✅ All calls now
      │     Popup Closes        │                       │    auto-log to
      │                         │                       │    Salesforce!
      │◄────────────────────────┼───────────────────────┤
      │                         │                       │

```

---

## 🔍 How Phone Number Search Works

We use Salesforce's powerful search to find your Leads and Contacts, even with different phone formats!

```
┌────────────────────────────────────────────────────────────────┐
│                   PHONE NUMBER SEARCH                            │
└────────────────────────────────────────────────────────────────┘

Incoming Call: +1 (555) 123-4567

Step 1: Clean Phone Number
──────────────────────────
  Remove: +, (, ), -, spaces
  Result: "15551234567"

Step 2: Search Salesforce
─────────────────────────
  Search ALL phone fields in:
  → Leads (Phone, Mobile)
  → Contacts (Phone, Mobile)

  Salesforce automatically matches:
  • "+1 (555) 123-4567"  ✓
  • "555-123-4567"        ✓
  • "5551234567"          ✓
  • "+15551234567"        ✓
  • "(555) 123-4567"      ✓

Step 3: Priority
────────────────
  1. Check Leads first (new prospects)
  2. Then check Contacts (existing customers)
  3. Use first match found

Step 4: Create Call Log
───────────────────────
  Task created on the Lead/Contact
  ✅ Appears in Activity Timeline!

```

---

## 📞 Call Logging

Every call creates a Task in Salesforce with complete details:

```
┌────────────────────────────────────────────────────────────────┐
│              WHAT GETS LOGGED IN SALESFORCE                      │
└────────────────────────────────────────────────────────────────┘

Lead/Contact: John Smith
Phone: (555) 123-4567

Activity Timeline:
┌─────────────────────────────────────────────────────────────┐
│  ☎️  Task: Inbound Call                                     │
│                                                              │
│      Subject:          Inbound Call                          │
│      Status:           Completed                             │
│      Type:             Call                                  │
│      Call Type:        Inbound                               │
│      Date/Time:        Today at 10:45 AM                     │
│      Duration:         3 min 42 sec                          │
│                                                              │
│      Description:      [Full call summary from Voice AI]    │
│                       Customer inquired about premium        │
│                       service. Interested in pricing.        │
│                       Follow-up needed.                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

```

---

## 📅 Appointment Scheduling

When your Voice AI schedules an appointment during a call, we automatically create both a call log AND a calendar event!

### How It Works

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    APPOINTMENT BOOKING FLOW                                  │
└────────────────────────────────────────────────────────────────────────────┘

  During Call                   After Call Ends           In Salesforce
  ===========                   ===============           =============

      │                              │                         │
      │ Customer:                    │                         │
      │ "I'd like to schedule        │                         │
      │  an appointment for          │                         │
      │  next Monday at 2pm"         │                         │
      │                              │                         │
      │ AI:                          │                         │
      │ "Great! I've booked you      │                         │
      │  for January 15th at         │                         │
      │  2:00 PM"                    │                         │
      │                              │                         │
      │ [Call Ends]                  │                         │
      ├─────────────────────────────►│                         │
      │                              │                         │
      │                              │ 1. Find Lead/Contact    │
      │                              │    by phone             │
      │                              ├────────────────────────►│
      │                              │                         │
      │                              │ 2. Create Task          │
      │                              │    (Call Log) ✓         │
      │                              ├────────────────────────►│
      │                              │                         │
      │                              │ 3. Create Event         │
      │                              │    (Appointment) ✓      │
      │                              ├────────────────────────►│
      │                              │                         │

  Result in Salesforce:
  ────────────────────

  Lead: Sarah Johnson
  └── Activity Timeline
      ├── ✅ Task: "Inbound Call - Scheduled Appointment"
      │   Today at 10:30 AM
      │   Duration: 3 min 45 sec
      │
      └── 📅 Event: "Consultation Appointment"
          Monday, Jan 15 at 2:00 PM - 3:00 PM
          🔔 Reminder: 1 hour before
          Shows in Salesforce Calendar!

```

### Task vs Event: What's The Difference?

```
┌────────────────────────────────────────────────────────────────┐
│                  TASK VS EVENT IN SALESFORCE                     │
└────────────────────────────────────────────────────────────────┘

Task (Call Log)                    Event (Appointment)
===============                    ===================

☎️  Phone Icon                     📅 Calendar Icon

Purpose:                           Purpose:
  Record past activity               Schedule future activity

Status:                            Status:
  Completed ✓                        Scheduled/Planned

Time:                              Time:
  When call happened                 When appointment is

Shows In:                          Shows In:
  • Activity History                 • Activity History
  • Task List                        • Salesforce Calendar
                                     • Outlook/Google Calendar sync

Example:                           Example:
  "Customer called today             "Consultation scheduled for
   about pricing"                     Jan 15 at 2:00 PM"

```

### What Gets Captured

When an appointment is booked during a call, we capture:

```
┌────────────────────────────────────────────────────────────────┐
│              APPOINTMENT EVENT IN SALESFORCE                     │
└────────────────────────────────────────────────────────────────┘

Event Details:
──────────────
  Subject:       "Consultation Appointment"
  Date:          January 15, 2025
  Start Time:    2:00 PM
  End Time:      3:00 PM (1 hour duration)
  Type:          Meeting
  Status:        Scheduled

  Description:   Appointment scheduled during call.

                 Notes: Bring ID and insurance card

                 Call Summary:
                 Customer called to schedule consultation.
                 Interested in premium service package.

  Reminder:      Set for 1 hour before (1:00 PM)

Visibility:
───────────
  ✓ Shows in Salesforce Activity Timeline
  ✓ Shows in Salesforce Calendar
  ✓ Syncs to Outlook/Google Calendar (if enabled)
  ✓ Rep receives reminder notification

```

---

## 🎯 What You See in Salesforce

### Activity Timeline View

```
┌─────────────────────────────────────────────────────────────┐
│  Lead: Michael Rodriguez                                     │
│  Phone: (555) 987-6543                                       │
│  Company: Tech Solutions Inc.                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Activity Timeline                           [Filter] [Sort] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📅 Upcoming                                                 │
│  ─────────                                                   │
│                                                               │
│  Monday, Jan 15 at 2:00 PM                                   │
│  📅  Consultation Appointment - Scheduled via Voice AI       │
│      Duration: 1 hour (2:00 PM - 3:00 PM)                    │
│      🔔 Reminder set for 1:00 PM                             │
│      [View Details] [Reschedule] [Cancel]                    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ Past Activity                                            │
│  ──────────────                                              │
│                                                               │
│  Today at 10:30 AM                                           │
│  ☎️  Inbound Call - Scheduled Appointment                    │
│      Status: Completed                                       │
│      Duration: 3 min 45 sec                                  │
│      Call Type: Inbound                                      │
│                                                               │
│      Description:                                            │
│      Customer called to schedule consultation. Discussed     │
│      premium service options. Very interested. Appointment   │
│      created for next week. Requested reminder to bring ID.  │
│                                                               │
│      [View Full Details]                                     │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Jan 10 at 3:15 PM                                           │
│  ☎️  Inbound Call - Information Request                      │
│      Status: Completed                                       │
│      Duration: 2 min 18 sec                                  │
│      ...                                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘

```

### Calendar View

```
┌─────────────────────────────────────────────────────────────┐
│  Salesforce Calendar                          January 2025   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Mon 13   Tue 14   Wed 15   Thu 16   Fri 17                 │
│  ───────  ───────  ───────  ───────  ───────                │
│                                                               │
│                     📅 2:00 PM                                │
│                     Consultation                              │
│                     with Michael R.                           │
│                     (Voice AI)                                │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Click event to see:
  • Full appointment details
  • Related Lead/Contact
  • Call notes from booking
  • Reschedule/Cancel options

```

---

## ✅ Benefits

```
┌────────────────────────────────────────────────────────────────┐
│                   WHAT YOU GET                                   │
└────────────────────────────────────────────────────────────────┘

For Sales Reps:
───────────────
  ✓ Complete call history on every Lead/Contact
  ✓ No manual data entry after calls
  ✓ Automatic appointment scheduling
  ✓ Calendar reminders for appointments
  ✓ Full call transcripts and summaries
  ✓ All data in one place (Salesforce)

For Managers:
─────────────
  ✓ Track all inbound calls automatically
  ✓ See which Leads are being contacted
  ✓ Monitor appointment booking rate
  ✓ Complete activity history
  ✓ No missed follow-ups

For Everyone:
─────────────
  ✓ Zero manual work
  ✓ No training needed
  ✓ Works automatically 24/7
  ✓ Sync happens in real-time
  ✓ Nothing to configure after initial setup

```

---

## 🔒 Security & Privacy

```
┌────────────────────────────────────────────────────────────────┐
│                   YOUR DATA IS SAFE                              │
└────────────────────────────────────────────────────────────────┘

Secure OAuth Connection:
────────────────────────
  ✓ Industry-standard OAuth 2.0
  ✓ No API keys to copy/paste
  ✓ You control permissions
  ✓ Can disconnect anytime

What We Access:
───────────────
  ✓ Read Leads (to find by phone)
  ✓ Read Contacts (to find by phone)
  ✓ Create Tasks (to log calls)
  ✓ Create Events (to schedule appointments)

What We DON'T Access:
──────────────────────
  ✗ Cannot delete records
  ✗ Cannot modify existing data
  ✗ No access to other objects
  ✗ No admin permissions
  ✗ Cannot see other users' data

Workspace Isolation:
────────────────────
  ✓ Each workspace has separate connection
  ✓ No cross-workspace data sharing
  ✓ Tokens stored securely server-side
  ✓ Auto-refresh for uninterrupted service

```

---

## 🚀 Setup Requirements

### What You Need

```
┌────────────────────────────────────────────────────────────────┐
│                   SETUP REQUIREMENTS                             │
└────────────────────────────────────────────────────────────────┘

Salesforce Account:
───────────────────
  • Any Salesforce edition (including Professional)
  • User must have:
    → Read access to Leads
    → Read access to Contacts
    → Create access to Tasks
    → Create access to Events
  • NO System Administrator required!
  • NO Developer Console access needed!
  • NO Apex programming required!

Typical User Profiles That Work:
─────────────────────────────────
  ✓ Standard User
  ✓ Sales User
  ✓ Service User
  ✓ Salesforce Platform
  ✓ Any custom profile with object permissions above

Time Required:
──────────────
  • Initial admin setup: 10 minutes (one-time)
  • User connection: 30 seconds (per user)
  • Zero ongoing maintenance!

```

---

## 🎓 Setup Process Overview

### For Salesforce Admins (One-Time Setup)

```
┌────────────────────────────────────────────────────────────────┐
│              ADMIN SETUP (10 MINUTES, ONE-TIME)                  │
└────────────────────────────────────────────────────────────────┘

Step 1: Create Connected App in Salesforce
──────────────────────────────────────────
  Navigate: Setup → Apps → App Manager → New Connected App

  Fill in:
    • App Name: "Voice AI Dashboard"
    • Contact Email: your@email.com
    • Enable OAuth Settings: ✓
    • Callback URL: (provided by us)
    • OAuth Scopes:
      - Access and manage your data (api)
      - Perform requests at any time (refresh_token)

Step 2: Get Credentials
───────────────────────
  Copy:
    • Consumer Key (Client ID)
    • Consumer Secret (Client Secret)

  Provide these to us for configuration

Step 3: Done!
────────────
  All workspace members can now connect their accounts

```

### For Users (30 Seconds)

```
┌────────────────────────────────────────────────────────────────┐
│                USER CONNECTION (30 SECONDS)                      │
└────────────────────────────────────────────────────────────────┘

Step 1: Go to Integrations
──────────────────────────
  Dashboard → Integrations → Salesforce

Step 2: Click "Connect"
──────────────────────
  Popup window opens to Salesforce

Step 3: Login & Allow
─────────────────────
  • Login to your Salesforce account
  • Review permissions
  • Click "Allow"

Step 4: Done! ✅
───────────────
  Connected! All calls now auto-log to Salesforce.

```

---

## 🔄 How Auto-Refresh Works

You never have to reconnect! Our system automatically maintains your connection.

```
┌────────────────────────────────────────────────────────────────┐
│              AUTOMATIC CONNECTION MAINTENANCE                    │
└────────────────────────────────────────────────────────────────┘

Initial Connection:
───────────────────
  You: Click "Connect" → Login → Allow
  Result: ✅ Connected

Behind The Scenes:
──────────────────
  • We receive access token (expires in 2 hours)
  • We receive refresh token (never expires)
  • We store both securely

Every Time A Call Comes In:
───────────────────────────
  1. Check if access token is still valid
  2. If expired, automatically refresh it
  3. Use new token to create Task/Event
  4. You never notice any interruption!

You Never Need To:
──────────────────
  ✗ Re-login
  ✗ Re-authorize
  ✗ Manually refresh
  ✗ Enter credentials again

The connection works until:
───────────────────────────
  • You click "Disconnect" in our dashboard
  • You revoke access in Salesforce
  • Admin disables the Connected App

Otherwise: Always connected, always working! ✅

```

---

## ❓ Frequently Asked Questions

### General Questions

**Q: Do I need to be a Salesforce Admin?**
A: No! Regular users can connect their own accounts. An admin only needs to do the one-time Connected App setup.

**Q: Will this work with Leads and Contacts?**
A: Yes! We search both Leads and Contacts by phone number and create call logs on whichever one we find.

**Q: What if the phone number isn't in Salesforce?**
A: We'll log a warning but won't create a Task. The call data is still saved in your Voice AI Dashboard.

**Q: Can I disconnect anytime?**
A: Yes! Click "Disconnect" in the Integrations page anytime. Your existing call logs in Salesforce won't be deleted.

### Phone Number Questions

**Q: Do phone formats need to match exactly?**
A: No! Salesforce's search handles different formats automatically:
- `+1 (555) 123-4567`
- `555-123-4567`
- `5551234567`
- All of these will match!

**Q: What if a Lead has multiple phone numbers?**
A: We search Phone AND Mobile Phone fields. If the incoming call matches either, we'll find it.

**Q: Can I test with a specific phone number?**
A: Yes! Use the "Test Sync" button in the integration settings to manually test any phone number.

### Appointment Questions

**Q: How does appointment scheduling work?**
A: If your Voice AI detects and confirms an appointment during the call, we automatically create both:
1. A Task (call log)
2. An Event (appointment on the calendar)

**Q: Can I customize the appointment duration?**
A: Yes! The default is 1 hour, but your Voice AI can specify different durations (30 min, 2 hours, etc.)

**Q: Will the sales rep get reminded?**
A: Yes! We set a reminder for 1 hour before the appointment. Reps will get Salesforce notifications.

**Q: What if the appointment needs to be rescheduled?**
A: The rep can reschedule directly in Salesforce. The Event is a normal Salesforce Event with all standard features.

### Technical Questions

**Q: Does this require Apex code?**
A: No! This is pure OAuth + REST API integration. Zero coding required.

**Q: Will this slow down my calls?**
A: No! The Salesforce sync happens after the call ends, so there's no impact on call quality or speed.

**Q: What Salesforce edition do I need?**
A: Professional Edition or higher. The integration uses standard Salesforce objects (Leads, Contacts, Tasks, Events).

**Q: How long does it take for calls to appear?**
A: Usually within 30 seconds of the call ending. It's near real-time!

---

## 📊 Success Metrics

After connecting Salesforce, you'll see:

```
┌────────────────────────────────────────────────────────────────┐
│                   MEASURABLE RESULTS                             │
└────────────────────────────────────────────────────────────────┘

Data Quality:
─────────────
  • 100% of calls automatically logged
  • Zero manual data entry
  • Complete call transcripts saved
  • No missed follow-ups

Time Savings:
─────────────
  • ~5 minutes saved per call (no manual logging)
  • ~10 calls/day = 50 minutes saved daily
  • ~250 calls/month = 20+ hours saved monthly!

Sales Performance:
──────────────────
  • Complete Lead activity history
  • Never miss a scheduled appointment
  • Better follow-up rates
  • Improved customer experience

Visibility:
───────────
  • Real-time call tracking
  • Appointment booking metrics
  • Lead engagement scores
  • Full audit trail

```

---

## 🎉 Get Started

Ready to connect Salesforce?

1. **Ask your Salesforce Admin** to set up the Connected App (takes 10 minutes)
2. **Go to Integrations** in your Voice AI Dashboard
3. **Click "Connect Salesforce"**
4. **Login and Allow**
5. **Done!** Calls start auto-logging immediately

Need help? Contact our support team anytime!

---

*Last Updated: January 2025*
*Voice AI Dashboard - Salesforce Integration*
