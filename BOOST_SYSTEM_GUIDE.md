# Profile Boost System

## Overview

The Profile Boost System allows premium users to temporarily increase their profile visibility in the discovery section. Boosts use smart scheduling, real-time analytics, and ROI tracking to help users maximize their dating success.

## Features

### 🚀 Quick Activation
- One-click boost activation
- Smart scheduling (Friday 8PM optimal time)
- Manual time selection option
- Immediate or scheduled deployment

### 📊 Real-Time Analytics
- Live impression tracking
- Click-through rate (CTR) calculation
- Likes and messages tracking
- ROI calculation based on engagement
- Cost-per-click and cost-per-engagement metrics

### 💰 Flexible Pricing
- **Standard**: $2.99 for 1 hour (3x visibility)
- **Premium**: $5.99 for 2 hours (5x visibility) - Most popular
- **Ultimate**: $8.99 for 3 hours (10x visibility)
- Bulk discounts: 10% off (3x), 15% off (5x), 25% off (10x)

### ⏰ Smart Scheduling
- AI-optimized timing based on target audience activity
- Default: Friday 8 PM (peak engagement time)
- Custom date/time selection available
- Timezone-aware scheduling

### 📱 User Experience
- Beautiful gradient UI with smooth animations
- Real-time timer showing remaining duration
- Compact and full analytics views
- Mobile-responsive design
- Dark mode support

## Architecture

### Backend

#### Models
- **ProfileBoost** (`backend/models/ProfileBoost.js`)
  - Stores boost records with full analytics
  - Tracks status: scheduled, active, completed, cancelled
  - Indexes on user_id, status, expires_at for performance

#### Services
- **boostService.js** (`backend/services/boostService.js`)
  - Core business logic for boost management
  - Smart scheduling algorithms
  - Analytics calculation
  - Pricing and discount logic
  - ~900 lines of well-documented code

#### Routes
- **boosts.js** (`backend/routes/boosts.js`)
  - 7 REST endpoints for boost operations
  - All authenticated (except /packages)
  - Consistent response format

### Frontend

#### Hooks
- **useBoosts.js** (`src/hooks/useBoosts.js`)
  - Data fetching and state management
  - Auto-initialization on component mount
  - Error handling and loading states
  - ~300 lines of React code

#### Components
- **BoostButton.jsx** (`src/components/BoostButton.jsx`)
  - Quick access button for profiles
  - Shows active boost status
  - Compact and full-size variants
  - Modal overlay

- **BoostPurchasePanel.jsx** (`src/components/BoostPurchasePanel.jsx`)
  - Package selection and pricing
  - Bulk purchase options
  - Smart scheduling controls
  - Pre-purchase summary
  - ~450 lines

- **BoostAnalytics.jsx** (`src/components/BoostAnalytics.jsx`)
  - Real-time analytics dashboard
  - ROI and engagement metrics
  - Quick insights
  - Compact and full views
  - ~450 lines

#### Styling
- Professional gradient designs
- Smooth animations and transitions
- Full dark mode support
- Mobile-first responsive design
- ~1200 lines of CSS

## API Reference

### GET /api/boosts/packages
Get available boost packages and bulk pricing.

**Response:**
```json
{
  "success": true,
  "packages": [
    {
      "type": "standard",
      "name": "1 Hour Visibility Boost",
      "multiplier": 3,
      "duration": 60,
      "basePrice": 2.99,
      "features": [...]
    }
  ],
  "bulkPricing": [
    { "quantity": 1, "discount": 0, "label": "1 Boost" },
    { "quantity": 3, "discount": 0.1, "label": "3 Boosts - Save 10%" }
  ]
}
```

### GET /api/boosts/pricing
Calculate pricing with optional bulk discounts.

**Query Parameters:**
- `type` (string): boost type (standard, premium, ultimate)
- `quantity` (number): number of boosts (1-10)

**Response:**
```json
{
  "success": true,
  "pricing": {
    "basePrice": 2.99,
    "discount": 0,
    "discountAmount": 0,
    "finalPrice": 2.99,
    "savings": 0
  }
}
```

### POST /api/boosts/purchase
Purchase a boost with optional smart scheduling.

**Body:**
```json
{
  "type": "premium",
  "smartSchedule": true,
  "scheduledTime": "2024-01-12T20:00:00" // optional, required if smartSchedule=false
}
```

**Response:**
```json
{
  "success": true,
  "boost": {
    "id": 1,
    "type": "premium",
    "multiplier": 5,
    "duration": 120,
    "status": "scheduled",
    "scheduledStart": "2024-01-12T20:00:00",
    "expiresAt": "2024-01-12T22:00:00",
    "price": 5.99,
    "message": "Boost scheduled for Friday 8:00 PM - optimal time for your audience!"
  }
}
```

### GET /api/boosts/active
Get user's currently active boosts.

**Response:**
```json
{
  "success": true,
  "count": 1,
  "boosts": [
    {
      "id": 1,
      "type": "premium",
      "status": "active",
      "remainingMinutes": 45,
      "impressions": 234,
      "clicks": 12,
      "ctr": 5.13,
      "likesReceived": 8,
      "messagesReceived": 2
    }
  ]
}
```

### GET /api/boosts/history?limit=20
Get user's boost history with analytics.

**Response:**
```json
{
  "success": true,
  "count": 5,
  "boosts": [...]
}
```

### GET /api/boosts/:boostId/analytics
Get detailed analytics for a specific boost.

**Response:**
```json
{
  "success": true,
  "analytics": {
    "id": 1,
    "type": "premium",
    "status": "completed",
    "period": { "start": "...", "end": "...", "duration": 120 },
    "impressions": 450,
    "clicks": 23,
    "ctr": 5.11,
    "likesReceived": 15,
    "messagesReceived": 8,
    "engagement": 23,
    "cost": 5.99,
    "roi": 284.47,
    "costPerClick": "0.26",
    "costPerEngagement": "0.26"
  }
}
```

### POST /api/boosts/:boostId/cancel
Cancel an active or scheduled boost (pro-rata refund).

**Response:**
```json
{
  "success": true,
  "message": "Boost cancelled",
  "refund": 2.99,
  "refundMessage": "You'll receive a refund of $2.99"
}
```

### GET /api/boosts/eligibility
Check if user can use boosts.

**Response:**
```json
{
  "success": true,
  "canUseBoosts": true,
  "message": "You can purchase boosts"
}
```

## Database

### profile_boosts Table
```sql
CREATE TABLE profile_boosts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boost_type ENUM('standard', 'premium', 'ultimate'),
  visibility_multiplier DECIMAL(3,1),
  duration_minutes INT,
  price_paid DECIMAL(10,2),
  status ENUM('scheduled', 'active', 'completed', 'cancelled'),
  scheduled_start DATETIME,
  started_at DATETIME,
  expires_at DATETIME,
  cancelled_at DATETIME,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  likes_received INT DEFAULT 0,
  messages_received INT DEFAULT 0,
  smart_scheduling_enabled BOOLEAN DEFAULT TRUE,
  ctr DECIMAL(5,2),
  roi DECIMAL(5,2),
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW(),
  KEY idx_user_id (user_id),
  KEY idx_status (status),
  KEY idx_expires_at (expires_at),
  KEY idx_scheduled_start (scheduled_start)
);
```

## Integration Guide

### 1. Add to Profile Component
```jsx
import BoostButton from './components/BoostButton';

function DatingProfile() {
  return (
    <div className="profile">
      {/* Profile content */}
      <BoostButton 
        onBoostActivated={(boost) => {
          console.log('Boost activated!', boost);
          // Refresh profile or show success message
        }}
        compact={false}
      />
    </div>
  );
}
```

### 2. Display Active Boosts
```jsx
import BoostAnalytics from './components/BoostAnalytics';
import useBoosts from './hooks/useBoosts';

function BoostStatus() {
  const { activeBoosts } = useBoosts();
  
  if (!activeBoosts.length) return null;
  
  return (
    <div>
      {activeBoosts.map(boost => (
        <BoostAnalytics key={boost.id} boostId={boost.id} compact />
      ))}
    </div>
  );
}
```

### 3. Setup Tasks

Run the database migration:
```bash
npm run migrate
```

Or manually:
```sql
-- Run backend/migrations/20260501_create_profile_boosts.js
```

## Smart Scheduling Algorithm

The boost system uses activity pattern analysis to determine optimal display times:

1. **Analyze Target Audience**: Identifies when the user's target demographic is most active
2. **Find Peak Hours**: Calculates the hour with highest activity (default: Friday 8 PM)
3. **Schedule Intelligently**: Creates boosts for maximum visibility during peak times
4. **Real-time Adjustment**: Updates based on actual user behavior patterns

## Analytics Calculations

### Click-Through Rate (CTR)
```
CTR = (Clicks / Impressions) × 100
```

### Return on Investment (ROI)
```
Engagement Value = (Likes × 0.5) + (Messages × 1)
ROI = ((Engagement Value - Cost) / Cost) × 100
```

### Cost Efficiency
```
Cost Per Click = Total Cost / Total Clicks
Cost Per Engagement = Total Cost / (Likes + Messages)
```

## Best Practices

1. **Optimal Timing**: Use smart scheduling for best results (usually Friday 8 PM)
2. **Monitor Analytics**: Check real-time stats to understand engagement patterns
3. **Bulk Purchasing**: Buy 10 boosts at once to save 25% ($89.90 vs $29.90)
4. **Frequency**: Space boosts 3-7 days apart to maintain freshness
5. **Profile Quality**: Ensure profile is 100% complete before boosting (better conversion)
6. **Cancellation**: Cancel early boosts if ROI is below 0% to recover investment

## Troubleshooting

### Boost not appearing as active
- Check database migration has been run
- Verify user has premium subscription
- Check expires_at timestamp

### Analytics not updating
- Refresh analytics page (10-second polling interval)
- Check ProfileView and like/message events are being recorded

### Smart scheduling not working
- Verify UserActivityPattern data exists
- Check server timezone settings
- Ensure database has activity data from last 30 days

## Future Enhancements

1. **AI Optimization**: Machine learning for personalized timing
2. **A/B Testing**: Test different multipliers and durations
3. **Targeting**: Geographic, age, interest-based targeting
4. **Referral Bonuses**: Free boosts for referrals
5. **Social Proof**: Show boost performance publicly
6. **Win-back Campaigns**: Special boost offers for inactive users
7. **Team Boosts**: Share boosts with friend circles
8. **Payment Integration**: Full Stripe integration for payments

## Files Created

**Backend:**
- `backend/models/ProfileBoost.js` - Database model
- `backend/services/boostService.js` - Business logic (~900 lines)
- `backend/routes/boosts.js` - API endpoints (~250 lines)
- `backend/migrations/20260501_create_profile_boosts.js` - Database migration

**Frontend:**
- `src/hooks/useBoosts.js` - Data management (~300 lines)
- `src/components/BoostButton.jsx` - Quick action button (~150 lines)
- `src/components/BoostPurchasePanel.jsx` - Purchase UI (~450 lines)
- `src/components/BoostAnalytics.jsx` - Analytics dashboard (~450 lines)
- `src/components/BoostButton.css` - Button styling (~200 lines)
- `src/components/BoostPurchasePanel.css` - Panel styling (~600 lines)
- `src/components/BoostAnalytics.css` - Analytics styling (~600 lines)

**Total Code: ~4000+ lines**

## Support

For issues or questions about the Boost System, check:
1. Console logs for errors
2. Network tab for API calls
3. Database schema for migration status
4. Component props and state in React DevTools
