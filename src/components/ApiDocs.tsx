import { useState } from 'react';
import {
  Book,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Search,
  Shield,
  Zap,
  Phone,
  Users,
  Webhook,
  BarChart3,
  Settings,
  Key,
  MessageSquare,
  Globe,
  Database,
  FileText,
  Clock,
  Bot,
  Building2
} from 'lucide-react';

const BASE_URL = 'https://api.voice-config.channelautomation.com';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: boolean;
  params?: { name: string; type: string; required: boolean; description: string }[];
  body?: { name: string; type: string; required: boolean; description: string }[];
  response?: string;
}

interface ApiSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  endpoints: Endpoint[];
}

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  PATCH: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const apiSections: ApiSection[] = [
  {
    id: 'assistants',
    title: 'Voice Assistants',
    icon: <Bot className="w-5 h-5" />,
    description: 'Create and manage AI voice assistants',
    endpoints: [
      {
        method: 'GET',
        path: '/api/assistants',
        description: 'List all voice assistants',
        auth: true,
        params: [
          { name: 'limit', type: 'number', required: false, description: 'Number of results (default: 50)' },
          { name: 'offset', type: 'number', required: false, description: 'Pagination offset' },
        ],
        response: '{ "assistants": [...], "total": 10 }',
      },
      {
        method: 'POST',
        path: '/api/assistants',
        description: 'Create a new voice assistant',
        auth: true,
        body: [
          { name: 'name', type: 'string', required: true, description: 'Assistant name' },
          { name: 'model', type: 'object', required: true, description: 'LLM model configuration' },
          { name: 'voice', type: 'object', required: true, description: 'Voice provider configuration' },
          { name: 'firstMessage', type: 'string', required: false, description: 'Initial greeting message' },
        ],
        response: '{ "assistant": { "id": "...", "name": "..." } }',
      },
      {
        method: 'GET',
        path: '/api/assistants/:id',
        description: 'Get assistant details by ID',
        auth: true,
        response: '{ "assistant": { "id": "...", "name": "...", "model": {...}, "voice": {...} } }',
      },
      {
        method: 'PATCH',
        path: '/api/assistants/:id',
        description: 'Update an existing assistant',
        auth: true,
        body: [
          { name: 'name', type: 'string', required: false, description: 'Updated name' },
          { name: 'model', type: 'object', required: false, description: 'Updated model config' },
          { name: 'voice', type: 'object', required: false, description: 'Updated voice config' },
        ],
        response: '{ "success": true, "assistant": {...} }',
      },
      {
        method: 'DELETE',
        path: '/api/assistants/:id',
        description: 'Delete an assistant',
        auth: true,
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: 'calls',
    title: 'Call Management',
    icon: <Phone className="w-5 h-5" />,
    description: 'Monitor and control live voice calls',
    endpoints: [
      {
        method: 'GET',
        path: '/api/active-calls',
        description: 'Get list of currently active calls',
        auth: true,
        response: '{ "calls": [{ "id": "...", "status": "in-progress", "customer_number": "..." }] }',
      },
      {
        method: 'GET',
        path: '/api/active-calls/ws',
        description: 'WebSocket connection for real-time call updates',
        auth: true,
        response: 'WebSocket connection upgrade',
      },
      {
        method: 'GET',
        path: '/api/calls/:id/listen',
        description: 'Get live audio stream URL for a call',
        auth: true,
        response: '{ "listenUrl": "wss://..." }',
      },
      {
        method: 'POST',
        path: '/api/calls/:id/control/say',
        description: 'Speak a message into an active call',
        auth: true,
        body: [
          { name: 'message', type: 'string', required: true, description: 'Message to speak' },
        ],
        response: '{ "success": true }',
      },
      {
        method: 'POST',
        path: '/api/calls/:id/end',
        description: 'End an active call',
        auth: true,
        response: '{ "success": true }',
      },
      {
        method: 'POST',
        path: '/api/calls/:id/transfer',
        description: 'Cold transfer call to another number',
        auth: true,
        body: [
          { name: 'destination', type: 'string', required: true, description: 'Phone number to transfer to' },
        ],
        response: '{ "success": true }',
      },
      {
        method: 'POST',
        path: '/api/calls/:id/warm-transfer',
        description: 'Initiate warm transfer with announcement',
        auth: true,
        body: [
          { name: 'agentNumber', type: 'string', required: true, description: 'Agent phone number' },
          { name: 'announcement', type: 'string', required: false, description: 'Announcement to agent' },
        ],
        response: '{ "success": true, "transferId": "..." }',
      },
    ],
  },
  {
    id: 'campaigns',
    title: 'Outbound Campaigns',
    icon: <Zap className="w-5 h-5" />,
    description: 'Manage outbound calling campaigns',
    endpoints: [
      {
        method: 'GET',
        path: '/api/campaigns',
        description: 'List all outbound campaigns',
        auth: true,
        response: '{ "campaigns": [...] }',
      },
      {
        method: 'POST',
        path: '/api/campaigns',
        description: 'Create a new outbound campaign',
        auth: true,
        body: [
          { name: 'name', type: 'string', required: true, description: 'Campaign name' },
          { name: 'assistant_id', type: 'string', required: true, description: 'Voice assistant ID' },
          { name: 'phone_number_id', type: 'string', required: true, description: 'Outbound phone number ID' },
          { name: 'max_concurrent_calls', type: 'number', required: false, description: 'Max parallel calls (default: 1)' },
        ],
        response: '{ "campaign": { "id": "...", "name": "..." } }',
      },
      {
        method: 'GET',
        path: '/api/campaigns/:id',
        description: 'Get campaign details',
        auth: true,
        response: '{ "campaign": {...}, "stats": { "total": 100, "completed": 50 } }',
      },
      {
        method: 'POST',
        path: '/api/campaigns/:id/leads',
        description: 'Add leads to campaign',
        auth: true,
        body: [
          { name: 'lead_ids', type: 'string[]', required: true, description: 'Array of lead IDs to add' },
        ],
        response: '{ "success": true, "added": 10 }',
      },
      {
        method: 'POST',
        path: '/api/campaigns/:id/start',
        description: 'Start the campaign',
        auth: true,
        response: '{ "success": true, "status": "running" }',
      },
      {
        method: 'POST',
        path: '/api/campaigns/:id/pause',
        description: 'Pause the campaign',
        auth: true,
        response: '{ "success": true, "status": "paused" }',
      },
      {
        method: 'POST',
        path: '/api/campaigns/:id/cancel',
        description: 'Cancel the campaign',
        auth: true,
        response: '{ "success": true, "status": "cancelled" }',
      },
    ],
  },
  {
    id: 'partner',
    title: 'Partner Integration',
    icon: <Building2 className="w-5 h-5" />,
    description: 'Single endpoint for external partners to trigger AI calls',
    endpoints: [
      {
        method: 'POST',
        path: '/api/partner/call',
        description: 'Create/find lead, add to campaign, and initiate AI call in one request',
        auth: true,
        body: [
          { name: 'campaign_id', type: 'string', required: true, description: 'Pre-created campaign ID (uses campaign\'s assistant & phone number)' },
          { name: 'phone', type: 'string', required: true, description: 'Lead phone number (E.164 format)' },
          { name: 'assistant_id', type: 'string', required: false, description: 'Override campaign\'s VAPI assistant ID' },
          { name: 'phone_number_id', type: 'string', required: false, description: 'Override campaign\'s VAPI phone number ID' },
          { name: 'firstname', type: 'string', required: false, description: 'Lead first name - used in {firstname} template' },
          { name: 'lastname', type: 'string', required: false, description: 'Lead last name - used in {lastname} template' },
          { name: 'email', type: 'string', required: false, description: 'Lead email - used in {email} template' },
          { name: 'product', type: 'string', required: false, description: 'Product interest - used in {product} template' },
          { name: 'lead_source', type: 'string', required: false, description: 'Lead source - used in {lead_source} template' },
          { name: 'notes', type: 'string', required: false, description: 'Additional context (flexible field) - used in {notes} template and injected into AI context' },
          { name: 'callback_url', type: 'string', required: false, description: 'Webhook URL to receive call result when complete' },
        ],
        response: '{ "success": true, "lead_id": "...", "lead_created": true, "campaign_lead_id": "...", "vapi_call_id": "...", "call_status": "initiated" }',
      },
    ],
  },
  {
    id: 'leads',
    title: 'Leads',
    icon: <Users className="w-5 h-5" />,
    description: 'Manage leads for outbound campaigns',
    endpoints: [
      {
        method: 'GET',
        path: '/api/leads',
        description: 'List all leads',
        auth: true,
        params: [
          { name: 'status', type: 'string', required: false, description: 'Filter by status (new, called, completed, failed)' },
          { name: 'limit', type: 'number', required: false, description: 'Results per page (default: 50)' },
          { name: 'offset', type: 'number', required: false, description: 'Pagination offset' },
        ],
        response: '{ "leads": [...], "total": 100 }',
      },
      {
        method: 'POST',
        path: '/api/leads',
        description: 'Create a single lead',
        auth: true,
        body: [
          { name: 'first_name', type: 'string', required: true, description: 'Lead first name' },
          { name: 'last_name', type: 'string', required: false, description: 'Lead last name' },
          { name: 'phone', type: 'string', required: true, description: 'Phone number (E.164 format)' },
          { name: 'email', type: 'string', required: false, description: 'Email address' },
          { name: 'notes', type: 'string', required: false, description: 'Additional notes' },
        ],
        response: '{ "lead": { "id": "...", "first_name": "...", "phone": "..." } }',
      },
      {
        method: 'POST',
        path: '/api/leads/upload',
        description: 'Bulk upload leads via CSV',
        auth: true,
        body: [
          { name: 'file', type: 'file', required: true, description: 'CSV file with leads data' },
        ],
        response: '{ "success": true, "imported": 100, "failed": 2 }',
      },
      {
        method: 'PATCH',
        path: '/api/leads/:id',
        description: 'Update a lead',
        auth: true,
        response: '{ "success": true, "lead": {...} }',
      },
      {
        method: 'DELETE',
        path: '/api/leads/:id',
        description: 'Delete a lead',
        auth: true,
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    icon: <Webhook className="w-5 h-5" />,
    description: 'Configure incoming and outgoing webhooks',
    endpoints: [
      {
        method: 'GET',
        path: '/api/webhooks',
        description: 'List all inbound webhooks',
        auth: true,
        response: '{ "webhooks": [{ "id": "...", "url": "..." }] }',
      },
      {
        method: 'POST',
        path: '/api/webhooks',
        description: 'Create a new inbound webhook endpoint',
        auth: true,
        body: [
          { name: 'name', type: 'string', required: true, description: 'Webhook name' },
        ],
        response: '{ "webhook": { "id": "...", "url": "https://api.voice-config.channelautomation.com/webhook/..." } }',
      },
      {
        method: 'DELETE',
        path: '/api/webhooks/:id',
        description: 'Delete a webhook',
        auth: true,
        response: '{ "success": true }',
      },
      {
        method: 'GET',
        path: '/api/outbound-webhooks',
        description: 'List outbound webhook destinations',
        auth: true,
        response: '{ "webhooks": [{ "id": "...", "destination_url": "...", "events": ["call.ended"] }] }',
      },
      {
        method: 'POST',
        path: '/api/outbound-webhooks',
        description: 'Create outbound webhook destination',
        auth: true,
        body: [
          { name: 'name', type: 'string', required: true, description: 'Webhook name' },
          { name: 'destination_url', type: 'string', required: true, description: 'URL to send events to' },
          { name: 'events', type: 'string', required: false, description: 'Comma-separated events (call.started, call.ended)' },
        ],
        response: '{ "id": "...", "name": "...", "destination_url": "..." }',
      },
      {
        method: 'PATCH',
        path: '/api/outbound-webhooks/:id',
        description: 'Update outbound webhook',
        auth: true,
        response: '{ "message": "Outbound webhook updated successfully" }',
      },
      {
        method: 'DELETE',
        path: '/api/outbound-webhooks/:id',
        description: 'Delete outbound webhook',
        auth: true,
        response: '{ "message": "Outbound webhook deleted successfully" }',
      },
      {
        method: 'GET',
        path: '/api/outbound-webhooks/:id/logs',
        description: 'Get delivery logs for outbound webhook',
        auth: true,
        response: '{ "logs": [{ "status": "success", "http_status": 200, "created_at": "..." }] }',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Call analytics and performance metrics',
    endpoints: [
      {
        method: 'GET',
        path: '/api/dashboard-summary',
        description: 'Get dashboard summary statistics',
        auth: true,
        params: [
          { name: 'days', type: 'number', required: false, description: 'Number of days to include (default: 30)' },
        ],
        response: '{ "totalCalls": 500, "totalMinutes": 1200, "avgDuration": 144 }',
      },
      {
        method: 'GET',
        path: '/api/agent-distribution',
        description: 'Get call distribution by agent',
        auth: true,
        response: '{ "distribution": [{ "agent": "Sales AI", "calls": 150 }] }',
      },
      {
        method: 'GET',
        path: '/api/call-ended-reasons',
        description: 'Get call end reasons breakdown',
        auth: true,
        response: '{ "reasons": [{ "reason": "customer-ended-call", "count": 200 }] }',
      },
      {
        method: 'GET',
        path: '/api/keywords',
        description: 'Get trending keywords from calls',
        auth: true,
        response: '{ "keywords": [{ "keyword": "pricing", "count": 50, "avg_sentiment": 0.5 }] }',
      },
      {
        method: 'GET',
        path: '/api/intent-analysis',
        description: 'Get call intent analysis',
        auth: true,
        params: [
          { name: 'days', type: 'number', required: false, description: 'Days to analyze (default: 30)' },
        ],
        response: '{ "intents": [{ "intent": "Scheduling", "count": 100 }] }',
      },
      {
        method: 'GET',
        path: '/api/appointments',
        description: 'Get appointments scheduled by AI',
        auth: true,
        response: '{ "appointments": [{ "date": "2025-01-15", "time": "2:00 PM", "customer": "..." }] }',
      },
      {
        method: 'GET',
        path: '/api/concurrent-calls/timeseries',
        description: 'Get concurrent calls over time',
        auth: true,
        params: [
          { name: 'hours', type: 'number', required: false, description: 'Hours to include (default: 24)' },
        ],
        response: '{ "timeseries": [{ "timestamp": "...", "concurrent": 5 }] }',
      },
      {
        method: 'GET',
        path: '/api/reports/call-analytics',
        description: 'Generate detailed call analytics report',
        auth: true,
        params: [
          { name: 'start_date', type: 'string', required: false, description: 'Start date (YYYY-MM-DD)' },
          { name: 'end_date', type: 'string', required: false, description: 'End date (YYYY-MM-DD)' },
        ],
        response: '{ "report": { "summary": {...}, "details": [...] } }',
      },
    ],
  },
  {
    id: 'phone-numbers',
    title: 'Phone Numbers',
    icon: <Phone className="w-5 h-5" />,
    description: 'Manage phone numbers for voice calls',
    endpoints: [
      {
        method: 'GET',
        path: '/api/twilio/phone-numbers',
        description: 'List Twilio phone numbers',
        auth: true,
        response: '{ "numbers": [{ "sid": "...", "phoneNumber": "+1..." }] }',
      },
      {
        method: 'GET',
        path: '/api/vapi/phone-numbers',
        description: 'List voice phone numbers',
        auth: true,
        response: '{ "numbers": [{ "id": "...", "number": "+1...", "assistantId": "..." }] }',
      },
      {
        method: 'POST',
        path: '/api/vapi/phone-number',
        description: 'Import or create a voice phone number',
        auth: true,
        body: [
          { name: 'provider', type: 'string', required: true, description: 'Phone provider (twilio)' },
          { name: 'twilioPhoneNumber', type: 'string', required: false, description: 'Twilio phone number to import' },
        ],
        response: '{ "phoneNumber": { "id": "...", "number": "..." } }',
      },
      {
        method: 'PATCH',
        path: '/api/vapi/phone-number/:id/assistant',
        description: 'Assign assistant to phone number',
        auth: true,
        body: [
          { name: 'assistantId', type: 'string', required: true, description: 'Assistant ID to assign' },
        ],
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: 'crm',
    title: 'CRM Integrations',
    icon: <Building2 className="w-5 h-5" />,
    description: 'Salesforce, HubSpot, and Dynamics 365 integrations',
    endpoints: [
      {
        method: 'GET',
        path: '/api/salesforce/oauth/initiate',
        description: 'Initiate Salesforce OAuth flow',
        auth: true,
        response: 'Redirect to Salesforce authorization',
      },
      {
        method: 'GET',
        path: '/api/salesforce/status',
        description: 'Get Salesforce connection status',
        auth: true,
        response: '{ "connected": true, "instanceUrl": "..." }',
      },
      {
        method: 'DELETE',
        path: '/api/salesforce/disconnect',
        description: 'Disconnect Salesforce integration',
        auth: true,
        response: '{ "success": true }',
      },
      {
        method: 'GET',
        path: '/api/salesforce/sync-logs',
        description: 'Get Salesforce sync logs',
        auth: true,
        response: '{ "logs": [{ "call_id": "...", "status": "success" }] }',
      },
      {
        method: 'GET',
        path: '/api/hubspot/oauth/initiate',
        description: 'Initiate HubSpot OAuth flow',
        auth: true,
        response: 'Redirect to HubSpot authorization',
      },
      {
        method: 'GET',
        path: '/api/hubspot/status',
        description: 'Get HubSpot connection status',
        auth: true,
        response: '{ "connected": true }',
      },
      {
        method: 'DELETE',
        path: '/api/hubspot/disconnect',
        description: 'Disconnect HubSpot integration',
        auth: true,
        response: '{ "success": true }',
      },
      {
        method: 'GET',
        path: '/api/dynamics/oauth/initiate',
        description: 'Initiate Dynamics 365 OAuth flow',
        auth: true,
        params: [
          { name: 'instanceUrl', type: 'string', required: true, description: 'Dynamics 365 instance URL' },
        ],
        response: 'Redirect to Microsoft authorization',
      },
      {
        method: 'GET',
        path: '/api/dynamics/status',
        description: 'Get Dynamics 365 connection status',
        auth: true,
        response: '{ "connected": true, "instanceUrl": "..." }',
      },
    ],
  },
  {
    id: 'workspaces',
    title: 'Workspaces & Teams',
    icon: <Users className="w-5 h-5" />,
    description: 'Manage workspaces and team members',
    endpoints: [
      {
        method: 'GET',
        path: '/api/workspaces',
        description: 'List all workspaces for current user',
        auth: true,
        response: '{ "workspaces": [{ "id": "...", "name": "...", "role": "owner" }] }',
      },
      {
        method: 'POST',
        path: '/api/workspaces',
        description: 'Create a new workspace',
        auth: true,
        body: [
          { name: 'name', type: 'string', required: true, description: 'Workspace name' },
        ],
        response: '{ "workspace": { "id": "...", "name": "..." } }',
      },
      {
        method: 'POST',
        path: '/api/workspaces/:id/invite',
        description: 'Invite a team member',
        auth: true,
        body: [
          { name: 'email', type: 'string', required: true, description: 'Email to invite' },
          { name: 'role', type: 'string', required: false, description: 'Role: admin or member (default: member)' },
        ],
        response: '{ "success": true, "invitation": {...} }',
      },
      {
        method: 'GET',
        path: '/api/workspaces/:id/members',
        description: 'List workspace members',
        auth: true,
        response: '{ "members": [{ "user_id": "...", "email": "...", "role": "..." }] }',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: <Settings className="w-5 h-5" />,
    description: 'Workspace settings and API keys',
    endpoints: [
      {
        method: 'GET',
        path: '/api/settings',
        description: 'Get workspace settings',
        auth: true,
        response: '{ "settings": { "workspace_name": "...", "twilio_account_sid": "..." } }',
      },
      {
        method: 'PUT',
        path: '/api/settings',
        description: 'Update workspace settings',
        auth: true,
        body: [
          { name: 'workspace_name', type: 'string', required: false, description: 'Workspace display name' },
          { name: 'private_key', type: 'string', required: false, description: 'Voice AI Private API Key' },
          { name: 'twilio_account_sid', type: 'string', required: false, description: 'Twilio Account SID' },
          { name: 'twilio_auth_token', type: 'string', required: false, description: 'Twilio Auth Token' },
        ],
        response: '{ "success": true }',
      },
      {
        method: 'GET',
        path: '/api/api-keys',
        description: 'List API keys',
        auth: true,
        response: '{ "keys": [{ "id": "...", "name": "...", "created_at": "..." }] }',
      },
      {
        method: 'POST',
        path: '/api/api-keys',
        description: 'Create a new API key',
        auth: true,
        body: [
          { name: 'name', type: 'string', required: true, description: 'API key name' },
        ],
        response: '{ "key": { "id": "...", "name": "...", "key": "vac_..." } }',
      },
      {
        method: 'DELETE',
        path: '/api/api-keys/:id',
        description: 'Revoke an API key',
        auth: true,
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: 'agent-flows',
    title: 'Agent Flows',
    icon: <MessageSquare className="w-5 h-5" />,
    description: 'Visual flow builder for voice agents',
    endpoints: [
      {
        method: 'POST',
        path: '/api/agent-flows',
        description: 'Create or update agent flow',
        auth: true,
        body: [
          { name: 'assistant_id', type: 'string', required: true, description: 'Associated assistant ID' },
          { name: 'flow_data', type: 'object', required: true, description: 'Flow nodes and edges' },
          { name: 'config_data', type: 'object', required: false, description: 'Flow configuration' },
        ],
        response: '{ "flow": { "id": "...", "assistant_id": "..." } }',
      },
      {
        method: 'GET',
        path: '/api/agent-flows/:assistantId',
        description: 'Get agent flow by assistant ID',
        auth: true,
        response: '{ "flow": { "id": "...", "flow_data": {...}, "config_data": {...} } }',
      },
      {
        method: 'PUT',
        path: '/api/agent-flows/:id',
        description: 'Update agent flow',
        auth: true,
        body: [
          { name: 'flow_data', type: 'object', required: true, description: 'Updated flow data' },
        ],
        response: '{ "success": true }',
      },
      {
        method: 'DELETE',
        path: '/api/agent-flows/:id',
        description: 'Delete agent flow',
        auth: true,
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    icon: <FileText className="w-5 h-5" />,
    description: 'Upload documents for AI knowledge',
    endpoints: [
      {
        method: 'POST',
        path: '/api/knowledge-files',
        description: 'Upload a knowledge base file',
        auth: true,
        body: [
          { name: 'assistant_id', type: 'string', required: true, description: 'Assistant to attach file to' },
          { name: 'file', type: 'file', required: true, description: 'File to upload (PDF, TXT, DOCX)' },
        ],
        response: '{ "file": { "id": "...", "name": "...", "size": 1024 } }',
      },
      {
        method: 'GET',
        path: '/api/knowledge-files/:id',
        description: 'Get knowledge file details',
        auth: true,
        response: '{ "file": { "id": "...", "name": "...", "content": "..." } }',
      },
      {
        method: 'DELETE',
        path: '/api/knowledge-files/:id',
        description: 'Delete a knowledge file',
        auth: true,
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: 'scheduling',
    title: 'Scheduling Triggers',
    icon: <Clock className="w-5 h-5" />,
    description: 'Schedule automated outbound calls',
    endpoints: [
      {
        method: 'GET',
        path: '/api/scheduling-triggers',
        description: 'List all scheduling triggers',
        auth: true,
        response: '{ "triggers": [{ "id": "...", "cron_expression": "...", "enabled": true }] }',
      },
      {
        method: 'POST',
        path: '/api/scheduling-triggers',
        description: 'Create a scheduling trigger',
        auth: true,
        body: [
          { name: 'name', type: 'string', required: true, description: 'Trigger name' },
          { name: 'cron_expression', type: 'string', required: true, description: 'Cron expression for schedule' },
          { name: 'campaign_id', type: 'string', required: true, description: 'Campaign to trigger' },
        ],
        response: '{ "trigger": { "id": "...", "name": "..." } }',
      },
      {
        method: 'PUT',
        path: '/api/scheduling-triggers/:id',
        description: 'Update a scheduling trigger',
        auth: true,
        response: '{ "success": true }',
      },
      {
        method: 'DELETE',
        path: '/api/scheduling-triggers/:id',
        description: 'Delete a scheduling trigger',
        auth: true,
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: 'addons',
    title: 'Add-ons',
    icon: <Database className="w-5 h-5" />,
    description: 'Enable additional features and integrations',
    endpoints: [
      {
        method: 'GET',
        path: '/api/addons',
        description: 'List available add-ons',
        auth: true,
        response: '{ "addons": [{ "id": "...", "name": "...", "enabled": false }] }',
      },
      {
        method: 'POST',
        path: '/api/addons/toggle',
        description: 'Enable or disable an add-on',
        auth: true,
        body: [
          { name: 'addon_id', type: 'string', required: true, description: 'Add-on ID' },
          { name: 'enabled', type: 'boolean', required: true, description: 'Enable or disable' },
        ],
        response: '{ "success": true }',
      },
      {
        method: 'POST',
        path: '/api/addons/embedding/settings',
        description: 'Configure embedding widget settings',
        auth: true,
        body: [
          { name: 'assistant_id', type: 'string', required: true, description: 'Assistant for widget' },
          { name: 'theme', type: 'object', required: false, description: 'Widget theme settings' },
        ],
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: 'public-webhooks',
    title: 'Public Webhooks',
    icon: <Globe className="w-5 h-5" />,
    description: 'Endpoints for receiving external events (no auth required)',
    endpoints: [
      {
        method: 'POST',
        path: '/webhook/:webhookId',
        description: 'Receive call events (status updates, call ended)',
        auth: false,
        body: [
          { name: 'message', type: 'object', required: true, description: 'Call event payload' },
        ],
        response: '{ "success": true }',
      },
      {
        method: 'POST',
        path: '/webhook/leads/:webhookId',
        description: 'Receive leads from external sources',
        auth: false,
        body: [
          { name: 'leads', type: 'array', required: true, description: 'Array of lead objects' },
        ],
        response: '{ "success": true, "imported": 10 }',
      },
    ],
  },
];

export default function ApiDocs() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['authentication']));
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleSection = (id: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = async (text: string, path: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const filteredSections = apiSections.filter(section => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (section.title.toLowerCase().includes(query)) return true;
    if (section.description.toLowerCase().includes(query)) return true;
    return section.endpoints.some(
      endpoint =>
        endpoint.path.toLowerCase().includes(query) ||
        endpoint.description.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30">
                <Book className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">API Documentation</h1>
                <p className="text-sm text-gray-400 mt-0.5">CHAU Voice AI Engine • REST API Reference</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <code className="px-3 py-1.5 bg-gray-800/50 rounded-lg text-sm text-gray-300 border border-gray-700/50">
                {BASE_URL}
              </code>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search endpoints..."
              className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Auth Info Card */}
        <div className="mb-8 p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Key className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">Authentication</h3>
              <p className="text-gray-400 text-sm mb-4">
                Most endpoints require authentication. Include your API key in the Authorization header:
              </p>
              <code className="block px-4 py-3 bg-gray-900/50 rounded-lg text-sm text-emerald-400 border border-gray-700/50 overflow-x-auto font-mono">
                Authorization: Bearer YOUR_API_KEY_HERE
              </code>
              
              <div className="mt-4 p-4 bg-gray-900/30 rounded-lg border border-gray-700/30">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Example cURL Request</p>
                <code className="block text-xs text-gray-300 font-mono whitespace-pre-wrap break-all">
{`curl -s "${BASE_URL}/api/campaigns" \\
  -H "Authorization: Bearer sk_live_xxxxx" \\
  -H "Content-Type: application/json"`}
                </code>
              </div>
              
              <p className="text-gray-500 text-xs mt-4">
                💡 Generate your API key in <span className="text-blue-400 font-medium">Settings → API Keys</span>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Nav */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Navigation</h2>
          <div className="flex flex-wrap gap-2">
            {apiSections.map(section => (
              <button
                key={section.id}
                onClick={() => {
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                  if (!expandedSections.has(section.id)) {
                    toggleSection(section.id);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-sm text-gray-300 hover:text-white border border-gray-700/50 transition-all"
              >
                {section.icon}
                {section.title}
              </button>
            ))}
          </div>
        </div>

        {/* API Sections */}
        <div className="space-y-4">
          {filteredSections.map(section => (
            <div
              key={section.id}
              id={section.id}
              className="bg-gray-900/50 rounded-2xl border border-gray-800/50 overflow-hidden"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-gray-800 rounded-xl text-gray-400">
                    {section.icon}
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                    <p className="text-sm text-gray-500">{section.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 bg-gray-800 rounded-lg text-xs text-gray-400">
                    {section.endpoints.length} endpoints
                  </span>
                  {expandedSections.has(section.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                </div>
              </button>

              {/* Endpoints */}
              {expandedSections.has(section.id) && (
                <div className="border-t border-gray-800/50">
                  {section.endpoints.map((endpoint, idx) => (
                    <div
                      key={idx}
                      className={`px-6 py-5 ${idx !== section.endpoints.length - 1 ? 'border-b border-gray-800/30' : ''}`}
                    >
                      {/* Method & Path */}
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-md border ${methodColors[endpoint.method]}`}
                        >
                          {endpoint.method}
                        </span>
                        <code className="text-sm text-gray-300 font-mono flex-1">
                          {endpoint.path}
                        </code>
                        <button
                          onClick={() => copyToClipboard(`${BASE_URL}${endpoint.path}`, endpoint.path)}
                          className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
                          title="Copy full URL"
                        >
                          {copiedPath === endpoint.path ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                        {endpoint.auth && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded-md border border-amber-500/30">
                            <Shield className="w-3 h-3" />
                            Auth
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-400 mb-4">{endpoint.description}</p>

                      {/* Parameters */}
                      {endpoint.params && endpoint.params.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Query Parameters
                          </h4>
                          <div className="bg-gray-950/50 rounded-lg border border-gray-800/50 overflow-hidden">
                            <table className="w-full text-sm">
                              <tbody>
                                {endpoint.params.map((param, pIdx) => (
                                  <tr key={pIdx} className={pIdx !== endpoint.params!.length - 1 ? 'border-b border-gray-800/30' : ''}>
                                    <td className="px-4 py-2.5 font-mono text-blue-400">{param.name}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{param.type}</td>
                                    <td className="px-4 py-2.5">
                                      {param.required ? (
                                        <span className="text-red-400 text-xs">required</span>
                                      ) : (
                                        <span className="text-gray-600 text-xs">optional</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-400">{param.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Request Body */}
                      {endpoint.body && endpoint.body.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Request Body
                          </h4>
                          <div className="bg-gray-950/50 rounded-lg border border-gray-800/50 overflow-hidden">
                            <table className="w-full text-sm">
                              <tbody>
                                {endpoint.body.map((field, fIdx) => (
                                  <tr key={fIdx} className={fIdx !== endpoint.body!.length - 1 ? 'border-b border-gray-800/30' : ''}>
                                    <td className="px-4 py-2.5 font-mono text-purple-400">{field.name}</td>
                                    <td className="px-4 py-2.5 text-gray-500">{field.type}</td>
                                    <td className="px-4 py-2.5">
                                      {field.required ? (
                                        <span className="text-red-400 text-xs">required</span>
                                      ) : (
                                        <span className="text-gray-600 text-xs">optional</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-400">{field.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Response */}
                      {endpoint.response && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Response
                          </h4>
                          <code className="block px-4 py-3 bg-gray-950/50 rounded-lg text-sm text-emerald-400 border border-gray-800/50 overflow-x-auto font-mono">
                            {endpoint.response}
                          </code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p className="text-gray-400 font-medium">CHAU Voice AI Engine</p>
          <p className="mt-1">Need help? Contact support or check the documentation guides.</p>
          <p className="mt-2 text-gray-600">Version 1.0 • Last updated: January 2025</p>
        </div>
      </div>
    </div>
  );
}
