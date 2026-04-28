# Catfish Prevention AI - Integration Guide

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Backend Integration](#backend-integration)
4. [Frontend Integration](#frontend-integration)
5. [API Reference](#api-reference)
6. [Testing Guide](#testing-guide)
7. [Deployment](#deployment)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
├──────────────────────────────────────────────────────────────┤
│ MessageSecurityWarning    │    CatfishDetectionDashboard     │
│ (Inline Alert)           │    (Stats & History)             │
└─────────────────┬────────────────────────┬──────────────────┘
                  │                        │
         catfishDetectionService (API Abstraction)
                  │                        │
                  └────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │   /api/catfish-detection/* Routes   │
        └────────────────┬─────────────────────┘
                         │
        ┌────────────────┴──────────────────┐
        │   catfishDetectionService         │
        │   (Red Flag Scanning Logic)       │
        └────────────────┬──────────────────┘
                         │
        ┌────────────────┴──────────────────┐
        │   CatfishDetectionFlag Model      │
        └────────────────┬──────────────────┘
                         │
        ┌────────────────┴──────────────────┐
        │   PostgreSQL Database             │
        │   catfish_detection_flags table   │
        └───────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Table: `catfish_detection_flags`

```sql
CREATE TABLE catfish_detection_flags (
  id                    INTEGER PRIMARY KEY AUTO_INCREMENT,
  message_id            INTEGER REFERENCES messages(id) ON DELETE CASCADE,
  chatroom_message_id   INTEGER REFERENCES chatroom_messages(id) ON DELETE CASCADE,
  from_user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text          TEXT NOT NULL,
  red_flags             JSON NOT NULL,  -- Array of detected keywords
  flag_type             ENUM('money_request', 'payment_app', 'crypto', 
                             'suspicious_link', 'identity_theft', 'other') NOT NULL,
  risk_level            ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  has_been_reported     BOOLEAN DEFAULT FALSE,
  reported_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  report_reason         ENUM('scam', 'money_request', 'catfishing', 
                             'harassment', 'other'),
  reported_at           TIMESTAMP,
  ai_confidence_score   FLOAT DEFAULT 0.5,
  user_dismissed        BOOLEAN DEFAULT FALSE,
  dismissed_at          TIMESTAMP,
  metadata              JSON,  -- Additional context (pattern matches, etc)
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_catfish_from_user_id ON catfish_detection_flags(from_user_id);
CREATE INDEX idx_catfish_to_user_id ON catfish_detection_flags(to_user_id);
CREATE INDEX idx_catfish_message_id ON catfish_detection_flags(message_id);
CREATE INDEX idx_catfish_flag_type ON catfish_detection_flags(flag_type);
CREATE INDEX idx_catfish_risk_level ON catfish_detection_flags(risk_level);
CREATE INDEX idx_catfish_reported ON catfish_detection_flags(has_been_reported);
CREATE INDEX idx_catfish_created_at ON catfish_detection_flags(created_at);
```

### Relationships

```
CatfishDetectionFlag
├── belongsTo Message (via message_id)
├── belongsTo ChatroomMessage (via chatroom_message_id)
├── belongsTo User as sender (via from_user_id)
├── belongsTo User as recipient (via to_user_id)
└── belongsTo User as reporter (via reported_by)
```

---

## 🔧 Backend Integration

### 1. Model Definition

**File:** `backend/models/CatfishDetectionFlag.js`

```javascript
const CatfishDetectionFlag = sequelize.define('CatfishDetectionFlag', {
  // ... field definitions
}, {
  tableName: 'catfish_detection_flags',
  timestamps: true,
  underscored: true
});

CatfishDetectionFlag.associate = (models) => {
  CatfishDetectionFlag.belongsTo(models.Message, {
    foreignKey: 'message_id',
    as: 'message'
  });
  // ... other associations
};
```

### 2. Service Layer

**File:** `backend/services/catfishDetectionService.js`

Core methods:

```javascript
// Scan message for red flags
scanMessage(message) => {
  // Returns: { hasRedFlags, redFlags, flagType, riskLevel, confidenceScore }
}

// Create database flag
async createFlag(data) => {
  // Creates CatfishDetectionFlag record
}

// Get user's flags
async getFlagsForUser(userId, options) => {
  // Returns: Array of CatfishDetectionFlag objects
}

// Dismiss warning
async dismissFlag(flagId, userId) => {
  // Marks flag as user_dismissed = true
}

// Report message
async reportFlag(flagId, userId, reportReason) => {
  // Creates both CatfishDetectionFlag report
  // AND ConversationSafetyFlag for moderation
}

// Get user stats
async getUserStats(userId) => {
  // Returns stats for the past 30 days
}

// Get suspicious users
async getSuspiciousUsers(options) => {
  // Returns users with 3+ flags (for moderation)
}
```

### 3. Routes

**File:** `backend/routes/catfishDetection.js`

Endpoints:

```javascript
POST   /api/catfish-detection/scan
       Scan a message for red flags

GET    /api/catfish-detection/flags
       Get user's flags

GET    /api/catfish-detection/stats
       Get user's suspicious activity stats

POST   /api/catfish-detection/flags/:flagId/dismiss
       Dismiss a warning

POST   /api/catfish-detection/flags/:flagId/report
       Report a message as suspicious

POST   /api/catfish-detection/check-user
       Check if user has suspicious patterns

GET    /api/catfish-detection/suspicious-users
       Get list of suspicious users (admin)
```

### 4. Integration into Message Sending

**In `backend/routes/messaging.js`:**

```javascript
router.post('/matches/:matchId/messages', async (req, res) => {
  // ... existing message validation ...

  const message = normalizedMessage;
  const toUserId = /* recipient */;

  // NEW: Scan message for red flags
  const scanResult = catfishDetectionService.scanMessage(message);

  if (scanResult.hasRedFlags) {
    // Create flag in database
    await catfishDetectionService.createFlag({
      messageId: messageId,
      fromUserId: userId,
      toUserId: toUserId,
      messageText: message,
      redFlags: scanResult.redFlags,
      flagType: scanResult.flagType,
      riskLevel: scanResult.riskLevel,
      confidenceScore: scanResult.confidenceScore,
      metadata: scanResult.metadata
    });

    // Include flag info in response/notification
    createdMessage.securityFlag = {
      hasRedFlags: true,
      flagType: scanResult.flagType,
      riskLevel: scanResult.riskLevel,
      warning: `⚠️ This message might be suspicious`
    };
  }

  // ... continue with normal message sending ...
});
```

### 5. Server Registration

**In `backend/server.js`:**

```javascript
// Add import
const catfishDetectionRoutes = require('./routes/catfishDetection');

// Register routes
app.use('/api/catfish-detection', authenticateToken, catfishDetectionRoutes);
```

---

## 💻 Frontend Integration

### 1. Service Layer

**File:** `src/services/catfishDetectionService.js`

```javascript
const catfishDetectionService = {
  async scanMessage(message) => {
    // POST /api/catfish-detection/scan
  },

  async getFlags(limit, offset, includeDismissed) => {
    // GET /api/catfish-detection/flags
  },

  async getStats() => {
    // GET /api/catfish-detection/stats
  },

  async dismissFlag(flagId) => {
    // POST /api/catfish-detection/flags/:flagId/dismiss
  },

  async reportFlag(flagId, reason) => {
    // POST /api/catfish-detection/flags/:flagId/report
  },

  async checkUser(userId) => {
    // POST /api/catfish-detection/check-user
  }
};
```

### 2. Message Warning Component

**File:** `src/components/MessageSecurityWarning.js`

Usage in messaging UI:

```javascript
import MessageSecurityWarning from './MessageSecurityWarning';
import catfishDetectionService from '../services/catfishDetectionService';

function ChatMessage({ message, flag }) {
  const handleDismiss = (flagId) => {
    return catfishDetectionService.dismissFlag(flagId);
  };

  const handleReport = (flagId, reason) => {
    return catfishDetectionService.reportFlag(flagId, reason);
  };

  return (
    <>
      {flag && (
        <MessageSecurityWarning
          flag={flag}
          onDismiss={handleDismiss}
          onReport={handleReport}
        />
      )}
      <div className="message">
        {message.text}
      </div>
    </>
  );
}
```

### 3. Dashboard Component

**File:** `src/components/CatfishDetectionDashboard.js`

Display security dashboard:

```javascript
import CatfishDetectionDashboard from './CatfishDetectionDashboard';

// In settings or trust & safety section
<CatfishDetectionDashboard />
```

### 4. Integration into Messaging UI

```javascript
// In DatingMessaging.js or similar
import { useEffect, useState } from 'react';
import catfishDetectionService from '../services/catfishDetectionService';

function DatingMessaging({ matchId }) {
  const [messages, setMessages] = useState([]);
  const [flaggedMessages, setFlaggedMessages] = useState({});

  // Load messages with flags
  useEffect(() => {
    const loadMessages = async () => {
      const msgs = await fetchMessages(matchId);
      
      // Check each message for flags
      for (const msg of msgs) {
        const scan = await catfishDetectionService.scanMessage(msg.text);
        if (scan.hasRedFlags) {
          // Query backend for flag details
          const flags = await catfishDetectionService.getFlags();
          // Match and store flags
        }
      }
      
      setMessages(msgs);
    };

    loadMessages();
  }, [matchId]);

  return (
    <div>
      {messages.map(msg => (
        <MessageSecurityWarning
          key={msg.id}
          flag={flaggedMessages[msg.id]}
          onDismiss={handleDismiss}
          onReport={handleReport}
        />
      ))}
    </div>
  );
}
```

---

## 🔌 API Reference

### POST /api/catfish-detection/scan

Scan a message for red flags.

**Request:**
```json
{
  "message": "Send me $100 via Venmo please"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message scanned",
  "scan": {
    "hasRedFlags": true,
    "redFlags": ["send me money", "venmo me", "$100"],
    "flagType": "payment_app",
    "riskLevel": "high",
    "confidenceScore": 0.95,
    "warning": "⚠️ This message might be suspicious (high risk)"
  }
}
```

### GET /api/catfish-detection/flags

Get flags for current user.

**Query Parameters:**
- `limit` (default: 50, max: 100)
- `offset` (default: 0)
- `includeDismissed` (default: false)

**Response:**
```json
{
  "success": true,
  "flags": [
    {
      "id": 1,
      "from_user_id": 5,
      "to_user_id": 1,
      "message_text": "Send me $100 via Venmo",
      "red_flags": ["send me money", "venmo me"],
      "flag_type": "payment_app",
      "risk_level": "high",
      "ai_confidence_score": 0.95,
      "created_at": "2026-04-28T10:00:00Z",
      "sender": {
        "id": 5,
        "username": "suspicious_user",
        "first_name": "John"
      }
    }
  ],
  "count": 1
}
```

### POST /api/catfish-detection/flags/:flagId/report

Report a message as suspicious.

**Request:**
```json
{
  "reason": "scam"  // or "money_request", "catfishing", "harassment", "other"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message reported successfully. Our team will review it.",
  "flag": { ...flag object... }
}
```

---

## 🧪 Testing Guide

### Unit Tests

```javascript
// Test scanning logic
describe('catfishDetectionService', () => {
  test('detects money requests', () => {
    const result = catfishDetectionService.scanMessage(
      'Can you send me $500 via Venmo?'
    );
    expect(result.hasRedFlags).toBe(true);
    expect(result.flagType).toContain('money_request');
    expect(result.riskLevel).toBe('high');
  });

  test('detects crypto requests', () => {
    const result = catfishDetectionService.scanMessage(
      'Send me Bitcoin: 1A1z7agoat2wSE2RNAq3G5L12qHTb5xCbn'
    );
    expect(result.hasRedFlags).toBe(true);
    expect(result.flagType).toBe('crypto');
    expect(result.riskLevel).toBe('critical');
  });

  test('handles false positives', () => {
    const result = catfishDetectionService.scanMessage(
      'I love working with crypto and Bitcoin as an investment'
    );
    expect(result.riskLevel).toBe('low');
  });
});
```

### Integration Tests

```javascript
describe('Catfish Detection Routes', () => {
  test('POST /api/catfish-detection/scan', async () => {
    const res = await request(app)
      .post('/api/catfish-detection/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Send me money Venmo' });

    expect(res.status).toBe(200);
    expect(res.body.scan.hasRedFlags).toBe(true);
  });

  test('GET /api/catfish-detection/flags', async () => {
    const res = await request(app)
      .get('/api/catfish-detection/flags')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.flags)).toBe(true);
  });
});
```

### Manual Testing

1. **Test in messaging UI:**
   ```
   Send a test message with money keywords: "Send me $100 via Venmo"
   Expected: Warning appears with HIGH risk alert
   ```

2. **Test dashboard:**
   ```
   Navigate to Trust & Safety dashboard
   Expected: See stats and all flagged messages
   ```

3. **Test reporting:**
   ```
   Click report on a suspicious message
   Expected: Message is reported and user can be blocked
   ```

---

## 🚀 Deployment

### Prerequisites

- PostgreSQL database running
- Backend and frontend build environments set up
- Environment variables configured

### Deployment Steps

**1. Database Migration**
```bash
cd backend
npm run db:migrate:up 20260428_add_catfish_detection
```

**2. Backend Deployment**
```bash
# Verify routes are registered
grep -n "catfish-detection" backend/server.js

# Build and deploy backend
npm run build
npm start
```

**3. Frontend Build**
```bash
cd frontend
npm run build
# Verify components compiled without errors
```

**4. Verification Checklist**

- [ ] Database table created: `SELECT * FROM catfish_detection_flags LIMIT 1;`
- [ ] Routes accessible: `GET /api/catfish-detection/flags` (returns empty array)
- [ ] Components load without errors
- [ ] Can send test message and see alert
- [ ] Dashboard loads with stats
- [ ] Report functionality works
- [ ] User can dismiss alerts

**5. Post-Deployment**

- Monitor error logs for catfish detection errors
- Test red flag patterns with real users
- Collect feedback on false positive rate
- Adjust keyword patterns based on user feedback
- Monitor moderation queue for reported messages

---

## 🔍 Monitoring & Maintenance

### Key Metrics

```sql
-- Monitor flagged message rate
SELECT 
  COUNT(*) as total_flags,
  COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_count,
  AVG(ai_confidence_score) as avg_confidence
FROM catfish_detection_flags
WHERE created_at > NOW() - INTERVAL '7 days';

-- Identify most common red flags
SELECT 
  red_flags,
  COUNT(*) as frequency
FROM catfish_detection_flags
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY red_flags
ORDER BY frequency DESC;
```

### Maintenance Tasks

1. **Weekly:** Review false positive reports
2. **Monthly:** Update red flag patterns based on new scam tactics
3. **Quarterly:** Analyze effectiveness and refine confidence scoring
4. **Ongoing:** Monitor moderation queue for reported messages

---

**Catfish Prevention AI deployment complete! 🛡️**
