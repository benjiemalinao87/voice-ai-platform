import React, { useState } from 'react';
import { Copy, Check, Phone, User, Bot, ArrowRight, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function WarmTransferDocs() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const initiateExample = `// Initiate warm transfer
POST /api/calls/{callId}/warm-transfer
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "agentNumber": "+14155551234",
  "announcement": "Incoming transfer from AI. Customer John is asking about pricing for the Enterprise plan. They seem interested but have budget concerns."
}`;

  const statusExample = `// Check transfer status
GET /api/calls/{callId}/warm-transfer-status
Authorization: Bearer YOUR_API_KEY

// Response
{
  "transferId": "wt_abc123",
  "status": "agent_answered",
  "agentNumber": "+14155551234",
  "announcement": "Incoming transfer...",
  "createdAt": "2024-12-08T10:30:00Z"
}`;

  const cancelExample = `// Cancel an in-progress transfer
POST /api/calls/{callId}/warm-transfer-cancel
Authorization: Bearer YOUR_API_KEY

// Response
{
  "success": true,
  "message": "Warm transfer cancelled"
}`;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-600 rounded-xl">
              <Phone className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Warm Transfer Documentation</h1>
              <p className="text-gray-400">Hand off calls from AI to human agents with context</p>
            </div>
          </div>
        </div>

        {/* What is Warm Transfer */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-4">What is Warm Transfer?</h2>
          <p className="text-gray-300 mb-4">
            Unlike a <strong>cold transfer</strong> (immediately connect customer to agent), a <strong>warm transfer</strong> 
            first calls the agent, plays an announcement with context about the customer, and <em>then</em> connects 
            the customer. This gives the agent time to prepare.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <h4 className="font-bold text-red-400 mb-2">❄️ Cold Transfer</h4>
              <p className="text-sm text-gray-400">Customer → Agent (no context)</p>
              <p className="text-xs text-gray-500 mt-2">"Hello? Who is this?"</p>
            </div>
            <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg">
              <h4 className="font-bold text-green-400 mb-2">🔥 Warm Transfer</h4>
              <p className="text-sm text-gray-400">AI → Agent (with context) → Customer</p>
              <p className="text-xs text-gray-500 mt-2">"Hi John! I understand you have questions about pricing..."</p>
            </div>
          </div>
        </section>

        {/* Main Flow Diagram */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6">The Complete Flow</h2>
          
          <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-gray-300">{`
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           WARM TRANSFER FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

  PHASE 1: CUSTOMER IS TALKING TO AI
  ═══════════════════════════════════

      ┌──────────────┐                    ┌──────────────┐
      │   CUSTOMER   │ ←───── call ─────→ │    AI BOT    │
      │   "I need    │                    │  "Let me     │
      │   to speak   │                    │   connect    │
      │   to someone"│                    │   you..."    │
      └──────────────┘                    └──────┬───────┘
                                                 │
                                                 │ Trigger: AI detects
                                                 │ need for human
                                                 ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  POST /api/calls/{callId}/warm-transfer                                      │
  │  { "agentNumber": "+1...", "announcement": "Customer John asking about..." } │
  └─────────────────────────────────────────────────────────────────────────────┘


  PHASE 2: SYSTEM DIALS AGENT
  ═══════════════════════════

      ┌──────────────┐                    ┌──────────────┐     ┌──────────────┐
      │   CUSTOMER   │ ←── on hold ────→  │   SYSTEM     │ ──→ │    AGENT     │
      │   (waiting)  │                    │  (dialing)   │     │  (ringing)   │
      └──────────────┘                    └──────────────┘     └──────────────┘
                                                 │
                                          Status: dialing_agent


  PHASE 3: AGENT ANSWERS & HEARS CONTEXT
  ══════════════════════════════════════

      ┌──────────────┐                    ┌──────────────┐     ┌──────────────┐
      │   CUSTOMER   │                    │   SYSTEM     │ ──→ │    AGENT     │
      │   (waiting)  │                    │  (playing    │     │  (listening) │
      │              │                    │   message)   │     │              │
      └──────────────┘                    └──────────────┘     └──────────────┘
                                                 │
                                                 │  🔊 "Incoming transfer from AI.
                                                 │      Customer John is asking
                                                 │      about pricing..."
                                                 │
                                          Status: agent_answered


  PHASE 4: CUSTOMER CONNECTED TO AGENT
  ════════════════════════════════════

      ┌──────────────┐                                        ┌──────────────┐
      │   CUSTOMER   │ ←──────────── connected ─────────────→ │    AGENT     │
      │   "Hi, I     │                                        │  "Hi John!   │
      │   was just   │                                        │   I heard    │
      │   talking..."│                                        │   you have   │
      └──────────────┘                                        │   questions" │
                                                              └──────────────┘
                                                 │
                                          Status: connected
                                          ✅ TRANSFER COMPLETE

`}</pre>
          </div>
        </section>

        {/* State Machine */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6">Transfer States</h2>
          
          <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm overflow-x-auto mb-6">
            <pre className="text-gray-300">{`
                              STATE MACHINE
  ════════════════════════════════════════════════════════════

                         ┌───────────────┐
                         │   initiated   │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                    ┌────│ dialing_agent │────┐
                    │    └───────┬───────┘    │
                    │            │            │
              (no answer)   (answered)   (cancelled)
                    │            │            │
                    ▼            ▼            ▼
              ┌──────────┐ ┌───────────────┐ ┌───────────┐
              │  failed  │ │ agent_answered│ │ cancelled │
              └──────────┘ └───────┬───────┘ └───────────┘
                                   │
                           (announcement done)
                                   │
                           ┌───────┴───────┐
                           │               │
                      (success)       (call ended)
                           │               │
                           ▼               ▼
                    ┌───────────┐    ┌──────────┐
                    │ connected │    │  failed  │
                    └───────────┘    └──────────┘

`}</pre>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="p-3 bg-gray-700/50 rounded-lg flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-sm font-medium">initiated</p>
                <p className="text-xs text-gray-500">Transfer created</p>
              </div>
            </div>
            <div className="p-3 bg-gray-700/50 rounded-lg flex items-center gap-2">
              <Phone className="w-4 h-4 text-yellow-400" />
              <div>
                <p className="text-sm font-medium">dialing_agent</p>
                <p className="text-xs text-gray-500">Calling agent</p>
              </div>
            </div>
            <div className="p-3 bg-gray-700/50 rounded-lg flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-sm font-medium">agent_answered</p>
                <p className="text-xs text-gray-500">Hearing context</p>
              </div>
            </div>
            <div className="p-3 bg-green-900/30 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <div>
                <p className="text-sm font-medium text-green-400">connected</p>
                <p className="text-xs text-gray-500">Success!</p>
              </div>
            </div>
            <div className="p-3 bg-red-900/30 rounded-lg flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-400">failed</p>
                <p className="text-xs text-gray-500">Error occurred</p>
              </div>
            </div>
            <div className="p-3 bg-gray-700/50 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium">cancelled</p>
                <p className="text-xs text-gray-500">User cancelled</p>
              </div>
            </div>
          </div>
        </section>

        {/* API Reference */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6">API Reference</h2>

          {/* Initiate */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded border border-blue-500/30">
                POST
              </span>
              <code className="text-gray-300">/api/calls/:callId/warm-transfer</code>
            </div>
            <p className="text-gray-400 text-sm mb-4">Initiate a warm transfer to a human agent</p>
            
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3">Field</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Required</th>
                    <th className="text-left py-2 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  <tr>
                    <td className="py-2 px-3 font-mono text-blue-400">agentNumber</td>
                    <td className="py-2 px-3">string</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 bg-red-900/50 text-red-400 rounded text-xs">Required</span></td>
                    <td className="py-2 px-3 text-gray-400">Agent's phone number (E.164)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-green-400">announcement</td>
                    <td className="py-2 px-3">string</td>
                    <td className="py-2 px-3"><span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">Optional</span></td>
                    <td className="py-2 px-3 text-gray-400">Message played to agent before connection</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-green-400">{initiateExample}</pre>
            </div>
            <button
              onClick={() => copyToClipboard(initiateExample, 'initiate')}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              {copiedSection === 'initiate' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedSection === 'initiate' ? 'Copied!' : 'Copy Example'}
            </button>
          </div>

          {/* Status */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded border border-emerald-500/30">
                GET
              </span>
              <code className="text-gray-300">/api/calls/:callId/warm-transfer-status</code>
            </div>
            <p className="text-gray-400 text-sm mb-4">Poll this endpoint to track transfer progress</p>
            
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-green-400">{statusExample}</pre>
            </div>
            <button
              onClick={() => copyToClipboard(statusExample, 'status')}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              {copiedSection === 'status' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedSection === 'status' ? 'Copied!' : 'Copy Example'}
            </button>
          </div>

          {/* Cancel */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded border border-blue-500/30">
                POST
              </span>
              <code className="text-gray-300">/api/calls/:callId/warm-transfer-cancel</code>
            </div>
            <p className="text-gray-400 text-sm mb-4">Cancel an in-progress transfer (before agent is connected)</p>
            
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre className="text-green-400">{cancelExample}</pre>
            </div>
            <button
              onClick={() => copyToClipboard(cancelExample, 'cancel')}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              {copiedSection === 'cancel' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedSection === 'cancel' ? 'Copied!' : 'Copy Example'}
            </button>
          </div>
        </section>

        {/* Sequence Diagram */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6">Sequence Diagram</h2>
          
          <div className="bg-gray-900 rounded-lg p-6 font-mono text-xs overflow-x-auto">
            <pre className="text-gray-300">{`
┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│Frontend│     │ Worker │     │ Twilio │     │  VAPI  │     │ Agent  │
└───┬────┘     └───┬────┘     └───┬────┘     └───┬────┘     └───┬────┘
    │              │              │              │              │
    │ POST /warm-transfer         │              │              │
    │─────────────>│              │              │              │
    │              │              │              │              │
    │              │ Create transfer record      │              │
    │              │──────┐      │              │              │
    │              │      │      │              │              │
    │              │<─────┘      │              │              │
    │              │              │              │              │
    │              │ Make call to agent         │              │
    │              │─────────────>│              │              │
    │              │              │              │              │
    │              │              │ Ring agent   │              │
    │              │              │─────────────────────────────>│
    │              │              │              │              │
    │ { status: "dialing_agent" }│              │              │
    │<─────────────│              │              │              │
    │              │              │              │              │
    │              │              │ Agent answers│              │
    │              │              │<─────────────────────────────│
    │              │              │              │              │
    │              │ Webhook: answered          │              │
    │              │<─────────────│              │              │
    │              │              │              │              │
    │              │              │ Play TwiML announcement     │
    │              │              │─────────────────────────────>│
    │              │              │              │  🔊 "Incoming│
    │              │              │              │   transfer..." 
    │              │              │              │              │
    │              │              │ Call completed (announcement done)
    │              │<─────────────│              │              │
    │              │              │              │              │
    │              │ GET call details           │              │
    │              │────────────────────────────>│              │
    │              │              │              │              │
    │              │ { controlUrl: "..." }      │              │
    │              │<────────────────────────────│              │
    │              │              │              │              │
    │              │ POST transfer to agent     │              │
    │              │────────────────────────────>│              │
    │              │              │              │              │
    │              │              │              │ Transfer call│
    │              │              │              │─────────────>│
    │              │              │              │              │
    │              │              │    CUSTOMER <──────────────>│ AGENT
    │              │              │              │   CONNECTED! │
    │              │              │              │              │
┌───┴────┐     ┌───┴────┐     ┌───┴────┐     ┌───┴────┐     ┌───┴────┐
│Frontend│     │ Worker │     │ Twilio │     │  VAPI  │     │ Agent  │
└────────┘     └────────┘     └────────┘     └────────┘     └────────┘

`}</pre>
          </div>
        </section>

        {/* Error Scenarios */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6">Error Scenarios</h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <h4 className="font-bold text-red-400 mb-2">Agent Doesn't Answer</h4>
              <p className="text-sm text-gray-400 mb-2">Status: <code className="bg-gray-800 px-1 rounded">failed</code> with message "Agent no-answer"</p>
              <p className="text-xs text-gray-500">Customer stays on original call with AI. Retry with different agent or fallback to voicemail.</p>
            </div>
            
            <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <h4 className="font-bold text-red-400 mb-2">Agent Line Busy</h4>
              <p className="text-sm text-gray-400 mb-2">Status: <code className="bg-gray-800 px-1 rounded">failed</code> with message "Agent busy"</p>
              <p className="text-xs text-gray-500">Try another agent or ask customer to call back.</p>
            </div>
            
            <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
              <h4 className="font-bold text-red-400 mb-2">Customer Hangs Up During Transfer</h4>
              <p className="text-sm text-gray-400 mb-2">Status: <code className="bg-gray-800 px-1 rounded">failed</code> with message "Original call ended before transfer"</p>
              <p className="text-xs text-gray-500">Transfer cannot complete. Log for callback.</p>
            </div>
            
            <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
              <h4 className="font-bold text-yellow-400 mb-2">User Cancels Transfer</h4>
              <p className="text-sm text-gray-400 mb-2">Status: <code className="bg-gray-800 px-1 rounded">cancelled</code></p>
              <p className="text-xs text-gray-500">Agent call is terminated. Customer continues with AI.</p>
            </div>
          </div>
        </section>

        {/* Best Practices */}
        <section className="p-6 bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-xl border border-orange-700">
          <h2 className="text-2xl font-bold mb-4">Best Practices</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>Keep announcements brief</strong> - 10-15 seconds max. Agent is waiting to help.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>Include key context</strong> - Customer name, topic, sentiment, any special needs.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>Poll status endpoint</strong> - Update UI to show transfer progress to supervisor.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>Have fallback agents</strong> - If primary agent doesn't answer, try backup.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>Tell customer what's happening</strong> - AI should say "Connecting you now, one moment..."</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow-400 mt-1">⚠</span>
              <span><strong>Don't include sensitive data</strong> - Don't put SSN, credit cards in announcement.</span>
            </li>
          </ul>
        </section>

        {/* Back link */}
        <div className="mt-8 text-center">
          <a href="/api-docs" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Back to API Documentation
          </a>
        </div>
      </div>
    </div>
  );
}
