# Opening Message Templates with Context - Integration Guide

## Overview
This feature provides AI-generated, context-aware opening message suggestions that replace generic "Hi" messages. The system learns which templates get the highest response rates and recommends them for future use.

## What Users See

### Scenario 1: Opening a Profile
```
User browsing profile sees:
┌─────────────────────────────────┐
│ Profile of Alex, 28 (loves hiking) │
│                                   │
│ [View Profile] [💡 Smart Message] │
└─────────────────────────────────┘

Clicks "Smart Message" →

┌──────────────────────────────────────┐
│ 💡 Personalized Opening Messages     │
│   for Alex                           │
├──────────────────────────────────────┤
│ [1] ⛰️  "Where's your favorite     │
│    trail near Denver? I'm always  │
│    looking for new adventure       │
│    recommendations!"              │
│    → Mentions: hiking              │
│    ✓ Uses This                    │
│                                    │
│ [2] 🥾 "I noticed we both love    │
│    hiking! Have you done any      │
│    challenging trails recently?"  │
│    → Shared Interest               │
│    ✓ Uses This                    │
│                                    │
│ [3] 💬 "Hi Alex! I love your      │
│    profile. What's something      │
│    most people don't know about   │
│    you?"                          │
│    → Generic fallback              │
│    ✓ Uses This                    │
└──────────────────────────────────┘
```

### Scenario 2: Analytics Dashboard
```
User checks which messages work best:

┌─────────────────────────────────┐
│ 📊 Message Template Analytics   │
├─────────────────────────────────┤
│ 🏆 Top Performers                │
├─────────────────────────────────┤
│ #1 "Where's your favorite..."   │
│    Response: 68% | Sent: 34     │
│    ████████░░░░░░ 68%           │
│    Last: 3 days ago             │
│                                 │
│ #2 "Have you done any..."       │
│    Response: 61% | Sent: 28     │
│    ██████░░░░░░░░░ 61%          │
│    Last: 1 week ago             │
│                                 │
│ #3 "What's something..."        │
│    Response: 42% | Sent: 19     │
│    ████░░░░░░░░░░░ 42%          │
│    Last: 2 weeks ago            │
│                                 │
│ 💡 Recommendations              │
│ → Try "Where's your favorite..." │
│   again! (68% success rate)     │
└─────────────────────────────────┘
```

## Implementation Steps

### Step 1: Verify Backend Dependencies

Ensure these models exist and are properly registered:
- ✅ `MessageTemplate.js` (Already exists)
- ✅ `DatingProfile.js` (Already exists)
- ✅ `Match.js` (Already exists)
- ✅ `Message.js` (Already exists)

Check `backend/models/index.js` has these auto-registered.

### Step 2: Add Backend Service

**File**: `backend/services/icereakerSuggestionService.js` ✅ DONE

This service contains:
- AI template library (14 interest categories)
- Mutual interest detection
- Performance tracking functions
- Recommendation engine

### Step 3: Add Backend Endpoints

**File**: `backend/routes/dating.js` ✅ DONE

Added 9 new endpoints (lines ~14989-15370):
1. Suggestion generation
2. Template tracking
3. Performance analytics
4. CRUD operations for templates

### Step 4: Add Frontend Components

**Component 1**: `src/components/IcereakerSuggestions.js` ✅ DONE
- Shows AI suggestions when user opens a profile
- Color-coded by category and contextual relevance
- Selection preview
- Loading/error states

**Component 2**: `src/components/TemplatePerformance.js` ✅ DONE
- Analytics dashboard
- Top performers with charts
- Smart recommendations
- Performance metrics

**Component 3**: `src/services/icereakerSuggestionService.js` ✅ DONE
- Frontend API wrapper
- Token management
- Error handling

### Step 5: Add Styles

**File 1**: `src/styles/IcereakerSuggestions.css` ✅ DONE
**File 2**: `src/styles/TemplatePerformance.css` ✅ DONE

### Step 6: Integrate Into Existing Components

#### Option A: Integrate with DatingProfileView.js

Find the messaging button section:
```jsx
// In DatingProfileView.js, locate the action buttons section
// Add this state at the top:
const [showSuggestions, setShowSuggestions] = useState(false);

// Add this button next to "Send Message":
<button 
  className="smart-message-button"
  onClick={() => setShowSuggestions(true)}
  title="Get AI-generated opening suggestions"
>
  💡 Smart Message
</button>

// Add this modal at the end:
{showSuggestions && (
  <Modal onClose={() => setShowSuggestions(false)}>
    <IcereakerSuggestions
      recipientProfile={profile}
      onSelectSuggestion={(suggestion) => {
        // Pass to message composer
        setMessageText(suggestion.content);
        setShowSuggestions(false);
      }}
      onClose={() => setShowSuggestions(false)}
    />
  </Modal>
)}
```

#### Option B: Integrate with DatingMessaging.js

```jsx
// In the message input area
import IcereakerSuggestions from './IcereakerSuggestions';

// Add state:
const [showTemplates, setShowTemplates] = useState(false);

// Add button in message toolbar:
<button onClick={() => setShowTemplates(true)}>
  💡 Suggestions
</button>

// When user sends message:
if (templateId) {
  icereakerSuggestionService.useSuggestion(
    recipientId,
    messageText,
    templateId,
    interestTrigger
  );
}
```

### Step 7: Track Message Responses

When a message is read, track the response:

```jsx
// In message display component
useEffect(() => {
  if (message.isRead && !message.responseTracked && message.templateId) {
    icereakerSuggestionService.trackResponse(
      message.templateId,
      true // User responded to this template message
    );
  }
}, [message.isRead]);
```

### Step 8: Add Analytics View

Add link to performance analytics:

```jsx
// In Matches.js or dashboard
const [showAnalytics, setShowAnalytics] = useState(false);

return (
  <>
    <button 
      onClick={() => setShowAnalytics(true)}
      className="analytics-button"
    >
      📊 My Message Analytics
    </button>

    {showAnalytics && (
      <Modal onClose={() => setShowAnalytics(false)}>
        <TemplatePerformance
          onClose={() => setShowAnalytics(false)}
        />
      </Modal>
    )}
  </>
);
```

## Using the Feature

### For End Users

1. **Browse Profiles**: See potential matches
2. **Click "💡 Smart Message"**: Get personalized suggestions
3. **Review Suggestions**: See AI-generated openers based on their interests
4. **Select & Send**: Choose the best option to send
5. **Track Success**: View analytics to see which templates work best

### For Developers

#### Get Suggestions
```javascript
const { suggestions } = await icereakerSuggestionService.getSuggestions(profileId);
// Returns 3-5 personalized suggestions sorted by relevance
```

#### Send Using Template
```javascript
await icereakerSuggestionService.useSuggestion(
  toUserId,
  message,
  templateId,      // optional, for tracking
  interestTrigger  // optional, to categorize
);
```

#### Get Performance Data
```javascript
const { templates } = await icereakerSuggestionService.getTopPerformers(10);
// Returns templates ranked by response rate

const { recommendations } = await icereakerSuggestionService.getRecommendations(5);
// Returns high-performing templates not used recently
```

#### Create Custom Template
```javascript
await icereakerSuggestionService.createTemplate(
  "Hey! I noticed we both love hiking. Want to grab coffee?",
  "Hiking Coffee Invite",
  "shared_interest",
  "☕",
  "hiking"
);
```

## Template Categories

Users can filter/organize templates by category:
- **shared_interest**: "We both love..."
- **question_based**: "What's your favorite..."
- **activity_suggestion**: "Want to try..."
- **compliment**: "I love how..."
- **humor**: "That's hilarious..."
- **location_based**: "In Denver, best..."
- **greeting**: Standard hello
- **flirtation**: Flirty/playful
- **thoughtful**: Deep/meaningful
- **general**: Miscellaneous

## Interest Triggers

System recognizes these interests and generates specific templates:
- hiking, cooking, travel, fitness, reading
- music, photography, gaming, art, coffee
- yoga, wine, dogs, cats, volunteering

### Adding New Interests

Edit `backend/services/icereakerSuggestionService.js`:

```javascript
const ICEBREAKER_TEMPLATES = {
  // ... existing interests ...
  
  // Add new interest:
  surfing: [
    { text: "What's your favorite surf spot? Looking for recommendations!", category: 'activity_suggestion', emoji: '🏄' },
    { text: "We both love surfing! Have you tried any new breaks recently?", category: 'shared_interest', emoji: '🌊' },
    { text: "Are you a big wave or mellow wave person?", category: 'question_based', emoji: '🏄‍♀️' }
  ]
};
```

## Performance Metrics

### Response Rate
```
Response Rate % = (Number of Responses / Number of Uses) × 100

Example:
- Template used 10 times
- Got 7 responses
- Response Rate = 70%
```

### Engagement Score
```
Engagement Score = Min(Response Rate + 20, 100)

Interpretation:
- 80-100: Excellent
- 60-79: Good
- 40-59: Fair
- <40: New/Learning
```

### Metrics Tracked Per Template
- `usageCount`: How many times sent
- `responseCount`: How many got replies
- `matchCount`: How many led to matches
- `responseRatePercent`: Success rate
- `avgResponseTimeSeconds`: Average time to reply
- `engagementScore`: ML-calculated score
- `lastUsedAt`: Recency
- `lastResponseAt`: Last successful response

## Testing the Feature

### Scenario 1: Test Suggestions Generation
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/dating/opening-templates/123/suggestions
```

Expected response:
```json
{
  "profileId": 123,
  "recipientName": "Alex",
  "suggestions": [
    {
      "content": "Where's your favorite trail...",
      "category": "activity_suggestion",
      "emoji": "🥾",
      "interestTrigger": "hiking",
      "isContextual": true
    },
    // ...
  ]
}
```

### Scenario 2: Test Message Sending with Template
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toUserId": 123, "message": "Where is...?", "templateId": 5}' \
  http://localhost:3001/api/dating/opening-templates/use
```

### Scenario 3: Test Analytics
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/dating/opening-templates/top-performers?limit=10
```

## Performance Considerations

### Database Optimization
- All MessageTemplate queries use indexes on `user_id`, `engagement_score`, `response_rate_percent`
- Sorting by response rate is indexed for fast queries

### Caching Opportunities
- Cache top performers for 1 hour per user
- Cache suggestions for 30 minutes per profile pair
- Invalidate on template update/usage

### Suggested Caching Implementation
```javascript
const cacheKey = `icebreaker:${userId}:${profileId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const suggestions = await generateSuggestions(...);
await redis.setex(cacheKey, 1800, JSON.stringify(suggestions)); // 30 min TTL
return suggestions;
```

## Security Considerations

### Input Validation
✅ All endpoints validate user ownership of templates
✅ Can't modify other users' templates
✅ Message content limited to 500 chars
✅ Title limited to 100 chars

### Rate Limiting
Consider adding rate limits:
- Suggestions: 10 per minute per user
- Message sending: 30 per hour per user
- Template creation: 5 per day per user

### Privacy
- Templates only visible to creator
- No personal data in suggestions

## Premium Feature Opportunities

Consider making these premium:

1. **Unlimited Suggestions**: Free users get 3, Premium get unlimited
2. **Template Analytics**: Premium-only feature ($4.99/month)
3. **AI Template Customization**: AI generates variations of templates
4. **Interest-Based Collections**: Pre-made templates for various interests
5. **A/B Testing Tools**: Premium users can test multiple templates

## Analytics & Insights

### User Engagement Metrics
- New users using suggestions = higher response rates
- Users checking analytics = higher engagement
- Templates with 3+ uses have statistically significant response rates

### Recommendation Engine
- Suggests templates not used in 30+ days if response rate > 30%
- Recommends new interest categories based on profile updates
- Seasonal recommendations (e.g., "skiing" in winter)

## Troubleshooting

### Problem: Suggestions always generic
**Solution**: Check DatingProfile has populated interests array
```javascript
SELECT interests FROM dating_profiles WHERE user_id = ? LIMIT 1;
```

### Problem: Response rates not updating
**Solution**: Ensure trackResponse is called when message is read
```javascript
// In message read handler
icereakerSuggestionService.trackResponse(templateId, true);
```

### Problem: Templates not persisting
**Solution**: Check MessageTemplate model is registered in models/index.js
```javascript
// models/index.js should have
const MessageTemplate = require('./MessageTemplate')(sequelize, DataTypes);
```

## Future Enhancements

1. **ML Model Retraining**: Periodically update AI templates based on response patterns
2. **Contextual Timing**: "Best time to message" based on user's online patterns
3. **Multi-language**: Generate suggestions in user's preferred language
4. **Emoji Recommendations**: AI suggests best emoji for message type
5. **Template Sharing**: Users share templates with friends
6. **A/B Testing Suite**: Built-in testing framework for templates
7. **Mobile-First Optimization**: Shorter suggestions for mobile users

## Questions & Support

For issues or questions, check:
- Backend logs for suggestions generation errors
- Message template performance metrics in database
- Ensure DatingProfile interests array is populated correctly
