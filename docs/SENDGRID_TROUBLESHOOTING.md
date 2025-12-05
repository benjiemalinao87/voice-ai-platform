# SendGrid Email Integration Troubleshooting

## Issue: Emails Not Being Received

### Common Causes

1. **Sender Email Not Verified in SendGrid** (Most Common)
   - SendGrid requires the sender email address to be verified
   - Go to SendGrid Dashboard → Settings → Sender Authentication
   - Verify that `hello@channelautomation.com` is verified as a Single Sender
   - OR verify the domain `channelautomation.com` with domain authentication

2. **Email Went to Spam/Junk Folder**
   - Check the recipient's spam/junk folder
   - Ask recipient to whitelist `hello@channelautomation.com`

3. **SendGrid API Key Issues**
   - Verify the API key has "Mail Send" permissions
   - Check that the API key is active in SendGrid dashboard

4. **Domain Authentication Not Set Up**
   - For better deliverability, set up domain authentication (SPF, DKIM, DMARC)
   - Go to SendGrid → Settings → Sender Authentication → Authenticate Your Domain

## How to Check SendGrid Logs

1. **Access SendGrid Dashboard**
   - Log in to https://app.sendgrid.com
   - Navigate to **Activity** → **Email Logs**

2. **Find the Email**
   - Search for recipient email: `benjiemalinao87@gmail.com`
   - Check the status:
     - ✅ **Delivered** - Email was sent successfully (check spam folder)
     - ❌ **Bounced** - Invalid email or blocked
     - ⚠️ **Deferred** - Temporary issue, will retry
     - ❌ **Dropped** - Email was dropped (check reason)

3. **Check Event Details**
   - Click on the email entry to see detailed information
   - Look for error messages or reasons

## How to Check Cloudflare Worker Logs

1. **Via Wrangler CLI**
   ```bash
   wrangler tail --format pretty
   ```
   Look for lines containing `[Email]` or `[SendGrid]`

2. **Via Cloudflare Dashboard**
   - Log in to Cloudflare Dashboard
   - Go to Workers & Pages → voice-ai-dashboard-api
   - Click on "Logs" tab
   - Filter by search term: "Email" or "SendGrid"

## Testing Email Sending

### Test Invitation Email
1. Go to Team Members page
2. Click "Invite Member"
3. Enter a test email address
4. Check Cloudflare Worker logs for:
   - `[Email] Attempting to send team invite email to: [email]`
   - `[SendGrid] Sending email to: [email]`
   - Success or error messages

### Verify API Key
The API key is set as a secret:
```bash
wrangler secret get SENDGRID_API_KEY
```
(Note: This will show the key value - use only for debugging)

## Quick Fixes

### Fix 1: Verify Sender Email
1. Go to SendGrid Dashboard
2. Settings → Sender Authentication
3. Click "Verify a Single Sender"
4. Enter: `hello@channelautomation.com`
5. Complete verification process

### Fix 2: Use Domain Authentication (Recommended)
1. Go to SendGrid Dashboard
2. Settings → Sender Authentication
3. Click "Authenticate Your Domain"
4. Enter: `channelautomation.com`
5. Add the required DNS records
6. Wait for verification (can take up to 48 hours)

### Fix 3: Check API Key Permissions
1. Go to SendGrid Dashboard
2. Settings → API Keys
3. Find your API key
4. Ensure "Mail Send" permission is enabled

## Email Template Details

- **Sender:** hello@channelautomation.com
- **App URL:** https://voice-config.channelautomation.com/
- **Templates:** HTML email with branding

## Next Steps After Fixing

1. Test by inviting a new team member
2. Check SendGrid Email Logs for delivery status
3. Ask recipient to check spam folder if not delivered
4. Monitor Cloudflare Worker logs for any errors


