# Smart Rewind Feature - Integration Guide

## Overview
The Smart Rewind Feature enables users to view profiles they've passed on during the past 7 days and re-like them. Passed profiles are organized by pass reason (age, distance, interests, goals, body type, height, or other). Premium users get unlimited daily rewinds, while free users are limited to 3 per day.

## Architecture

### Backend Components
- **Models**:
  - `UserDecisionHistory` - Tracks all swipe decisions with pass reasons
  - `RewindQuotaTracker` - Tracks daily rewind usage per user

- **Service**:
  - `rewindService.js` - Business logic for categorizing passes, formatting responses, checking quotas

- **Routes** (`backend/routes/dating.js`):
  - `GET /api/dating/rewind/quota` - Get rewind limits and usage
  - `GET /api/dating/rewind/history` - Get passed profiles (paginated)
  - `GET /api/dating/rewind/history/by-reason` - Get passed profiles grouped by reason
  - `POST /api/dating/rewind/restore/:profileId` - Rewind (re-like) a profile
  - `POST /api/dating/rewind/record-pass` - Record a pass with reason

### Frontend Components
- **SmartRewindHistory.jsx** - Main component with two views (by-reason and timeline)
- **RewindQuotaBar.jsx** - Compact quota status indicator
- **PassReasonTag.jsx** - Visual tag for displaying pass reasons

## Integration Steps

### 1. Backend Setup (Already Done)
No additional setup needed - models and routes are already implemented.

### 2. Frontend Integration

#### Step 2a: Import Components in Your App
```jsx
import SmartRewindHistory from './components/dating/SmartRewindHistory';
import RewindQuotaBar from './components/dating/RewindQuotaBar';
import PassReasonTag from './components/dating/PassReasonTag';
```

#### Step 2b: Add SmartRewindHistory to Dating Dashboard
In your dating module's main component (e.g., `DatingDashboard.jsx`):

```jsx
import SmartRewindHistory from '../components/dating/SmartRewindHistory';

function DatingDashboard() {
  const [rewindRefresh, setRewindRefresh] = useState(0);

  const handleProfileRestore = (restoredProfile) => {
    // Profile has been restored - show it to user
    console.log('Profile restored:', restoredProfile);
    // You might want to add it to the discovery queue or show a modal
  };

  return (
    <div className="dating-dashboard">
      <SmartRewindHistory 
        userId={currentUserId}
        onProfileRestore={handleProfileRestore}
      />
      {/* Other dashboard content */}
    </div>
  );
}
```

#### Step 2c: Add RewindQuotaBar to Discovery Screen
In your discovery/swipe component (e.g., `DiscoverySwiper.jsx`):

```jsx
import RewindQuotaBar from '../components/dating/RewindQuotaBar';

function DiscoverySwiper() {
  const [quotaRefresh, setQuotaRefresh] = useState(0);

  return (
    <div className="discovery-container">
      <RewindQuotaBar refreshTrigger={quotaRefresh} />
      {/* Discovery cards and swipe logic */}
    </div>
  );
}
```

### 3. Pass Tracking in Discovery Flow

#### Step 3a: Import Pass Recording Service
```jsx
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';

// In your discovery swipe handler:
const handlePassProfile = async (profileId, passReason = 'other') => {
  try {
    // Record the pass with reason
    const response = await axios.post(
      `${API_BASE_URL}/api/dating/rewind/record-pass`,
      {
        profileId,
        reason: passReason, // 'age', 'distance', 'interests', 'goals', 'body_type', 'height', 'other'
        context: 'discovery'
      },
      { withCredentials: true }
    );
    
    console.log('Pass recorded:', response.data);
    
    // Continue with your swiping logic
    loadNextProfile();
  } catch (err) {
    console.error('Failed to record pass:', err);
  }
};
```

#### Step 3b: Auto-detect Pass Reason (Optional)
You can automatically detect the pass reason by comparing user preferences with profile data:

```jsx
// Utility function to determine pass reason
const getPassReasonFromComparison = (userPrefs, candidateProfile) => {
  if (candidateProfile.age < userPrefs.ageMin || candidateProfile.age > userPrefs.ageMax) {
    return 'age';
  }
  
  if (calculateDistance(userPrefs.location, candidateProfile.location) > userPrefs.maxDistance) {
    return 'distance';
  }
  
  const commonInterests = userPrefs.interests.filter(i => 
    candidateProfile.interests.includes(i)
  ).length;
  
  if (userPrefs.interests.length > 0 && commonInterests === 0) {
    return 'interests';
  }
  
  return 'other';
};
```

### 4. Display Pass Reasons

Use the `PassReasonTag` component throughout your app to display why a profile was passed:

```jsx
import PassReasonTag from '../components/dating/PassReasonTag';

// In any component showing a passed profile
<PassReasonTag reason="distance" size="medium" variant="solid" />

// Available sizes: 'small' | 'medium' | 'large'
// Available variants: 'default' | 'solid' | 'outline'
```

### 5. Linking Rewind History to Navigation

#### Step 5a: Add Menu Item
In your app's navigation menu:

```jsx
<NavLink to="/dating/rewind-history">
  🔄 Rewind History
</NavLink>
```

#### Step 5b: Create Route
In your routing configuration:

```jsx
import SmartRewindHistory from './components/dating/SmartRewindHistory';

<Route 
  path="/dating/rewind-history" 
  element={<SmartRewindHistory userId={currentUserId} />}
/>
```

## API Reference

### GET /api/dating/rewind/quota
Get rewind quota status for current user.

**Response:**
```json
{
  "success": true,
  "quota": {
    "isPremium": false,
    "dailyLimit": 3,
    "usedToday": 1,
    "remainingToday": 2,
    "canRewind": true,
    "message": "2 rewinds remaining today"
  },
  "resetTime": "2026-04-29T00:00:00.000Z",
  "premiumUpgradeUrl": "/premium-plans"
}
```

### GET /api/dating/rewind/history
Get passed profiles timeline (past 7 days).

**Query Parameters:**
- `limit` (optional): Default 50, max 100
- `offset` (optional): Default 0

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "decisionId": 123,
      "profileId": 456,
      "passedAt": "2026-04-28T14:30:00Z",
      "passReason": "distance",
      "passReasonLabel": "📍 Too Far Away",
      "passReasonIcon": "📍",
      "profile": {
        "id": 456,
        "firstName": "Sarah",
        "age": 28,
        "verified": true,
        "interests": ["hiking", "yoga"],
        "photoUrl": "https://..."
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 50,
    "total": 15,
    "hasMore": false
  }
}
```

### GET /api/dating/rewind/history/by-reason
Get passed profiles grouped by pass reason.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "reason": "distance",
      "label": "📍 Too Far Away",
      "icon": "📍",
      "count": 5,
      "profiles": [
        {
          "decisionId": 123,
          "profileId": 456,
          "passedAt": "2026-04-28T14:30:00Z",
          "profile": {...}
        }
      ]
    },
    {
      "reason": "age",
      "label": "📅 Age Mismatch",
      "icon": "📅",
      "count": 3,
      "profiles": [...]
    }
  ],
  "totalPassed": 15
}
```

### POST /api/dating/rewind/restore/:profileId
Restore (re-like) a previously passed profile.

**Response:**
```json
{
  "success": true,
  "message": "Profile rewound successfully",
  "restoredProfile": {
    "id": 456,
    "firstName": "Sarah",
    "age": 28,
    "verified": true,
    "interests": ["hiking", "yoga"],
    "photos": [...]
  },
  "quota": {
    "isPremium": false,
    "dailyLimit": 3,
    "usedToday": 2,
    "remainingToday": 1,
    "canRewind": true,
    "message": "1 rewind remaining today"
  }
}
```

### POST /api/dating/rewind/record-pass
Record a pass decision with reason.

**Request:**
```json
{
  "profileId": 456,
  "reason": "distance",
  "context": "discovery"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pass recorded",
  "reason": "distance",
  "reasonLabel": "📍 Too Far Away"
}
```

## Error Handling

### Quota Exceeded (429)
```json
{
  "error": "Daily rewind limit reached",
  "limit": 3,
  "used": 3,
  "message": "Free users limited to 3 rewinds per day"
}
```

### Profile Not Found (404)
```json
{
  "error": "No pass found for this profile"
}
```

## Database Migrations

If models haven't been auto-synced, run:

```bash
# Backend
cd backend
npm run migrate

# Or manually using Sequelize
npx sequelize db:migrate
```

## Testing

### Test Rewind Quota
```bash
curl -X GET http://localhost:5000/api/dating/rewind/quota \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test History Retrieval
```bash
curl -X GET "http://localhost:5000/api/dating/rewind/history?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Profile Restoration
```bash
curl -X POST http://localhost:5000/api/dating/rewind/restore/456 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## Feature Flags

### Enable/Disable for Premium Only
Modify `backend/routes/dating.js` in the `/rewind/*` endpoints to add subscription check:

```jsx
const subscriptionAccess = await getSubscriptionAccessForUser(userId);
if (!subscriptionAccess.isPremium && !subscriptionAccess.isGold) {
  return res.status(403).json({ 
    error: 'Premium feature - upgrade to use Smart Rewind' 
  });
}
```

## Analytics & Monitoring

Track these events:
- Rewind quota checks
- Pass recordings (by reason)
- Rewind usage (daily quota tracking)
- Profile restorations
- Premium upgrades via rewind CTA

## Troubleshooting

### Rewinds not being tracked
- Check `UserDecisionHistory` table for recent pass records
- Verify `pass_reason` field is populated
- Check database indexes are created

### Quota not resetting
- Verify `RewindQuotaTracker` table uses UTC dates
- Check `quota_date` format (DATEONLY in UTC)
- Query: `SELECT * FROM rewind_quota_tracker WHERE user_id = X ORDER BY quota_date DESC`

### Frontend not showing history
- Check console for API errors
- Verify authentication token is being sent
- Check CORS settings if calling from different domain
- Verify `withCredentials: true` on axios calls

## Future Enhancements

1. **Smart Re-suggestions** - Offer to re-swipe passed profiles when new filters applied
2. **Pass Analytics** - Dashboard showing common pass reasons
3. **Rewind Boost** - Premium feature: one free rewind per match made
4. **Group Rewind** - Undo multiple passes at once
5. **Pass Reason Refinement** - ML model to improve pass categorization
