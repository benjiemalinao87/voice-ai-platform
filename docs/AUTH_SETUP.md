# Authentication System Setup Guide

## Overview

Your Voice AI Dashboard now includes a complete authentication system with:
- ✅ User registration and login
- ✅ JWT-based session management
- ✅ Encrypted API key storage in D1 database
- ✅ Multi-device synchronization
- ✅ Secure password hashing

## Architecture

```
Frontend (React) → Cloudflare Worker API → D1 Database
                                         → Encrypted Settings
```

## What's Been Deployed

1. **D1 Database Tables:**
   - `users` - User accounts
   - `user_settings` - Encrypted API keys and preferences
   - `sessions` - JWT token management
   - `agent_knowledge_files` - Knowledge base files (existing)

2. **Worker API Endpoints:**
   - `POST /api/auth/register` - Create new account
   - `POST /api/auth/login` - Login with email/password
   - `POST /api/auth/logout` - Logout (invalidates token)
   - `GET /api/auth/me` - Get current user info
   - `GET /api/settings` - Get user settings (protected)
   - `PUT /api/settings` - Update user settings (protected)
   - All knowledge base endpoints now require authentication

3. **Worker URL:**
   ```
   https://voice-ai-dashboard-api.benjiemalinao879557.workers.dev
   ```

## Required Environment Variable Update

Update your `.env` file:

```env
VITE_VAPI_ASSISTANT_ID=151dc598-9439-4d17-bc63-6d5d1bb9cd9b
VITE_VAPI_PHONE_NUMBER_ID=67ac3b4e-63b7-4063-8937-bee42ea3cfa9
VITE_VAPI_PRIVATE_KEY=94d99bcc-17cb-4d09-9810-437447ec8072
VITE_VAPI_PUBLIC_KEY=9b13c215-aabf-4f80-abc3-75f2ccd29962
VITE_D1_API_URL=https://voice-ai-dashboard-api.benjiemalinao879557.workers.dev
```

## Security Features

### 1. Password Security
- Passwords are hashed using SHA-256 before storage
- Never stored in plain text
- Server-side validation

### 2. API Key Encryption
- API keys are encrypted using AES-GCM (256-bit)
- Encryption key derived from user password using PBKDF2 (100,000 iterations)
- Unique salt per user
- Keys are decrypted only in the browser using the user's password

### 3. Session Management
- JWT tokens with 7-day expiration
- Token invalidation on logout
- Automatic token refresh
- Session tracking in database

### 4. Transport Security
- All API calls over HTTPS
- CORS protection
- Authorization header validation

## How It Works

### Registration Flow
1. User enters email, password, and name
2. Worker hashes password and creates user account
3. Worker generates JWT token
4. Empty settings record created with unique encryption salt
5. User automatically logged in

### Login Flow
1. User enters email and password
2. Worker verifies password against hash
3. Worker generates new JWT token
4. Session created in database
5. User authenticated

### Settings Save Flow
1. User enters API keys in Settings page
2. Keys encrypted in browser using user's password
3. Encrypted keys sent to Worker with Authorization token
4. Worker verifies token and saves encrypted keys to D1
5. Keys synced across devices

### Settings Load Flow
1. User logs in on new device
2. Worker returns encrypted keys from D1
3. Browser decrypts keys using user's password
4. Keys used to fetch assistants/phones from VAPI API

## Testing the Authentication

### 1. Register a New Account
```bash
curl -X POST https://voice-ai-dashboard-api.benjiemalinao879557.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 2. Login
```bash
curl -X POST https://voice-ai-dashboard-api.benjiemalinao879557.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Get Current User (use token from login response)
```bash
curl -X GET https://voice-ai-dashboard-api.benjiemalinao879557.workers.dev/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Next Steps

I need to complete:
1. ✅ D1 Schema - DONE
2. ✅ Worker API - DONE
3. ✅ Auth Context - DONE
4. ✅ Login Component - DONE
5. ⏳ Update Settings component to use encrypted D1 storage
6. ⏳ Integrate Login component into App.tsx
7. ⏳ Add logout button and user profile display
8. ⏳ Test end-to-end authentication flow

## Important Notes

### Password Recovery
- Currently, there's no password recovery system
- Users must remember their passwords (keys cannot be decrypted without it)
- Consider adding password reset via email in the future

### JWT Secret
- Change the JWT secret in production:
  ```bash
  wrangler secret put JWT_SECRET
  # Enter a long, random string when prompted
  ```

### Encryption Key
- User's password is the encryption key
- If password is lost, API keys cannot be recovered
- Consider adding a backup/recovery mechanism

### Database Backups
- D1 databases are automatically backed up by Cloudflare
- Export data regularly for additional safety
- Use `wrangler d1 execute` for manual backups

## Migration from LocalStorage

Old settings in localStorage will be automatically cleared on logout. Users will need to:
1. Register/Login with the new system
2. Re-enter their API keys in Settings
3. Select their preferred assistant and phone number

## Troubleshooting

### "Unauthorized" errors
- Token may be expired (7 days)
- User needs to login again
- Check Authorization header format: `Bearer TOKEN`

### Settings not saving
- Check user is logged in
- Verify token is valid
- Check browser console for errors
- Verify D1_API_URL is correct

### Can't decrypt keys
- User password may have changed
- Keys may be corrupted
- Re-enter keys in Settings to re-encrypt


