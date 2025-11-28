# Voice AI Performance & Configuration Dashboard

A comprehensive dashboard for managing and monitoring Voice AI agents powered by VAPI (CHAU Voice Engine). Built with React, TypeScript, and Cloudflare Workers.

## 🚀 Features

### Voice Agent Management
- **Create Voice AI Agents**: Build and configure agents directly from the dashboard
- **Agent Configuration**: Set system prompts, voice settings, model selection, and behavior
- **Voice Testing**: Test your agents before deployment with live voice interaction
- **Multiple Agents**: Create unlimited agents for different use cases

### Phone Number Management
- **Create Free Numbers**: Get up to 10 free US phone numbers by area code
- **Import from Twilio**: One-click import of existing Twilio numbers
- **Agent Assignment**: Link specific agents to phone numbers for automatic routing
- **Real-time Status**: Monitor number activation and assignment status

### Live Call Monitoring
- **Active Calls Feed**: Real-time view of all ongoing calls
- **Sound Alerts**: Audio notifications when new calls arrive
- **Browser Notifications**: Desktop notifications for incoming calls
- **Call Controls**: End or transfer calls directly from the dashboard
- **Caller Information**: View caller ID, carrier, and line type via Twilio Lookup

### Performance Analytics
- **Real-time Metrics**: Track call volume, duration, and success rates
- **Concurrent Calls**: Monitor current and peak concurrent calls
- **Call End Reasons**: Analyze why calls end (customer hangup, error, etc.)
- **Historical Trends**: View performance over time with customizable date ranges
- **Agent Performance**: Compare metrics across different agents

### Intent & Sentiment Analysis
- **Keyword Extraction**: Automatically detect keywords from call transcripts
- **Intent Detection**: Understand what customers are calling about
- **Sentiment Analysis**: Track positive, neutral, and negative interactions
- **Heat Maps**: Visualize keyword frequency and sentiment distribution

### Call Recordings
- **Transcript Viewer**: Read full call transcripts with timestamps
- **Audio Playback**: Listen to call recordings directly in the dashboard
- **Search & Filter**: Find specific calls by date, status, or content
- **Categorization**: Organize calls by type (sales, support, missed)

### Advanced Features
- **Voice Engine Caching**: 3-5x faster dashboard loads with intelligent caching
- **Dark Mode**: Full dark mode support with system preference detection
- **Multi-user Support**: Secure authentication with user isolation
- **Admin Dashboard**: User management and system overview (admin only)
- **Webhook Integration**: Real-time call event processing

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for blazing-fast builds
- **Tailwind CSS** for styling
- **Lucide React** for icons
- Custom-built components (no heavy UI libraries)

### Backend
- **Cloudflare Workers** for serverless API
- **Cloudflare D1** (SQLite) for database
- **VAPI/CHAU Voice Engine** integration
- **Twilio** for phone number management and caller ID
- JWT authentication with bcrypt password hashing

## 📦 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "Voice AI Performance & Config Dashboard"
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create .env file
VITE_D1_API_URL=your_worker_url
```

4. Set up Cloudflare Workers:
```bash
cd workers
npm install
wrangler d1 create voice-ai-db
wrangler d1 execute voice-ai-db --file=schema.sql
```

5. Deploy the worker:
```bash
wrangler deploy
```

6. Start the development server:
```bash
npm run dev
```

## 🔧 Configuration

### VAPI/CHAU Voice Engine Setup
1. Get your VAPI API key from the [VAPI Dashboard](https://dashboard.vapi.ai)
2. Go to Settings → API Configuration
3. Enter your Private Key
4. Optionally configure Twilio for phone numbers

### Twilio Integration (Optional)
1. Get Twilio credentials from [Twilio Console](https://console.twilio.com)
2. In Settings, add:
   - Account SID
   - Auth Token
3. Now you can import Twilio numbers and get caller ID

## 📱 Usage

### Creating Your First Agent
1. Click **Voice Agents** in the navigation
2. Click **Create New Agent**
3. Configure:
   - Name and description
   - System prompt (agent's personality and instructions)
   - Voice settings (provider, voice ID, speed)
   - Model selection (GPT-4, Claude, etc.)
4. Click **Create Agent**

### Setting Up Phone Numbers
1. Go to **Phone Numbers** tab
2. Choose one of:
   - **Create Number**: Enter a 3-digit US area code (e.g., 415)
   - **Import from Twilio**: Select from your existing numbers
3. Assign an agent to the number using the dropdown
4. Start receiving calls!

### Monitoring Calls
1. Active calls appear automatically in the dashboard
2. Click **End Call** to terminate a call
3. Click **Transfer** to forward a call to another number
4. View full history in **Call Recordings**

### Analyzing Performance
1. Use the date range selector to view specific periods
2. View metrics like:
   - Total calls
   - Average duration
   - Success rate
   - Concurrent calls
3. Check **Intent Analysis** for customer insights

## 🎨 Design System

This project follows a custom design system documented in `CLAUDE.md`. Key principles:
- Lightweight, custom-built components
- Consistent color palette with dark mode support
- Reusable component patterns
- Mobile-first responsive design

## 🔐 Security

- JWT-based authentication
- Bcrypt password hashing
- User data isolation in database
- CORS protection
- Environment variable protection

## 📊 Database Schema

The application uses Cloudflare D1 (SQLite) with tables for:
- Users and sessions
- User settings (API keys)
- Voice agents (cached)
- Webhooks and webhook calls
- Active calls tracking
- Keywords and analytics
- Phone number assignments

## 🚀 Recent Updates (January 2025)

### New Features
- ✅ Voice agent creation UI
- ✅ Phone number management (create & import)
- ✅ Smart agent-to-number assignment
- ✅ Voice engine caching (3-5x faster)
- ✅ Live call alerts with sound
- ✅ Manual call control (end/transfer)
- ✅ Concurrent calls analytics
- ✅ Keyword extraction from transcripts
- ✅ Intent analysis dashboard
- ✅ Twilio caller ID integration

### API Endpoints Added
- `POST /api/vapi/phone-number` - Create phone number
- `POST /api/vapi/import-twilio` - Import Twilio number
- `GET /api/active-calls` - Get active calls
- `POST /api/calls/:id/end` - End call
- `POST /api/calls/:id/transfer` - Transfer call
- `GET /api/concurrent-calls` - Concurrent call metrics
- `GET /api/keywords` - Keyword analysis

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.

## 📄 License

Proprietary - Channel Automation

## 🔗 Links

- [VAPI Documentation](https://docs.vapi.ai)
- [Twilio Documentation](https://www.twilio.com/docs)
- [Cloudflare Workers](https://workers.cloudflare.com)
- [Channel Automation](https://channelautomation.com)

---

**Built with ❤️ by Channel Automation**
