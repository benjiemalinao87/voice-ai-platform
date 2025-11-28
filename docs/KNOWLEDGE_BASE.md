# Knowledge Base Integration Guide

## Overview
The Knowledge Base feature allows you to upload documents that your AI agent can reference during conversations. This solves the hallucination problem by grounding the AI's responses in verified, factual information from your documents.

## How It Works

### 1. Upload Documents
Navigate to the Agent Configuration page and scroll to the "Knowledge Base" section. Click "Upload Files" to add:
- PDFs
- Word documents (.doc, .docx)
- Text files (.txt)
- Markdown files (.md)

### 2. VAPI Processing
When you upload a file:
1. File is sent to VAPI's `/file` endpoint
2. VAPI parses and indexes the content
3. Content is made searchable using semantic search
4. File ID is linked to your agent's knowledge base

### 3. During Conversations
When a caller asks a question:
1. AI analyzes the question
2. Searches the knowledge base for relevant information
3. Retrieves matching document snippets
4. Augments its context with verified facts
5. Responds using information from your documents

## Best Practices

### Document Organization
✅ **DO:**
- Use multiple focused documents (services.pdf, pricing.pdf, policies.pdf)
- Keep documents up-to-date
- Use clear headings and structure
- Include FAQs in Q&A format

❌ **DON'T:**
- Upload one massive document with everything
- Include outdated information
- Use scanned images without OCR
- Upload duplicate information

### System Prompt Integration
Instruct your AI to prioritize the knowledge base:

```
You are a [role] for [company].

IMPORTANT: When answering questions about our services, pricing, 
or policies, ALWAYS check the knowledge base first. Only provide 
information that you can verify from our uploaded documents.

If you don't find information in the knowledge base, politely 
say you'll have a staff member follow up rather than guessing.
```

### What to Include in Knowledge Base

**Perfect for:**
- Service descriptions and pricing
- Company policies (refund, cancellation, privacy)
- Product catalogs and specifications
- Frequently asked questions
- Procedures and workflows
- Location and hours information
- Contact information for departments

**Not recommended:**
- Scripts (use system prompt instead)
- Conversational examples (use system prompt)
- Personality guidelines (use system prompt)
- Technical API documentation

## File Management

### Upload Status
Files go through several states:
- **Uploading** - File is being sent to VAPI
- **Processing** - VAPI is parsing and indexing
- **Ready** - File is available for the AI to reference
- **Error** - Upload or processing failed

### Deleting Files
Click the trash icon next to any file to remove it from the knowledge base. The AI will immediately stop referencing that document.

### Usage Stats
Monitor your knowledge base:
- **Total Files** - Number of documents uploaded
- **Ready** - Number of files available to the AI
- **Total Size** - Combined size of all uploaded files

## Technical Details

### API Endpoint
```typescript
POST https://api.vapi.ai/file
Authorization: Bearer YOUR_VAPI_API_KEY
Content-Type: multipart/form-data

Body: FormData with 'file' field
```

### Response
```json
{
  "id": "file_abc123",
  "name": "services.pdf",
  "size": 52428,
  "createdAt": "2025-10-16T12:00:00Z",
  "status": "processing"
}
```

### Linking to Agent
The file ID is automatically linked to your agent's `knowledgeBase` array, making it available during calls.

## Example Use Case: Funeral Home

### Documents to Upload
1. **services.pdf** - All funeral services with descriptions and pricing
2. **policies.pdf** - Payment plans, cancellation policy, grief resources
3. **faq.pdf** - Common questions about pre-planning, cremation, burial
4. **locations.pdf** - Locations, hours, parking information

### System Prompt
```
You are a compassionate funeral home assistant for [Funeral Home Name].

Your role is to provide accurate information about our services and 
support families during difficult times.

CRITICAL INSTRUCTIONS:
1. ALWAYS check the knowledge base before answering questions about:
   - Service pricing and packages
   - Policies and procedures
   - Locations and hours
   - Pre-planning options

2. If information isn't in the knowledge base, say:
   "That's a great question. Let me have one of our directors 
   follow up with you personally to ensure you get the most 
   accurate information. May I take your contact details?"

3. Be empathetic, patient, and respectful at all times.
```

### Sample Conversation
**Caller:** "How much does a traditional burial service cost?"

**AI:** *Searches knowledge base → finds services.pdf → retrieves pricing info*

"Our traditional burial service packages range from $5,500 to $8,500, 
depending on the options you choose. This includes [lists items from 
services.pdf]. Would you like me to explain what's included in each 
package?"

## Troubleshooting

### File Won't Upload
- Check file size (should be < 10MB)
- Verify file format (PDF, DOC, DOCX, TXT, MD only)
- Ensure VAPI API key is valid
- Check browser console for errors

### AI Not Using Knowledge Base
- Verify file status is "Ready" (not "Processing")
- Update system prompt to instruct AI to check knowledge base
- Ensure question matches content in documents
- Try rephrasing the question more specifically

### File Stuck in "Processing"
- Wait a few minutes (large files take time)
- Refresh the page to check status
- If stuck > 10 minutes, delete and re-upload

## Summary
The Knowledge Base transforms your AI from a general chatbot into a knowledgeable expert about YOUR business. By combining uploaded documents with well-crafted system prompts, you create an AI that provides accurate, verified information every time.

