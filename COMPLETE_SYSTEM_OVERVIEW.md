# LinkUp Dating App - Complete System Overview

**Session Date:** April 27, 2026  
**Project:** LinkUp - Modern Dating App with Real-time Messaging & Video Calling

---

## 🎯 Project Summary

**LinkUp** is a full-stack dating application built with:
- **Frontend:** React + Capacitor (for Android/iOS)
- **Backend:** Node.js + Express + Sequelize
- **Database:** PostgreSQL
- **Real-time:** Socket.io
- **Media:** AWS S3 + Twilio (for calls)

---

## 📱 Core Features

### **1. Discovery & Matching**
- **DiscoveryCards** - Swipe-based card discovery
- **BrowseProfiles** - Browse and search profiles
- **Matches** - View all matches
- Smart queue, top picks, trending profiles
- Daily like/superlike limits
- Profile boosting (premium)

### **2. Direct Messaging (1-on-1)**
- **DatingMessaging** - Direct message conversations
- Text, image, video, file, voice messages
- Message reactions (emoji)
- Read receipts
- Typing indicators
- Voice call button (Audio)
- Video call button (Video)

### **3. Group Chatting**
- **Chatroom System** - Create/manage groups
- Custom or match-based groups
- Admin/Moderator/Member roles
- Rich messaging (text, media, files)
- Message history with pagination
- Leave group with timestamp tracking
- Real-time member join/leave notifications

### **4. Audio/Video Calling**
- **CallWindow** - Audio & video calls
- WebRTC peer-to-peer connection
- Local/remote video streams
- Picture-in-picture support
- Mute/unmute audio
- Enable/disable video
- Screen sharing
- Call duration timer
- Accept/Decline/End call buttons

### **5. Profile Management**
- **DatingProfile** - View/edit my profile
- **DatingProfileView** - View other profiles
- Profile photos, bio, interests
- Verification status
- Age, location, height, body type

---

## 🗂️ Project Structure

```
LinkUp/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DiscoveryCards.js      (Swipe cards)
│   │   │   ├── BrowseProfiles.js      (Browse)
│   │   │   ├── Matches.js             (Match list)
│   │   │   ├── DatingMessaging.js     (1-on-1 chat)
│   │   │   ├── DatingProfile.js       (My profile)
│   │   │   ├── DatingProfileView.js   (View profile)
│   │   │   ├── VideoDating.js         (Video calls)
│   │   │   ├── ChatRooms.js           (Groups list)
│   │   │   ├── ChatRoomView.js        (Group details)
│   │   │   └── GroupChat.js           (Group messaging)
│   │   │
│   │   ├── modules/messaging/         (Advanced messaging)
│   │   │   ├── Messaging.js           (Main container)
│   │   │   ├── ChatWindow.js          (Message display)
│   │   │   ├── ChatList.js            (Chat list)
│   │   │   ├── CallWindow.js          (Call interface)
│   │   │   ├── ChatroomCreation.js    (Create group)
│   │   │   ├── ChatroomBrowser.js     (Browse groups)
│   │   │   ├── ChatroomList.js        (Group list)
│   │   │   ├── ChatroomPanel.js       (Group info)
│   │   │   ├── MessageSearch.js       (Search messages)
│   │   │   ├── MessageContextMenu.js  (Message actions)
│   │   │   ├── MessagePagination.js   (Load older)
│   │   │   ├── ReadReceipts.js        (Message status)
│   │   │   ├── EmojiPicker.js         (Reactions)
│   │   │   └── utils.js               (Helpers)
│   │   │
│   │   ├── services/
│   │   │   ├── datingProfileService.js
│   │   │   ├── datingMessagingService.js
│   │   │   ├── notificationService.js
│   │   │   ├── messagingEnhancedService.js
│   │   │   └── socialService.js
│   │   │
│   │   ├── styles/
│   │   │   ├── Messaging.css          (Main messaging styles)
│   │   │   ├── DatingMessaging.css    (1-on-1 styles)
│   │   │   ├── GroupChat.css          (Group styles)
│   │   │   └── ... (other component styles)
│   │   │
│   │   ├── App.js                     (Main router)
│   │   └── index.js                   (Entry point)
│   │
│   ├── package.json
│   └── README.md
│
└── backend/
    ├── models/
    │   ├── User.js
    │   ├── DatingProfile.js
    │   ├── Match.js
    │   ├── Message.js
    │   ├── MessageAttachment.js
    │   ├── MessageReaction.js
    │   ├── GroupChat.js               (Group model)
    │   ├── GroupChatMember.js         (Member model)
    │   ├── GroupChatMessage.js        (Message model)
    │   ├── Notification.js
    │   └── ... (other models)
    │
    ├── routes/
    │   ├── auth.js                    (Authentication)
    │   ├── dating.js                  (Discovery & matching)
    │   ├── messaging.js               (1-on-1 messages)
    │   ├── chatrooms.js               (Group chats)
    │   └── ... (other routes)
    │
    ├── services/
    │   ├── userNotificationService.js
    │   ├── spamFraudService.js
    │   └── ... (other services)
    │
    ├── middleware/
    │   ├── auth.js
    │   ├── rateLimit.js
    │   └── validation.js
    │
    ├── config/
    │   ├── database.js
    │   └── sequelize.js
    │
    ├── server.js                      (Express server)
    ├── Procfile                       (Deployment)
    └── package.json
```

---

## 📊 Database Schema Overview

### **Core Tables**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User accounts | id, email, password, firstName, lastName |
| `dating_profiles` | User profiles | userId, age, location, bio, interests, verified |
| `matches` | Match records | userId1, userId2, matchedAt, unmatchedAt |
| `messages` | 1-on-1 messages | matchId, fromUserId, message, createdAt |
| `message_attachments` | File uploads | messageId, url, type, size |
| `message_reactions` | Emoji reactions | messageId, userId, emoji |
| `group_chats` | Group info | createdByUserId, name, description, settings |
| `group_chat_members` | Group members | groupId, userId, role, status, joinedAt, leftAt |
| `group_chat_messages` | Group messages | groupId, fromUserId, message, reactions |
| `notifications` | User alerts | userId, type, title, body, read |

---

## 🔌 API Endpoints

### **Discovery & Matching**
```
GET    /dating/discovery?filters     # Get discovery profiles
GET    /dating/top-picks             # Premium: top picks
GET    /dating/smart-queue           # Smart queue
GET    /dating/trending              # Trending profiles
POST   /dating/swipe                 # Swipe (like/pass)
POST   /dating/superlike             # Superlike
POST   /dating/unmatch              # Unmatch
```

### **Direct Messaging**
```
GET    /messaging/matches/:matchId/messages    # Message history
POST   /messaging/matches/:matchId/messages    # Send message
GET    /messaging/matches                      # Match list
POST   /messaging/calls/initiate              # Start call
POST   /messaging/calls/:callId/accept        # Accept call
POST   /messaging/calls/:callId/decline       # Decline call
```

### **Group Messaging**
```
GET    /messaging/chatrooms                    # List groups
POST   /messaging/chatrooms                    # Create group
GET    /messaging/chatrooms/:id                # Get group details
PUT    /messaging/chatrooms/:id                # Update group
DELETE /messaging/chatrooms/:id                # Delete group

POST   /messaging/chatrooms/:id/join           # Join group
POST   /messaging/chatrooms/:id/leave          # Leave group
GET    /messaging/chatrooms/:id/members        # List members
PUT    /messaging/chatrooms/:id/members/:uid   # Update role

GET    /messaging/chatrooms/:id/messages       # Message history
POST   /messaging/chatrooms/:id/messages       # Send message
PUT    /messaging/chatrooms/:id/messages/:mid  # Edit message
DELETE /messaging/chatrooms/:id/messages/:mid  # Delete message
```

### **Profile**
```
GET    /dating/profile                # My profile
PUT    /dating/profile                # Update profile
GET    /dating/profile/:userId        # View user profile
POST   /dating/profile/photos         # Upload photo
DELETE /dating/profile/photos/:id     # Delete photo
```

### **Notifications**
```
GET    /notifications                 # Get notifications
GET    /notifications/unread          # Unread count
PUT    /notifications/:id             # Mark as read
DELETE /notifications/:id             # Delete notification
```

---

## 🎨 UI/UX Components

### **Messaging Module (37 components)**

**Chat Management:**
- ChatList (direct message list)
- ChatroomList (group list)
- ChatroomBrowser (discover & join groups)
- ChatroomCreation (create group)

**Messaging:**
- ChatWindow (unified message display)
- MessageSearch (search messages)
- MessageContextMenu (message actions)
- MessagePagination (load older messages)
- EmojiPicker (add reactions)

**Real-time:**
- CallWindow (audio/video calls)
- NotificationBell (notifications)
- ReadReceipts (message status)

**Settings:**
- VisibilitySettings (online status)
- ContactMeansSettings (contact preferences)
- ScheduledBlockManager (block scheduling)

---

## 🔄 Real-time Features

### **Socket.io Events**

**Emit (Client → Server):**
```javascript
socket.emit('message:send', {chatId, content, type});
socket.emit('message:edit', {messageId, content});
socket.emit('message:delete', {messageId});
socket.emit('message:reaction:add', {messageId, emoji});
socket.emit('user:typing', {chatId, isTyping});
socket.emit('call:initiate', {recipientId, callType});
socket.emit('call:accept', {callId});
socket.emit('call:decline', {callId});
socket.emit('webrtc:offer', {callId, offer});
socket.emit('webrtc:answer', {callId, answer});
socket.emit('ice:candidate', {callId, candidate});
socket.emit('chatroom:message', {chatroomId, message});
socket.emit('chatroom:member:joined', {chatroomId});
socket.emit('chatroom:member:left', {chatroomId});
```

**Listen (Server → Client):**
```javascript
socket.on('message:received', (message) => {...});
socket.on('message:updated', (message) => {...});
socket.on('message:deleted', (messageId) => {...});
socket.on('user:typing', (user) => {...});
socket.on('call:incoming', (call) => {...});
socket.on('call:accepted', (call) => {...});
socket.on('call:declined', (call) => {...});
socket.on('webrtc:offer', (offer) => {...});
socket.on('webrtc:answer', (answer) => {...});
socket.on('ice:candidate', (candidate) => {...});
socket.on('notification:new', (notification) => {...});
socket.on('chatroom:message:received', (message) => {...});
```

---

## 💻 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router, Socket.io Client |
| **Mobile** | Capacitor (Android/iOS) |
| **Backend** | Node.js, Express.js |
| **ORM** | Sequelize |
| **Database** | PostgreSQL |
| **Real-time** | Socket.io |
| **Authentication** | JWT Tokens |
| **File Storage** | AWS S3 |
| **Video/Voice** | Twilio / WebRTC |
| **Styling** | CSS3, Responsive Design |
| **Deployment** | Render.com, Docker |

---

## 🔐 Security Features

✅ **Authentication:** JWT token-based  
✅ **Authorization:** Role-based access control  
✅ **Encryption:** End-to-end encryption option  
✅ **Rate Limiting:** API rate limits  
✅ **Input Validation:** Server-side validation  
✅ **CORS:** Cross-origin protection  
✅ **Blocked Users:** Cannot message/view profiles  
✅ **Spam Detection:** Fraud service  
✅ **Moderation:** Admin/moderator controls  

---

## 🚀 Key Features Implemented

### **Discovery**
- ✅ Swipe cards (like/pass)
- ✅ Smart recommendations
- ✅ Top picks & trending
- ✅ Advanced filters (age, distance, interests)
- ✅ Profile boost (premium)
- ✅ Superlike feature

### **Matching**
- ✅ Match creation & tracking
- ✅ Unmatch with confirmation
- ✅ Match history
- ✅ Match-based groups

### **Messaging - 1-on-1**
- ✅ Direct messages
- ✅ Text, image, video, file, voice
- ✅ Message edit/delete
- ✅ Emoji reactions
- ✅ Read receipts
- ✅ Typing indicators
- ✅ Message search

### **Messaging - Groups**
- ✅ Create custom groups
- ✅ Match-based auto groups
- ✅ Member management (add/remove)
- ✅ Role system (admin/moderator/member)
- ✅ Message history with pagination
- ✅ Leave with timestamp tracking
- ✅ Real-time updates

### **Calling**
- ✅ Audio calls
- ✅ Video calls
- ✅ WebRTC peer connection
- ✅ Picture-in-picture video
- ✅ Mute/unmute
- ✅ Enable/disable video
- ✅ Call duration tracking
- ✅ Incoming call notifications
- ✅ Accept/decline/end call

### **Profile**
- ✅ Create/edit profile
- ✅ Upload photos
- ✅ Add bio & interests
- ✅ Verification status
- ✅ View other profiles

---

## 🎯 Call Feature Location

### **Frontend - Where to Find Call Buttons**

**File:** `src/modules/messaging/ChatWindow.js` (Lines 494-498)

```jsx
<button className="btn-icon" title="Voice Call" onClick={() => onStartCall('audio')}>
  Audio
</button>
<button className="btn-icon" title="Video Call" onClick={() => onStartCall('video')}>
  Video
</button>
```

**Implementation:** `src/modules/messaging/Messaging.js` (Line 1660)

```jsx
const handleStartCall = async (callType = 'audio') => {
  // Validates user, initiates call, opens CallWindow
}
```

**Call Interface:** `src/modules/messaging/CallWindow.js`

- WebRTC setup
- Local/remote video rendering
- Call controls (mute, video, screen share)
- Accept/decline/end buttons

---

## 📈 Messaging Module Design

### **Architecture**

```
Messaging (Root Container)
├── State: chats, messages, calls, notifications
├── Socket.io Connection
│
├── Sidebar (300px, left panel)
│   ├── Tabs: Chats | Chatrooms | Contacts | Invites | Settings
│   ├── ChatList / ChatroomList / ContactsList / etc.
│   └── Notification Bell
│
└── Main Content (1fr, right panel)
    ├── ChatWindow (message display)
    │   ├── Message list
    │   ├── Message input
    │   └── Media upload
    │
    ├── CallWindow (modal overlay, z-index: 1000)
    │   ├── Video container
    │   ├── Call controls
    │   └── Accept/Decline/End buttons
    │
    └── FileUpload (modal)
```

### **Layout Grid**

```css
.messaging-layout {
  display: grid;
  grid-template-columns: 300px 1fr;  /* Sidebar | Main */
}

@media (max-width: 900px) {
  /* Tablets - buttons wrap */
}

@media (max-width: 520px) {
  /* Mobile - full width */
}
```

---

## 🎓 Design System

### **Colors**
- **Primary:** `#667eea` (purple)
- **Danger:** `#dc2626` (red)
- **Success:** `#16a34a` (green)
- **Background:** `#f5f5f5` (light) / `#0f172a` (dark)
- **Text:** `#333` (dark) / `#f8fafc` (light)

### **Components**
- `.btn-icon` - Rounded pill buttons
- `.message-bubble` - Message containers
- `.chat-window-header` - Chat title bar
- `.messages-container` - Message list

### **Spacing**
- Default padding: `1rem`
- Gap between items: `0.75rem`
- Border radius: `12px` to `24px`

---

## 📋 Implementation Checklist

### **Core Features**
- ✅ User authentication & profiles
- ✅ Discovery & swipe cards
- ✅ Matching system
- ✅ Direct messaging (1-on-1)
- ✅ Group chatting
- ✅ Audio/video calling
- ✅ File uploads & media sharing
- ✅ Real-time notifications

### **Advanced Features**
- ✅ Message reactions (emoji)
- ✅ Message search
- ✅ Read receipts
- ✅ Typing indicators
- ✅ Message pagination
- ✅ User blocking
- ✅ Role-based access
- ✅ Message edit/delete

### **Coming Soon**
- 🔄 Message archiving
- 🔄 Message encryption
- 🔄 Message expiration
- 🔄 @mentions
- 🔄 Admin analytics
- 🔄 Custom themes

---

## 🧪 Testing Guides

### **Discovery Testing**
- [ ] Load discovery cards
- [ ] Swipe like/pass
- [ ] Apply filters
- [ ] View top picks
- [ ] View trending profiles
- [ ] Use superlike
- [ ] Unmatch from match

### **Messaging Testing**
- [ ] Send text message
- [ ] Upload image
- [ ] Upload video
- [ ] Send voice note
- [ ] Edit own message
- [ ] Delete own message
- [ ] Add emoji reaction
- [ ] Search messages
- [ ] Load older messages
- [ ] Real-time message sync

### **Group Chatting Testing**
- [ ] Create group
- [ ] Add members
- [ ] Send message to group
- [ ] Promote member to moderator
- [ ] Remove member
- [ ] Leave group
- [ ] View member list
- [ ] Pagination in group messages

### **Calling Testing**
- [ ] Start audio call
- [ ] Start video call
- [ ] Accept incoming call
- [ ] Decline incoming call
- [ ] Mute audio during call
- [ ] Disable video during call
- [ ] End call
- [ ] Call duration tracking
- [ ] Incoming call notification

### **Profile Testing**
- [ ] View my profile
- [ ] Edit profile
- [ ] Upload photo
- [ ] View other profile
- [ ] View profile stats

---

## 📞 Support & Documentation

### **Generated Documentation**
- `GROUP_CHAT_SYSTEM_DESIGN.md` - Detailed group chat design
- This file - Complete system overview

### **Key Files to Review**
- `backend/models/GroupChat.js` - Group data model
- `backend/routes/chatrooms.js` - Group API endpoints
- `src/modules/messaging/ChatWindow.js` - Unified messaging UI
- `src/modules/messaging/CallWindow.js` - Calling interface
- `src/modules/messaging/Messaging.js` - Main messaging container

---

## 🎉 Summary

**LinkUp** is a **full-featured dating application** with:

1. **Discovery** - Swipe-based profile discovery with smart recommendations
2. **Matching** - Real-time matching system with unmatch capability
3. **1-on-1 Messaging** - Direct chat with rich media support
4. **Group Chatting** - Create & manage groups with roles
5. **Audio/Video Calls** - Real-time WebRTC calling with video
6. **Real-time Updates** - Socket.io for instant message/call delivery
7. **Security** - JWT auth, role-based access, user blocking
8. **Scalability** - Pagination, caching, optimized queries

The system is designed for **high scalability**, **real-time performance**, and **excellent user experience** across web and mobile platforms.

---

**Ready to build more features? Let me know what you'd like to work on next!** 🚀

