# Message Reactions & Rich Reactions - Quick Reference

## Feature Summary

**Implement message reactions and streak tracking with psychology-driven engagement mechanics.**

### Requirements Completed ✅
1. ✅ Emoji reactions (👍, ❤️, 😂, 🔥, 😭, 😮, 🤔, 😠)
2. ✅ Custom reactions using profile photos
3. ✅ Heart streaks - emoji shown when messaging 3+ days
4. ✅ Psychology boost - engagement score increases with streaks

---

## Backend Components

### Models
```javascript
// 1. MessageReaction (Enhanced)
// Location: backend/models/MessageReaction.js
// New fields:
//   - customReactionType: 'emoji' | 'photo'
//   - customPhotoUrl: String
//   - customPhotoId: Integer (ProfilePhoto FK)
//   - customDisplayName: String

// 2. MessageStreakTracker (New)
// Location: backend/models/MessageStreakTracker.js
// Tracks consecutive messaging days with milestones
```

### Services
```javascript
// MessageReactionService
// Location: backend/services/messageReactionService.js

// Emoji Management
- addEmojiReaction(messageId, userId, emoji)
- removeReaction(messageId, userId, emoji)
- getMessageReactions(messageId)
- getReactionCounts(messageId)

// Custom Reactions
- addCustomReaction(messageId, userId, {photoUrl, photoId, displayName})

// Streak Management
- updateStreakAfterReaction(messageId)
- getStreak(userId1, userId2, matchId)
- calculateEngagementScore(matchId, userId1, userId2)

// Suggestions & Analytics
- getSuggestedReactions(matchId, userId)
- getTopReactions(matchId, limit)
```

### API Routes
```
POST   /api/messages/:messageId/reactions
POST   /api/messages/:messageId/custom-reactions
DELETE /api/messages/:messageId/reactions/:emoji
GET    /api/messages/:messageId/reactions
GET    /api/matches/:matchId/streak
GET    /api/matches/:matchId/engagement-score
GET    /api/matches/:matchId/top-reactions
GET    /api/reactions/suggested/:matchId
GET    /api/streaks/active-streaks
GET    /api/streaks/history
GET    /api/reactions/emoji-list
```

### Socket.io Events
```javascript
// EMIT (Server broadcasts)
message_reaction_added
message_custom_reaction_added
message_reaction_removed
streak_milestone_3days    // 🎉 + ❤️
streak_milestone_7days    // 🎉 + ❤️
streak_milestone_30days   // 🔥🔥🔥
engagement_score_updated

// LISTEN (Client receives)
// Same events + data updates
```

---

## Frontend Components

### ReactionPicker
```jsx
import ReactionPicker from './components/ReactionPicker';

<ReactionPicker
  messageId={msg.id}
  onReactionSelected={(emoji) => handleReaction(emoji)}
  matchId={matchId}
  userFavorites={userFavs}
/>
```
- 4 quick-access buttons (👍, ❤️, 😂, 🔥)
- "More" button for full emoji picker
- Modal with all 8 reactions + categories

### MessageReactionDisplay
```jsx
import MessageReactionDisplay from './components/MessageReactionDisplay';

<MessageReactionDisplay
  messageId={msg.id}
  reactions={reactions}
  onRemoveReaction={(emoji) => handleRemove(emoji)}
  currentUserId={userId}
/>
```
- Shows emoji + reaction count
- Hover reveals who reacted
- Click to toggle your reaction
- Remove button for user's reactions

### StreakBadge
```jsx
import StreakBadge from './components/StreakBadge';

<StreakBadge
  matchId={matchId}
  streakDays={7}
  emoji="❤️"
  isActive={true}
  totalMessages={45}
  engagementScore={58}
/>
```
- 3-day: ❤️ badge
- 7-day: ❤️ badge
- 30-day: 🔥 badge
- Animated milestone celebrations
- Progress bar to next emoji

---

## Custom Hooks

### useMessageReactions
```javascript
const { reactions, addEmojiReaction, removeReaction } = 
  useMessageReactions(messageId, matchId);

// reactions = { '❤️': { count: 3, users: [...] }, ... }
// addEmojiReaction(emoji) - returns {success, reaction, action}
// removeReaction(emoji) - returns {success, message}
```

### useStreak
```javascript
const { streak, loading, error } = useStreak(matchId);

// streak = {
//   active: true,
//   streakDays: 7,
//   emoji: '❤️',
//   text: '7❤️ Day Streak!',
//   totalMessages: 45,
//   engagementScore: 58
// }
```

### useEngagementScore
```javascript
const { score, loading } = useEngagementScore(matchId);
// score = 58 (percentage 0-100)
```

### useSuggestedReactions
```javascript
const { suggestions } = useSuggestedReactions(matchId, userId);
// suggestions = ['❤️', '😂', '👍', '🔥', ...]
```

### useActiveStreaks
```javascript
const { streaks } = useActiveStreaks();
// streaks = [
//   { matchId, matchUserId, matchUserName, streakDays, emoji, text, engagementScore },
//   ...
// ]
```

---

## Database Schema

### message_streak_trackers
```sql
CREATE TABLE message_streak_trackers (
  id SERIAL PRIMARY KEY,
  user_id_1 INTEGER,          -- User 1 in pair
  user_id_2 INTEGER,          -- User 2 in pair
  match_id INTEGER,           -- Match reference
  
  streak_days INTEGER,        -- Current streak days
  is_active BOOLEAN,          -- Streak status
  streak_start_date TIMESTAMP,
  last_message_date TIMESTAMP,
  
  milestone_3_days BOOLEAN,   -- Achievement flags
  milestone_7_days BOOLEAN,
  milestone_30_days BOOLEAN,
  
  total_messages INTEGER,     -- Analytics
  total_reactions INTEGER,
  engagement_score FLOAT,
  
  notification_sent BOOLEAN,
  last_notification_date TIMESTAMP,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  UNIQUE(user_id_1, user_id_2, match_id)
);
```

### message_reactions (Enhanced)
```sql
ALTER TABLE message_reactions ADD (
  custom_reaction_type VARCHAR(20) DEFAULT 'emoji',
  custom_photo_url VARCHAR(500),
  custom_photo_id INTEGER,
  custom_display_name VARCHAR(100),
  updated_at TIMESTAMP
);
```

---

## Engagement Score Formula

```
Score = (streakDays × 10) + messageBonus + reactionBonus + milestoneBonus

Components:
- Streak Velocity: streakDays × 10 points/day (max 300)
- Message Frequency: min(messageCount × 2, 200) points
- Reaction Activity: min(reactionCount × 5, 150) points
- 3-day Milestone: +50 points
- 7-day Milestone: +100 points
- 30-day Milestone: +500 points

Examples:
- 3 days, 50 msgs, 10 reactions = 230 (23%)
- 7 days, 100 msgs, 25 reactions = 585 (58%)
- 30 days, 200+ msgs, 30+ reactions = 1000 (100%)
```

---

## Streak Progression

### 3-Day Milestone ❤️
- **Emoji**: ❤️
- **Message**: "🎉 You are on a 3-day message streak! ❤️"
- **Psychology**: First achievement - builds habit formation
- **Points**: +50 engagement

### 7-Day Milestone ❤️
- **Emoji**: ❤️ (stays same)
- **Message**: "🎉 Impressive! 7-day message streak! ❤️❤️"
- **Psychology**: Sustained engagement - shows consistency
- **Points**: +100 engagement

### 30-Day Milestone 🔥
- **Emoji**: 🔥 (upgraded!)
- **Message**: "🔥🔥🔥 AMAZING! 30-day streak! 🔥🔥🔥"
- **Psychology**: Major achievement - triggers celebration
- **Points**: +500 engagement

---

## Integration Steps

1. **Database**
   ```bash
   # Run migration
   npm run migrate 20260428_add_reactions_and_streaks.sql
   ```

2. **Backend Server**
   ```javascript
   // In server.js
   const reactionHandlers = require('./sockets/reactionSocketHandlers');
   
   io.on('connection', (socket) => {
     // Mount handlers
     socket.on('emoji_reaction_added', (data) => 
       reactionHandlers.handleEmojiReactionAdded(io, socket, data));
     // ... more handlers
   });
   
   // Mount API routes
   app.use('/api/messages', require('./routes/messageReactions'));
   ```

3. **React Components**
   ```jsx
   // In ChatMessage component
   <ReactionPicker 
     messageId={msg.id} 
     matchId={matchId}
     onReactionSelected={handleReaction}
   />
   
   <MessageReactionDisplay 
     reactions={reactions}
     onRemoveReaction={handleRemove}
   />
   
   {/* In match header */}
   <StreakBadge streak={streak} />
   ```

4. **Test & Deploy**

---

## Performance Tips

- **Indexes**: Efficient streak lookups by match, user, active status
- **Socket Rooms**: Use `match_${matchId}` for targeted broadcasting
- **Caching**: Cache suggested reactions per user
- **Batch Updates**: Combine streak + engagement score updates
- **Pagination**: Limit streak history queries (100 records)

---

## Files Summary

### Backend (8 files, 1425 lines)
- MessageReaction.js - Enhanced model
- MessageStreakTracker.js - New model
- messageReactionService.js - Service (365 lines)
- reactionSocketHandlers.js - Socket handlers (280 lines)
- messageReactions.js - API routes (380 lines)
- Migration SQL - Schema + triggers

### Frontend (9 files, 880 lines)
- ReactionPicker.jsx + .css
- MessageReactionDisplay.jsx + .css
- StreakBadge.jsx + .css
- useReactions.js - 6 custom hooks

### Documentation (2 files)
- MESSAGE_REACTIONS_INTEGRATION_GUIDE.md
- MESSAGE_REACTIONS_COMPLETE.md

---

## Testing Commands

```bash
# Test emoji reaction
curl -X POST http://localhost:5000/api/messages/1/reactions \
  -H "Content-Type: application/json" \
  -d '{"emoji": "❤️"}'

# Get reactions
curl http://localhost:5000/api/messages/1/reactions

# Get streak
curl http://localhost:5000/api/matches/1/streak

# Get engagement score
curl http://localhost:5000/api/matches/1/engagement-score

# Get active streaks
curl http://localhost:5000/api/streaks/active-streaks

# Get emoji list
curl http://localhost:5000/api/reactions/emoji-list
```

---

## Key Files Location

**Backend:**
```
backend/
  ├── models/
  │   ├── MessageReaction.js ✅ (Enhanced)
  │   └── MessageStreakTracker.js ✅ (NEW)
  ├── services/
  │   └── messageReactionService.js ✅ (NEW)
  ├── sockets/
  │   └── reactionSocketHandlers.js ✅ (NEW)
  ├── routes/
  │   └── messageReactions.js ✅ (NEW)
  └── migrations/
      └── 20260428_add_reactions_and_streaks.sql ✅ (NEW)
```

**Frontend:**
```
src/
  ├── components/
  │   ├── ReactionPicker.jsx ✅ (NEW)
  │   ├── ReactionPicker.css ✅ (NEW)
  │   ├── MessageReactionDisplay.jsx ✅ (NEW)
  │   ├── MessageReactionDisplay.css ✅ (NEW)
  │   ├── StreakBadge.jsx ✅ (NEW)
  │   └── StreakBadge.css ✅ (NEW)
  └── hooks/
      └── useReactions.js ✅ (NEW)
```

---

## Status: ✅ IMPLEMENTATION COMPLETE

All requirements implemented and ready for integration!
