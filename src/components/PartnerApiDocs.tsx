import React, { useState } from 'react';
import { Copy, Check, ArrowRight, Zap, Settings, Phone, FileText, MessageSquare } from 'lucide-react';

export default function PartnerApiDocs() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const exampleRequest = `{
  "campaign_id": "a202ba2d-3b6c-4a31-b5b7-32b72b6025b8",
  "phone": "+14155551234",
  "firstname": "John",
  "lastname": "Doe",
  "product": "Bathroom Remodel",
  "notes": "Lives at 123 Main St, San Diego, CA. Prefers morning calls.",
  "lead_source": "Facebook Ad",
  "system_prompt": "You are a friendly sales rep for Jacuzzi Bath Remodel...",
  "first_message": "Hi, is this {firstname}?",
  "callback_url": "https://your-webhook.com/callback"
}`;

  const minimalRequest = `{
  "campaign_id": "your-campaign-id",
  "phone": "+14155551234",
  "firstname": "John"
}`;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Partner API Documentation</h1>
          <p className="text-xl text-gray-400">
            Single endpoint to trigger AI-powered outbound calls with full dynamic control
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" />
            Quick Start
          </h2>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <div className="text-gray-400 mb-2"># Minimal request - uses campaign defaults</div>
            <pre className="text-green-400">{`POST /api/partner/call
Authorization: Bearer sk_live_your_api_key
Content-Type: application/json

${minimalRequest}`}</pre>
          </div>
          <button
            onClick={() => copyToClipboard(minimalRequest, 'minimal')}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
          >
            {copiedSection === 'minimal' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedSection === 'minimal' ? 'Copied!' : 'Copy Example'}
          </button>
        </section>

        {/* How It Works - ASCII Diagram */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-500" />
            How It Works
          </h2>
          
          <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-gray-300">{`
┌─────────────────────────────────────────────────────────────────────────┐
│                        PARTNER API FLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
  │   PARTNER    │         │   YOUR BACKEND   │         │    VAPI.AI   │
  │   SYSTEM     │         │   (Worker API)   │         │   (AI Call)  │
  └──────┬───────┘         └────────┬─────────┘         └──────┬───────┘
         │                          │                          │
         │  POST /api/partner/call  │                          │
         │  {                       │                          │
         │    phone, firstname,     │                          │
         │    system_prompt,        │                          │
         │    first_message...      │                          │
         │  }                       │                          │
         │ ─────────────────────────>                          │
         │                          │                          │
         │                          │  1. Find/Create Lead     │
         │                          │  2. Add to Campaign      │
         │                          │  3. Build AI Prompt      │
         │                          │                          │
         │                          │  POST /call/phone        │
         │                          │  + assistantOverrides    │
         │                          │ ─────────────────────────>
         │                          │                          │
         │                          │      Call Initiated      │
         │                          │ <─────────────────────────
         │                          │                          │
         │    { success: true,      │                          │
         │      vapi_call_id: "..." │                          │
         │    }                     │                          │
         │ <─────────────────────────                          │
         │                          │                          │
         │                          │      ☎️ AI CALLS LEAD     │
         │                          │          │               │
         │                          │          ▼               │
         │                          │    "Hi, is this John?"   │
         │                          │                          │

`}</pre>
          </div>
        </section>

        {/* Priority System */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <ArrowRight className="w-6 h-6 text-purple-500" />
            Priority System
          </h2>
          
          <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm overflow-x-auto mb-6">
            <pre className="text-gray-300">{`
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROMPT PRIORITY (Highest to Lowest)                   │
└─────────────────────────────────────────────────────────────────────────┘

   PRIORITY 1 (API Request)          Used if provided in request body
   ════════════════════════
        │
        │  system_prompt: "You are a sales agent..."
        │  first_message: "Hi {firstname}..."
        │
        ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  ✅ HIGHEST PRIORITY - Overrides everything below                   │
   └─────────────────────────────────────────────────────────────────────┘


   PRIORITY 2 (Campaign Settings)    Used if Priority 1 not provided
   ══════════════════════════════
        │
        │  Campaign.prompt_template
        │  Campaign.first_message_template
        │
        ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  📋 MEDIUM PRIORITY - Configured in dashboard                       │
   └─────────────────────────────────────────────────────────────────────┘


   PRIORITY 3 (VAPI Assistant)       Used if Priority 1 & 2 not provided
   ═══════════════════════════
        │
        │  Assistant.model.messages (system prompt)
        │  Assistant.firstMessage
        │
        ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  🤖 FALLBACK - Default assistant configuration in VAPI              │
   └─────────────────────────────────────────────────────────────────────┘

`}</pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
              <h4 className="font-bold text-green-400 mb-2">API Request</h4>
              <p className="text-sm text-gray-300">Pass system_prompt and first_message in request body for full control per call</p>
            </div>
            <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <h4 className="font-bold text-blue-400 mb-2">Campaign Settings</h4>
              <p className="text-sm text-gray-300">Configure in dashboard - good for consistent scripts across calls</p>
            </div>
            <div className="p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
              <h4 className="font-bold text-purple-400 mb-2">VAPI Assistant</h4>
              <p className="text-sm text-gray-300">Default fallback if nothing else specified</p>
            </div>
          </div>
        </section>

        {/* Data Flow */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <FileText className="w-6 h-6 text-green-500" />
            Data Flow &amp; Context Injection
          </h2>
          
          <div className="bg-gray-900 rounded-lg p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-gray-300">{`
┌─────────────────────────────────────────────────────────────────────────┐
│                    HOW YOUR DATA BECOMES AI CONTEXT                      │
└─────────────────────────────────────────────────────────────────────────┘

  YOUR API REQUEST                      WHAT AI SEES
  ═════════════════                     ════════════

  {                                     ┌───────────────────────────────┐
    "firstname": "John",        ──────> │ Customer Name: John Doe       │
    "lastname": "Doe",                  │                               │
    "product": "Bathroom",      ──────> │ Product Interest: Bathroom    │
    "lead_source": "Facebook",  ──────> │ Lead Source: Facebook         │
    "notes": "Lives in San      ──────> │ Notes: Lives in San Diego,    │
              Diego, prefers            │        prefers mornings       │
              mornings"                 └───────────────────────────────┘
  }                                              │
                                                 │
                                                 ▼
                                    ┌───────────────────────────────────┐
                                    │      APPENDED TO SYSTEM PROMPT    │
                                    │                                   │
                                    │  === CURRENT CALL CONTEXT ===     │
                                    │  Customer Name: John Doe          │
                                    │  Product Interest: Bathroom       │
                                    │  Lead Source: Facebook            │
                                    │  Notes: Lives in San Diego,       │
                                    │         prefers mornings          │
                                    │  === END CONTEXT ===              │
                                    └───────────────────────────────────┘


  PLACEHOLDER REPLACEMENT
  ═══════════════════════

  first_message: "Hi {firstname}!"      ──────>  "Hi John!"
  
  system_prompt: "Selling {product}"    ──────>  "Selling Bathroom"

`}</pre>
          </div>
        </section>

        {/* Request Schema */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-orange-500" />
            Request Schema
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4">Field</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Required</th>
                  <th className="text-left py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                <tr className="bg-gray-900/50">
                  <td className="py-3 px-4 font-mono text-blue-400">campaign_id</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-red-900/50 text-red-400 rounded text-xs">Required</span></td>
                  <td className="py-3 px-4">Pre-created campaign ID</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-blue-400">phone</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-red-900/50 text-red-400 rounded text-xs">Required</span></td>
                  <td className="py-3 px-4">Lead phone (E.164 format: +14155551234)</td>
                </tr>
                <tr className="bg-gray-900/50">
                  <td className="py-3 px-4 font-mono text-green-400">firstname</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Optional</span></td>
                  <td className="py-3 px-4">Used in {'{firstname}'} placeholder</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-green-400">lastname</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Optional</span></td>
                  <td className="py-3 px-4">Used in {'{lastname}'} placeholder</td>
                </tr>
                <tr className="bg-gray-900/50">
                  <td className="py-3 px-4 font-mono text-green-400">product</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Optional</span></td>
                  <td className="py-3 px-4">Used in {'{product}'} placeholder</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-green-400">notes</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Optional</span></td>
                  <td className="py-3 px-4">Flexible context (address, preferences, etc.)</td>
                </tr>
                <tr className="bg-gray-900/50">
                  <td className="py-3 px-4 font-mono text-green-400">lead_source</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Optional</span></td>
                  <td className="py-3 px-4">Where the lead came from</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-green-400">email</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Optional</span></td>
                  <td className="py-3 px-4">Lead email address</td>
                </tr>
                <tr className="bg-purple-900/20">
                  <td className="py-3 px-4 font-mono text-purple-400">system_prompt</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-purple-900/50 text-purple-400 rounded text-xs">Dynamic</span></td>
                  <td className="py-3 px-4">Override AI system prompt (highest priority)</td>
                </tr>
                <tr className="bg-purple-900/20">
                  <td className="py-3 px-4 font-mono text-purple-400">first_message</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-purple-900/50 text-purple-400 rounded text-xs">Dynamic</span></td>
                  <td className="py-3 px-4">Override first message (highest priority)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-green-400">callback_url</td>
                  <td className="py-3 px-4">string</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Optional</span></td>
                  <td className="py-3 px-4">Webhook URL for call results</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Full Example */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Phone className="w-6 h-6 text-cyan-500" />
            Full Example Request
          </h2>
          
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre className="text-green-400">{exampleRequest}</pre>
          </div>
          <button
            onClick={() => copyToClipboard(exampleRequest, 'full')}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
          >
            {copiedSection === 'full' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedSection === 'full' ? 'Copied!' : 'Copy Full Example'}
          </button>
        </section>

        {/* Response */}
        <section className="mb-12 p-6 bg-gray-800 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-bold mb-4">Response</h2>
          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
            <pre className="text-blue-400">{`{
  "success": true,
  "lead_id": "abc123-def456",
  "lead_created": true,
  "campaign_lead_id": "xyz789",
  "vapi_call_id": "call_abc123",
  "call_status": "initiated",
  "message": "Call initiated successfully"
}`}</pre>
          </div>
        </section>

        {/* Tips */}
        <section className="p-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-700">
          <h2 className="text-2xl font-bold mb-4">Pro Tips</h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>Use notes for dynamic context</strong> - Address, preferences, prior conversations go here</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>Keep system_prompt static</strong> - Same script for all calls of a type</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>first_message should be short</strong> - Just the greeting, AI waits for response</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>Don't repeat greeting in system_prompt</strong> - first_message handles it</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-400 mt-1">✓</span>
              <span><strong>Placeholders work everywhere</strong> - {'{firstname}'}, {'{product}'}, {'{notes}'} in both prompt fields</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
