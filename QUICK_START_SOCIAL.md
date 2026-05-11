# ⚡ QUICK START - Mount Social Routes

## Step 1: Open backend/server.js

Add this code where other routes are mounted (usually around line 50-80):

```javascript
// Social Features Routes
const socialRoutes = require('./routes/social');
app.use('/social', socialRoutes);
```

## Complete Example (what it should look like)

```javascript
const express = require('express');
const cors = require('cors');
const app = express();

// ... middleware setup ...

// Routes
const authRoutes = require('./routes/auth');
const datingRoutes = require('./routes/dating');
const messagingRoutes = require('./routes/messaging');
const chatRooms = require('./routes/chatrooms');

// Social Features - ADD THIS
const socialRoutes = require('./routes/social');

// Mount routes
app.use('/auth', authRoutes);
app.use('/dating', datingRoutes);
app.use('/messaging', messagingRoutes);
app.use('/chatrooms', chatRooms);

// Mount social routes - ADD THIS
app.use('/social', socialRoutes);

// ... rest of server setup ...
```

## That's it! 

Your social features are now:
✅ Available at `http://localhost:5000/social/*`  
✅ Ready to receive API calls  
✅ Integrated with your authentication  
✅ Connected to your database  

## Test Immediately

```bash
# Get referral info
curl http://localhost:5000/social/referral/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "id": 1,
  "code": "ABC123DEF456",
  "link": "https://datinghub.app/signup?ref=ABC123DEF456",
  "status": "pending"
}
```

Done! 🚀
