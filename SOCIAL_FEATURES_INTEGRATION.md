# Social Features - Integration Checklist

## 📋 Pre-Integration Setup

### 1. **Backend Integration**
- [ ] Verify all 6 models are in `/backend/models/` directory
- [ ] Confirm User model has social relationships (already updated)
- [ ] Models auto-load in `/backend/models/index.js` (confirm models/*.js pattern)

### 2. **Mount Social Routes**
File: `backend/server.js`

Add after other route mounts (around line where other routes are mounted):
```javascript
// Social Features
const socialRoutes = require('./routes/social');
app.use('/social', socialRoutes);
```

### 3. **Environment Variables** (if needed)
Add to `.env`:
```
APP_BASE_URL=http://localhost:3000  # For referral links
SOCIAL_PROVIDERS_API_KEY=xxx        # OAuth tokens (future)
```

### 4. **Database Migrations** (Sequelize)
```bash
# Auto-create tables from models
npm run db:migrate

# Or seed with sample data
npm run db:seed
```

---

## 🎨 Frontend Integration

### 1. **Import Components in App.js**
```javascript
import ReferralShareModal from './components/ReferralShareModal';
import FriendsList from './components/FriendsList';
import SocialIntegration from './components/SocialIntegration';
import GroupChat from './components/GroupChat';
```

### 2. **Add State Management**
```javascript
const [showReferral, setShowReferral] = useState(false);
const [showFriends, setShowFriends] = useState(false);
const [showSocial, setShowSocial] = useState(false);
const [activeGroupChat, setActiveGroupChat] = useState(null);
```

### 3. **Mount Modals in DatingProfile Component**
```javascript
<button onClick={() => setShowReferral(true)}>Share Profile</button>
<button onClick={() => setShowFriends(true)}>Friends</button>
<button onClick={() => setShowSocial(true)}>Social Media</button>

{showReferral && <ReferralShareModal onClose={() => setShowReferral(false)} />}
{showFriends && <FriendsList onClose={() => setShowFriends(false)} />}
{showSocial && <SocialIntegration onClose={() => setShowSocial(false)} />}
{activeGroupChat && <GroupChat groupId={activeGroupChat} onClose={() => setActiveGroupChat(null)} />}
```

---

## 🧪 Testing Commands

### 1. **Test Backend Endpoints**
```bash
# Get referral info
curl http://localhost:5000/social/referral/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Send friend request
curl -X POST http://localhost:5000/social/friends/add \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetUserId": 2}'

# Add social integration
curl -X POST http://localhost:5000/social/integrations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"platform": "instagram", "username": "@myusername", "isPublic": true}'

# Create group chat
curl -X POST http://localhost:5000/social/group-chats \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Squad", "memberIds": [2, 3]}'
```

### 2. **Test Frontend Components**
```javascript
// In browser console:
import socialService from './services/socialService';

// Test referral
socialService.getReferralInfo().then(console.log);

// Test friends
socialService.getFriends('accepted', 50).then(console.log);

// Test social integration
socialService.getSocialIntegrations().then(console.log);

// Test group chat
socialService.getGroupChats().then(console.log);
```

---

## 📊 Endpoint Summary

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/social/referral/me` | Get referral code | ✅ |
| GET | `/social/referral/stats` | Get referral stats | ✅ |
| POST | `/social/referral/validate` | Validate code | ✗ |
| POST | `/social/friends/add` | Send request | ✅ |
| POST | `/social/friends/:id/accept` | Accept request | ✅ |
| POST | `/social/friends/:id/decline` | Decline request | ✅ |
| GET | `/social/friends/list` | Get friends | ✅ |
| DELETE | `/social/friends/:id` | Remove friend | ✅ |
| POST | `/social/integrations` | Add social account | ✅ |
| GET | `/social/integrations` | Get accounts | ✅ |
| DELETE | `/social/integrations/:id` | Remove account | ✅ |
| GET | `/social/integrations/:id/public` | Get public profiles | ✗ |
| POST | `/social/group-chats` | Create group | ✅ |
| GET | `/social/group-chats` | Get groups | ✅ |
| POST | `/social/group-chats/:id/messages` | Send message | ✅ |
| GET | `/social/group-chats/:id/messages` | Get messages | ✅ |
| POST | `/social/group-chats/:id/leave` | Leave group | ✅ |

---

## ⚙️ Configuration Options

### Referral Settings
File: `backend/routes/social.js` (lines ~10-15)
```javascript
const MAX_FRIENDS = 1000;              // Max friend count
const REFERRAL_EXPIRY_DAYS = 30;       // Code expiry
const REFERRAL_CODE_LENGTH = 12;       // Code character length
```

### Group Chat Settings
File: `backend/models/GroupChat.js`
```javascript
defaults: {
  maxMembers: 100,                     // Max members per group
  allowMediaSharing: true,
  allowVideoCall: true,
  hideFromProfile: false
}
```

---

## 🚨 Common Issues & Fixes

### Issue: Routes not found (404)
**Fix:** Ensure `app.use('/social', socialRoutes)` is added in server.js BEFORE other error handlers

### Issue: Foreign key constraint errors
**Fix:** Ensure Referral model's `referred_user_id` is nullable (it is by default)

### Issue: Models not auto-loading
**Fix:** Verify models are `.js` files in `/backend/models/` and follow naming convention

### Issue: Authentication errors on endpoints
**Fix:** Add `req.user = { id: 1 }` in middleware if testing without real auth

---

## 📈 Monitoring & Logging

Add to endpoints for production monitoring:
```javascript
console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${req.user?.id}`);
```

---

## 🔒 Security Checklist

Before production deployment:
- [ ] Rate limiting on `/social/friends/add` (spam prevention)
- [ ] Rate limiting on `/social/referral/validate` (brute force)
- [ ] Input sanitization with Joi validation
- [ ] OAuth token encryption at rest
- [ ] HTTPS enforced
- [ ] CORS properly configured
- [ ] User ownership checks on all endpoints
- [ ] Audit logging for sensitive actions
- [ ] Regular security audits

---

## 📚 Reference Links

- Models: `backend/models/Referral.js`, `FriendRelationship.js`, etc.
- Routes: `backend/routes/social.js`
- Service: `src/services/socialService.js`
- Components: `src/components/{Referral,Friends,Social,GroupChat}*.js`
- Styles: `src/styles/{Referral,Friends,Social,GroupChat}*.css`

---

## ✅ Verification Steps

After integration:
1. [ ] All endpoints respond with 200/201 for valid requests
2. [ ] Invalid tokens return 401
3. [ ] Referral code is unique and 12 chars
4. [ ] Friend requests are bidirectional
5. [ ] Social integrations save correctly
6. [ ] Group messages paginate properly
7. [ ] UI components render without errors
8. [ ] Navigation between features works

---

## 📞 Support Resources

- SOCIAL_FEATURES_GUIDE.md - Complete feature documentation
- This file - Integration checklist
- Code comments in models/routes/components
- Error messages in API responses

---

**Last Updated:** April 27, 2026  
**Status:** Ready for Integration  
**Estimated Setup Time:** 30 minutes
