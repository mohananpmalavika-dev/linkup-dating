# Double Dates Feature - Complete Implementation Guide

## Overview

The Double Dates feature enables users to coordinate group dates with friends and their matches. Two matched couples can propose and agree to spend time together as a foursome, with optional friend validation of matches.

**Key Features:**
- ✅ Dual-match validation (both couples must be matched)
- ✅ Multi-step approval workflow (4-person consensus required)
- ✅ Friend verification system (optional match validation)
- ✅ Integrated group chat for all 4 participants
- ✅ Post-date ratings and feedback system

---

## Architecture

### Database Schema

#### 1. `double_date_requests` Table
Stores proposals for double dates between two matched couples.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `user_id_1` | UUID | First user in first match (FK User) |
| `user_id_2` | UUID | Second user in first match (FK User) |
| `friend_id_1` | UUID | First user in second match (FK User) |
| `friend_id_2` | UUID | Second user in second match (FK User) |
| `initiated_by` | UUID | User who created the request (FK User) |
| `status` | ENUM | pending, accepted_by_user_1, accepted_by_user_2, accepted_by_friend_1, accepted_by_friend_2, all_accepted, rejected, cancelled |
| `proposed_date` | TIMESTAMP | Suggested date for the double date |
| `proposed_location` | VARCHAR | Venue for the date |
| `proposed_activity` | VARCHAR | Activity type (dinner, drinks, etc.) |
| `message` | TEXT | Personal message from initiator |
| `user_1_approved_at` | TIMESTAMP | When user_1 approved |
| `user_2_approved_at` | TIMESTAMP | When user_2 approved |
| `friend_1_approved_at` | TIMESTAMP | When friend_1 approved |
| `friend_2_approved_at` | TIMESTAMP | When friend_2 approved |
| `double_date_group_id` | UUID | Reference to created group (FK) |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

**Status Flow:**
```
pending 
  ↓
When first user approves → accepted_by_user_1
When second user approves → accepted_by_user_2
When first friend approves → accepted_by_friend_1
When second friend approves → accepted_by_friend_2
All 4 approved → all_accepted (creates DoubleDateGroup)
Any rejection → rejected
```

#### 2. `double_date_groups` Table
Represents an active group of 4 people scheduled for a double date.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `user_id_1` | UUID | First user (FK User) |
| `user_id_2` | UUID | Second user (FK User) |
| `friend_id_1` | UUID | Third user (FK User) |
| `friend_id_2` | UUID | Fourth user (FK User) |
| `match_id_pair_1` | UUID | Match ID for first couple (FK Match) |
| `match_id_pair_2` | UUID | Match ID for second couple (FK Match) |
| `chatroom_id` | UUID | Group chat for 4 people (FK Chatroom) |
| `scheduled_date` | TIMESTAMP | When the date is planned |
| `location` | VARCHAR | Venue |
| `activity` | VARCHAR | Activity type |
| `notes` | TEXT | Additional details |
| `status` | ENUM | scheduled, in_progress, completed, cancelled |
| `marked_completed_by` | UUID | User who marked as done (FK User) |
| `completed_at` | TIMESTAMP | When date was marked complete |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

#### 3. `friend_verifications` Table
Allows users to optionally share their matches with friends for validation.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID | User sharing match (FK User) |
| `friend_id` | UUID | Friend viewing match (FK User) |
| `match_id` | UUID | Match being shared (FK Match) |
| `status` | ENUM | pending_approval, approved, rejected |
| `friend_feedback` | TEXT | Friend's comments |
| `viewed_at` | TIMESTAMP | When friend viewed |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

**Unique Constraint:** (user_id, friend_id, match_id)

#### 4. `double_date_ratings` Table
Captures post-date feedback from each participant.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `double_date_group_id` | UUID | Reference to group (FK) |
| `user_id` | UUID | Person providing rating (FK User) |
| `overall_rating` | SMALLINT | 1-5 scale (CHECK: 1-5) |
| `rating_for_user_2` | SMALLINT | Rating given to user_2 (1-5) |
| `rating_for_friend_1` | SMALLINT | Rating given to friend_1 (1-5) |
| `rating_for_friend_2` | SMALLINT | Rating given to friend_2 (1-5) |
| `review` | TEXT | Detailed feedback |
| `would_do_again` | BOOLEAN | Would participate again |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

---

## Backend Implementation

### Database Migration

**File:** `backend/migrations/20260428_create_double_dates.js`

```bash
# Run migration
npx sequelize-cli db:migrate

# Undo migration
npx sequelize-cli db:migrate:undo
```

Features:
- ✅ Foreign key constraints with cascading deletes
- ✅ Composite indexes on user tuples for query performance
- ✅ Status indexes for efficient filtering
- ✅ ENUM constraints at database level
- ✅ Date indexes for scheduling queries

### Sequelize Models

**Files:**
- `backend/models/DoubleDateRequest.js`
- `backend/models/DoubleDateGroup.js`
- `backend/models/FriendVerification.js`
- `backend/models/DoubleDateRating.js`

**Key Features:**
- Proper associations with aliases
- Validation constraints
- Scopes for common queries
- Model hooks for automatic timestamps

### Service Layer

**File:** `backend/services/doubleDateService.js`

**Core Methods:**

#### 1. `createDoubleDateRequest(userId, data)`
Creates a new double date proposal.

**Validation:**
- Both users must be matched together
- Both friends must be matched together
- Initiator and friend must be friends
- Their partner and the friend must be friends
- No duplicate pending requests

**Returns:** `{ success, message, requestId }`

```javascript
const result = await doubleDateService.createDoubleDateRequest(userId, {
  matchId: 123,
  friendId: 456,
  friendMatchId: 789,
  proposedDate: "2024-12-25T18:00:00",
  proposedLocation: "The Italian Place",
  proposedActivity: "dinner",
  message: "I think we'd all have fun together!"
});
```

#### 2. `getPendingRequests(userId)`
Fetches all pending double date requests for a user.

**Returns:** `{ success, requests: Array }`

#### 3. `approveRequest(requestId, userId)`
Approves a request from a specific user.

**Logic:**
- Tracks which user approved
- When all 4 approve:
  1. Creates DoubleDateGroup
  2. Creates Chatroom with 4 members
  3. Updates status to 'all_accepted'

**Returns:** `{ success, message, status, groupId?, chatroomId? }`

#### 4. `rejectRequest(requestId, userId)`
Rejects a double date request.

**Returns:** `{ success, message }`

#### 5. `getActiveGroups(userId)`
Retrieves all active double date groups.

**Returns:** `{ success, groups: Array }`

#### 6. `markCompleted(groupId, userId)`
Marks a double date as completed.

**Returns:** `{ success, message }`

#### 7. `rateDoubleDate(groupId, userId, ratings)`
Submits post-date ratings and feedback.

**Validates:**
- Rating between 1-5
- Calculates group average

**Returns:** `{ success, message, groupAverageRating, totalRatings }`

#### 8. `enableFriendVerification(userId, matchId, friendId)`
Shares a match with a friend for validation.

**Returns:** `{ success, message }`

#### 9. `getFriendVerifications(userId)`
Gets matches shared with the user.

**Returns:** `{ success, verifications: Array }`

#### 10. `respondToVerification(verificationId, userId, approved, feedback)`
Approves or rejects a shared match.

**Returns:** `{ success, message }`

---

### API Endpoints

**Base URL:** `/api/double-dates`

#### 1. Create Request
```
POST /api/double-dates/request
Authorization: Bearer TOKEN
Content-Type: application/json

Body: {
  matchId: number,
  friendId: number,
  friendMatchId: number,
  proposedDate?: string,
  proposedLocation?: string,
  proposedActivity?: string,
  message?: string
}

Response: {
  success: boolean,
  message: string,
  requestId?: number
}
```

#### 2. Get Pending Requests
```
GET /api/double-dates/requests/pending
Authorization: Bearer TOKEN

Response: {
  success: boolean,
  requests: Array
}
```

#### 3. Approve Request
```
POST /api/double-dates/request/:requestId/approve
Authorization: Bearer TOKEN

Response: {
  success: boolean,
  message: string,
  status: string,
  groupId?: number,
  chatroomId?: number
}
```

#### 4. Reject Request
```
POST /api/double-dates/request/:requestId/reject
Authorization: Bearer TOKEN

Response: {
  success: boolean,
  message: string
}
```

#### 5. Get Active Groups
```
GET /api/double-dates/groups
Authorization: Bearer TOKEN

Response: {
  success: boolean,
  groups: Array
}
```

#### 6. Mark Completed
```
POST /api/double-dates/group/:groupId/complete
Authorization: Bearer TOKEN

Response: {
  success: boolean,
  message: string
}
```

#### 7. Rate Double Date
```
POST /api/double-dates/group/:groupId/rate
Authorization: Bearer TOKEN
Content-Type: application/json

Body: {
  overallRating: 1-5,
  ratingForUser2?: 1-5,
  ratingForFriend1?: 1-5,
  ratingForFriend2?: 1-5,
  review?: string,
  wouldDoAgain?: boolean
}

Response: {
  success: boolean,
  message: string,
  groupAverageRating: number,
  totalRatings: number
}
```

#### 8. Enable Friend Verification
```
POST /api/double-dates/friend-verification/enable
Authorization: Bearer TOKEN
Content-Type: application/json

Body: {
  matchId: number,
  friendId: number
}

Response: {
  success: boolean,
  message: string
}
```

#### 9. Get Friend Verifications
```
GET /api/double-dates/friend-verification/shared-with-me
Authorization: Bearer TOKEN

Response: {
  success: boolean,
  verifications: Array
}
```

#### 10. Respond to Verification
```
POST /api/double-dates/friend-verification/:verificationId/respond
Authorization: Bearer TOKEN
Content-Type: application/json

Body: {
  approved: boolean,
  feedback?: string
}

Response: {
  success: boolean,
  message: string
}
```

---

## Frontend Implementation

### Service Layer

**File:** `src/services/doubleDateService.js`

Exports API wrapper functions:
- `createRequest()`
- `getPendingRequests()`
- `approveRequest()`
- `rejectRequest()`
- `getActiveGroups()`
- `markCompleted()`
- `rateDoubleDate()`
- `enableFriendVerification()`
- `getFriendVerifications()`
- `respondToVerification()`

### React Components

#### 1. DoubleDateProposal Component
**File:** `src/components/DoubleDateProposal.js`

Two-step form for proposing a double date:
1. **Step 1:** Select friend and their match
2. **Step 2:** Plan date details (time, location, activity)

**Props:**
```javascript
{
  currentMatch: { id, user1, user2 },
  friends: Array,
  onSuccess: Function,
  onClose: Function
}
```

#### 2. DoubleDateRequests Component
**File:** `src/components/DoubleDateRequests.js`

Displays pending requests with approve/reject buttons.

**Features:**
- Shows all 4 participants
- Displays proposed details
- Handles approvals with real-time updates

#### 3. DoubleDateGroups Component
**File:** `src/components/DoubleDateGroups.js`

Shows active/completed double date groups.

**Features:**
- Lists all scheduled dates
- Shows participant avatars
- Links to group chat
- Mark complete button
- Rating modal for completed dates

#### 4. FriendVerification Component
**File:** `src/components/FriendVerification.js`

Tabbed interface:
- **Shared With Me:** Shows matches friends sent for validation
- **Share:** Allows sharing your matches with friends

---

## Styling

### CSS Files

- `src/styles/DoubleDateProposal.css` - Modal and form styling
- `src/styles/DoubleDateRequests.css` - Request cards
- `src/styles/DoubleDateGroups.css` - Group cards and rating modal
- `src/styles/FriendVerification.css` - Verification tabs and layouts

**Design System:**
- Primary gradient: `#ff6b9d → #c44569` (pink)
- Secondary: `#667eea → #764ba2` (purple for chat)
- Success: `#4CAF50` (green)
- Status colors: blue (scheduled), green (completed), red (cancelled)
- Responsive design with mobile optimizations

---

## Workflow Examples

### Example 1: Proposing a Double Date

1. **User A** (matched with B) wants to do a double date with Friend C (matched with D)
2. A opens DoubleDateProposal, selects:
   - Friend: C
   - Their match: D
   - Date: 2024-12-25 18:00
   - Location: The Italian Restaurant
   - Activity: dinner
3. Request created with status: `pending`
4. All 4 receive notifications:
   - A and B see request in pending section
   - C and D receive separate approval prompts

### Example 2: Multi-Step Approval

1. **A approves** → Status: `accepted_by_user_1` → B notified
2. **B approves** → Status: `accepted_by_user_2` → C & D notified
3. **C approves** → Status: `accepted_by_friend_1` → D notified
4. **D approves** → Status: `all_accepted`
   - **DoubleDateGroup** created
   - **Chatroom** created with all 4 members
   - All receive "Group created!" notification with chat link

### Example 3: Friend Verification Workflow

1. **User A** wants validation: Opens FriendVerification → Share tab
2. Selects their match (B) and friend (C)
3. **Friend C** receives notification
4. **C** reviews A's match (B) via Shared With Me tab
5. **C** can:
   - 👍 Approve: "Looks great! Good match!"
   - 👎 Pass: "Not interested"
6. A sees feedback in recommendations

---

## Error Handling

### Validation Errors

```javascript
// Not friends
{ success: false, message: "You must be friends with this person" }

// Not part of match
{ success: false, message: "You are not part of this match" }

// Duplicate request
{ success: false, message: "A request already exists for these pairs" }

// Invalid rating
{ success: false, message: "Overall rating must be 1-5" }
```

### Authorization Errors

```javascript
// Not authorized
{ success: false, message: "Not authorized" }

// Invalid approval
{ success: false, message: "Invalid approval" }
```

---

## Testing Scenarios

### Unit Tests

1. **doubleDateService**
   - createDoubleDateRequest validation
   - Approval state transitions
   - Rating calculations
   - Friend verification logic

2. **Models**
   - Sequelize validations
   - Associations
   - Scopes

### Integration Tests

1. **End-to-End Approval Workflow**
   - Create request
   - A approves
   - B approves
   - C approves
   - D approves
   - Verify group created
   - Verify chatroom created

2. **Friend Verification Flow**
   - Share match with friend
   - Friend approves
   - Verify feedback recorded

3. **Rating Submission**
   - Mark group completed
   - Submit ratings
   - Verify average calculated
   - Check other participants notified

---

## Future Enhancements

- [ ] Suggest potential double date matches based on compatibility
- [ ] Calendar integration for date scheduling
- [ ] Photo sharing during double dates
- [ ] Ratings history and analytics
- [ ] Repeat double date with same group
- [ ] Double date cost splitting
- [ ] Video call option for remote double dates
- [ ] Achievement badges ("Most Active Double Daters")
- [ ] Double date "chemistry" scoring

---

## Security Considerations

1. **Authentication:** All endpoints require valid JWT token
2. **Authorization:** Users can only see their own requests/groups
3. **Validation:** All inputs validated at service layer
4. **Rate Limiting:** API limiter middleware applied
5. **SQL Injection:** Parameterized queries via Sequelize ORM
6. **Cross-Origin:** CORS configured for frontend domain

---

## Deployment Checklist

- [ ] Run migrations: `npx sequelize-cli db:migrate`
- [ ] Seed test data (optional)
- [ ] Test all endpoints with Postman/Thunder
- [ ] Deploy backend to production
- [ ] Test frontend components
- [ ] Monitor error logs
- [ ] Verify group chat creation working
- [ ] Test notification system
- [ ] Load testing for concurrent requests

---

## Support & Troubleshooting

### Common Issues

**Q: Approval doesn't update immediately**
A: Frontend polling needed. Implement websocket for real-time or increase poll frequency.

**Q: Chatroom not created when all approve**
A: Check if Chatroom/ChatroomMember models exist. Verify foreign key constraints.

**Q: Friend not seeing shared match**
A: Confirm friend_id in FriendVerification matches actual friend user ID.

### Debug Mode

Set environment variables:
```bash
DEBUG_DOUBLE_DATES=true
DEBUG_APPROVAL_FLOW=true
```

This logs all state transitions and validation checks.

---

## Contact & Questions

For implementation questions, consult:
- Backend: [Backend team contact]
- Frontend: [Frontend team contact]
- Database: [DB admin contact]
