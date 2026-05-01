# Conversation Quality Meter - Integration Examples

Complete code examples for integrating the Conversation Quality Meter into your DatingHub messaging interface.

---

## 📦 Installation & Setup

### 1. Database Migration (One-time)

```bash
# In backend directory
npm run db:migrate
```

This creates:
- `conversation_qualities` table
- `conversation_suggestions` table
- Proper indexes and relationships

### 2. Verify Files Exist

All these files should exist:
```
✅ backend/models/ConversationQuality.js
✅ backend/models/ConversationSuggestion.js
✅ backend/services/conversationQualityService.js
✅ backend/routes/conversationQuality.js
✅ backend/migrations/20260428_add_conversation_quality_meter.js
✅ src/components/ConversationQualityMeter.js
✅ src/components/ConversationQualitySuggestions.js
✅ src/components/ConversationQualityInsights.js
✅ src/services/conversationQualityService.js
✅ src/styles/ConversationQualityMeter.css
✅ src/styles/ConversationQualitySuggestions.css
✅ src/styles/ConversationQualityInsights.css
```

---

## 🔧 Integration Into Messaging Component

### Option 1: Add Below Message List (Recommended)

**File:** `src/components/DatingMessaging.js`

```jsx
import React, { useState, useEffect } from 'react';
import ConversationQualityMeter from './ConversationQualityMeter';
import ConversationQualitySuggestions from './ConversationQualitySuggestions';
import ConversationQualityInsights from './ConversationQualityInsights';

function DatingMessaging() {
  const [activeMatch, setActiveMatch] = useState(null);
  const [messages, setMessages] = useState([]);

  // Your existing message handling code...

  return (
    <div className="messaging-container">
      {/* Existing Messages List */}
      <div className="messages-list">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            {msg.content}
          </div>
        ))}
      </div>

      {/* NEW: Conversation Quality Section */}
      {activeMatch && (
        <div className="conversation-quality-section">
          <h3>Conversation Quality</h3>
          
          {/* Main Quality Meter */}
          <ConversationQualityMeter 
            matchId={activeMatch.id}
            partnerId={activeMatch.partnerId}
          />
          
          {/* AI Suggestions */}
          <ConversationQualitySuggestions 
            matchId={activeMatch.id}
          />
          
          {/* Detailed Insights */}
          <ConversationQualityInsights 
            matchId={activeMatch.id}
          />
        </div>
      )}

      {/* Your existing message input area */}
      <div className="message-input">
        {/* Input field, send button, etc. */}
      </div>
    </div>
  );
}

export default DatingMessaging;
```

### Option 2: Add as Sidebar (Alternative)

```jsx
return (
  <div className="messaging-layout">
    {/* Left: Message List */}
    <div className="messages-column">
      <div className="messages-list">
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            {msg.content}
          </div>
        ))}
      </div>
      <div className="message-input">
        {/* Input area */}
      </div>
    </div>

    {/* Right: Quality Meter Sidebar */}
    {activeMatch && (
      <div className="quality-sidebar">
        <ConversationQualityMeter 
          matchId={activeMatch.id}
          partnerId={activeMatch.partnerId}
        />
        <ConversationQualitySuggestions 
          matchId={activeMatch.id}
        />
        <ConversationQualityInsights 
          matchId={activeMatch.id}
        />
      </div>
    )}
  </div>
);
```

### Option 3: Add as Expandable Panel

```jsx
const [qualityPanelOpen, setQualityPanelOpen] = useState(false);

return (
  <div className="messaging-container">
    {/* Messages and input */}
    
    {/* Toggle Button */}
    <button 
      onClick={() => setQualityPanelOpen(!qualityPanelOpen)}
      className="quality-panel-toggle"
    >
      {qualityPanelOpen ? '▼ Hide' : '▶ Show'} Conversation Quality
    </button>

    {/* Expandable Panel */}
    {qualityPanelOpen && activeMatch && (
      <div className="quality-panel">
        <ConversationQualityMeter 
          matchId={activeMatch.id}
          partnerId={activeMatch.partnerId}
        />
        <ConversationQualitySuggestions 
          matchId={activeMatch.id}
        />
        <ConversationQualityInsights 
          matchId={activeMatch.id}
        />
      </div>
    )}
  </div>
);
```

---

## 🎨 Adding Custom Styling

### Option 1: Container Styling

**File:** `src/components/DatingMessaging.css` or similar

```css
/* Conversation Quality Section */
.conversation-quality-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.conversation-quality-section h3 {
  color: white;
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
}

/* Sidebar Styling */
.quality-sidebar {
  width: 350px;
  background: #f8f9fa;
  border-left: 1px solid #e0e0e0;
  padding: 16px;
  overflow-y: auto;
  max-height: 600px;
}

@media (max-width: 1024px) {
  .quality-sidebar {
    display: none;
  }
}

/* Toggle Button Styling */
.quality-panel-toggle {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  transition: transform 0.2s;
}

.quality-panel-toggle:hover {
  transform: scale(1.02);
}
```

---

## 🔄 Real-Time Updates

### Auto-Refresh Implementation

By default, components auto-refresh every 30 seconds. To customize:

**File:** `src/components/ConversationQualityMeter.js` (Line 15)

```jsx
useEffect(() => {
  if (matchId) {
    fetchConversationQuality();
    
    // Change interval here (milliseconds)
    // 10000 = 10 seconds
    // 30000 = 30 seconds (default)
    // 60000 = 1 minute
    const interval = setInterval(fetchConversationQuality, 30000);
    
    return () => clearInterval(interval);
  }
}, [matchId]);
```

### Manual Refresh Trigger

```jsx
const [quality, setQuality] = useState(null);
const [loading, setLoading] = useState(false);

// Add refresh button
<button 
  onClick={fetchConversationQuality}
  disabled={loading}
>
  {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
</button>

// Fetch function
const fetchConversationQuality = async () => {
  try {
    setLoading(true);
    const token = localStorage.getItem('authToken');
    const response = await axios.get(
      `${process.env.REACT_APP_API_URL}/api/conversation-quality/${matchId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setQuality(response.data);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## 🧪 Testing the Integration

### Step 1: Verify Backend Connection

```bash
# In terminal, test the API endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/conversation-quality/1
```

### Step 2: Check Browser Console

Open browser DevTools → Console

You should see:
- No error messages about component imports
- API requests being made to `/api/conversation-quality/*`
- Quality data being returned

### Step 3: Manual Testing

1. Open messaging with any match
2. Send 5-10 messages back and forth
3. Watch the quality meter appear
4. Refresh page to verify data persists
5. Check that score updates every 30 seconds

### Step 4: Verify All Components Render

```javascript
// In browser console
console.log(
  'Check for these elements:',
  document.querySelector('.quality-meter-container'),
  document.querySelector('.suggestions-container'),
  document.querySelector('.insights-container')
);
```

---

## 🔌 API Integration Example

### Manual API Calls

```jsx
import axios from 'axios';

// Get quality metrics
const getQuality = async (matchId) => {
  const token = localStorage.getItem('authToken');
  const response = await axios.get(
    `${process.env.REACT_APP_API_URL}/api/conversation-quality/${matchId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

// Get suggestions
const getSuggestions = async (matchId) => {
  const token = localStorage.getItem('authToken');
  const response = await axios.get(
    `${process.env.REACT_APP_API_URL}/api/conversation-quality/${matchId}/suggestions`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.suggestions;
};

// Mark suggestion as used
const useSuggestion = async (matchId, suggestionId, rating) => {
  const token = localStorage.getItem('authToken');
  const response = await axios.post(
    `${process.env.REACT_APP_API_URL}/api/conversation-quality/${matchId}/suggestions/${suggestionId}/use`,
    { rating },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

// Get insights
const getInsights = async (matchId) => {
  const token = localStorage.getItem('authToken');
  const response = await axios.get(
    `${process.env.REACT_APP_API_URL}/api/conversation-quality/${matchId}/insights`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

// Usage in component
useEffect(() => {
  if (matchId) {
    getQuality(matchId).then(setQuality);
    getSuggestions(matchId).then(setSuggestions);
    getInsights(matchId).then(setInsights);
  }
}, [matchId]);
```

---

## 🎯 Usage Scenarios

### Scenario 1: Show Only Quality Meter

```jsx
<ConversationQualityMeter 
  matchId={activeMatch.id}
  partnerId={activeMatch.partnerId}
/>
```

Shows: Score, percentile rank, basic metrics

### Scenario 2: Show Meter + Suggestions

```jsx
<ConversationQualityMeter 
  matchId={activeMatch.id}
  partnerId={activeMatch.partnerId}
/>
<ConversationQualitySuggestions 
  matchId={activeMatch.id}
/>
```

Shows: Score + AI suggestions to improve conversation

### Scenario 3: Show All Components

```jsx
<ConversationQualityMeter 
  matchId={activeMatch.id}
  partnerId={activeMatch.partnerId}
/>
<ConversationQualitySuggestions 
  matchId={activeMatch.id}
/>
<ConversationQualityInsights 
  matchId={activeMatch.id}
/>
```

Shows: Complete analysis with interpretations

### Scenario 4: Conditional Display

```jsx
const [showQuality, setShowQuality] = useState(false);

// Show only after some messages
const shouldShowQuality = messages.length > 5;

{shouldShowQuality && (
  <ConversationQualityMeter 
    matchId={activeMatch.id}
    partnerId={activeMatch.partnerId}
  />
)}
```

---

## 🐛 Debugging

### Issue: Components Not Showing

**Solution:**
```javascript
// 1. Check imports
import ConversationQualityMeter from './ConversationQualityMeter';

// 2. Verify matchId is passed
console.log('matchId:', matchId); // Should not be undefined

// 3. Check API URL
console.log('API URL:', process.env.REACT_APP_API_URL);

// 4. Check browser console for errors
// Open DevTools → Console tab
```

### Issue: "Could not load metrics" Error

**Solution:**
```javascript
// 1. Verify backend is running
// Test: curl http://localhost:5000

// 2. Check token is valid
console.log('Token:', localStorage.getItem('authToken'));

// 3. Test API endpoint directly
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/conversation-quality/1

// 4. Check browser console for details
// Look for CORS errors or auth failures
```

### Issue: No Suggestions Appearing

**Solution:**
```javascript
// Need at least 10 messages for suggestions
console.log('Message count:', messages.length);

// Test suggestions endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/conversation-quality/1/suggestions

// Check for API errors
// Open DevTools → Network tab
```

---

## 📋 Deployment Checklist

- [ ] Database migration executed: `npm run db:migrate`
- [ ] Backend running: `npm start` (in backend directory)
- [ ] Components imported into messaging UI
- [ ] matchId and partnerId passed to components
- [ ] `.env` has correct API URL
- [ ] Bearer token authentication working
- [ ] CSS styling looks good on mobile/desktop
- [ ] Real-time updates working (30 sec refresh)
- [ ] Error handling tested with invalid data
- [ ] All 3 components showing in messaging
- [ ] Frontend build successful: `npm run build`
- [ ] Ready to deploy!

---

## 📞 Support

**Quick Reference:**
- [CONVERSATION_QUALITY_METER_QUICK_REF.md](./CONVERSATION_QUALITY_METER_QUICK_REF.md)

**Full Integration Guide:**
- [CONVERSATION_QUALITY_METER_INTEGRATION.md](./CONVERSATION_QUALITY_METER_INTEGRATION.md)

**Implementation Details:**
- [CONVERSATION_QUALITY_METER_IMPLEMENTATION.md](./CONVERSATION_QUALITY_METER_IMPLEMENTATION.md)

---

**Ready to integrate!** Copy-paste any of these examples into your component. 🚀
