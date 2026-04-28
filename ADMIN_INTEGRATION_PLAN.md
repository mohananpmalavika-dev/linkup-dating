# Admin Dashboard Integration Plan

**Date**: April 28, 2026  
**Task**: Complete Admin Dashboard Integration (TIER 1 - Critical)  
**Estimated Time**: 4 hours  
**Status**: IN PROGRESS  

---

## Current Status

### ✅ What's Already Implemented

**Frontend Components**:
- ✅ AdminDashboard.js (900+ lines, comprehensive)
  - 8 tabs: Overview, Queue, Reviews, Photos, Bans, Appeals, Analytics, Actions
  - Full moderation workflow (suspend, ban, delete users)
  - Manual flagging system
  - Detailed user reviews with history
  - Photo moderation queue
  - Appeals review system
  - Comprehensive analytics dashboard

- ✅ AdminModeration.jsx (basic implementation)
  - Needs API endpoint corrections
  - Has basic flags queue and stats

**Backend Routes** (20+ endpoints):
- ✅ GET /admin/dashboard
- ✅ GET /admin/moderation/queue
- ✅ GET /admin/reports
- ✅ PUT /admin/reports/:reportId/resolve
- ✅ GET /admin/spam-flags
- ✅ PUT /admin/spam-flags/:flagId/resolve
- ✅ GET /admin/fraud-flags
- ✅ PUT /admin/fraud-flags/:flagId/resolve
- ✅ GET /admin/moderation-flags
- ✅ PUT /admin/moderation-flags/:flagId/review
- ✅ GET /admin/users/review
- ✅ GET /admin/users/:userId/review
- ✅ POST /admin/users/:userId/flag
- ✅ POST /admin/users/:userId/suspend
- ✅ POST /admin/users/:userId/ban
- ✅ POST /admin/users/:userId/delete
- ✅ GET /admin/photo-moderation
- ✅ PUT /admin/photo-moderation/:queueId/review
- ✅ GET /admin/bans
- ✅ POST /admin/bans/:banId/revoke
- ✅ GET /admin/appeals
- ✅ POST /admin/appeals/:appealId/review
- ✅ GET /admin/analytics/users/:userId
- ✅ GET /admin/analytics/platform
- ✅ GET /admin/analytics/moderation
- ✅ GET /admin/actions-log

**Frontend Service**:
- ✅ adminService.js (all endpoints wired)

**App Routes**:
- ✅ /admin-dashboard (AdminDashboard component)
- ✅ /admin/moderation (AdminModeration component)

---

## Tasks to Complete

### Task 1: Fix AdminModeration Component API Paths (1 hour)

**Current Issues**:
- Using `/api/moderation/*` instead of `/api/admin/*`
- Needs proper error handling
- Missing auth token in axios calls

**Fix**:
- [ ] Replace `/api/moderation/pending-flags` → `/api/admin/moderation/queue`
- [ ] Replace `/api/moderation/stats` → `/api/admin/analytics/moderation`
- [ ] Replace `/api/moderation/resolve-flag` → appropriate `/api/admin/*` endpoint
- [ ] Add axios auth interceptor (use apiClient from services)
- [ ] Add proper error handling and loading states

### Task 2: Verify Backend Admin Endpoints (1 hour)

**Tests to Run**:
- [ ] Check /admin/dashboard returns proper metrics
- [ ] Check /admin/moderation/queue returns flagged content
- [ ] Check /admin/users/review returns users with flags
- [ ] Check /admin/analytics/moderation returns stats
- [ ] Verify all suspend/ban/delete endpoints work
- [ ] Verify appeal review endpoints work

### Task 3: Test AdminDashboard End-to-End (1 hour)

**Tests**:
- [ ] Dashboard loads with metrics
- [ ] Queue tab shows pending items
- [ ] User review tab loads users
- [ ] Can expand user details
- [ ] Can create manual flags
- [ ] Can suspend users
- [ ] Can ban users
- [ ] Can delete users
- [ ] Can revoke bans
- [ ] Can review appeals
- [ ] Photo moderation works
- [ ] Analytics dashboard shows data
- [ ] Actions log displays

### Task 4: Polish & Integration (1 hour)

**Polish**:
- [ ] Improve error messages
- [ ] Add loading indicators
- [ ] Add confirmation dialogs
- [ ] Add success notifications
- [ ] Ensure responsive design
- [ ] Test on mobile (if needed for Play Store)

---

## Implementation Plan

### Step 1: Fix AdminModeration Component

Replace incorrect API calls with correct ones from adminService:

**Before**:
```javascript
const response = await axios.get('/api/moderation/pending-flags');
```

**After**:
```javascript
const response = await adminService.getModerationQueue({ limit: 50, status: filterStatus });
```

### Step 2: Verify Each Admin Endpoint

For each endpoint in adminService, verify:
1. Endpoint exists in backend/routes/admin.js
2. Response format matches what component expects
3. Error handling works properly
4. Auth check works (admin only)

### Step 3: Test Admin Dashboard

Create test checklist and run through each scenario:
- Login as admin user
- Navigate to /admin-dashboard
- Verify each tab loads
- Test each action button
- Verify moderation workflows

### Step 4: Deploy & Monitor

- [ ] Build production bundle
- [ ] Test on staging
- [ ] Monitor for errors
- [ ] Gather feedback from test admins

---

## API Mapping Reference

### AdminModeration → AdminService

```javascript
// OLD - Wrong endpoints
axios.get('/api/moderation/pending-flags')
axios.get('/api/moderation/stats')
axios.post('/api/moderation/resolve-flag')

// NEW - Use adminService
adminService.getModerationQueue()
adminService.getModerationAnalytics()
adminService.reviewModerationFlag() // or other resolve methods
```

### AdminDashboard Already Uses

```javascript
// Already correct - uses adminService
adminService.getDashboard()
adminService.getModerationQueue()
adminService.getReviewCandidates()
adminService.getPhotoModeration()
adminService.getBans()
adminService.getAppeals()
adminService.getModerationAnalytics()
adminService.getActionsLog()

// User actions
adminService.suspendUser()
adminService.banUser()
adminService.deleteUser()
adminService.revokeBan()
adminService.createUserFlag()
```

---

## Known Issues & Workarounds

### Issue 1: AdminModeration Wrong API Paths
**Status**: Needs Fix
**Workaround**: Use AdminDashboard for now (it's more complete)
**Fix**: Use adminService methods

### Issue 2: Some Backend Endpoints May Need Auth Check
**Status**: Should be fine (authenticateToken middleware applied)
**Verify**: All admin routes have requireAdmin check

### Issue 3: Response Formats
**Status**: Need to verify match between backend and frontend
**Test**: Each endpoint individually

---

## Dependencies & Requirements

**Frontend**:
- ✅ React Router (for /admin-dashboard and /admin/moderation routes)
- ✅ axios (for API calls)
- ✅ adminService (for centralized API calls)

**Backend**:
- ✅ Express routes (all 25+ endpoints)
- ✅ Database (user_bans, moderation tables)
- ✅ Auth middleware (authenticateToken, requireAdmin)

**Database**:
- ✅ user_bans table
- ✅ user_flags table
- ✅ reports table
- ✅ fraud_flags table
- ✅ spam_flags table
- ✅ admin_actions_log table

---

## Success Criteria

✅ **Admin Dashboard**:
- [ ] Loads without errors
- [ ] Shows real data from backend
- [ ] All 8 tabs functional
- [ ] All user actions work (suspend, ban, delete)
- [ ] Photo moderation works
- [ ] Appeals review works
- [ ] Analytics displays properly

✅ **AdminModeration**:
- [ ] Uses correct API endpoints
- [ ] Queue loads and shows flags
- [ ] Stats display
- [ ] Can resolve flags

✅ **Integration**:
- [ ] Both routes accessible (/admin-dashboard, /admin/moderation)
- [ ] Admin users can access, non-admins see 403
- [ ] All errors handled gracefully
- [ ] No console errors

---

## Timeline

**Today (Hour 1)**: Fix AdminModeration APIs  
**Today (Hour 2)**: Verify all backend endpoints  
**Today (Hour 3)**: Test AdminDashboard end-to-end  
**Today (Hour 4)**: Polish and deployment prep  

**Total**: ~4 hours (1 session)

---

## Testing Checklist

### Admin Dashboard Tests
- [ ] Login as admin
- [ ] Visit /admin-dashboard
- [ ] Overview tab: Check all metrics display
- [ ] Queue tab: See pending moderation items
- [ ] Reviews tab: Filter users, expand details
- [ ] Photos tab: Review pending photos
- [ ] Bans tab: See active bans
- [ ] Appeals tab: Review pending appeals
- [ ] Analytics tab: View moderation stats
- [ ] Actions tab: See admin action history

### User Management Tests
- [ ] Can manually flag user
- [ ] Can suspend user (7 days)
- [ ] Can ban user permanently
- [ ] Can delete user account
- [ ] Can revoke ban
- [ ] Actions appear in log

### Error Handling Tests
- [ ] Show error when API fails
- [ ] Show loading states
- [ ] Disable buttons during action
- [ ] Clear error messages
- [ ] Retry functionality

---

## Notes

1. **AdminDashboard is more complete** - Consider making it primary admin interface
2. **AdminModeration is simpler** - Use for quick queue review only
3. **Both can coexist** - /admin-dashboard (main) + /admin/moderation (supplementary)
4. **Play Store doesn't require admin panel** - But good for moderation post-launch
5. **Priority**: Get AdminDashboard working 100% first

---

## Next Phase

After admin integration is complete:
- Task 3: Content Moderation UI Integration (wire to message sending)
- Task 4: Sentry Error Tracking Setup
- Task 5: Socket.IO Handler Registration
- Task 6: Firebase Push Notifications

