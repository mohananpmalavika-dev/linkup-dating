## IP Blocking System for Age Verification - Complete Guide

### Overview

The IP Blocking System automatically detects and blocks IP addresses when users attempt to sign up with an age less than 18. This is a security feature to prevent underage users from creating accounts while allowing admins to configure block duration and manage blocked IPs.

**Key Features:**
- ✅ Automatic IP blocking for underage signup attempts
- ✅ Admin-configurable block duration (2hrs, 24hrs, 37hrs, etc.)
- ✅ Manual IP blocking/unblocking by admins
- ✅ Real-time block expiration tracking
- ✅ Comprehensive admin dashboard
- ✅ Detailed statistics and analytics
- ✅ Support for proxy servers (X-Forwarded-For header)

---

## System Architecture

### Database Models

#### 1. **IPBlocklist Model** (`/backend/models/IPBlocklist.js`)
Stores all blocked IP addresses with expiration information.

**Fields:**
- `id` - Primary key
- `ipAddress` (UNIQUE) - The blocked IP address
- `reason` - Why the IP was blocked (e.g., "underage_attempt", "manual_block")
- `blockDurationHours` - How long (in hours) the block lasts
- `expiresAt` - Timestamp when block expires
- `attemptedEmail` - Email used in the underage signup attempt (optional)
- `attemptedAge` - Age provided in the signup (optional)
- `attemptCount` - Number of attempts from this IP
- `isActive` - Boolean flag (true = currently blocked, false = expired)
- `removedAt` - Timestamp when admin manually unblocked
- `removedByAdminId` - Admin user ID who unblocked
- `createdAt`, `updatedAt` - Timestamps

**Indexes:**
- Unique index on `ipAddress`
- Index on `expiresAt` (for cleanup queries)
- Index on `isActive` (for active block queries)

#### 2. **AdminSetting Model** (`/backend/models/AdminSetting.js`)
Stores system configuration as key-value pairs.

**Fields:**
- `id` - Primary key
- `settingKey` (UNIQUE) - Configuration key (e.g., "underage_ip_block_duration_hours")
- `settingValue` - Configuration value (stored as string, but can be parsed as integer/boolean)
- `settingType` - Data type: "integer", "string", "boolean", "json"
- `category` - Grouping for settings (e.g., "age_verification")
- `description` - Human-readable description
- `updatedByAdminId` - Admin ID who last updated
- `createdAt`, `updatedAt` - Timestamps

**Default Settings:**
```javascript
{
  settingKey: 'underage_ip_block_duration_hours',
  settingValue: '2',
  settingType: 'integer',
  category: 'age_verification',
  description: 'Hours to block IP for underage signup attempt'
}

{
  settingKey: 'underage_block_enabled',
  settingValue: 'true',
  settingType: 'boolean',
  category: 'age_verification',
  description: 'Enable/disable IP blocking for underage attempts'
}

{
  settingKey: 'max_underage_attempts_per_ip',
  settingValue: '3',
  settingType: 'integer',
  category: 'age_verification',
  description: 'Max underage signup attempts before permanent block'
}
```

---

### Backend Services

#### 1. **IPBlockingService** (`/backend/services/ipBlockingService.js`)

Handles all IP blocking logic and database operations.

**Key Methods:**

```javascript
// Check if an IP is currently blocked
const isBlocked = await IPBlockingService.isIPBlocked(ipAddress);
// Returns: true/false

// Get detailed block information
const blockDetails = await IPBlockingService.getIPBlockDetails(ipAddress);
// Returns: { isBlocked, ipAddress, reason, expiresAt, remainingMinutes, attemptedAge, ... }

// Block an IP for underage attempt (called during signup)
await IPBlockingService.blockIPForUnderageAttempt(ipAddress, email, age);
// Creates/updates block with duration from AdminSetting

// Manually block an IP (admin action)
await IPBlockingService.blockIPManually(ipAddress, reason, durationHours, adminId);
// Allows admin to block any IP for custom duration

// Unblock an IP (admin action)
await IPBlockingService.unblockIP(ipAddress, adminId);
// Sets isActive = false, records admin who unblocked

// Get paginated list of blocked IPs
const result = await IPBlockingService.getBlockedIPs(page, limit, activeOnly);
// Returns: { blocks: [...], total, page, limit }

// Clean up expired blocks
const cleaned = await IPBlockingService.cleanupExpiredBlocks();
// Returns: number of blocks marked as inactive

// Get statistics
const stats = await IPBlockingService.getBlockStatistics();
// Returns: { totalBlocks, activeBlocks, expiredBlocks, uniqueIPs, ... }
```

#### 2. **AdminSettingsService** (`/backend/services/adminSettingsService.js`)

Manages system configuration and default values.

**Key Methods:**

```javascript
// Get a single setting with type conversion
const value = await AdminSettingsService.getSetting(key, defaultValue);
// Examples:
// - getSetting('underage_ip_block_duration_hours', 2) returns integer
// - getSetting('underage_block_enabled', true) returns boolean

// Get all settings by category
const settings = await AdminSettingsService.getSettingsByCategory('age_verification');
// Returns: array of setting objects

// Create or update a setting
await AdminSettingsService.setSetting(
  key,
  value,
  type, // 'integer', 'string', 'boolean', 'json'
  category,
  adminId,
  description
);

// Initialize all default settings
await AdminSettingsService.initializeDefaultSettings();
// Called on app startup
```

---

### Middleware

#### **IP Blocking Middleware** (`/backend/middleware/ipBlocking.js`)

Intercepts incoming requests and checks if the IP is blocked.

```javascript
// Exports checkIPBlock middleware
// Mounted early in Express middleware stack
// Returns 403 if IP is blocked, otherwise calls next()

app.use(checkIPBlock);

// Response when IP is blocked:
{
  status: 403,
  json: {
    success: false,
    error: 'Your IP address is currently blocked',
    blockedUntil: '2026-04-29T14:32:00Z',
    remainingMinutes: 120,
    reason: 'underage_attempt'
  }
}
```

---

### Routes

#### **Age Verification Route** (`/backend/routes/ageVerification.js`)

Modified POST `/api/auth/verify-age` endpoint:

```javascript
// On underage attempt (age < 18):
// 1. Retrieve block duration from AdminSetting
// 2. Call IPBlockingService.blockIPForUnderageAttempt()
// 3. Return 403 with block details

// Response:
{
  status: 403,
  json: {
    error: 'You must be at least 18 years old to use DatingHub',
    code: 'UNDERAGE_USER',
    age: 15,
    message: 'Your IP address has been blocked for 2 hours due to underage signup attempt.'
  }
}
```

#### **Admin IP Blocking Routes** (`/backend/routes/ipBlockingAdmin.js`)

All routes require `authenticateToken` + `requireAdmin` middleware.

**Settings Endpoints:**
```
GET    /api/admin/ip-blocking/settings
       - Get all age verification settings
       - Returns: { success, settings: [...] }

POST   /api/admin/ip-blocking/settings/update
       - Update a specific setting
       - Body: { key, value, type, description }
       - Returns: { success, setting }

GET    /api/admin/ip-blocking/settings/get/:key
       - Get a single setting
       - Returns: { success, key, value }
```

**Blocking Management Endpoints:**
```
POST   /api/admin/ip-blocking/block-ip
       - Manually block an IP
       - Body: { ipAddress, reason, durationHours }
       - Returns: { success, message, block }

DELETE /api/admin/ip-blocking/unblock-ip/:ip
       - Unblock an IP address
       - Returns: { success, message, block }

GET    /api/admin/ip-blocking/blocked-ips
       - List blocked IPs (paginated)
       - Query: ?page=1&limit=50&activeOnly=true
       - Returns: { success, data: { blocks, total, page, limit } }

GET    /api/admin/ip-blocking/check/:ip
       - Check if specific IP is blocked
       - Returns: { success, isBlocked, details }

GET    /api/admin/ip-blocking/stats
       - Get blocking statistics
       - Returns: { success, statistics: { totalBlocks, activeBlocks, ... } }

POST   /api/admin/ip-blocking/cleanup
       - Manually cleanup expired blocks
       - Returns: { success, cleaned: number }
```

---

## Frontend Admin Panel

### Component: AdminIPBlockingPanel
**Location:** `/src/components/AdminIPBlockingPanel.js`

**Features:**

1. **Settings Tab**
   - View current block duration
   - Change block duration (2, 24, 37, etc. hours)
   - Enable/disable automatic IP blocking
   - How-to-use information

2. **Blocked IPs Tab**
   - Manually block new IP addresses
   - Add custom blocking reason
   - View all currently active blocked IPs
   - See time remaining for each block
   - One-click unblock option

3. **Statistics Tab**
   - Total blocks created
   - Currently active blocks
   - Expired/inactive blocks
   - Unique IPs blocked

**Styling:** AdminIPBlockingPanel.css
- Responsive design (mobile, tablet, desktop)
- Color-coded status indicators
- Accessible form controls
- Modern UI with Flexbox/Grid

---

## How It Works: Step by Step

### User Signup Flow (Age < 18)

```
1. User submits signup form with dateOfBirth
         ↓
2. POST /api/auth/verify-age
         ↓
3. Backend extracts client IP from request
   (checks X-Forwarded-For, X-Real-IP, socket.remoteAddress)
         ↓
4. Calculates age from dateOfBirth
         ↓
5. Age < 18? → YES
         ↓
6. Retrieve 'underage_block_enabled' from AdminSetting
         ↓
7. If enabled: Call IPBlockingService.blockIPForUnderageAttempt()
         ↓
8. Service creates IPBlocklist record:
   - ipAddress = extracted IP
   - expiresAt = now + blockDurationHours
   - isActive = true
   - reason = 'underage_attempt'
         ↓
9. Return 403 response with block details
         ↓
10. Frontend displays: "Your IP has been blocked for 2 hours"
```

### Returning User (After Block Expires)

```
1. Same user from blocked IP tries to sign up again
         ↓
2. Middleware checks: isIPBlocked(ip)?
         ↓
3. Query IPBlocklist where ip=X AND expiresAt > now AND isActive=true
         ↓
4. If expired: Allow request (block no longer active)
         ↓
5. User can try signup again
```

### Admin Managing Blocks

```
1. Admin visits /admin/ip-blocking or AdminIPBlockingPanel
         ↓
2. Views current settings:
   - Block duration: 2 hours
   - Status: Enabled
         ↓
3. Wants to change to 24 hours:
   - Enters "24" in duration input
   - Clicks "Update Duration"
         ↓
4. POST /api/admin/ip-blocking/settings/update
   {
     key: 'underage_ip_block_duration_hours',
     value: '24',
     type: 'integer'
   }
         ↓
5. Service updates AdminSetting record
         ↓
6. Next underage attempt uses 24-hour duration
         ↓
7. Admin can also:
   - View blocked IPs list
   - Unblock specific IPs immediately
   - Manually block IPs (e.g., known abusers)
   - View statistics
```

---

## Configuration & Customization

### Changing Block Duration

**For admins (UI):**
1. Open Admin Panel → IP Blocking Settings
2. Enter hours: 2, 24, 37, 48, 72, 168 (1 week), etc.
3. Click "Update Duration"
4. New duration applies to next underage attempt

**For developers (code):**
```javascript
// Set via API
PUT /api/admin/ip-blocking/settings/update
{
  key: 'underage_ip_block_duration_hours',
  value: '24',
  type: 'integer'
}

// Or directly in code
const AdminSettingsService = require('./services/adminSettingsService');
await AdminSettingsService.setSetting(
  'underage_ip_block_duration_hours',
  24,
  'integer',
  'age_verification'
);
```

### Enable/Disable IP Blocking

```javascript
// Disable (don't block underage IPs)
await AdminSettingsService.setSetting(
  'underage_block_enabled',
  false,
  'boolean'
);

// Enable (block underage IPs)
await AdminSettingsService.setSetting(
  'underage_block_enabled',
  true,
  'boolean'
);
```

### Manual IP Blocking

```javascript
// Block a known spammer IP for 48 hours
POST /api/admin/ip-blocking/block-ip
{
  ipAddress: '192.168.1.100',
  reason: 'spam_abuse',
  durationHours: 48
}
```

---

## IP Extraction Logic

The system extracts client IP from request headers in this priority order:

```javascript
1. X-Forwarded-For (for proxied requests)
   - Takes FIRST IP in list
   - Example: "203.0.113.1, 198.51.100.1" → "203.0.113.1"

2. X-Real-IP (alternative proxy header)
   - Single IP address

3. socket.remoteAddress (direct connection)
   - Node.js socket property

Example for deployed app on Render:
- Request from 192.168.1.100 through Render proxy
- Headers: X-Forwarded-For: "192.168.1.100, 10.0.0.1"
- Extracted IP: 192.168.1.100 ✓
```

---

## Database Initialization

### On App Startup

```javascript
// File: /backend/server.js
db.init()
  .then(async () => {
    // ... sync models ...
    
    // Initialize default settings
    const AdminSettingsService = require('./services/adminSettingsService');
    await AdminSettingsService.initializeDefaultSettings();
    
    startServer();
  })
```

### Default Settings Created

```javascript
{
  settingKey: 'underage_ip_block_duration_hours',
  settingValue: '2',
  settingType: 'integer',
  category: 'age_verification'
}

{
  settingKey: 'underage_block_enabled',
  settingValue: 'true',
  settingType: 'boolean',
  category: 'age_verification'
}

{
  settingKey: 'max_underage_attempts_per_ip',
  settingValue: '3',
  settingType: 'integer',
  category: 'age_verification'
}
```

---

## Error Handling

### Common Scenarios

**Scenario 1: Database Connection Failed**
- Middleware fails gracefully (logs error, calls next())
- Request is NOT blocked
- Error logged to system

**Scenario 2: Setting Doesn't Exist**
- Service returns default value (e.g., 2 hours)
- Block still created with default duration

**Scenario 3: Invalid IP Format**
- Still creates block record
- IP stored as-is
- Middleware comparison handles gracefully

**Scenario 4: Block Expired But Not Cleaned Up**
- Middleware checks `expiresAt > now`
- Expired blocks are effectively ignored
- Cleanup task removes them from active list

---

## Monitoring & Maintenance

### Regular Cleanup

```javascript
// Run cleanup to mark expired blocks as inactive
POST /api/admin/ip-blocking/cleanup

// Or schedule via cron job
0 * * * * node -e "require('./services/ipBlockingService').cleanupExpiredBlocks()"
```

### Viewing Statistics

```javascript
GET /api/admin/ip-blocking/stats

Response:
{
  totalBlocks: 127,
  activeBlocks: 8,
  expiredBlocks: 119,
  uniqueIPs: 105,
  lastBlockedAt: '2026-04-29T12:30:00Z',
  mostCommonReason: 'underage_attempt'
}
```

### Audit Trail

All admin actions are logged:
- Who blocked/unblocked
- When the action occurred
- Reason for action
- Duration set

---

## Security Considerations

### ✅ Implemented

1. **Admin-only endpoints** - Require `authenticateToken` + `requireAdmin`
2. **IP validation** - Extracts from multiple header sources
3. **Graceful degradation** - Fails open if DB unavailable
4. **Audit trail** - Tracks admin actions
5. **Automatic expiration** - Blocks don't last forever

### ⚠️ Limitations

1. **IPv4 only** - Currently stores full IPv4 addresses
2. **No IPv6 support** - Future enhancement needed
3. **Not VPN-aware** - Can't detect/handle VPN users
4. **Proxy dependent** - Relies on X-Forwarded-For accuracy

### 🔒 Recommendations

1. Monitor abuse patterns - Are same IPs repeatedly trying?
2. Set reasonable duration - Too long blocks legitimate users
3. Regular cleanup - Keep database lean
4. Log analysis - Review blocked IPs for trends
5. Rate limiting - Combine with other anti-abuse measures

---

## Testing

### Manual Testing Checklist

- [ ] Create user with age < 18 → Verify IP blocked
- [ ] Wait for block duration → Verify can sign up again
- [ ] Admin changes duration to 24hrs → Block uses new duration
- [ ] Admin enables/disables blocking → Toggle works
- [ ] Admin manually blocks IP → Verify 403 response
- [ ] Admin unblocks IP → Verify can access again
- [ ] View blocked IPs list → Shows all active blocks
- [ ] Check statistics → Numbers match actual blocks

### API Testing Examples

```bash
# Check if IP is blocked
curl -H "Authorization: Bearer TOKEN" \
  https://api.datinghub.app/api/admin/ip-blocking/check/192.168.1.100

# Get current settings
curl -H "Authorization: Bearer TOKEN" \
  https://api.datinghub.app/api/admin/ip-blocking/settings

# Update block duration
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"underage_ip_block_duration_hours","value":"24","type":"integer"}' \
  https://api.datinghub.app/api/admin/ip-blocking/settings/update

# List blocked IPs
curl -H "Authorization: Bearer TOKEN" \
  https://api.datinghub.app/api/admin/ip-blocking/blocked-ips?page=1&limit=50

# Manually block IP
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ipAddress":"192.168.1.100","reason":"spam","durationHours":48}' \
  https://api.datinghub.app/api/admin/ip-blocking/block-ip

# Unblock IP
curl -X DELETE \
  -H "Authorization: Bearer TOKEN" \
  https://api.datinghub.app/api/admin/ip-blocking/unblock-ip/192.168.1.100

# Get statistics
curl -H "Authorization: Bearer TOKEN" \
  https://api.datinghub.app/api/admin/ip-blocking/stats
```

---

## File Reference

**Backend Files:**
- `/backend/models/IPBlocklist.js` - IP blocklist model
- `/backend/models/AdminSetting.js` - Settings model
- `/backend/services/ipBlockingService.js` - Blocking logic
- `/backend/services/adminSettingsService.js` - Settings management
- `/backend/middleware/ipBlocking.js` - Request-level checking
- `/backend/routes/ipBlockingAdmin.js` - Admin API endpoints
- `/backend/routes/ageVerification.js` - Modified signup route

**Frontend Files:**
- `/src/components/AdminIPBlockingPanel.js` - Admin panel component
- `/src/components/AdminIPBlockingPanel.css` - Styling

**Configuration:**
- `/backend/server.js` - Middleware mounting, settings initialization

---

## Future Enhancements

1. **IPv6 Support** - Add IPv6 address blocking
2. **VPN Detection** - Detect and handle VPN users
3. **Geographic Blocking** - Block by country/region
4. **Rate Limiting** - Combine with request rate limiting
5. **ML Detection** - Detect suspicious patterns
6. **Bulk Operations** - Block/unblock multiple IPs at once
7. **Whitelist** - Trusted IPs that bypass blocking
8. **Export Reports** - Download blocked IP statistics as CSV
9. **Scheduled Tasks** - Automatic cleanup via scheduler
10. **Webhooks** - Notify external systems of blocking events

---

## Support & Troubleshooting

### Issue: Legitimate user's IP is blocked

**Solution:**
1. Verify actual age
2. Admin manually unblocks IP via Admin Panel
3. User can sign up again

### Issue: Block not expiring

**Solution:**
1. Check AdminSetting for correct duration
2. Run cleanup: POST /api/admin/ip-blocking/cleanup
3. Verify database timestamps are correct

### Issue: Proxy IP not detected correctly

**Solution:**
1. Verify X-Forwarded-For header is being sent
2. Check Render/hosting platform forwards headers correctly
3. Check middleware execution order (must be early in stack)

### Issue: Middleware blocking all requests

**Solution:**
1. Verify checkIPBlock is called with proper error handling
2. Check database connectivity
3. Review middleware logs for errors
4. Ensure token-based auth is working

---

**Last Updated:** April 29, 2026
**Version:** 1.0.0
