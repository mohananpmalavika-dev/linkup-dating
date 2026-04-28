## IP Blocking System - Quick Reference Guide

### What It Does
- Automatically blocks IP addresses when users attempt signup with age < 18
- Admin can configure block duration (2hrs, 24hrs, 37hrs, etc.)
- Admin can manually block/unblock IPs
- Tracks statistics and provides monitoring dashboard

---

### 🚀 Quick Setup Checklist

**Backend:**
- ✅ Created `IPBlocklist.js` model - stores blocked IPs
- ✅ Created `AdminSetting.js` model - stores config
- ✅ Created `ipBlockingService.js` - blocking logic
- ✅ Created `adminSettingsService.js` - settings management
- ✅ Created `ipBlocking.js` middleware - request checking
- ✅ Created `ipBlockingAdmin.js` routes - admin endpoints
- ✅ Modified `ageVerification.js` - triggers IP blocking
- ✅ Modified `server.js` - mounted middleware & routes, init settings

**Frontend:**
- ✅ Created `AdminIPBlockingPanel.js` - admin UI
- ✅ Created `AdminIPBlockingPanel.css` - styling

---

### 📊 Key Endpoints

**Settings (Admin Only):**
```
GET  /api/admin/ip-blocking/settings
POST /api/admin/ip-blocking/settings/update
GET  /api/admin/ip-blocking/settings/get/:key
```

**Blocking (Admin Only):**
```
POST   /api/admin/ip-blocking/block-ip
DELETE /api/admin/ip-blocking/unblock-ip/:ip
GET    /api/admin/ip-blocking/blocked-ips
GET    /api/admin/ip-blocking/check/:ip
GET    /api/admin/ip-blocking/stats
POST   /api/admin/ip-blocking/cleanup
```

**Age Verification:**
```
POST /api/auth/verify-age (automatically blocks if age < 18)
```

---

### ⚙️ Admin Panel Features

**Location:** `/src/components/AdminIPBlockingPanel.js`

**Settings Tab:**
- View current block duration
- Change duration (2, 24, 37 hours, etc.)
- Toggle blocking on/off
- See status: ENABLED ✓ or DISABLED ✗

**Blocked IPs Tab:**
- Manually block new IP
- Add blocking reason
- View all active blocks
- See time remaining per block
- One-click unblock

**Statistics Tab:**
- Total blocks created
- Currently active blocks
- Expired blocks
- Unique IPs blocked

---

### 🔄 How It Works

**User tries to signup with age < 18:**
```
1. POST /api/auth/verify-age
2. Age < 18? → YES
3. Extract client IP from request
4. Create IPBlocklist record
5. Return 403 with block details
```

**Returning user after block expires:**
```
1. Request comes in
2. Middleware checks: isIPBlocked?
3. expiresAt > now? → YES → Request allowed
4. User can sign up
```

**Admin changes duration:**
```
1. Admin enters "24" in panel
2. POST /api/admin/ip-blocking/settings/update
3. Next underage attempt uses 24-hour duration
```

---

### 🗄️ Database Models

**IPBlocklist:**
- `ipAddress` (UNIQUE) - The blocked IP
- `reason` - Why blocked (underage_attempt, manual_block, etc.)
- `blockDurationHours` - Duration in hours
- `expiresAt` - When block expires
- `attemptedEmail` - Email from failed signup
- `attemptedAge` - Age from failed signup
- `isActive` - true=blocked, false=expired
- `removedAt` - When admin unblocked
- `removedByAdminId` - Which admin unblocked

**AdminSetting:**
- `settingKey` (UNIQUE) - Config key
- `settingValue` - Config value
- `settingType` - integer/string/boolean/json
- `category` - e.g., "age_verification"

**Default Settings:**
```
underage_ip_block_duration_hours = 2
underage_block_enabled = true
max_underage_attempts_per_ip = 3
```

---

### 🔧 Services

**IPBlockingService:**
```javascript
isIPBlocked(ip)                                    // Check if blocked
getIPBlockDetails(ip)                              // Get block info
blockIPForUnderageAttempt(ip, email, age)         // Auto-block
blockIPManually(ip, reason, hours, adminId)       // Manual block
unblockIP(ip, adminId)                            // Unblock
getBlockedIPs(page, limit, activeOnly)            // List blocks
cleanupExpiredBlocks()                            // Mark expired
getBlockStatistics()                              // Stats
```

**AdminSettingsService:**
```javascript
getSetting(key, defaultValue)                 // Get setting
setSetting(key, value, type, category, ...)  // Create/update
getSettingsByCategory(category)               // Get by category
initializeDefaultSettings()                   // Init defaults
```

---

### 📱 Response Examples

**User blocked (underage attempt):**
```json
{
  "status": 403,
  "error": "You must be at least 18 years old to use LinkUp",
  "code": "UNDERAGE_USER",
  "age": 15,
  "message": "Your IP address has been blocked for 2 hours due to underage signup attempt."
}
```

**IP is blocked (middleware check):**
```json
{
  "status": 403,
  "success": false,
  "error": "Your IP address is currently blocked",
  "blockedUntil": "2026-04-29T14:32:00Z",
  "remainingMinutes": 120,
  "reason": "underage_attempt"
}
```

**Get statistics:**
```json
{
  "success": true,
  "statistics": {
    "totalBlocks": 127,
    "activeBlocks": 8,
    "expiredBlocks": 119,
    "uniqueIPs": 105
  }
}
```

---

### 🔐 Security

**Protected Endpoints:**
- All `/api/admin/ip-blocking/*` routes require:
  - `authenticateToken` (valid JWT)
  - `requireAdmin` (is_admin = true)

**IP Extraction (in priority order):**
1. X-Forwarded-For (first IP in list)
2. X-Real-IP
3. socket.remoteAddress

**Graceful Degradation:**
- If DB unavailable: middleware logs error but allows request
- If setting doesn't exist: uses default value
- If expired block not cleaned: middleware checks expiration anyway

---

### ⚡ Common Operations

**Change block duration to 24 hours:**
```bash
POST /api/admin/ip-blocking/settings/update
{
  "key": "underage_ip_block_duration_hours",
  "value": "24",
  "type": "integer"
}
```

**Manually block spammer IP:**
```bash
POST /api/admin/ip-blocking/block-ip
{
  "ipAddress": "192.168.1.100",
  "reason": "spam",
  "durationHours": 48
}
```

**Unblock an IP:**
```bash
DELETE /api/admin/ip-blocking/unblock-ip/192.168.1.100
```

**See blocked IPs:**
```bash
GET /api/admin/ip-blocking/blocked-ips?page=1&limit=50&activeOnly=true
```

**Get statistics:**
```bash
GET /api/admin/ip-blocking/stats
```

**Disable blocking (for testing):**
```bash
POST /api/admin/ip-blocking/settings/update
{
  "key": "underage_block_enabled",
  "value": "false",
  "type": "boolean"
}
```

---

### 📁 File Locations

**Backend:**
```
/backend/models/IPBlocklist.js
/backend/models/AdminSetting.js
/backend/services/ipBlockingService.js
/backend/services/adminSettingsService.js
/backend/middleware/ipBlocking.js
/backend/routes/ipBlockingAdmin.js
/backend/routes/ageVerification.js (modified)
/backend/server.js (modified)
```

**Frontend:**
```
/src/components/AdminIPBlockingPanel.js
/src/components/AdminIPBlockingPanel.css
```

**Documentation:**
```
/IP_BLOCKING_SYSTEM_GUIDE.md (complete guide)
/IP_BLOCKING_QUICK_REF.md (this file)
```

---

### 🧪 Testing

**Test underage signup:**
1. Enter age < 18 in signup
2. Verify 403 response
3. Verify IP blocked in database

**Test unblock:**
1. Admin unblocks IP
2. Same IP tries signup again
3. Should work (if still < 18 error, but no IP block)

**Test duration change:**
1. Change duration to 1 hour
2. Create new block
3. Verify expiresAt is 1 hour from now

**Test disable:**
1. Disable blocking
2. Try signup with age < 18
3. IP should NOT be blocked (no IPBlocklist record)

---

### ⚠️ Important Notes

1. **Block Duration:** Set reasonable values (2-72 hours typical)
   - Too short: spammers can try again quickly
   - Too long: blocks legitimate users

2. **IP Extraction:** Depends on X-Forwarded-For header
   - Works on Render/Heroku with proper config
   - May need adjustment for other hosting

3. **Cleanup:** Expired blocks marked as inactive
   - Can run POST /api/admin/ip-blocking/cleanup manually
   - Or schedule as periodic cron job

4. **Audit Trail:** All admin actions logged
   - Who unblocked, when, and which IP
   - Helps track admin activity

5. **VPN Limitation:** Can't detect VPN users
   - VPN users share exit IP
   - Blocking VPN IP blocks all users on that IP
   - Future enhancement recommended

---

### 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| All requests blocked | Check middleware order, database connection |
| Legitimate user blocked | Admin unblocks via panel |
| Block not expiring | Run cleanup, check DB timestamps |
| Setting changes not working | Verify admin role, check auth token |
| IP not detected | Check X-Forwarded-For header |
| High false positives | Reduce block duration or disable temporarily |

---

### 📚 Related Documentation

- `IP_BLOCKING_SYSTEM_GUIDE.md` - Complete implementation guide
- `ADMIN_MODERATION_GUIDE.md` - Admin panel operations
- Age Verification Routes - See `ageVerification.js`

---

**Version:** 1.0.0  
**Last Updated:** April 29, 2026  
**Status:** ✅ Complete and Integrated
