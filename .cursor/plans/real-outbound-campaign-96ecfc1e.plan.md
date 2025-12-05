<!-- 96ecfc1e-f51d-4c5e-a5e8-ab7c85b0afc9 76ce4cec-c424-4f51-9b62-e80a73ea4cb7 -->
# Dynamic Lead Context for Outbound Campaigns

## Overview
Enable campaigns to store prompt templates with placeholders (`{firstname}`, `{product}`, `{notes}`, `{lead_source}`) that get replaced with actual lead data before each call, creating personalized AI interactions.

## Database Changes

Add new columns to `campaigns` table:
```sql
ALTER TABLE campaigns ADD COLUMN prompt_template TEXT;
ALTER TABLE campaigns ADD COLUMN first_message_template TEXT;
```

Migration file: `workers/migrations/0031_add_campaign_templates.sql`

## Backend Changes

### 1. Update Campaign Create/Update Endpoints
File: `workers/index.ts`

- Accept `prompt_template` and `first_message_template` in POST/PATCH `/api/campaigns`
- Store templates in database

### 2. Update `executeCampaignCalls` Function
File: `workers/index.ts` (~line 1644)

Replace placeholders before each call:
```typescript
function replaceLeadPlaceholders(template: string, lead: any): string {
  return template
    .replace(/\{firstname\}/gi, lead.firstname || '')
    .replace(/\{lastname\}/gi, lead.lastname || '')
    .replace(/\{product\}/gi, lead.product || '')
    .replace(/\{notes\}/gi, lead.notes || '')
    .replace(/\{lead_source\}/gi, lead.lead_source || '')
    .replace(/\{email\}/gi, lead.email || '')
    .replace(/\{phone\}/gi, lead.phone || '');
}
```

Update call payload to include overrides:
```typescript
assistantOverrides: {
  firstMessage: campaign.first_message_template 
    ? replaceLeadPlaceholders(campaign.first_message_template, lead)
    : undefined,
  model: campaign.prompt_template ? {
    messages: [{
      role: 'system',
      content: replaceLeadPlaceholders(campaign.prompt_template, lead)
    }]
  } : undefined,
  variableValues: { ... }
}
```

## Frontend Changes

### 1. Update Create Campaign Modal
File: `src/components/Leads.tsx`

Add two new fields:
- **First Message Template** - Text input with placeholder hints
- **Prompt Template** - Large textarea for full system prompt

Show available placeholders: `{firstname}`, `{lastname}`, `{product}`, `{notes}`, `{lead_source}`, `{email}`, `{phone}`

### 2. Update Edit Campaign Modal
File: `src/components/Leads.tsx`

Same fields as create modal, pre-populated with existing templates.

### 3. Update Campaign State
File: `src/components/Leads.tsx`

Add to campaign interfaces and state:
```typescript
interface Campaign {
  // existing fields...
  prompt_template?:

### To-dos

- [ ] Create database migration for campaigns and campaign_leads tables
- [ ] Add campaign CRUD and control API endpoints to workers/index.ts
- [ ] Implement VAPI outbound call logic with campaign execution
- [ ] Add campaign methods to src/lib/d1.ts
- [ ] Transform Leads.tsx into tabbed interface with Campaigns management