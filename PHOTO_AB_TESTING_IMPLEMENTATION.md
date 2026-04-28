# Photo A/B Testing - Technical Implementation

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│ PhotoABTestUpload   PhotoABTestDashboard   PhotoABTestResults│
│  (Create Tests)      (View All Tests)      (Detailed Results) │
└────────────────────────────┬────────────────────────────────┘
                             │
                   photoABTestService
                    (API Abstraction)
                             │
┌────────────────────────────┴────────────────────────────────┐
│                   Backend (Node.js/Express)                 │
├──────────────────────────────────────────────────────────────┤
│  photoABTesting.js (Routes)                                  │
│       ↓                                                       │
│  photoABTestService.js (Business Logic)                      │
│       ↓                                                       │
│  PhotoABTest & PhotoABTestResult Models (Sequelize ORM)     │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│             PostgreSQL Database                             │
├──────────────────────────────────────────────────────────────┤
│  photo_ab_tests                                              │
│  photo_ab_test_results                                       │
│  (with indexes for fast queries)                             │
└──────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Data Models

### PhotoABTest Model

**Purpose**: Stores aggregated test data and results

**Fields**:
```javascript
{
  id: Integer,                      // Primary Key
  userId: Integer,                  // FK - User running test
  photoAId: Integer,               // FK - First photo
  photoBId: Integer,               // FK - Second photo
  testName: String,                // User-friendly name
  status: ENUM,                    // 'active' | 'paused' | 'completed'
  testDurationHours: Integer,      // How long to run test
  likesA: Integer,                 // Total likes for photo A
  likesB: Integer,                 // Total likes for photo B
  viewsA: Integer,                 // Total profile views while A shown
  viewsB: Integer,                 // Total profile views while B shown
  engagementA: Decimal,            // Likes A / Views A * 100
  engagementB: Decimal,            // Likes B / Views B * 100
  winner: ENUM,                    // 'A' | 'B' | 'tie'
  winMargin: Decimal,              // Percentage difference
  autoPromoted: Boolean,           // Was winner promoted to position 1?
  promotedPhotoId: Integer,        // Photo ID that was promoted
  startedAt: DateTime,             // When test started
  completedAt: DateTime,           // When test finished
  notes: Text,                     // User notes
  createdAt: DateTime,             // Record creation
  updatedAt: DateTime              // Last update
}

Indexes:
- user_id (for filtering by user)
- status (for filtering active/completed)
- winner (for stats)
- created_at (for sorting)
- (user_id, status) compound index for common queries
```

### PhotoABTestResult Model

**Purpose**: Tracks individual interaction events for detailed analysis

**Fields**:
```javascript
{
  id: Integer,                    // Primary Key
  testId: Integer,               // FK - Which test
  userId: Integer,               // FK - Test owner
  likerUserId: Integer,          // FK - Who liked/viewed
  photoId: Integer,              // FK - Which photo
  photoVersion: ENUM,            // 'A' | 'B'
  eventType: ENUM,               // 'like' | 'view' | 'pass'
  timestamp: DateTime,           // When event occurred
  createdAt: DateTime            // Record creation
}

Indexes:
- test_id (foreign key)
- user_id (for filtering)
- photo_version (for aggregation)
- event_type (for filtering)
- (test_id, photo_version) compound for quick engagement calc
- timestamp (for timeline queries)
```

---

## 🔧 Service Architecture

### photoABTestService.js

**Core Functions**:

```javascript
// Test Creation & Management
createTest(userId, photoAId, photoBId, testName, durationHours)
  ↓ validates both photos belong to user
  ↓ checks no active test already running
  ↓ creates PhotoABTest record
  ↓ returns test object

pauseTest(testId, userId)
  ↓ validates ownership
  ↓ sets status = 'paused'
  ↓ returns updated test

resumeTest(testId, userId)
  ↓ validates ownership & paused status
  ↓ sets status = 'active'
  ↓ returns updated test

endTestEarly(testId, userId)
  ↓ calls updateMetrics(testId)
  ↓ forces completion & winner determination
  ↓ triggers auto-promotion

// Event Recording
recordLike(testId, likerUserId, photoId, photoVersion)
  ↓ validates test is active
  ↓ creates PhotoABTestResult record
  ↓ increments likesA or likesB
  ↓ saves to database

recordView(testId, viewerUserId, photoVersion)
  ↓ validates test is active
  ↓ creates PhotoABTestResult record
  ↓ increments viewsA or viewsB
  ↓ saves to database

// Metrics & Analysis
updateMetrics(testId)
  ↓ calculates engagementA = likesA / viewsA * 100
  ↓ calculates engagementB = likesB / viewsB * 100
  ↓ checks if test duration elapsed
  ↓ if complete: determines winner
  ↓ if winner: auto-promotes photo
  ↓ returns updated test

promoteWinnerPhoto(userId, photoId)
  ↓ finds profile by userId
  ↓ gets current photo order
  ↓ swaps winning photo to position 1
  ↓ swaps old #1 photo down

// Data Retrieval
getTestDetails(testId, userId)
  ↓ validates ownership
  ↓ calls updateMetrics
  ↓ returns test with current metrics

getUserTests(userId, status?, limit, offset)
  ↓ filters by status if provided
  ↓ orders by createdAt DESC
  ↓ returns paginated results

getTestResults(testId, userId)
  ↓ validates ownership
  ↓ fetches all PhotoABTestResult records
  ↓ aggregates likes/views by photoVersion
  ↓ calculates engagement rates
  ↓ returns detailed breakdown

getTestInsights(testId, userId)
  ↓ validates ownership
  ↓ analyzes test data
  ↓ generates insights
  ↓ provides recommendations
```

---

## 🔌 REST API Design

### Route: `/api/photo-ab-testing`

**Method: POST** - Create Test
```http
POST /api/photo-ab-testing HTTP/1.1
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "photoAId": 123,
  "photoBId": 456,
  "testName": "Outdoor vs Studio",
  "durationHours": 48
}

Response 201:
{
  "success": true,
  "message": "A/B test created successfully",
  "test": {
    "id": 1,
    "userId": 1,
    "photoAId": 123,
    "photoBId": 456,
    "testName": "Outdoor vs Studio",
    "status": "active",
    "testDurationHours": 48,
    "likesA": 0,
    "likesB": 0,
    "viewsA": 0,
    "viewsB": 0,
    "engagementA": 0,
    "engagementB": 0,
    "winner": null,
    "winMargin": 0,
    "autoPromoted": false,
    "promotedPhotoId": null,
    "startedAt": "2026-04-28T10:00:00Z",
    "completedAt": null,
    "notes": null,
    "createdAt": "2026-04-28T10:00:00Z",
    "updatedAt": "2026-04-28T10:00:00Z"
  }
}
```

**Method: GET** - Get Test by ID
```http
GET /api/photo-ab-testing/1 HTTP/1.1
Authorization: Bearer eyJhbGc...

Response 200:
{
  "success": true,
  "test": { ...test object... }
}
```

**Method: GET** - Get All User Tests
```http
GET /api/photo-ab-testing/user/all?status=active&limit=10&offset=0 HTTP/1.1
Authorization: Bearer eyJhbGc...

Response 200:
{
  "success": true,
  "tests": [ {...}, {...} ],
  "count": 2
}
```

**Method: POST** - Record Like
```http
POST /api/photo-ab-testing/1/like HTTP/1.1
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "photoId": 123,
  "photoVersion": "A"
}

Response 200:
{
  "success": true,
  "message": "Like recorded",
  "test": { ...updated test... }
}
```

**Method: POST** - Record View
```http
POST /api/photo-ab-testing/1/view HTTP/1.1
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "photoVersion": "A"
}

Response 200:
{
  "success": true,
  "message": "View recorded",
  "test": { ...updated test... }
}
```

**Method: GET** - Get Test Results
```http
GET /api/photo-ab-testing/1/results HTTP/1.1
Authorization: Bearer eyJhbGc...

Response 200:
{
  "success": true,
  "test": { ...test... },
  "likesA": 12,
  "likesB": 8,
  "viewsA": 45,
  "viewsB": 38,
  "engagementA": 26.67,
  "engagementB": 21.05,
  "totalEvents": 103,
  "timeline": [
    {
      "photoVersion": "A",
      "eventType": "like",
      "timestamp": "2026-04-28T10:05:00Z"
    },
    ...
  ]
}
```

**Method: GET** - Get Test Insights
```http
GET /api/photo-ab-testing/1/insights HTTP/1.1
Authorization: Bearer eyJhbGc...

Response 200:
{
  "success": true,
  "insights": {
    "testStatus": "active",
    "winner": "A",
    "winMargin": 5.62,
    "recommendations": [
      "Continue test to gather more data for meaningful insights"
    ],
    "insights": [
      "Photo A is winning with 26.67% engagement vs 21.05% for Photo B"
    ]
  }
}
```

**Method: PUT** - Pause Test
```http
PUT /api/photo-ab-testing/1/pause HTTP/1.1
Authorization: Bearer eyJhbGc...

Response 200:
{
  "success": true,
  "message": "Test paused",
  "test": { ...updated test with status='paused'... }
}
```

**Method: PUT** - Resume Test
```http
PUT /api/photo-ab-testing/1/resume HTTP/1.1
Authorization: Bearer eyJhbGc...

Response 200:
{
  "success": true,
  "message": "Test resumed",
  "test": { ...updated test with status='active'... }
}
```

**Method: PUT** - End Test
```http
PUT /api/photo-ab-testing/1/end HTTP/1.1
Authorization: Bearer eyJhbGc...

Response 200:
{
  "success": true,
  "message": "Test ended",
  "test": { 
    ...updated test with status='completed', winner set...
  }
}
```

---

## 💻 Frontend State Management

### PhotoABTestUpload Component State
```javascript
const [selectedPhotoA, setSelectedPhotoA] = useState('');
const [selectedPhotoB, setSelectedPhotoB] = useState('');
const [testName, setTestName] = useState('');
const [durationHours, setDurationHours] = useState(48);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState('');
const [previewA, setPreviewA] = useState(null);
const [previewB, setPreviewB] = useState(null);

// Effects
useEffect(() => {
  // Update preview when photo selection changes
}, [selectedPhotoA, selectedPhotoB]);

// Handlers
const handleCreateTest = async (e) => {
  // 1. Validate inputs
  // 2. Call API
  // 3. Show success/error
  // 4. Reset form
  // 5. Call onTestCreated callback
};
```

### PhotoABTestDashboard Component State
```javascript
const [tests, setTests] = useState([]);
const [activeTests, setActiveTests] = useState([]);
const [completedTests, setCompletedTests] = useState([]);
const [loading, setLoading] = useState(true);
const [selectedTab, setSelectedTab] = useState('active');
const [error, setError] = useState('');

// Effects
useEffect(() => {
  fetchTests();
  // Auto-refresh every 30 seconds
  const interval = setInterval(fetchTests, 30000);
  return () => clearInterval(interval);
}, []);

// Handlers
const fetchTests = async () => { /* ... */ };
const handlePauseTest = async (testId) => { /* ... */ };
const handleResumeTest = async (testId) => { /* ... */ };
const handleEndTest = async (testId) => { /* ... */ };
```

### PhotoABTestResults Component State
```javascript
const [testData, setTestData] = useState(null);
const [insights, setInsights] = useState(null);
const [results, setResults] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const [activeTab, setActiveTab] = useState('overview');

// Effects
useEffect(() => {
  if (testId) {
    fetchTestData();
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchTestData, 15000);
    return () => clearInterval(interval);
  }
}, [testId]);

// Handlers
const fetchTestData = async () => {
  // Fetch test, insights, results in parallel
  Promise.all([...])
};
```

---

## 🔄 Data Flow Diagram

```
User Creates Test
    ↓
PhotoABTestUpload.handleCreateTest()
    ↓
photoABTestService.createTest()
    ↓
API POST /api/photo-ab-testing
    ↓
backend/routes/photoABTesting.js
    ↓
photoABTestService.createTest()
    ↓
PhotoABTest.create()
    ↓
Database INSERT photo_ab_tests
    ↓
Response with test object
    ↓
onTestCreated callback
    ↓
Update dashboard to show active test
```

---

## 🧮 Engagement Calculation

```javascript
// Frontend calculation (read-only)
const engagementA = viewsA > 0 ? (likesA / viewsA) * 100 : 0;
const engagementB = viewsB > 0 ? (likesB / viewsB) * 100 : 0;

// Backend calculation (authoritative)
test.engagementA = test.viewsA > 0 ? (test.likesA / test.viewsA) * 100 : 0;
test.engagementB = test.viewsB > 0 ? (test.likesB / test.viewsB) * 100 : 0;

// Winner determination
if (test.engagementA > test.engagementB) {
  test.winner = 'A';
  test.winMargin = test.engagementA - test.engagementB;
} else if (test.engagementB > test.engagementA) {
  test.winner = 'B';
  test.winMargin = test.engagementB - test.engagementA;
} else {
  test.winner = 'tie';
  test.winMargin = 0;
}
```

---

## 🔐 Security Considerations

### Authentication
- All endpoints require valid JWT token
- Token must contain user ID
- Backend verifies token on every request

### Authorization
- Users can only create tests for their own account
- Users can only view/modify their own tests
- Database queries filter by userId

### Validation
- Both photos must exist and belong to user
- Photos must be different
- Duration must be 1-720 hours
- Only 1 active test per user at a time

### SQL Injection Prevention
- Use Sequelize ORM (parameterized queries)
- No raw SQL used in service layer
- Input validation on all endpoints

---

## ⚡ Performance Optimization

### Indexes
```sql
-- Fast lookup by user
CREATE INDEX idx_photo_ab_tests_user_id ON photo_ab_tests(user_id);

-- Fast filtering by status
CREATE INDEX idx_photo_ab_tests_status ON photo_ab_tests(status);

-- Fast result aggregation
CREATE INDEX idx_photo_ab_test_results_test_version 
  ON photo_ab_test_results(test_id, photo_version);

-- Fast timeline queries
CREATE INDEX idx_photo_ab_test_results_timestamp 
  ON photo_ab_test_results(timestamp);
```

### Query Optimization
```javascript
// Bulk insert results (faster than single inserts)
await PhotoABTestResult.bulkCreate(events);

// Only select needed fields
const test = await PhotoABTest.findOne({
  where: { id: testId },
  attributes: ['id', 'likesA', 'likesB', 'viewsA', 'viewsB']
});

// Count efficiently
const count = await PhotoABTestResult.count({
  where: { testId, eventType: 'like' }
});
```

### Frontend Optimization
```javascript
// Debounce auto-refresh
const [lastFetch, setLastFetch] = useState(0);
const fetchTests = async () => {
  const now = Date.now();
  if (now - lastFetch < 1000) return; // Min 1s between fetches
  // ... fetch ...
};

// Memoize expensive calculations
const engagementRate = useMemo(() => {
  return viewsA > 0 ? (likesA / viewsA) * 100 : 0;
}, [likesA, viewsA]);
```

---

## 🧪 Test Cases

### Unit Tests
```javascript
// Service layer tests
describe('photoABTestService', () => {
  it('should create a test', async () => {
    const test = await photoABTestService.createTest(...);
    expect(test.status).toBe('active');
  });

  it('should calculate engagement rate', () => {
    const engagement = 25 / 100 * 100; // 25%
    expect(engagement).toBe(25);
  });

  it('should determine winner correctly', () => {
    const winner = determineWinner(26.67, 21.05);
    expect(winner).toBe('A');
  });
});
```

### Integration Tests
```javascript
// API endpoint tests
describe('POST /api/photo-ab-testing', () => {
  it('should create test with valid input', async () => {
    const res = await request(app)
      .post('/api/photo-ab-testing')
      .send({ photoAId: 1, photoBId: 2 });
    expect(res.status).toBe(201);
  });

  it('should reject duplicate photos', async () => {
    const res = await request(app)
      .post('/api/photo-ab-testing')
      .send({ photoAId: 1, photoBId: 1 });
    expect(res.status).toBe(400);
  });
});
```

---

**Photo A/B Testing Technical Implementation Complete!** 🎯
