# Opening Message Templates - User & Data Flow

## 📱 User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                                 │
└─────────────────────────────────────────────────────────────────────┘

1. DISCOVERY PHASE
   ┌──────────────────────────────────┐
   │ User browses dating profiles     │
   │ (Sees list of potential matches) │
   └──────────────────────────────────┘
                    ↓
   
2. PROFILE VIEW PHASE
   ┌──────────────────────────────────┐
   │ Clicks on profile                │
   │ Views photos, bio, interests     │
   └──────────────────────────────────┘
                    ↓
   
3. MESSAGING DECISION
   ┌──────────────────────────────────────────┐
   │ Sees action buttons:                     │
   │ ├─ ❤️ Like                              │
   │ ├─ ✕ Pass                              │
   │ └─ 💡 Smart Message ← NEW FEATURE      │
   └──────────────────────────────────────────┘
                    ↓
                    
   💡 "Smart Message" clicked
                    ↓
   
4. SUGGESTION GENERATION
   ┌──────────────────────────────────────────────────────────┐
   │ System:                                                  │
   │ 1. Analyzes mutual interests                             │
   │    (User has: hiking, coffee, photography)              │
   │    (Profile has: hiking, cooking, yoga)                 │
   │    → Mutual: hiking                                     │
   │                                                          │
   │ 2. Generates 5 suggestions:                              │
   │    ├─ Context (hiking) templates                        │
   │    ├─ User's proven templates                           │
   │    └─ Generic fallbacks                                 │
   │                                                          │
   │ 3. Ranks by:                                             │
   │    ├─ Relevance (context match > generic)              │
   │    ├─ Performance (high response rate first)            │
   │    └─ Recency (pinned/custom at top)                   │
   └──────────────────────────────────────────────────────────┘
                    ↓
   
5. SUGGESTION DISPLAY (Modal)
   ┌─────────────────────────────────────────────────────────┐
   │  💡 Personalized Opening Messages for Alex              │
   ├─────────────────────────────────────────────────────────┤
   │                                                         │
   │  [1] ⛰️  "Where's your favorite trail near...?"       │
   │      → Mentions: hiking                                │
   │      ✓ Context-Aware | ✅ 68% response rate          │
   │      [USE THIS]                                        │
   │                                                         │
   │  [2] 🥾  "I noticed we both love hiking!..."          │
   │      → Shared Interest                                 │
   │      ✓ Context-Aware | ✅ 61% response rate          │
   │      [USE THIS]                                        │
   │                                                         │
   │  [3] 💬  "Hi Alex! I love your profile..."            │
   │      → Generic                                         │
   │      📝 Generic | ✅ 42% response rate               │
   │      [USE THIS]                                        │
   │                                                         │
   │  [4] ☕  "Coffee lover? Let's compare favorites!"     │
   │      → Shared Interest (pinned template)              │
   │      📌 Your Best (72% response rate)                │
   │      [USE THIS]                                        │
   │                                                         │
   └─────────────────────────────────────────────────────────┘
                    ↓
                    
   User selects [1]
                    ↓
   
6. MESSAGE SENDING
   ┌────────────────────────────────────────────────────────┐
   │ System:                                                │
   │ 1. Sends message                                       │
   │ 2. Creates Match record if needed                      │
   │ 3. Tracks:                                             │
   │    - templateId (if available)                         │
   │    - usage_count++                                     │
   │    - timestamp                                         │
   │                                                        │
   │ Message in database:                                  │
   │ ├─ content: "Where's your favorite trail..."         │
   │ ├─ from_user_id: 123                                 │
   │ ├─ to_user_id: 456                                   │
   │ ├─ template_id: 789 (for tracking)                   │
   │ └─ is_read: false                                    │
   └────────────────────────────────────────────────────────┘
                    ↓
                    
   ✓ Message sent notification
                    ↓
   
7. RESPONSE PHASE (Next time Alex goes online)
   ┌────────────────────────────────────────────────────────┐
   │ Alex sees message:                                     │
   │ "Where's your favorite trail near Denver...?"         │
   │                                                        │
   │ Alex replies:                                         │
   │ "OMG yes! I love Evergreen Trail! Have you tried...?" │
   └────────────────────────────────────────────────────────┘
                    ↓
                    
   Frontend detects: is_read = true
                    ↓
   
8. RESPONSE TRACKING
   ┌────────────────────────────────────────────────────────┐
   │ System:                                                │
   │ 1. Calls trackResponse(templateId=789, true)          │
   │ 2. Updates template metrics:                           │
   │    - response_count++                                  │
   │    - response_rate = (1 / 34) * 100 = 68%            │
   │    - engagement_score = min(68 + 20, 100) = 88       │
   │    - last_response_at = NOW                           │
   └────────────────────────────────────────────────────────┘
                    ↓
                    
9. ANALYTICS PHASE (User wants to see what works)
   ┌─────────────────────────────────────────────────────────┐
   │ User clicks: 📊 Template Analytics                      │
   │                                                         │
   │ ╔═════════════════════════════════════════════════════╗ │
   │ ║ 🏆 TOP PERFORMERS                                   ║ │
   │ ╠═════════════════════════════════════════════════════╣ │
   │ ║ #1 "Where's your favorite trail...?"               ║ │
   │ ║    Response: 68% (34 sent, 23 replies)             ║ │
   │ ║    ████████░░░░░░ 68%                             ║ │
   │ ║    Last: 3 days ago                                ║ │
   │ ║                                                     ║ │
   │ ║ #2 "Have you done any challenging..."              ║ │
   │ ║    Response: 61% (28 sent, 17 replies)             ║ │
   │ ║    ██████░░░░░░░░░ 61%                            ║ │
   │ ║    Last: 1 week ago                                ║ │
   │ ║                                                     ║ │
   │ ║ 💡 RECOMMENDATIONS                                  ║ │
   │ ║ → "Where's your favorite trail...?"                ║ │
   │ ║   High performer - try again! (68% success)        ║ │
   │ ║   Last used 3 days ago                             ║ │
   │ ╚═════════════════════════════════════════════════════╝ │
   │                                                         │
   │ User learns: Hiking-related templates get best results! │
   └─────────────────────────────────────────────────────────┘
                    ↓
                    
10. OPTIMIZATION LOOP
    ┌──────────────────────────────────────────────┐
    │ User now:                                    │
    │ - Uses top templates more often             │
    │ - Gets better response rates                │
    │ - More matches                              │
    │ - Better conversations                      │
    │ → Happier user, higher engagement           │
    │ → More likely to upgrade to premium         │
    └──────────────────────────────────────────────┘
```

## 📊 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA FLOW                                  │
└─────────────────────────────────────────────────────────────────┘

REQUEST: Get Suggestions
═════════════════════════════════════════════════════════════════

Frontend                  Backend                  Database
─────────────────────────────────────────────────────────────────

User clicks
"💡 Smart Message"
        │
        │ GET /opening-templates/456/suggestions
        ├──────────────────────────────────┤
        │                                  │
        │                          Fetch User A Profile
        │                          Fetch User B Profile (456)
        │                          ├─ interests: [hiking, coffee]
        │                          ├─ location_city: Denver
        │                          └─ first_name: Alex
        │                                  │
        │                          Query MessageTemplate
        │                          WHERE user_id = User A
        │                          ORDER BY engagement_score DESC
        │                          LIMIT 2
        │                          ├─ Pinned templates
        │                          └─ High performers
        │                                  │
        │                          Generate AI Suggestions:
        │                          1. Find mutual interests
        │                          2. Load interest templates
        │                          3. Format with user data
        │                          4. Sort by performance
        │                                  │
        ├──────────────────────────────────┤
        │ [5 Suggestions JSON]
        │ [Display in Modal]


SEND MESSAGE WITH TEMPLATE
═════════════════════════════════════════════════════════════════

Frontend                  Backend                  Database
─────────────────────────────────────────────────────────────────

Select suggestion:
"Where's your favorite..."
        │
        │ POST /opening-templates/use
        │ {toUserId, message, templateId, interestTrigger}
        ├──────────────────────────────────┤
        │                                  │
        │                          Find or Create Match
        │                          (user_id_1, user_id_2)
        │                                  │
        │                          Create Message
        │                          {matchId, from_user_id, 
        │                           to_user_id, message}
        │                                  ✓ messages table
        │                                  │
        │                          If templateId:
        │                          UPDATE message_templates
        │                          SET usage_count = usage_count + 1,
        │                              last_used_at = NOW
        │                          ✓ message_templates table
        │                                  │
        │                          Emit WebSocket event
        │                          (Real-time notification)
        │                                  │
        ├──────────────────────────────────┤
        │ {success: true, messageId}
        │ [Close Modal]
        │ [Show Success]


TRACK RESPONSE
═════════════════════════════════════════════════════════════════

Frontend                  Backend                  Database
─────────────────────────────────────────────────────────────────

Message is_read = true
        │
        │ POST /opening-templates/track-response
        │ {templateId, hasResponse: true}
        ├──────────────────────────────────┤
        │                                  │
        │                          Fetch Template
        │                          {id, usage_count, response_count}
        │                                  │
        │                          Calculate New Metrics:
        │                          response_count++
        │                          response_rate = 
        │                            (response_count/usage_count)*100
        │                          engagement_score = 
        │                            min(response_rate + 20, 100)
        │                                  │
        │                          UPDATE message_templates
        │                          SET response_count = ...,
        │                              response_rate_percent = ...,
        │                              engagement_score = ...,
        │                              last_response_at = NOW
        │                          ✓ message_templates table
        │                                  │
        ├──────────────────────────────────┤
        │ {updated metrics}


ANALYTICS QUERY
═════════════════════════════════════════════════════════════════

Frontend                  Backend                  Database
─────────────────────────────────────────────────────────────────

Click "📊 Analytics"
        │
        │ GET /opening-templates/top-performers?limit=10
        ├──────────────────────────────────┤
        │                                  │
        │                          SELECT * FROM message_templates
        │                          WHERE user_id = ?
        │                          ORDER BY response_rate_percent DESC,
        │                                   usage_count DESC
        │                          LIMIT 10
        │                          (Uses: idx_user_engagement)
        │                                  │
        │                          Query GET /recommended
        │                          WHERE user_id = ?
        │                            AND response_rate_percent >= 30
        │                            AND last_used_at < 30 days ago
        │                          ORDER BY engagement_score DESC
        │                          (Uses: idx_response_rate)
        │                                  │
        ├──────────────────────────────────┤
        │ [{top_templates}, {recommendations}]
        │ [Render Charts & Analytics]
```

## 🗄️ Database Schema

```
┌─────────────────────────────────────────────────────┐
│          MESSAGE_TEMPLATES TABLE                    │
├─────────────────────────────────────────────────────┤
│ Field                    Type          Index        │
├─────────────────────────────────────────────────────┤
│ id                       INT (PK)      PRIMARY      │
│ user_id                  INT (FK)      idx_user_id  │
│ recipient_user_id        INT (FK)      NULL        │
│ title                    VARCHAR(100)  -           │
│ content                  TEXT          -           │
│ category                 ENUM          idx_cat     │
│ template_source          ENUM          idx_src     │
│ interest_trigger         VARCHAR(100)  idx_int     │
│ context_json             JSONB         -           │
│ emoji                    VARCHAR(10)   -           │
│ is_pinned                BOOLEAN       idx_pin     │
│ usage_count              INT           -           │
│ response_count           INT           -           │
│ match_count              INT           -           │
│ response_rate_percent    DECIMAL(5,2)  idx_rate    │
│ avg_response_time_sec    INT           -           │
│ engagement_score         DECIMAL(5,2)  idx_eng     │
│ last_used_at             TIMESTAMP     -           │
│ last_response_at         TIMESTAMP     -           │
│ created_at               TIMESTAMP     -           │
│ updated_at               TIMESTAMP     -           │
└─────────────────────────────────────────────────────┘

KEY INDEXES:
- idx_user_id: Fast lookup by user
- idx_user_engagement: Combined lookup (user + score)
- idx_response_rate: Sort by performance
- idx_interest_trigger: Filter by interest
- idx_category: Group by type
```

## 🔄 State Management

```
React Component State Flow
═════════════════════════════════════════════════════════════════

DatingProfileView
├─ showSuggestions: boolean
├─ selectedSuggestion: object | null
└─ messageText: string

IcereakerSuggestions (Modal)
├─ suggestions: array
├─ loading: boolean
├─ error: string
└─ selectedIndex: number

TemplatePerformance (Analytics)
├─ topTemplates: array
├─ recommendations: array
├─ loading: boolean
├─ activeTab: 'top' | 'recommendations'
└─ error: string

Template Lifecycle
═════════════════════════════════════════════════════════════════

1. GENERATION
   ├─ Parse interests
   ├─ Find mutual interests
   └─ Select templates

2. USAGE
   ├─ Send message
   ├─ Track usage_count
   └─ Record timestamp

3. ENGAGEMENT
   ├─ Wait for reply
   ├─ Detect message read
   ├─ Update response_count
   └─ Calculate response_rate

4. ANALYTICS
   ├─ Query top performers
   ├─ Calculate recommendations
   ├─ Display in dashboard
   └─ Guide user to best templates

5. OPTIMIZATION
   ├─ User learns what works
   ├─ Uses high-performers more
   └─ Loop back to step 1
```

## 📈 Performance Metrics Timeline

```
Template "Where's your favorite trail...?" (ID: 789)
═════════════════════════════════════════════════════════════════

Day 1:
├─ Created: 0 uses, 0 responses, 0% rate
│
├─ Used 5 times
│  └─ Got 2 responses → 40% rate
│
└─ Score: min(40 + 20, 100) = 60

Day 2:
├─ Used 5 more times (10 total)
│  └─ Got 4 responses (6 total) → 60% rate
│
└─ Score: min(60 + 20, 100) = 80

Day 7:
├─ Used 34 times
│  └─ Got 23 responses (23 total) → 68% rate
│
└─ Score: min(68 + 20, 100) = 88

Status: TOP PERFORMER ✓
Action: Recommend for reuse
```
