# Photo A/B Testing - Quick Start Guide

## 🎯 Overview

Photo A/B Testing lets you scientifically determine which of your 2 photos performs better with potential matches. Compare likes, views, and engagement over a 48-hour period, then automatically promote the winner to your profile's first photo.

**Key Benefits:**
- 📊 See which photo gets more likes and engagement
- 📈 Track real-time performance metrics  
- 🏆 Automatically promote the winning photo to position #1
- 🔄 Make data-driven profile optimization decisions

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Start a Test
```javascript
import PhotoABTestUpload from './components/PhotoABTestUpload';

<PhotoABTestUpload 
  userPhotos={userPhotos}
  onTestCreated={(test) => console.log('Test created:', test)}
/>
```

### Step 2: View Tests in Dashboard
```javascript
import PhotoABTestDashboard from './components/PhotoABTestDashboard';

<PhotoABTestDashboard 
  onSelectTest={(testId) => setSelectedTestId(testId)}
/>
```

### Step 3: See Results
```javascript
import PhotoABTestResults from './components/PhotoABTestResults';

<PhotoABTestResults 
  testId={selectedTestId}
  onClose={() => setSelectedTestId(null)}
/>
```

---

## 📁 Files Created

### Backend (5 files)

**Models:**
- `backend/models/PhotoABTest.js` - Main test tracking model
- `backend/models/PhotoABTestResult.js` - Individual event tracking

**Service:**
- `backend/services/photoABTestService.js` - Business logic (8 core methods)

**Routes:**
- `backend/routes/photoABTesting.js` - 8 API endpoints

**Database:**
- `backend/migrations/20260428_add_photo_ab_testing.js` - Schema migration

**Server:**
- `backend/server.js` - Updated to register routes

### Frontend (4 files)

**Components:**
- `src/components/PhotoABTestUpload.js` - Create new tests
- `src/components/PhotoABTestDashboard.js` - View all tests
- `src/components/PhotoABTestResults.js` - Detailed analysis

**Service:**
- `src/services/photoABTestService.js` - API abstraction

### Styling (3 files)
- `src/styles/PhotoABTestUpload.css` - 350+ lines
- `src/styles/PhotoABTestDashboard.css` - 400+ lines  
- `src/styles/PhotoABTestResults.css` - 500+ lines

---

## 🗄️ Database Schema

### photo_ab_tests Table

```sql
CREATE TABLE photo_ab_tests (
  id INTEGER PRIMARY KEY
  user_id INTEGER (FK to users)
  photo_a_id INTEGER (FK to profile_photos)
  photo_b_id INTEGER (FK to profile_photos)
  test_name VARCHAR(255)
  status ENUM('active', 'paused', 'completed')
  test_duration_hours INTEGER (default 48)
  likes_a INTEGER (default 0)
  likes_b INTEGER (default 0)
  views_a INTEGER (default 0)
  views_b INTEGER (default 0)
  engagement_a DECIMAL(5,2) (calculated)
  engagement_b DECIMAL(5,2) (calculated)
  winner ENUM('A', 'B', 'tie')
  win_margin DECIMAL(5,2)
  auto_promoted BOOLEAN (default false)
  promoted_photo_id INTEGER (FK to profile_photos)
  started_at TIMESTAMP
  completed_at TIMESTAMP
  notes TEXT
  created_at TIMESTAMP
  updated_at TIMESTAMP
  
  Indexes: user_id, status, winner, created_at
)
```

### photo_ab_test_results Table

```sql
CREATE TABLE photo_ab_test_results (
  id INTEGER PRIMARY KEY
  test_id INTEGER (FK to photo_ab_tests)
  user_id INTEGER (FK to users)
  liker_user_id INTEGER (FK to users)
  photo_id INTEGER (FK to profile_photos)
  photo_version ENUM('A', 'B')
  event_type ENUM('like', 'view', 'pass')
  timestamp TIMESTAMP
  created_at TIMESTAMP
  
  Indexes: test_id, user_id, photo_version, event_type, timestamp
)
```

---

## 🔌 API Endpoints

### 1. Create Test
```
POST /api/photo-ab-testing
Body: {
  photoAId: 123,
  photoBId: 456,
  testName: "Outdoor vs Indoor",
  durationHours: 48
}
Response: { success: true, test: {...} }
```

### 2. Get Test Details
```
GET /api/photo-ab-testing/:testId
Response: { success: true, test: {...} }
```

### 3. Get All User Tests
```
GET /api/photo-ab-testing/user/all?status=active&limit=10&offset=0
Response: { success: true, tests: [...], count: 5 }
```

### 4. Record a Like
```
POST /api/photo-ab-testing/:testId/like
Body: {
  photoId: 123,
  photoVersion: 'A'
}
Response: { success: true, message: 'Like recorded', test: {...} }
```

### 5. Record a View
```
POST /api/photo-ab-testing/:testId/view
Body: {
  photoVersion: 'A'
}
Response: { success: true, message: 'View recorded', test: {...} }
```

### 6. Get Test Results
```
GET /api/photo-ab-testing/:testId/results
Response: {
  test: {...},
  likesA: 12,
  likesB: 8,
  viewsA: 45,
  viewsB: 38,
  engagementA: 26.67,
  engagementB: 21.05,
  totalEvents: 103,
  timeline: [...]
}
```

### 7. Get Test Insights
```
GET /api/photo-ab-testing/:testId/insights
Response: {
  insights: {
    testStatus: 'active',
    winner: 'A',
    winMargin: 5.62,
    recommendations: [...],
    insights: [...]
  }
}
```

### 8. Pause/Resume/End Test
```
PUT /api/photo-ab-testing/:testId/pause
PUT /api/photo-ab-testing/:testId/resume
PUT /api/photo-ab-testing/:testId/end
Response: { success: true, test: {...} }
```

---

## 🧠 Service Methods

### Core Business Logic

**photoABTestService.js** provides these methods:

```javascript
// Create a new test
createTest(userId, photoAId, photoBId, testName, durationHours)

// Record interactions
recordLike(testId, likerUserId, photoId, photoVersion)
recordView(testId, viewerUserId, photoVersion)

// Update and analyze
updateMetrics(testId) // Calculate engagement, check completion

// Get data
getTestDetails(testId, userId)
getUserTests(userId, status, limit, offset)
getTestResults(testId, userId)
getTestInsights(testId, userId)

// Manage tests
pauseTest(testId, userId)
resumeTest(testId, userId)
endTestEarly(testId, userId)

// Utility
promoteWinnerPhoto(userId, photoId)
```

---

## 🎨 Component APIs

### PhotoABTestUpload
```jsx
<PhotoABTestUpload 
  userPhotos={[{id, url, displayOrder}]} 
  onTestCreated={(test) => {}}
/>
```

Props:
- `userPhotos`: Array of user's profile photos
- `onTestCreated`: Callback when test is created

### PhotoABTestDashboard
```jsx
<PhotoABTestDashboard 
  onSelectTest={(testId) => {}}
/>
```

Props:
- `onSelectTest`: Callback when user clicks "View Details"

### PhotoABTestResults
```jsx
<PhotoABTestResults 
  testId={123}
  onClose={() => {}}
/>
```

Props:
- `testId`: ID of test to display
- `onClose`: Callback to close modal

---

## 📊 Key Metrics

**Engagement Rate**: `(Likes + Views) / Total Profile Views * 100`

**Winner Determination**:
- Photo with higher engagement rate wins
- Tie if engagement rates are equal
- Auto-promoted to position #1 when test completes

**Test Duration**: Configurable (1-720 hours), default 48 hours

---

## 🔄 Integration Steps

### 1. Add to Server
✅ Already added to `backend/server.js`

### 2. Run Migration
```bash
cd backend
npm run db:migrate
```

### 3. Import Components
```javascript
import PhotoABTestUpload from './components/PhotoABTestUpload';
import PhotoABTestDashboard from './components/PhotoABTestDashboard';
import PhotoABTestResults from './components/PhotoABTestResults';
```

### 4. Add to UI
```javascript
export default function ProfileOptimization() {
  const [testId, setTestId] = useState(null);
  
  return (
    <div>
      <h1>Photo A/B Testing</h1>
      <PhotoABTestUpload onTestCreated={() => {}} />
      <PhotoABTestDashboard onSelectTest={setTestId} />
      {testId && <PhotoABTestResults testId={testId} onClose={() => setTestId(null)} />}
    </div>
  );
}
```

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] Create a test with 2 photos
- [ ] Verify test appears in dashboard
- [ ] Check test details show correct photos
- [ ] Pause and resume test
- [ ] End test early
- [ ] Verify winner is determined
- [ ] Confirm photo promoted to position 1
- [ ] Check engagement calculations

### Test Duration
- Set to 12 hours for quick testing
- Use 48 hours for real scenarios
- Can end test early to skip wait time

---

## ⚠️ Important Notes

1. **One Active Test Per User**: Users can only run 1 active test at a time
2. **Photo Ownership**: Both photos must belong to the user
3. **Different Photos**: Photos must be different (photoA ≠ photoB)
4. **Auto-Promotion**: Winner is automatically moved to position 1 when test completes
5. **Engagement Rate**: Calculated as (likes + views from that photo) / total interactions
6. **Timeline**: All events are tracked with timestamps for analysis

---

## 🐛 Troubleshooting

**Test not creating?**
- Verify both photos are from your profile
- Check you don't already have an active test
- Ensure duration is 1-720 hours

**Results not updating?**
- Components auto-refresh every 15-30 seconds
- Check browser console for API errors
- Verify backend server is running

**Winner not promoted?**
- Only happens when test completes (or ends early)
- Check `autoPromoted` flag in test data
- Verify `promotedPhotoId` is set

---

## 📚 Related Documentation

- [Conversation Quality Meter](./CONVERSATION_QUALITY_METER_QUICK_REF.md)
- [Backend API Guide](./backend/routes/README.md)
- [Component Styling Guide](./src/styles/README.md)

---

**Photo A/B Testing** is now ready to help users make data-driven decisions about their profile photos! 🚀
