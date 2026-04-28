# Photo A/B Testing - Integration Guide

## 📋 Complete Integration Walkthrough

This guide walks you through integrating Photo A/B Testing into your LinkUp dating app.

---

## ✅ Step 1: Verify Backend Setup

### Check Files Exist
```bash
# Models
ls -la backend/models/PhotoABTest.js
ls -la backend/models/PhotoABTestResult.js

# Service
ls -la backend/services/photoABTestService.js

# Routes
ls -la backend/routes/photoABTesting.js

# Migration
ls -la backend/migrations/20260428_add_photo_ab_testing.js
```

### Verify Server Registration
```bash
grep -n "photoABTestingRoutes" backend/server.js
# Should show 2 matches: import and app.use
```

---

## ✅ Step 2: Run Database Migration

### Create Tables
```bash
cd backend
npm run db:migrate
```

### Verify Tables Created
```bash
psql linkup_dating
\dt photo_ab*
```

You should see:
- `photo_ab_tests`
- `photo_ab_test_results`

### Verify Indexes
```sql
\di photo_ab*
```

---

## ✅ Step 3: Verify Backend Routes

### Test Server Startup
```bash
cd backend
npm start
```

### Check Routes Register
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/photo-ab-testing/user/all
```

Expected response:
```json
{
  "success": true,
  "tests": [],
  "count": 0
}
```

---

## ✅ Step 4: Integrate Frontend Components

### Import Components in Your Profile Component
```javascript
// src/components/DatingProfile.js

import PhotoABTestUpload from './PhotoABTestUpload';
import PhotoABTestDashboard from './PhotoABTestDashboard';
import PhotoABTestResults from './PhotoABTestResults';

export default function DatingProfile() {
  const [userPhotos, setUserPhotos] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState(null);

  // ... existing code ...

  return (
    <div className="profile-container">
      {/* Existing profile sections */}
      
      {/* Add Photo A/B Testing Section */}
      <section className="ab-testing-section">
        <h2>📊 Optimize Your Photos</h2>
        
        {selectedTestId ? (
          <PhotoABTestResults 
            testId={selectedTestId}
            onClose={() => setSelectedTestId(null)}
          />
        ) : (
          <>
            <PhotoABTestUpload 
              userPhotos={userPhotos}
              onTestCreated={() => {
                console.log('Test created!');
              }}
            />
            
            <PhotoABTestDashboard 
              onSelectTest={setSelectedTestId}
            />
          </>
        )}
      </section>
    </div>
  );
}
```

### Add Styling
```css
/* src/components/DatingProfile.css */

.ab-testing-section {
  margin-top: 40px;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 12px;
}

.ab-testing-section h2 {
  margin: 0 0 20px 0;
  font-size: 24px;
  color: #333;
}
```

---

## ✅ Step 5: Test the Feature

### 5.1 Create a Test
```bash
curl -X POST http://localhost:5000/api/photo-ab-testing \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "photoAId": 1,
    "photoBId": 2,
    "testName": "Outdoor vs Indoor",
    "durationHours": 12
  }'
```

Response:
```json
{
  "success": true,
  "message": "A/B test created successfully",
  "test": {
    "id": 1,
    "userId": 123,
    "photoAId": 1,
    "photoBId": 2,
    "testName": "Outdoor vs Indoor",
    "status": "active",
    "testDurationHours": 12,
    "likesA": 0,
    "likesB": 0,
    "engagementA": 0,
    "engagementB": 0,
    "startedAt": "2026-04-28T10:00:00.000Z",
    "createdAt": "2026-04-28T10:00:00.000Z"
  }
}
```

### 5.2 Record Some Likes
```bash
curl -X POST http://localhost:5000/api/photo-ab-testing/1/like \
  -H "Authorization: Bearer OTHER_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "photoId": 1,
    "photoVersion": "A"
  }'
```

### 5.3 Get Test Results
```bash
curl http://localhost:5000/api/photo-ab-testing/1/results \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "success": true,
  "test": {...},
  "likesA": 3,
  "likesB": 2,
  "viewsA": 15,
  "viewsB": 12,
  "engagementA": 20,
  "engagementB": 16.67,
  "totalEvents": 32,
  "timeline": [...]
}
```

### 5.4 Get Insights
```bash
curl http://localhost:5000/api/photo-ab-testing/1/insights \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ Step 6: Frontend Testing

### 1. View Dashboard
1. Navigate to profile section
2. Click "Optimize Your Photos"
3. Should see empty "Active Tests" tab
4. Verify "Create New A/B Test" form loads

### 2. Create Test via UI
1. Select Photo A from dropdown
2. Select Photo B from dropdown
3. Enter test name (optional)
4. Select duration
5. Click "🚀 Start A/B Test"
6. Verify test appears in Active tab

### 3. View Test Details
1. In dashboard, click "📊 View Details"
2. Should see "Overview" tab with:
   - Photo A and B metrics
   - Progress bar
   - Test status
3. Click other tabs (Metrics, Insights)

### 4. Test Controls
1. Click "⏸️ Pause" button
2. Test status should change to "paused"
3. Click "▶️ Resume" button
4. Status should return to "active"

### 5. Complete Test
1. Click "🏁 End Now"
2. Confirm in dialog
3. Test moves to "Completed" tab
4. Winner badge displays
5. ✨ Auto-promoted badge shows

---

## 🔧 API Integration in Your App

### Record Like Event
When user swipes right/likes a profile:

```javascript
// src/services/datingProfileService.js

async recordProfileLike(likedUserId, matchId, myPhotoVersion) {
  // ... existing code ...
  
  // If user is running A/B test, record the like
  if (runningABTestId && myPhotoVersion) {
    await photoABTestService.recordLike(
      runningABTestId,
      likedUserId,
      myPhotoVersion
    );
  }
}
```

### Record View Event
When profile is viewed:

```javascript
// src/services/datingProfileService.js

async recordProfileView(viewedUserId, myPhotoVersion) {
  // ... existing code ...
  
  // If user is running A/B test, record the view
  if (runningABTestId && myPhotoVersion) {
    await photoABTestService.recordView(
      runningABTestId,
      myPhotoVersion
    );
  }
}
```

---

## 📊 Dashboard Integration

### Add AB Testing Tab to Profile
```javascript
// src/components/DatingProfile.js

const [activeTab, setActiveTab] = useState('photos');

return (
  <div>
    <div className="profile-tabs">
      <button 
        className={activeTab === 'photos' ? 'active' : ''}
        onClick={() => setActiveTab('photos')}
      >
        📸 Photos
      </button>
      <button 
        className={activeTab === 'testing' ? 'active' : ''}
        onClick={() => setActiveTab('testing')}
      >
        📊 A/B Testing
      </button>
    </div>
    
    {activeTab === 'photos' && <PhotoUploadSection />}
    {activeTab === 'testing' && <PhotoABTestingSection />}
  </div>
);
```

---

## 🧪 Testing Scenarios

### Scenario 1: Complete Test Flow
1. Create test with 2 photos, 12-hour duration
2. Simulate 5 likes for Photo A, 3 for Photo B
3. Simulate 20 views for Photo A, 15 for Photo B
4. End test
5. Verify Photo A determined as winner
6. Check that Photo A promoted to position 1

### Scenario 2: Tie Test
1. Create test
2. Give both photos same engagement rate
3. End test
4. Verify "tie" winner
5. Verify no auto-promotion

### Scenario 3: Pause/Resume
1. Create test
2. Pause test after 2 hours
3. Resume test
4. Continue adding interactions
5. End test after 12 total hours
6. Verify test completes correctly

### Scenario 4: Multiple Tests
1. Complete first test
2. Create second test with different photos
3. View both in "Active" and "Completed" tabs
4. Verify only 1 active test at a time

---

## 🔌 Database Queries

### Check All Tests for User
```sql
SELECT * FROM photo_ab_tests 
WHERE user_id = 123
ORDER BY created_at DESC;
```

### Check Test Results/Events
```sql
SELECT * FROM photo_ab_test_results 
WHERE test_id = 1
ORDER BY timestamp DESC
LIMIT 20;
```

### Count Likes by Photo Version
```sql
SELECT photo_version, COUNT(*) as like_count
FROM photo_ab_test_results 
WHERE test_id = 1 AND event_type = 'like'
GROUP BY photo_version;
```

### Get Engagement Rate
```sql
SELECT 
  photo_version,
  SUM(CASE WHEN event_type = 'like' THEN 1 ELSE 0 END) as likes,
  SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views,
  ROUND(100.0 * SUM(CASE WHEN event_type = 'like' THEN 1 ELSE 0 END) / 
    NULLIF(SUM(CASE WHEN event_type IN ('like', 'view') THEN 1 ELSE 0 END), 0), 2) as engagement_rate
FROM photo_ab_test_results 
WHERE test_id = 1
GROUP BY photo_version;
```

---

## 📱 Mobile Responsiveness

All components are fully responsive:
- ✅ Desktop (1024px+): Full grid layout
- ✅ Tablet (768px-1023px): Optimized grid
- ✅ Mobile (320px-767px): Single column

Test on:
- Chrome DevTools (mobile view)
- iPhone 12 (375px)
- iPad (768px)
- Desktop (1920px)

---

## 🚀 Deployment Checklist

- [ ] Backend models created and tested
- [ ] Database migration runs successfully
- [ ] Backend routes registered in server.js
- [ ] API endpoints tested with curl/Postman
- [ ] Frontend components imported
- [ ] Components render without errors
- [ ] Styling loads correctly
- [ ] Like/view recording integrated
- [ ] Photo promotion logic verified
- [ ] Mobile responsive tested
- [ ] All edge cases handled

---

## 📞 Support & Troubleshooting

### Issue: "One or both photos do not exist"
- Solution: Verify photoA and photoB IDs exist in profile_photos table
- Check: `SELECT * FROM profile_photos WHERE id IN (photoAId, photoBId);`

### Issue: "User already has an active A/B test running"
- Solution: Complete or pause the existing test first
- Query: `SELECT * FROM photo_ab_tests WHERE user_id = ? AND status = 'active';`

### Issue: Results not updating
- Solution: Check if test is still active (not completed/paused)
- Verify: Test duration hasn't elapsed
- Force refresh: Click browser refresh or wait 30 seconds

### Issue: Photo not auto-promoted
- Solution: Test must be completed (status = 'completed')
- Check: `autoPromoted` flag should be true
- Verify: `promoted_photo_id` is set to winning photo

---

**Photo A/B Testing Integration Complete!** 🎉
