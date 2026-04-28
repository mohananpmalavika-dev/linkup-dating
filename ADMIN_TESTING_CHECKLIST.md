# Admin Dashboard Testing Checklist

## Status: API Fixes Complete ✅ → Testing Phase

**Last Updated:** Phase 2 - 70% complete  
**Build Status:** ✅ Compiled successfully  
**Next Step:** End-to-end testing of admin dashboard

---

## Test Environment Setup

### Prerequisites
- [ ] Dev server running: `npm start` (http://localhost:3000)
- [ ] Backend running: `npm start` in backend/ (http://localhost:3001)
- [ ] Database: Running and populated with test data
- [ ] Browser: Chrome/Firefox with DevTools open

### Test Admin Account
- **Email**: admin@linkup.test
- **Password**: AdminTest123!
- **Role**: Admin (requireAdmin middleware verified)

---

## Phase 1: Authentication & Access Control (5 min)

### Test 1.1: Admin Login Flow
- [ ] Navigate to `/login`
- [ ] Enter admin credentials
- [ ] Verify redirect to `/admin-dashboard` (not `/discover`)
- [ ] Verify "Admin Dashboard" appears in navbar/sidebar
- [ ] Check localStorage for admin token

### Test 1.2: Non-Admin Access Blocked
- [ ] Logout, login as regular user
- [ ] Try to access `/admin-dashboard`
- [ ] Verify redirect to `/discover` (access denied)
- [ ] Try to access `/admin/moderation`
- [ ] Verify redirect to `/discover` (access denied)

### Test 1.3: Token Expiry Handling
- [ ] Login as admin
- [ ] Manually remove token from localStorage
- [ ] Try to navigate to protected route
- [ ] Verify redirect to login

---

## Phase 2: Admin Dashboard Main Page (5 min)

### Test 2.1: Dashboard Loads
- [ ] Navigate to `/admin-dashboard`
- [ ] Verify page loads without errors
- [ ] Check browser console for 401/404 errors
- [ ] Verify dashboard title and header visible

### Test 2.2: Tab Navigation
- [ ] Click each tab: Overview, Queue, Reviews, Photos, Bans, Appeals, Analytics, Actions
- [ ] Verify each tab content loads
- [ ] Verify active tab styling
- [ ] Check Network tab for correct API calls

### Test 2.3: AdminDashboard API Calls (Overview Tab)
Expected endpoints:
- [ ] `GET /admin/dashboard` - Should return metrics
- [ ] Response contains: totalUsers, totalFlags, totalBans, totalAppeals, activeUsers
- [ ] Verify metrics display in Overview tab
- [ ] Check response time: < 1 second

---

## Phase 3: AdminModeration Component Tests (10 min)

### Test 3.1: Moderation Queue Tab
**Route**: `/admin/moderation` (direct access)

- [ ] Component loads without errors
- [ ] Queue tab is active by default
- [ ] Network call: `GET /admin/moderation/queue`
- [ ] Verify response format:
  ```json
  {
    "queue": [
      {
        "id": "...",
        "type": "flag|report|spam|fraud",
        "reason": "...",
        "flaggedUserId": "...",
        "flaggedContentId": "...",
        "createdAt": "...",
        "status": "pending"
      }
    ]
  }
  ```
- [ ] Flags display in list
- [ ] Sorting works (Recent/Oldest)
- [ ] Filtering works (All/Pending/Resolved)

### Test 3.2: Resolve Flag Workflow
- [ ] Click on a flag in the queue
- [ ] Click "Approve" or "Reject" button
- [ ] Enter optional reason
- [ ] Network call: `PUT /admin/moderation-flags/:flagId/review`
- [ ] Verify flag removed from queue after resolution
- [ ] Verify success message displayed
- [ ] Refresh page and confirm flag still resolved (persisted)

### Test 3.3: Moderation Stats Tab
- [ ] Click Stats tab
- [ ] Network call: `GET /admin/analytics/moderation`
- [ ] Verify stats load:
  - [ ] Total flags today/this week/this month
  - [ ] Flags by type (spam, fraud, manual)
  - [ ] Resolution rate (%)
  - [ ] Average resolution time
  - [ ] Charts/graphs render

### Test 3.4: Error Handling
- [ ] Simulate network error (DevTools → Offline)
- [ ] Verify error message displays
- [ ] Verify "Retry" button appears
- [ ] Click Retry and verify reconnection works
- [ ] Verify no console errors on error states

---

## Phase 4: User Review & Management (5 min)

### Test 4.1: Reviews Tab (AdminDashboard)
- [ ] Click Reviews tab
- [ ] Network call: `GET /admin/users/review`
- [ ] Verify list of flagged users loads
- [ ] Click user to view review details
- [ ] Network call: `GET /admin/users/:userId/review`
- [ ] Verify detailed review information displays:
  - [ ] User profile (photo, name, age)
  - [ ] Flag count and details
  - [ ] Messages flagged
  - [ ] Ban history

### Test 4.2: User Actions
- [ ] From review detail, test "Flag User" button
  - [ ] Network call: `POST /admin/users/:userId/flag`
  - [ ] Verify flag created and displays in queue
- [ ] Test "Suspend User" button (48 hours)
  - [ ] Network call: `POST /admin/users/:userId/suspend`
  - [ ] Verify suspension message
  - [ ] Verify user can't login for 48 hours
- [ ] Test "Ban User" button (permanent)
  - [ ] Network call: `POST /admin/users/:userId/ban`
  - [ ] Verify ban confirmation dialog
  - [ ] Verify user account disabled
  - [ ] Verify user can't login

### Test 4.3: User Deletion
- [ ] Test "Delete Account" button
- [ ] Network call: `POST /admin/users/:userId/delete`
- [ ] Verify confirmation required
- [ ] Verify user data deleted
- [ ] Verify cannot login after deletion

---

## Phase 5: Photo Moderation (3 min)

### Test 5.1: Photo Queue
- [ ] Click Photos tab
- [ ] Network call: `GET /admin/photo-moderation`
- [ ] Verify pending photos load
- [ ] Verify photo thumbnail displays
- [ ] Verify user info displays

### Test 5.2: Photo Review
- [ ] Click photo to review
- [ ] Click "Approve" or "Reject"
- [ ] Network call: `PUT /admin/photo-moderation/:queueId/review`
- [ ] Verify photo removed from queue
- [ ] Verify user notified of decision

---

## Phase 6: Bans & Appeals (3 min)

### Test 6.1: Active Bans
- [ ] Click Bans tab
- [ ] Network call: `GET /admin/bans`
- [ ] Verify banned users list loads
- [ ] Verify ban reason and date
- [ ] Verify revoke button

### Test 6.2: Revoke Ban
- [ ] Click "Revoke Ban" button
- [ ] Network call: `POST /admin/bans/:banId/revoke`
- [ ] Verify user re-enabled
- [ ] Verify user can login again
- [ ] Verify appeals from that user cleared

### Test 6.3: Appeals Queue
- [ ] Click Appeals tab
- [ ] Network call: `GET /admin/appeals`
- [ ] Verify appeals load with user info
- [ ] Verify appeal reason displays

### Test 6.4: Review Appeal
- [ ] Click appeal to review
- [ ] Click "Approve" or "Deny"
- [ ] Network call: `POST /admin/appeals/:appealId/review`
- [ ] Verify appeal resolution saved
- [ ] If approved: verify user ban revoked

---

## Phase 7: Analytics & Reports (5 min)

### Test 7.1: Analytics Tab
- [ ] Click Analytics tab in AdminModeration
- [ ] Network call: `GET /admin/analytics/moderation` (if separate tab)
- [ ] Verify charts load (bar charts, line graphs)
- [ ] Verify data by day/week/month filters work

### Test 7.2: Platform Analytics (AdminDashboard)
- [ ] Click Analytics tab in AdminDashboard
- [ ] Network call: `GET /admin/analytics/platform`
- [ ] Verify KPIs load:
  - [ ] Daily active users
  - [ ] New matches
  - [ ] Messages sent
  - [ ] Revenue metrics
  - [ ] Conversion rates

### Test 7.3: User Analytics
- [ ] From Reviews tab, click user → Analytics
- [ ] Network call: `GET /admin/analytics/users/:userId`
- [ ] Verify user-specific metrics:
  - [ ] Messages sent/received
  - [ ] Matches created
  - [ ] Photos uploads
  - [ ] Time spent in app

---

## Phase 8: Admin Actions Log (3 min)

### Test 8.1: Actions Log Tab
- [ ] Click Actions tab
- [ ] Network call: `GET /admin/actions-log`
- [ ] Verify all admin actions logged:
  - [ ] User suspended
  - [ ] User banned
  - [ ] Flag resolved
  - [ ] Photo rejected
  - [ ] Appeal reviewed
- [ ] Verify timestamp accurate
- [ ] Verify admin name shows correctly

### Test 8.2: Log Filtering
- [ ] Filter by action type
- [ ] Filter by date range
- [ ] Filter by admin name
- [ ] Verify results update

---

## Phase 9: Edge Cases & Error Scenarios (5 min)

### Test 9.1: Network Failures
- [ ] Simulate slow connection (DevTools → Slow 3G)
- [ ] Verify loading states display
- [ ] Verify spinners/skeletons show
- [ ] Verify timeout handling after 30s

### Test 9.2: Missing Data
- [ ] Test with empty queue
- [ ] Verify "No pending items" message
- [ ] Test with single item
- [ ] Test with 100+ items (pagination?)

### Test 9.3: Concurrent Actions
- [ ] Open admin dashboard in 2 tabs
- [ ] Resolve flag in tab 1
- [ ] Verify tab 2 updates (or prompts refresh)
- [ ] Verify no duplicate actions

### Test 9.4: Permission Issues
- [ ] Try to resolve flag without admin role
- [ ] Verify 403 Forbidden returned
- [ ] Verify error message displayed
- [ ] Try to ban another admin
- [ ] Verify prevented (if not allowed by business logic)

---

## Phase 10: Performance & Load Testing (5 min)

### Test 10.1: Page Load Time
- [ ] Admin Dashboard: < 2s
- [ ] AdminModeration: < 1.5s
- [ ] Each tab load: < 1s

### Test 10.2: Large Data Sets
- [ ] Load with 1000+ flags in queue
- [ ] Load with 100+ reports
- [ ] Verify no lag or freezing
- [ ] Verify pagination works
- [ ] Verify sorting still responsive

### Test 10.3: Browser DevTools Performance
- [ ] Open Performance tab
- [ ] Record dashboard load
- [ ] Verify no long tasks
- [ ] Verify frames per second (FPS) > 30
- [ ] Check memory usage < 100MB

---

## Sign-Off Checklist

### API Correctness
- [ ] All 26 admin endpoints called correctly
- [ ] No wrong endpoint paths used
- [ ] All responses parsed correctly
- [ ] Error codes handled properly

### UI/UX
- [ ] All buttons clickable and functional
- [ ] All forms validate correctly
- [ ] Loading states visible
- [ ] Error messages clear and helpful
- [ ] Confirmation dialogs for destructive actions

### Security
- [ ] Admin token verified before each action
- [ ] Non-admins cannot access endpoints
- [ ] Suspended/banned users blocked correctly
- [ ] No sensitive data leaked in UI

### Browser Compatibility
- [ ] Chrome ✅
- [ ] Firefox ✅
- [ ] Safari ✅
- [ ] Edge ✅
- [ ] Mobile browsers (responsive)

---

## Testing Results

| Component | Status | Notes | Issues |
|-----------|--------|-------|--------|
| AdminDashboard | 🔄 Testing | - | None yet |
| AdminModeration | 🔄 Testing | API calls fixed | None yet |
| Authentication | 🔄 Testing | - | None yet |
| API Endpoints | 🔄 Testing | - | None yet |
| Error Handling | ⏳ Pending | - | - |
| Performance | ⏳ Pending | - | - |

---

## Next Steps After Testing

1. **If All Tests Pass** ✅
   - Mark admin integration as 100% complete
   - Update TODO: Priority 3 (Content Moderation)
   - Proceed to content moderation UI integration

2. **If Issues Found** ❌
   - Document issues
   - Create bug tickets
   - Prioritize by severity (critical/high/medium/low)
   - Fix and re-test

---

## Time Estimate

- **Total Testing Time**: ~40-45 minutes
- **Documentation**: 5 minutes
- **Fixes (if needed)**: Variable
- **Total Phase 2 Time**: 1.5-2 hours (of 4 estimated)

**Status**: Ready to begin testing phase ✅
