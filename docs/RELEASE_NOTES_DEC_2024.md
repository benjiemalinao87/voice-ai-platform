# 🚀 What's New in CHAU Voice Engine!

**Release Date:** December 4, 2024

Hey team! 👋 Quick update on some awesome improvements we just shipped:

---

## 1️⃣ Auto Warm Transfer 🔥

The AI can now *automatically* transfer calls to your sales team when it detects buying intent — no dashboard babysitting required!

```
Customer: "I'd like to get a quote"
AI: 🧠 *detects sales opportunity*
System: *auto-dials agent list until someone answers*
Result: Hot lead connected in seconds!
```

### What's cool:
- ✅ Configure your agent list + priority order in the UI
- ✅ Set ring timeout per agent (default: 30s)
- ✅ Custom announcement plays to agent before transfer
- ✅ Full audit log of every dial attempt
- ✅ Works 24/7 — never miss a hot lead again

### How it works:

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTO WARM TRANSFER FLOW                  │
└─────────────────────────────────────────────────────────────┘

  Customer          AI Assistant                    Sales Team
     │                   │                              │
     │  "I want to buy"  │                              │
     │──────────────────►│                              │
     │                   │                              │
     │                   │  🧠 Detects sales intent     │
     │                   │  Calls transfer_to_sales()   │
     │                   │                              │
     │                   │  ┌────────────────────────┐  │
     │                   │  │   AUTO-DIAL SEQUENCE   │  │
     │                   │  │  Agent 1 → No answer   │  │
     │                   │  │  Agent 2 → No answer   │  │
     │                   │  │  Agent 3 → ANSWERED! ✅│  │
     │                   │  └────────────────────────┘  │
     │                   │                              │
     │◄─────────────────────────────────────────────────│
     │           Connected to Agent 3! 🎉              │
```

### Where to configure:
**Dashboard → Agent Config → Transfer Settings**

---

## 2️⃣ WebSockets Replace Polling 🚀

Live Call Feed is now *actually* live!

| Before | After |
|--------|-------|
| Polling API every 2 seconds | WebSocket with Durable Objects |
| 15k+ requests/day 😬 | Instant updates |
| Up to 2s delay | Real-time! |
| High D1 load | 90% less requests 🎉 |

Your dashboard now updates the **moment** call status changes — no more waiting!

### Technical details:
- Cloudflare Durable Objects manage WebSocket connections
- Automatic fallback to polling if WebSocket fails
- Per-user/workspace isolation
- Hibernation support for cost efficiency

---

## 3️⃣ Other Improvements 🛠️

### White-Label Polish
- Removed all third-party branding from error messages
- Clean, professional experience for your customers

### Call Metrics Fix
- **Problem:** Webhook events were inflating call counts (mid-call events counted as separate calls!)
- **Fix:** Now only `end-of-call-report` events create call records
- **Impact:** Accurate metrics for your clients

### AI Flow Creator Enhancements
- Right-click context menus to add nodes
- Live speech indicators during flow visualization
- Better template categories with pagination
- AI chat sidebar moved to left side

### Password Reset
- Now using SendGrid for reliable email delivery
- Secure token-based reset flow

### Performance
- Intent Analysis cache TTL: 2min → 5min
- Dashboard loading: Reduced API calls from 16 to 7
- Removed excessive logging in appointments API

---

## Coming Soon 🔮

- Transfer success rate analytics
- Agent availability scheduling
- Multi-language support for announcements

---

## Questions?

Ping the dev team or check out these docs:
- [Auto Warm Transfer Plan](./AUTO_WARM_TRANSFER_PLAN.md)
- [Warm Transfer Quick Start](./WARM_TRANSFER_QUICKSTART.md)
- [Warm Transfer Marketing](./WARM_TRANSFER_MARKETING.md)

---

*Built with ❤️ by the CHAU Voice Engine team*


