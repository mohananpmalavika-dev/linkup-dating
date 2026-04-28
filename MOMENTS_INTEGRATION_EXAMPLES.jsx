// 📸 MOMENTS FEATURE - INTEGRATION EXAMPLES
// Copy-paste ready code for integrating Story-like Moments into LinkUp

// ============================================================
// 1. ROUTE REGISTRATION (backend/server.js)
// ============================================================

// Add to your route imports at top of server.js:
const momentRoutes = require('./routes/moments');

// Add to your app.use() statements (after other API routes):
app.use('/api/moments', momentRoutes);

// Add the cleanup job scheduler (near other scheduled jobs):
const schedule = require('node-schedule');
const { deleteExpiredMoments } = require('./services/momentService');

// Run cleanup job every hour
schedule.scheduleJob('0 * * * *', async () => {
  try {
    console.log('[Moments] Running cleanup job...');
    await deleteExpiredMoments();
    console.log('[Moments] Cleanup job completed successfully');
  } catch (error) {
    console.error('[Moments] Cleanup job failed:', error);
  }
});

// ============================================================
// 2. FRONTEND ROUTE SETUP (src/router.js)
// ============================================================

import MomentsFeed from './components/MomentsFeed';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Add to your Routes component:
<Routes>
  {/* ...existing routes... */}
  
  {/* Add Moments feed route */}
  <Route path="/moments" element={<MomentsFeed />} />
  
  {/* ...other routes... */}
</Routes>

// ============================================================
// 3. NAVIGATION MENU UPDATE (src/components/Navigation.js)
// ============================================================

// Add Moments link to your navigation menu:
<nav className="navigation">
  {/* ...existing nav items... */}
  
  <a href="/moments" className="nav-item">
    📸 Moments
  </a>
  
  {/* ...other nav items... */}
</nav>

// Or if using React Router Link:
import { Link } from 'react-router-dom';

<Link to="/moments" className="nav-item">
  📸 Moments
</Link>

// ============================================================
// 4. DATABASE MIGRATIONS (backend/migrations/moments.sql)
// ============================================================

-- Create moments table
CREATE TABLE moments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_key VARCHAR(255),
  caption TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  view_count INTEGER DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at),
  INDEX idx_created_at_user_id (created_at, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create moment_views table for tracking viewers
CREATE TABLE moment_views (
  id CHAR(36) PRIMARY KEY,
  moment_id CHAR(36) NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  viewer_user_id CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_moment_id (moment_id),
  INDEX idx_viewer_user_id (viewer_user_id),
  UNIQUE KEY unique_view (moment_id, viewer_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

// ============================================================
// 5. ENVIRONMENT VARIABLES (.env)
// ============================================================

# Moments Configuration
MOMENTS_CLEANUP_INTERVAL=3600000        # 1 hour in milliseconds
MOMENTS_PHOTO_MAX_SIZE_MB=10
MOMENTS_CAPTION_MAX_LENGTH=200
MOMENTS_EXPIRY_HOURS=24

# If using S3 for photo storage:
MOMENTS_S3_BUCKET=linkup-moments
MOMENTS_S3_REGION=us-east-1

// ============================================================
// 6. APP.js INTEGRATION (src/App.js)
// ============================================================

// Add Moments to your main app component:
import MomentsFeed from './components/MomentsFeed';

function App() {
  return (
    <div className="App">
      {/* ...existing components... */}
      
      {/* Add Moments route */}
      <Routes>
        {/* ...existing routes... */}
        <Route path="/moments" element={<MomentsFeed />} />
      </Routes>
      
      {/* ...other components... */}
    </div>
  );
}

// ============================================================
// 7. MATCH PROFILE PAGE - ADD MOMENTS VIEW (Optional)
// ============================================================

// In your profile viewing component, add a way to view user's moments:
import momentService from '../services/momentService';

function ProfileView({ userId }) {
  const [userMoments, setUserMoments] = useState([]);

  useEffect(() => {
    // Fetch this user's moments (if matched)
    const fetchUserMoments = async () => {
      try {
        const response = await fetch(`/api/moments/feed?userId=${userId}`);
        const moments = await response.json();
        setUserMoments(moments);
      } catch (error) {
        console.error('Failed to load user moments:', error);
      }
    };

    fetchUserMoments();
  }, [userId]);

  return (
    <div className="profile-view">
      {/* ...existing profile content... */}
      
      {/* Add moments section */}
      {userMoments.length > 0 && (
        <section className="user-moments">
          <h3>📸 Their Moments</h3>
          <div className="moments-preview">
            {userMoments.slice(0, 3).map(moment => (
              <div key={moment.id} className="moment-preview">
                <img src={moment.photo_url} alt="moment" />
                <span className="view-count">{moment.view_count} views</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================
// 8. DASHBOARD - ADD MOMENTS STATS (Optional)
// ============================================================

// Add Moments stats to your dashboard:
import momentService from '../services/momentService';

function Dashboard() {
  const [momentsStats, setMomentsStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const stats = await momentService.getMomentsStats();
        setMomentsStats(stats);
      } catch (error) {
        console.error('Failed to load moments stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="dashboard">
      {/* ...existing dashboard sections... */}
      
      {momentsStats && (
        <div className="moments-stats-card">
          <h3>📸 Moments Activity</h3>
          <div className="stat-row">
            <span>Active Moments:</span>
            <strong>{momentsStats.activeMoments}</strong>
          </div>
          <div className="stat-row">
            <span>Total Views:</span>
            <strong>{momentsStats.totalViews}</strong>
          </div>
          <div className="stat-row">
            <span>Unique Viewers:</span>
            <strong>{momentsStats.uniqueViewers}</strong>
          </div>
          <a href="/moments" className="btn-view-moments">View Moments Feed</a>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 9. TESTING - EXAMPLE TEST CASES (backend/tests/moments.test.js)
// ============================================================

const request = require('supertest');
const app = require('../server');
const { Moment, MomentView, User } = require('../models');

describe('Moments API', () => {
  let testUser, testUser2, testMoment;

  beforeAll(async () => {
    // Create test users
    testUser = await User.create({
      email: 'test1@moments.com',
      password: 'testpass123',
    });
    testUser2 = await User.create({
      email: 'test2@moments.com',
      password: 'testpass123',
    });
  });

  describe('POST /api/moments/upload', () => {
    it('should upload a moment with image and caption', async () => {
      const response = await request(app)
        .post('/api/moments/upload')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          photoUrl: 'https://example.com/photo.jpg',
          photoKey: 'moments/test1/photo.jpg',
          caption: 'My first moment!',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.caption).toBe('My first moment!');
      expect(response.body).toHaveProperty('expires_at');
      testMoment = response.body;
    });

    it('should reject caption longer than 200 characters', async () => {
      const longCaption = 'a'.repeat(201);
      const response = await request(app)
        .post('/api/moments/upload')
        .set('Authorization', `Bearer ${testUser.token}`)
        .send({
          photoUrl: 'https://example.com/photo.jpg',
          caption: longCaption,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/moments/feed', () => {
    it('should get moments from matches', async () => {
      // Create match between users
      await Match.create({
        user1_id: testUser.id,
        user2_id: testUser2.id,
      });

      const response = await request(app)
        .get('/api/moments/feed')
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/moments/:momentId/view', () => {
    it('should record a view and increment view count', async () => {
      const response = await request(app)
        .post(`/api/moments/${testMoment.id}/view`)
        .set('Authorization', `Bearer ${testUser2.token}`);

      expect(response.status).toBe(200);

      // Check that view was recorded
      const momentView = await MomentView.findOne({
        where: {
          moment_id: testMoment.id,
          viewer_user_id: testUser2.id,
        },
      });

      expect(momentView).toBeDefined();
    });

    it('should not increment view count for duplicate views', async () => {
      // First view
      await request(app)
        .post(`/api/moments/${testMoment.id}/view`)
        .set('Authorization', `Bearer ${testUser2.token}`);

      const momentBefore = await Moment.findByPk(testMoment.id);
      const countBefore = momentBefore.view_count;

      // Second view (should not increment)
      await request(app)
        .post(`/api/moments/${testMoment.id}/view`)
        .set('Authorization', `Bearer ${testUser2.token}`);

      const momentAfter = await Moment.findByPk(testMoment.id);
      expect(momentAfter.view_count).toBe(countBefore);
    });
  });

  describe('GET /api/moments/:momentId/viewers', () => {
    it('should return viewers list (owner only)', async () => {
      const response = await request(app)
        .get(`/api/moments/${testMoment.id}/viewers`)
        .set('Authorization', `Bearer ${testUser.token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should deny access to non-owners', async () => {
      const response = await request(app)
        .get(`/api/moments/${testMoment.id}/viewers`)
        .set('Authorization', `Bearer ${testUser2.token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Expiry Logic', () => {
    it('should mark expired moments as deleted', async () => {
      // Create a moment with past expiry
      const expiredMoment = await Moment.create({
        user_id: testUser.id,
        photo_url: 'https://example.com/photo.jpg',
        caption: 'Expired moment',
        created_at: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
        expires_at: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      });

      // Run cleanup
      await momentService.deleteExpiredMoments();

      // Check that it's marked as deleted
      const updated = await Moment.findByPk(expiredMoment.id);
      expect(updated.is_deleted).toBe(true);
    });
  });
});

// ============================================================
// 10. ERROR HANDLING - TRY/CATCH WRAPPER (Frontend)
// ============================================================

// Example error handling for moments operations:
async function uploadMomentWithErrorHandling(photoUrl, photoKey, caption) {
  try {
    // Show loading state
    setIsLoading(true);
    setError(null);

    // Validate inputs
    if (!photoUrl) {
      throw new Error('Photo is required');
    }
    if (caption && caption.length > 200) {
      throw new Error('Caption must be 200 characters or less');
    }

    // Upload moment
    const response = await fetch('/api/moments/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ photoUrl, photoKey, caption }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Upload failed');
    }

    const moment = await response.json();
    
    // Success handling
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
    
    return moment;

  } catch (error) {
    console.error('Moment upload error:', error);
    setError(error.message);
    return null;
  } finally {
    setIsLoading(false);
  }
}

// ============================================================
// 11. PERFORMANCE OPTIMIZATION - LAZY LOADING (Frontend)
// ============================================================

// Use React.lazy() for code splitting:
import { lazy, Suspense } from 'react';

const MomentsFeed = lazy(() => import('./components/MomentsFeed'));
const MomentsUpload = lazy(() => import('./components/MomentsUpload'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/moments" element={<MomentsFeed />} />
      </Routes>
    </Suspense>
  );
}

// Lazy load images in MomentsFeed:
import { useInView } from 'react-intersection-observer';

function MomentCard({ moment }) {
  const { ref, inView } = useInView({ threshold: 0.1 });

  return (
    <div ref={ref} className="moment-card">
      {inView && (
        <img 
          src={moment.photo_url} 
          alt="moment" 
          loading="lazy"
        />
      )}
    </div>
  );
}

// ============================================================
// 12. QUICK INTEGRATION CHECKLIST
// ============================================================

/*
✅ Backend Setup:
  - [ ] Import momentRoutes in server.js
  - [ ] Register app.use('/api/moments', momentRoutes)
  - [ ] Add schedule.scheduleJob() for cleanup
  - [ ] Run database migrations
  - [ ] Add environment variables to .env
  
✅ Frontend Setup:
  - [ ] Add Moments route to router.js
  - [ ] Import MomentsFeed component
  - [ ] Add navigation link to Moments
  - [ ] Add styling (Moments.css)
  - [ ] Test upload/view flow
  
✅ Testing:
  - [ ] Test moment upload
  - [ ] Test moment visibility (matches only)
  - [ ] Test view tracking
  - [ ] Test viewer list access
  - [ ] Test 24-hour expiry
  - [ ] Test cleanup job
  - [ ] Test responsive design
  
✅ Deployment:
  - [ ] Database migrations run
  - [ ] Routes registered
  - [ ] Scheduler running
  - [ ] S3/storage configured
  - [ ] Monitor cleanup jobs
  - [ ] Track performance metrics
*/

// ============================================================
// Done! Your Moments feature is ready to rock! 📸
// ============================================================
