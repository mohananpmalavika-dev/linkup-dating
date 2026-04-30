# TODO: FRND-Style Paid Calling Implementation

## Phase 1: Database
- [ ] Create call_sessions table
- [ ] Create call_credits table  
- [ ] Create call_earnings table
- [ ] Add availability columns to dating_profiles

## Phase 2: Backend Routes
- [ ] Create call-wallet.js routes
- [ ] Create call-market.js routes
- [ ] Create call-earnings.js routes

## Phase 3: Admin Panel
- [ ] Add calling rates settings to AdminDashboard
- [ ] Voice rate per minute setting
- [ ] Video rate per minute setting
- [ ] Earner payout percentage

## Phase 4: Frontend Services & Hooks
- [ ] callWalletService.js
- [ ] callMarketService.js
- [ ] callEarningsService.js
- [ ] useCallWallet hook
- [ ] useCallAvailability hook

## Phase 5: Frontend Components
- [ ] CallWallet.js (credits + purchase)
- [ ] CallBrowser.js (browse available)
- [ ] LiveCallScreen.js (active call UI)
- [ ] AvailabilityToggle.js (set online/offline)
- [ ] EarningsDashboard.js (track earnings)

## Phase 6: Integration
- [ ] Add routes in App.js
- [ ] Add bottom nav for "Call" tab
- [ ] Wire in DatingNavigation

## Phase 7: Testing
- [ ] Test credit purchase flow
- [ ] Test availability toggle
- [ ] Test call browse
- [ ] Test earnings tracking
