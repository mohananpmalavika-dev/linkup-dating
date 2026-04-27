# Group Chat System Design

## 📋 Overview

The **Group Chat System** enables users to create custom or match-based groups, manage members with different roles, send various message types, and maintain full message history with pagination.

---

## 🗄️ Database Schema

### 1. **GroupChat Model** (`group_chats` table)
```sql
CREATE TABLE group_chats (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_type ENUM('friend_matches', 'custom') DEFAULT 'custom',
  match_id INTEGER REFERENCES matches(id) ON DELETE SET NULL,
  profile_photo_url VARCHAR(500),
  max_members INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT {
    allowMediaSharing: true,
    allowVideoCall: true,
    notificationsEnabled: true,
    hideFromProfile: false
  },
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

Indexes:
- created_by_user_id
- match_id
- is_active
- group_type
```

**Fields:**
| Field | Type | Purpose |
|-------|------|---------|
| `id` | INTEGER | Primary key |
| `name` | VARCHAR(255) | Group display name |
| `description` | TEXT | Optional group description |
| `created_by_user_id` | INTEGER | Admin/creator of group |
| `group_type` | ENUM | 'custom' or 'friend_matches' (auto-generated) |
| `match_id` | INTEGER | Optional link to match |
| `max_members` | INTEGER | Max group size (default 100) |
| `is_active` | BOOLEAN | Soft delete flag |
| `settings` | JSONB | Feature toggles (media, video, etc.) |

---

### 2. **GroupChatMember Model** (`group_chat_members` table)
```sql
CREATE TABLE group_chat_members (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  group_id INTEGER NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role ENUM('admin', 'moderator', 'member') DEFAULT 'member',
  status ENUM('active', 'muted', 'left') DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  last_read_message_id INTEGER NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, user_id)
);

Indexes:
- (group_id, user_id) UNIQUE
- group_id
- user_id
- status
```

**Role Permissions:**
| Role | Create | Edit Own | Delete Own | Manage Members | Manage Roles | Delete Group |
|------|--------|----------|-----------|----------------|--------------|--------------|
| **Member** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Moderator** | ✅ | ✅ | ✅ | ✅ Remove | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ All | ✅ | ✅ |

**Statuses:**
- `active` - Member is active in group
- `muted` - Member muted notifications
- `left` - Member left (soft delete, preserves message history)

---

### 3. **GroupChatMessage Model** (`group_chat_messages` table)
```sql
CREATE TABLE group_chat_messages (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  group_id INTEGER NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  media_type ENUM('image', 'video', 'audio', 'file'),
  media_url VARCHAR(500),
  message_type ENUM('text', 'media', 'system') DEFAULT 'text',
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP NULL,
  reactions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

Indexes:
- group_id
- from_user_id
- created_at
```

**Reactions Structure:**
```json
[
  {
    "emoji": "❤️",
    "count": 3,
    "reactedByCurrentUser": true,
    "firstReactedAt": "2026-04-27T10:30:00Z"
  }
]
```

---

## 🔌 API Endpoints

### **Group Management**

#### `GET /messaging/chatrooms`
List all public chatrooms with pagination
```
Query Parameters:
- page: number (default: 1)
- pageSize: number (default: 20)

Response:
{
  "chatrooms": [...],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

#### `GET /messaging/chatrooms/:chatroomId`
Get chatroom details with member info
```
Response:
{
  "id": 5,
  "name": "React Devs",
  "description": "...",
  "createdByUserId": 12,
  "memberCount": 45,
  "isMember": true,
  "isPublic": true,
  "maxMembers": 100,
  "createdAt": "2026-04-20T10:00:00Z"
}
```

#### `POST /messaging/chatrooms`
Create a new group chatroom
```
Body:
{
  "name": "React Devs",
  "description": "For React developers",
  "isPublic": true,
  "maxMembers": 100
}

Response: (201)
{
  "id": 5,
  "name": "React Devs",
  ...
}
```

#### `PUT /messaging/chatrooms/:chatroomId`
Update chatroom (admin only)
```
Body:
{
  "name": "React Developers",
  "description": "Updated description",
  "isPublic": false
}
```

#### `DELETE /messaging/chatrooms/:chatroomId`
Delete chatroom (admin only)
```
Response: (204 No Content)
```

---

### **Member Management**

#### `GET /messaging/chatrooms/:chatroomId/members`
List all members with roles
```
Response:
{
  "members": [
    {
      "id": 1,
      "userId": 12,
      "userName": "john_doe",
      "role": "admin",
      "status": "active",
      "joinedAt": "2026-04-20T10:00:00Z"
    },
    ...
  ]
}
```

#### `POST /messaging/chatrooms/:chatroomId/join`
Join a chatroom
```
Response: (201)
{
  "success": true,
  "membershipId": 156
}
```

#### `POST /messaging/chatrooms/:chatroomId/leave`
Leave a chatroom
```
Request Body (optional):
{
  "reason": "Not interested anymore"
}

Response: (200)
{
  "success": true,
  "leftAt": "2026-04-27T15:30:00Z"
}
```

#### `PUT /messaging/chatrooms/:chatroomId/members/:userId`
Update member role or status (admin/moderator)
```
Body:
{
  "role": "moderator",
  "status": "active"
}

Response:
{
  "userId": 25,
  "role": "moderator",
  "status": "active"
}
```

#### `DELETE /messaging/chatrooms/:chatroomId/members/:userId`
Remove member from group (admin/moderator)
```
Response: (204 No Content)
```

---

### **Messaging**

#### `GET /messaging/chatrooms/:chatroomId/messages`
Get message history with pagination
```
Query Parameters:
- limit: number (default: 50)
- offset: number (default: 0)
- before: messageId (for cursor-based pagination)

Response:
{
  "messages": [
    {
      "id": 1001,
      "groupId": 5,
      "fromUserId": 12,
      "fromUserName": "john_doe",
      "message": "Hello everyone!",
      "messageType": "text",
      "mediaType": null,
      "mediaUrl": null,
      "reactions": [
        {"emoji": "❤️", "count": 2, "reactedByCurrentUser": false}
      ],
      "isEdited": false,
      "createdAt": "2026-04-27T10:30:00Z"
    },
    ...
  ],
  "total": 523,
  "hasMore": true
}
```

#### `POST /messaging/chatrooms/:chatroomId/messages`
Send message to chatroom
```
Body (Text):
{
  "message": "Hello everyone!"
}

Body (Media):
{
  "message": "Check this out!",
  "mediaType": "image",
  "mediaUrl": "https://..."
}

Response: (201)
{
  "id": 1001,
  "groupId": 5,
  "fromUserId": 12,
  "message": "Hello everyone!",
  "messageType": "text",
  "createdAt": "2026-04-27T10:30:00Z"
}
```

#### `PUT /messaging/chatrooms/:chatroomId/messages/:messageId`
Edit own message
```
Body:
{
  "message": "Updated message text"
}

Response:
{
  "id": 1001,
  "message": "Updated message text",
  "isEdited": true,
  "editedAt": "2026-04-27T10:35:00Z"
}
```

#### `DELETE /messaging/chatrooms/:chatroomId/messages/:messageId`
Delete own message
```
Response: (204 No Content)
```

#### `POST /messaging/chatrooms/:chatroomId/messages/:messageId/reactions`
Add emoji reaction
```
Body:
{
  "emoji": "❤️"
}

Response:
{
  "id": 1001,
  "reactions": [
    {"emoji": "❤️", "count": 1, "reactedByCurrentUser": true}
  ]
}
```

---

## 🖥️ Frontend Components

### **1. ChatroomBrowser**
Browse and join public chatrooms
- Search by name/description
- Filter by member count, creation date
- Show member count & preview
- **Join button** with role assignment
- Pagination (20 per page)

**Key Props:**
```javascript
{
  onJoinChatroom: (chatroom) => {},
  onRequestAccess: (chatroom) => {},
  onCancel: () => {}
}
```

### **2. ChatroomCreation**
Create new group with member selection
- **Name & Description** input
- **Member Search** (user database search)
- **Selected Members** list with removal
- **Permissions** toggle (public/private, allow media)
- **Create Group** with validation

**Key Props:**
```javascript
{
  onChatroomCreated: (chatroom) => {},
  onCancel: () => {}
}
```

**Features:**
- ✅ Prevents adding blocked users
- ✅ Prevents duplicate members
- ✅ Minimum 1 member validation
- ✅ Group name required
- ✅ Async user search with debounce

### **3. ChatroomList**
List user's groups with search & filter
- Group avatars & names
- Unread message badge
- Last message preview
- Member count
- Search functionality
- Sorting (recent first)

**Key Props:**
```javascript
{
  chatrooms: [],
  selectedChatroom: null,
  onSelectChatroom: (chatroom) => {},
  onNewChatroom: () => {},
  onBrowseChatrooms: () => {},
  searchQuery: "",
  onSearchChange: (query) => {},
  loading: false
}
```

### **4. ChatroomPanel**
Right sidebar showing group info
- Group name & description
- Member list (clickable for profile)
- Member count & roles
- Leave button with confirmation
- Edit settings (admin only)
- Delete group (admin only)

**Key Props:**
```javascript
{
  chatroom: {},
  onLeaveChatroom: () => {},
  onClose: () => {},
  onRefreshChatroom: () => {}
}
```

### **5. ChatWindow** (Shared - Also used for Groups)
Display messages for chatroom
- **Message Rendering:**
  - Text messages
  - Images (clickable to open)
  - Videos (with controls)
  - Files (downloadable)
  - Voice messages (playable)
  - System messages (member joined/left)

- **Message Actions:**
  - Edit (own messages only)
  - Delete (own messages only)
  - Reactions (emoji picker)
  - Reply (threaded)
  - Search

- **Input Area:**
  - Text input (multiline)
  - Media upload button
  - Voice recording button
  - Emoji picker
  - Send button (auto-disable on empty)

**Features:**
- ✅ Message pagination (load older)
- ✅ Auto-scroll to latest
- ✅ Read receipts
- ✅ Typing indicators
- ✅ Message search

---

## 📊 Data Flow Diagram

```
User Action → Frontend Component → API Request → Backend Logic → Database
                                   ↓
                        Validation & Authorization
                                   ↓
                        Process Request & Update DB
                                   ↓
                        Response to Frontend
                                   ↓
                        Update State & Re-render
                                   ↓
                        Socket Broadcast (if real-time)
                                   ↓
                        Other Users Receive Update
```

### **Example: Sending a Message**

1. User types message in `ChatWindow` input
2. Click **Send** button → `handleSendMessage()`
3. `POST /messaging/chatrooms/5/messages` with message data
4. Backend validates:
   - User is member of group
   - Group is active
   - Message is not empty
5. Insert into `group_chat_messages` table
6. Return created message object
7. Frontend adds message to messages state
8. Socket emits `message:received` to other members
9. Other users' ChatWindow receives update
10. Message displays in real-time

---

## 🔄 Real-time Features (Socket.io)

### **Emitted Events**

```javascript
// User sends message
socket.emit('chatroom:message', {
  chatroomId: 5,
  message: "Hello",
  messageType: "text"
});

// User starts typing
socket.emit('chatroom:typing', {
  chatroomId: 5,
  isTyping: true
});

// User reacts to message
socket.emit('chatroom:reaction', {
  messageId: 1001,
  emoji: "❤️"
});

// User leaves group
socket.emit('chatroom:leave', {
  chatroomId: 5,
  userId: 12
});
```

### **Listened Events**

```javascript
// New message received
socket.on('chatroom:message:received', (data) => {
  // Update messages list
});

// User typing
socket.on('chatroom:user:typing', (data) => {
  // Show typing indicator
});

// Member joined
socket.on('chatroom:member:joined', (data) => {
  // Update member list + system message
});

// Member left
socket.on('chatroom:member:left', (data) => {
  // Remove from member list + system message
});

// Message edited
socket.on('chatroom:message:edited', (data) => {
  // Update message in list
});

// Message deleted
socket.on('chatroom:message:deleted', (data) => {
  // Remove message from list
});
```

---

## 🎯 Key Features Implementation

### ✅ **1. Create Custom Groups**
- `GroupCreation` component handles UI
- Search & select members
- Validate (name required, min 1 member)
- Create with `POST /chatrooms`
- Auto-add creator as admin

### ✅ **2. Match-Based Auto Groups**
- Backend creates group when match happens
- `groupType: 'friend_matches'`
- Link to match_id
- Auto-add both users as members

### ✅ **3. Add/Remove Members**
- Admins/moderators can manage members
- `POST /chatrooms/:id/join` - User requests
- `POST /chatrooms/:id/members/:userId` - Admin adds
- `DELETE /chatrooms/:id/members/:userId` - Remove
- Preserve message history when user leaves

### ✅ **4. Message Types**
- **Text** - Plain messages
- **Image** - Upload & store media
- **Video** - Video uploads
- **File** - Generic file uploads
- **Voice** - Audio recordings
- **System** - Auto-generated (member joined, left)

### ✅ **5. Message History Pagination**
- Limit: 50 messages per page
- Offset-based pagination: `LIMIT 50 OFFSET 100`
- Cursor-based: `before: messageId`
- Load older: Click "Show earlier messages"
- Load latest: Click "Jump to latest"

### ✅ **6. Role-Based Access Control**
- **Admin:** Full control (create, edit, delete group, manage roles)
- **Moderator:** Manage members, remove messages
- **Member:** Send messages, edit own, leave

### ✅ **7. Leave Group with Tracking**
- `POST /chatrooms/:id/leave` 
- Records `leftAt` timestamp
- Member status → 'left'
- Preserved in member list (soft delete)
- Message history remains intact
- Can rejoin later

### ✅ **8. Reactions on Messages**
- Click message → emoji picker
- Select emoji → add reaction
- Show reaction count
- Highlight if user reacted
- Remove reaction by clicking again

### ✅ **9. Message Edit/Delete**
- Edit own message: `PUT /messages/:id`
- Delete own message: `DELETE /messages/:id`
- Mark as edited with timestamp
- Admin can delete any message (moderation)

### ✅ **10. Media Sharing**
- File upload to backend
- Store URL in message
- Support: Image, Video, File, Voice
- Thumbnail generation (images)
- Download links (files)

---

## 📱 UI/UX Flow

### **Creating a Group**
```
Browse Tab
    ↓
[Create Group] button
    ↓
GroupCreation Modal Opens
    ↓
Enter Group Name & Description
    ↓
Search & Add Members
    ↓
[Create] button
    ↓
Group Created → ChatWindow Opens
    ↓
Can Send First Message
```

### **Browsing & Joining Groups**
```
Browse Chatrooms Tab
    ↓
See Public Chatrooms List
    ↓
Click Chatroom → Details Modal
    ↓
See Members & Description
    ↓
[Join] button
    ↓
Joined → Added to ChatroomList
```

### **Sending Message**
```
Select Group from ChatroomList
    ↓
ChatWindow Loads Messages
    ↓
Type Message in Input
    ↓
[Send] or Press Enter
    ↓
Message Sent (optimistic update)
    ↓
API Response Confirms
    ↓
Real-time: Other users see message
```

---

## 🔒 Security & Permissions

| Action | Requirement |
|--------|-------------|
| Create Group | Authenticated user |
| Join Public Group | Any user |
| Join Private Group | Request + Admin approval |
| Send Message | Group member |
| Edit Own Message | Sender |
| Delete Own Message | Sender |
| Remove Any Message | Admin/Moderator |
| Remove Member | Admin/Moderator |
| Delete Group | Admin (creator) |
| Change Role | Admin only |
| View Members | Group member |

---

## 🚀 Performance Considerations

### **Pagination**
- Messages limited to 50 per request
- Cursor-based for large groups
- Client-side caching of loaded messages

### **Indexes**
- `(group_id, user_id)` - Fast member lookup
- `(group_id, created_at)` - Fast message pagination
- `(user_id)` - Find user's groups
- `(status)` - Filter active members

### **Real-time Limits**
- Socket events debounced (typing: 500ms)
- Bulk operations batched
- File uploads chunked
- Reactions rate-limited

---

## 📈 Scalability Improvements

### **Future Enhancements**

1. **Message Search**
   - Full-text search via Elasticsearch
   - Search by date, sender, media type

2. **Admin Features**
   - Pin important messages
   - Message moderation
   - Group analytics

3. **Privacy**
   - Encryption for private groups
   - Message expiration (auto-delete)
   - Read-only mode for new members

4. **Integration**
   - Discord-style threads
   - @mentions with notifications
   - Scheduled messages
   - Custom emojis

5. **Performance**
   - Message archives
   - Redis caching layer
   - CDN for media files

---

## 🧪 Testing Checklist

- [ ] Create group with members
- [ ] Join public chatroom
- [ ] Send text message
- [ ] Send image/video
- [ ] Edit own message
- [ ] Delete own message
- [ ] Add emoji reaction
- [ ] Load older messages (pagination)
- [ ] Leave group
- [ ] Rejoin group
- [ ] Promote member to moderator
- [ ] Remove member (moderator)
- [ ] Real-time message sync
- [ ] Typing indicators
- [ ] Member joined/left notifications

---

## 📞 Summary

The **Group Chat System** provides:

✅ **Flexible Group Creation** - Custom or match-based  
✅ **Role-Based Management** - Admin, Moderator, Member  
✅ **Rich Messaging** - Text, media, files, voice  
✅ **Message Pagination** - Efficient history loading  
✅ **Real-time Updates** - Socket.io integration  
✅ **Member Tracking** - Join/leave timestamps  
✅ **Media Sharing** - Secure file uploads  
✅ **Engagement** - Emoji reactions  

