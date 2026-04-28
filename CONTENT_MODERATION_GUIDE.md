# Content Moderation Implementation Guide

## Overview

LinkUp includes a comprehensive content moderation system to ensure platform safety and compliance with Play Store policies. The system detects:
- **Profanity & offensive language**
- **NSFW images** (using Google Cloud Vision)
- **Spam & promotional content**
- **Harassment & threats**

---

## Architecture

### Components

1. **ContentModerationService** - Core moderation logic
2. **Moderation Routes** - API endpoints for scanning and review
3. **Database Tables** - Flagged content, logs, bans, warnings
4. **Admin Dashboard** - Manual review interface (separate)

---

## Setup Instructions

### 1. Enable Google Cloud Vision (Optional but Recommended)

For NSFW image detection:

```bash
# Install Google Cloud CLI
curl https://sdk.cloud.google.com | bash

# Create a Google Cloud project
# Enable Vision API: https://console.cloud.google.com/apis/library/vision.googleapis.com

# Create service account with Vision API access
# Download JSON key file

# Set environment variable
export GOOGLE_CLOUD_VISION_API_KEY=your_api_key_here
```

**Free Tier**: 1,000 images/month free

**Cost**: $1.50 per 1,000 images after free tier

### 2. Update Backend Environment Variables

```bash
# .env or .env.local
GOOGLE_CLOUD_VISION_API_KEY=your_key_here
```

### 3. Run Database Migrations

```bash
# Apply moderation tables schema
npm run migrate -- 20260428_add_moderation_tables.sql
```

### 4. Mount Moderation Routes

In `backend/server.js`:

```javascript
const moderationRoutes = require('./routes/moderation');

// Add after other routes
app.use('/api/moderation', moderationRoutes);
```

---

## API Endpoints

### 1. Scan Text

**Endpoint**: `POST /api/moderation/scan-text`

**Body**:
```json
{
  "text": "User bio or message text"
}
```

**Response**:
```json
{
  "clean": true,
  "severity": "none",
  "flags": [],
  "issues": []
}
```

### 2. Scan Image

**Endpoint**: `POST /api/moderation/scan-image`

**Body**:
```json
{
  "imageUrl": "https://example.com/photo.jpg"
}
```

**Response**:
```json
{
  "clean": true,
  "nsfw": false,
  "issues": []
}
```

### 3. Scan Profile

**Endpoint**: `POST /api/moderation/scan-profile`

**Body**:
```json
{
  "profileData": {
    "username": "john_doe",
    "bio": "Software engineer and traveler",
    "photos": [
      { "url": "https://example.com/photo1.jpg" },
      { "url": "https://example.com/photo2.jpg" }
    ]
  }
}
```

**Response**:
```json
{
  "clean": true,
  "severity": "none",
  "flags": [],
  "issues": []
}
```

### 4. Flag Content

**Endpoint**: `POST /api/moderation/flag`

**Headers**: `Authorization: Bearer {token}`

**Body**:
```json
{
  "contentType": "profile",
  "contentId": "user_123",
  "reason": "Inappropriate bio content"
}
```

**Response**:
```json
{
  "success": true,
  "flagId": "flag_uuid_here",
  "message": "Content flagged for review"
}
```

### 5. Get Pending Flags (Admin)

**Endpoint**: `GET /api/moderation/pending-flags?limit=50&offset=0`

**Headers**: `Authorization: Bearer {admin_token}`

**Response**:
```json
{
  "flags": [
    {
      "id": "flag_uuid",
      "userId": 123,
      "contentType": "profile",
      "contentId": "user_456",
      "reason": "Inappropriate content",
      "createdAt": "2026-04-28T10:30:00Z"
    }
  ],
  "count": 5
}
```

### 6. Resolve Flag (Admin)

**Endpoint**: `POST /api/moderation/resolve-flag`

**Headers**: `Authorization: Bearer {admin_token}`

**Body**:
```json
{
  "flagId": "flag_uuid_here",
  "action": "approved",
  "reason": "Content violates Terms of Service - user banned"
}
```

**Response**:
```json
{
  "success": true,
  "flag": {
    "id": "flag_uuid",
    "userId": 123,
    "contentType": "profile",
    "status": "approved"
  },
  "message": "Content approved"
}
```

### 7. Get Moderation Stats (Admin)

**Endpoint**: `GET /api/moderation/stats`

**Headers**: `Authorization: Bearer {admin_token}`

**Response**:
```json
{
  "pending": 12,
  "resolved": 486,
  "recentActions": [
    { "action": "warning", "count": 5 },
    { "action": "suspension", "count": 2 },
    { "action": "content_removed", "count": 15 }
  ]
}
```

---

## Integration Examples

### Example 1: Scan Profile on Signup

In `backend/routes/auth.js`:

```javascript
const contentModerationService = require('../services/contentModerationService');

router.post('/register', async (req, res) => {
  const { username, bio, photos } = req.body;
  
  // Scan profile before registration
  const scan = await contentModerationService.scanProfile({
    username,
    bio,
    photos: photos.map(p => ({ url: p }))
  });
  
  if (!scan.clean) {
    return res.status(400).json({
      error: 'Profile contains inappropriate content',
      severity: scan.severity,
      issues: scan.issues
    });
  }
  
  // Continue with registration...
});
```

### Example 2: Scan Message Before Saving

In `backend/routes/messages.js`:

```javascript
const contentModerationService = require('../services/contentModerationService');

router.post('/send', authenticateToken, async (req, res) => {
  const { text, recipientId } = req.body;
  
  // Scan message text
  const scan = await contentModerationService.scanText(text);
  
  if (!scan.clean && scan.severity === 'high') {
    // Flag for immediate review
    await contentModerationService.flagContent(
      req.user.id,
      'message',
      `msg_${Date.now()}`,
      `High severity: ${scan.flags.join(', ')}`
    );
    
    return res.status(400).json({
      error: 'Message contains inappropriate content'
    });
  }
  
  // Save message...
});
```

### Example 3: Flag Content from Frontend

```javascript
// src/services/moderationService.js
export const flagContent = async (contentType, contentId, reason) => {
  const response = await axios.post('/api/moderation/flag', {
    contentType,
    contentId,
    reason
  });
  return response.data;
};

// In a component
const handleReportProfile = async (userId) => {
  await flagContent('profile', userId, 'Fake profile photos');
  toast.success('Profile reported. Our team will review it shortly.');
};
```

---

## Moderation Workflow

### 1. Content is Flagged

User reports content → API stores flag in `moderation_flags` table

### 2. Admin Review Queue

Admin views pending flags at `/admin/moderation/queue`

### 3. Decision & Action

Admin can:
- **Approve**: Content is allowed, no action taken
- **Reject**: Content violates policy, removed and user warned/banned
- **Investigate**: Flag marked as investigating for later review

### 4. Consequences

**For Users**:
1. First violation: Warning
2. Second violation: Temporary suspension (1-7 days)
3. Third violation: Permanent ban

**For Content**:
- Removed/hidden from platform
- Logged in `moderation_logs` for pattern analysis

---

## Database Schema

### moderation_flags
```sql
id UUID                   -- Unique flag ID
user_id INTEGER          -- User who reported
content_type VARCHAR(50) -- Type of content
content_id VARCHAR(255)  -- Content identifier
reason VARCHAR(255)      -- Why it was flagged
evidence JSONB          -- Additional context
status VARCHAR(50)       -- pending/approved/rejected
resolved_at TIMESTAMP   -- When resolved
reviewed_by INTEGER     -- Admin who reviewed
```

### moderation_logs
```sql
id UUID               -- Unique log ID
user_id INTEGER      -- User who received action
action_type VARCHAR  -- warning/suspension/ban
details JSONB        -- Context of action
created_by INTEGER   -- Admin who took action
created_at TIMESTAMP -- When action taken
```

### bans
```sql
user_id INTEGER      -- Banned user
ban_type VARCHAR(50) -- temporary/permanent
end_date TIMESTAMP   -- When ban expires (NULL if permanent)
active BOOLEAN       -- Is ban currently active
```

---

## Best Practices

1. **Scan on Input**: Always scan user input before saving (profiles, messages, bios)
2. **Batch Processing**: For existing content, run batch scans during off-peak hours
3. **False Positives**: Review flagging rules regularly, adjust sensitivity
4. **Transparency**: Show users why content was flagged (not just "content removed")
5. **Appeal Process**: Allow users to appeal bans with explanation

---

## Cost Estimate

**Monthly Moderation Cost**:
- Google Vision API: ~$150 (10,000 images at $1.50/1000 after free tier)
- Database: ~$10 (small storage for flags/logs)
- **Total**: ~$160/month for 10,000 active users

---

## Performance Notes

- Text scanning: <10ms per message (local)
- Image scanning: 100-500ms per image (API call)
- Cache profanity list in memory for speed
- Async queue for bulk image scanning

---

## Support & Escalation

**Critical Issues**: Content promoting violence/self-harm
- Immediate removal
- Account investigation
- Contact law enforcement if necessary

**High Priority**: NSFW, harassment, hate speech
- Flagged for 24-hour review
- Temporary suspension while reviewing

**Standard Issues**: Spam, minor profanity
- Queued for 48-hour review
- User warned

---

## Next Steps

1. ✅ **Backend Service**: Created `contentModerationService.js`
2. ✅ **Routes**: Created `/api/moderation/*` endpoints
3. ✅ **Database**: Created moderation tables
4. 🔄 **Frontend Integration**: Implement report buttons in UI
5. 🔄 **Admin Dashboard**: Build moderation review queue
6. 🔄 **Webhooks**: Set up alerts for critical flags

---

## Support

For issues or questions:
- Check Google Cloud Vision docs: https://cloud.google.com/vision/docs
- Email: support@linkup.io
