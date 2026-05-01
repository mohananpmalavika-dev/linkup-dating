# DatingHub FRND-Style Paid Calling System

**Analysis Date:** Current
**Feature:** Dual-sided paid calling marketplace (earn + pay per call)

---

## 🎯 OVERVIEW

FRND App Model:
- Users set themselves "available for calls" and earn money when they take calls
- Callers pay per-minute to connect with available users
- Real-time voice/video calling with payment integration

**DatingHub Implementation:** Full paid calling system with earnings + credits.

---

## 📊 KEY FEATURES

### Tier 1: CALLER (Pays to Call)
1. **Call Credits Wallet** - Purchase prepaid credits (₹10 = 10 mins voice)
2. **Browse Available Users** - See who's online/available for calls
3. **Instant Call Connection** - Tap to call, payment deducted per second
4. **Call History & Ratings** - View past calls, rate callers

### Tier 2: EARNER (Earn by Taking Calls)
1. **Set Availability** - Toggle online/offline for calls
2. **Set Call Rate** - Price per minute (e.g., ₹5/min)
3. **Call Earnings Dashboard** - Track earnings, pending payouts
4. **Payout System** - UPI/bank transfer withdrawals

### Tier 3: MATCHING & CONNECTION
1. **Available Users Feed** - Browse online earners
2. **Call Request Flow** - Request → Accept → Connect
3. **Real-time WebRTC** - Voice/video call
4. **Call Timer** - Live billing counter

---

## 📁 FILES TO CREATE

```
src/
├── components/
│   ├── CallWallet.js          # Credits balance & purchase
│   ├── CallBrowser.js        # Browse available callers
│   ├── CallRequestModal.js   # Send call request
│   ├── LiveCallScreen.js    # Active call UI
│   ├── EarningsDashboard.js # Earner earnings view
│   └── AvailabilityToggle.js # Set online/offline
├── services/
│   ├── callWalletService.js   # Credits purchase & tracking
│   ├── callMarketService.js   # Available users API
│   └── callEarningsService.js # Earnings tracking
├── hooks/
│   ├── useCallWallet.js      # Wallet state
│   └── useCallAvailability.js # Availability state
├── styles/
│   └── CallWallet.css        # Wallet styles
│   └── LiveCallScreen.css   # Call screen styles

backend/
├── routes/
│   ├── call-wallet.js       # Credits API
│   ├── call-market.js       # Available users API
│   └── call-earnings.js     # Earnings API
├── services/
│   ├── callBillingService.js  # Per-second billing
│   └── callPayoutService.js  # Payout processing
└── models/
    └── call_sessions.js     # Call session tracking
```

---

## 🗄️ DATABASE SCHEMA

```sql
-- User earnings & availability
ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS is_available_for_calls BOOLEAN DEFAULT FALSE;
ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS call_rate_per_minute DECIMAL(10,2) DEFAULT 5.00;
ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE dating_profiles ADD COLUMN IF NOT EXISTS pending_payout DECIMAL(12,2) DEFAULT 0.00;

-- Call credits wallet
CREATE TABLE IF NOT EXISTS call_credits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  credits_balance DECIMAL(12,2) DEFAULT 0.00,
  total_spent DECIMAL(12,2) DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call sessions
CREATE TABLE IF NOT EXISTS call_sessions (
  id SERIAL PRIMARY KEY,
  caller_id INTEGER REFERENCES users(id),
  receiver_id INTEGER REFERENCES users(id),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INTEGER DEFAULT 0,
  rate_per_minute DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  status VARCHAR(20), -- 'requested', 'active', 'completed', 'declined'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Earnings transactions
CREATE TABLE IF NOT EXISTS call_earnings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  call_session_id INTEGER REFERENCES call_sessions(id),
  amount DECIMAL(10,2),
  type VARCHAR(20), -- 'earned', 'payout', 'refund'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔄 USER FLOWS

### Caller Flow:
1. User opens "Call" tab
2. Browse "Available for Call" users (with rates)
3. Tap user → See profile + call rate
4. Click "Call Now" → Check credits
5. If sufficient credits → Send call request
6. Receiver accepts → Connect
7. Live call with billing timer
8. Call ends → Rate caller

### Earner Flow:
1. User opens "Profile" → "Call Settings"
2. Toggle "Available for Calls"
3. Set rate per minute (e.g., ₹5)
4. Receive call request notification
5. Accept → Live call
6. Earn credits added per second
7. Track earnings in dashboard
8. Request payout (UPI/bank)

---

## 💰 PRICING MODEL (Admin-Controlled)

| Feature | Price | Set By |
|---------|-------|-------|
| Voice Call Rate | ₹X/min | Admin |
| Video Call Rate | ₹Y/min | Admin |
| Caller Credit | Purchased via Payment Gateway | Admin |
| Earner Payout | % of call revenue | Admin |

**Admin Panel Controls:**
- Voice call rate per minute
- Video call rate per minute  
- Earner payout percentage (e.g., 70% to earner, 30% platform)
- Minimum payout threshold
- Payment gateway (Razorpay/UPIMode)
- Global enable/disable calling feature

---

## 🔌 PAYMENT GATEWAY

- **Razorpay** - For purchasing call credits
- **UPIMode** - For earner payouts
- Both configurable via Admin Panel

---

## ✅ PRIORITY ORDER

1. **Database migrations** - Add columns + tables
2. **Backend routes** - wallet, market, earnings APIs
3. **CallWallet component** - Credits purchase/balance
4. **CallBrowser component** - Browse available callers
5. **LiveCallScreen component** - Active call UI
6. **AvailabilityToggle component** - Earner settings
7. **EarningsDashboard component** - Track earnings
8. **Wire in App.js** - Add routes

---

Ready to start implementation?
