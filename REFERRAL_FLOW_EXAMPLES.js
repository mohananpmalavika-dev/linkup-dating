/**
 * Referral Code System - Complete Flow Example
 * Shows how the entire referral system works end-to-end
 */

// ============================================
// STEP 1: ADMIN GENERATES CODES FOR ALL USERS
// ============================================

/**
 * Admin Tool: Generate referral codes for all users
 * Run from browser console while logged in as admin
 */
async function adminGenerateAllCodes() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/admin/referrals/generate-all', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  
  console.log(`✅ Generated: ${data.summary.codesCreated}`);
  console.log(`⏭️ Skipped: ${data.summary.codesSkipped}`);
  console.log(`❌ Errors: ${data.summary.errors}`);
  console.log(`Coverage: ${data.summary.totalUsers} users processed`);

  return data;
}

// ============================================
// STEP 2: CHECK SYSTEM STATISTICS
// ============================================

/**
 * Admin Tool: Check overall referral statistics
 */
async function adminCheckStats() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/admin/referrals/stats', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  
  console.log('📊 System Statistics:');
  console.log(`Total Users: ${data.stats.totalUsers}`);
  console.log(`Users with Codes: ${data.stats.usersWithReferralCodes}`);
  console.log(`Coverage: ${data.stats.coveragePercentage}`);
  console.log(`By Status:`, data.stats.referralsByStatus);

  return data.stats;
}

// ============================================
// STEP 3: USER GETS THEIR REFERRAL CODE
// ============================================

/**
 * User Action: Get my referral code
 * Called when user visits Referrals section
 */
async function userGetMyCode() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/referrals/my-code', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  
  console.log('My Referral Code:', data.code);
  console.log('Share Link:', data.link);
  console.log('Expires At:', data.expiresAt);
  
  // Display in UI
  document.querySelector('.referral-code').textContent = data.code;
  document.querySelector('.referral-link').value = data.link;

  return data;
}

// ============================================
// STEP 4: USER SHARES CODE WITH FRIEND
// ============================================

/**
 * User Action: Share referral code
 * Via WhatsApp, SMS, Email, or Copy-Paste
 */
function userShareCode(code, method = 'copy') {
  const message = `Join me on LinkUp! Use my code: ${code}`;
  const link = `https://linkup.dating/?referral=${code}`;
  const fullMessage = `${message}\n${link}`;

  switch(method) {
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`);
      break;
    
    case 'sms':
      window.open(`sms:?body=${encodeURIComponent(fullMessage)}`);
      break;
    
    case 'email':
      window.open(`mailto:?subject=Join LinkUp&body=${encodeURIComponent(fullMessage)}`);
      break;
    
    case 'copy':
      navigator.clipboard.writeText(fullMessage);
      console.log('✅ Copied to clipboard');
      break;
  }
}

// ============================================
// STEP 5: FRIEND SIGNS UP WITH REFERRAL CODE
// ============================================

/**
 * New User: Signup with referral code
 * Code is extracted from URL: ?referral=LINK1A2B3C4D
 */
async function newUserSignupWithReferral(referralCode) {
  // First, normal signup flow
  const signupData = {
    email: 'friend@example.com',
    password: 'SecurePassword123',
    firstName: 'Friend',
    lastName: 'Name'
  };

  // Signup first
  const signupResponse = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signupData)
  });

  const signupResult = await signupResponse.json();
  const newToken = signupResult.token;

  // Then accept the referral code
  const referralResponse = await fetch('/api/referrals/accept', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${newToken}`
    },
    body: JSON.stringify({ referralCode })
  });

  const referralResult = await referralResponse.json();
  
  if (referralResult.success) {
    console.log('✅ Referral accepted!');
    console.log('Rewards earned:', referralResult.rewards);
  }

  return referralResult;
}

// Expected rewards:
// {
//   "success": true,
//   "message": "Referral accepted! You and your friend will receive bonuses.",
//   "rewards": {
//     "referrer": [
//       { "type": "premium_days", "amount": 7 },
//       { "type": "superlikes", "amount": 5 }
//     ],
//     "referred": [
//       { "type": "premium_days", "amount": 7 },
//       { "type": "superlikes", "amount": 5 }
//     ]
//   }
// }

// ============================================
// STEP 6: USER CHECKS THEIR REFERRAL STATS
// ============================================

/**
 * User Action: Get my referral statistics
 */
async function userGetStats() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/referrals/stats', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  
  console.log('📊 My Referral Stats:');
  console.log(`Friends Invited: ${data.stats.totalInvited}`);
  console.log(`Successful: ${data.stats.successfulReferrals}`);
  console.log(`Pending: ${data.stats.pendingReferrals}`);
  console.log(`Premium Days Earned: ${data.stats.rewardsEarned.premium_days || 0}`);
  console.log(`Superlikes Earned: ${data.stats.rewardsEarned.superlikes || 0}`);
  console.log(`My Code: ${data.stats.referralCode}`);
  console.log(`Referred Friends:`, data.stats.referredFriends);

  return data.stats;
}

// Example response:
// {
//   "stats": {
//     "totalInvited": 5,
//     "successfulReferrals": 3,
//     "pendingReferrals": 1,
//     "expiredReferrals": 1,
//     "referralCode": "LINK1A2B3C4D",
//     "referralLink": "https://linkup.dating/?referral=LINK1A2B3C4D",
//     "rewardsEarned": {
//       "premium_days": 21,
//       "superlikes": 15
//     },
//     "referredFriends": [
//       {
//         "id": 456,
//         "name": "Friend Name",
//         "email": "friend@example.com",
//         "joinedAt": "2024-04-29T10:30:00Z",
//         "completedAt": "2024-04-29T11:45:00Z",
//         "age": 28
//       }
//     ]
//   }
// }

// ============================================
// STEP 7: USER CHECKS PENDING REWARDS
// ============================================

/**
 * User Action: Get pending rewards to claim
 */
async function userGetPendingRewards() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/referrals/rewards/pending', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  
  console.log('🎁 Pending Rewards:');
  data.rewards?.forEach((reward, i) => {
    console.log(`${i + 1}. ${reward.reward_type}: +${reward.reward_amount} (${reward.reward_description})`);
  });

  return data.rewards || [];
}

// ============================================
// STEP 8: USER CLAIMS REWARDS
// ============================================

/**
 * User Action: Claim all pending rewards
 * Converts unclaimed rewards to account benefits
 */
async function userClaimRewards() {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/referrals/rewards/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  
  if (data.success) {
    console.log('✅ Rewards Claimed!');
    console.log(`+${data.rewards.premiumDays} days premium access`);
    console.log(`+${data.rewards.superlikes} superlikes`);
  } else {
    console.log('❌ ' + data.message);
  }

  return data;
}

// ============================================
// STEP 9: USER VIEWS LEADERBOARD
// ============================================

/**
 * Public/User Action: View top referrers leaderboard
 */
async function viewLeaderboard(limit = 10) {
  const response = await fetch(`/api/referrals/leaderboard?limit=${limit}`, {
    method: 'GET'
  });

  const data = await response.json();
  
  console.log(`🏆 Top ${limit} Referrers:`);
  data.leaderboard?.forEach((entry, i) => {
    console.log(`${i + 1}. ${entry.userName} - ${entry.successfulReferrals} successful referrals`);
  });

  return data.leaderboard || [];
}

// ============================================
// STEP 10: ADMIN REGENERATES CODE FOR USER
// ============================================

/**
 * Admin Action: Regenerate referral code for specific user
 * Old code is marked as expired
 */
async function adminRegenerateCodeForUser(userId) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`/api/admin/referrals/regenerate/${userId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  
  if (data.success) {
    console.log(`✅ New code generated for user ${userId}:`);
    console.log(`Code: ${data.code}`);
    console.log(`Link: ${data.link}`);
  }

  return data;
}

// ============================================
// COMPLETE FLOW EXECUTION EXAMPLE
// ============================================

/**
 * Run this entire flow from admin browser console
 * Demonstrates the complete referral system
 */
async function runCompleteReferralFlow() {
  console.log('\n=== 🚀 LinkUp Referral System - Complete Flow ===\n');

  try {
    // Step 1: Generate codes
    console.log('Step 1️⃣  Generating referral codes for all users...');
    await adminGenerateAllCodes();

    // Step 2: Check stats
    console.log('\nStep 2️⃣  Checking system statistics...');
    await adminCheckStats();

    // Step 3: User gets code
    console.log('\nStep 3️⃣  User getting their referral code...');
    const myCode = await userGetMyCode();

    // Step 4: User shares
    console.log('\nStep 4️⃣  User shares code via WhatsApp...');
    userShareCode(myCode.code, 'whatsapp');

    // Step 5: Friend signs up (simulated)
    console.log('\nStep 5️⃣  Friend signs up with referral code...');
    // In real flow: await newUserSignupWithReferral(myCode.code);

    // Step 6: User checks stats
    console.log('\nStep 6️⃣  User checking updated stats...');
    await userGetStats();

    // Step 7: Check pending rewards
    console.log('\nStep 7️⃣  Checking pending rewards...');
    await userGetPendingRewards();

    // Step 8: Claim rewards
    console.log('\nStep 8️⃣  Claiming rewards...');
    // await userClaimRewards();

    // Step 9: View leaderboard
    console.log('\nStep 9️⃣  Viewing top referrers...');
    await viewLeaderboard(5);

    console.log('\n✅ Complete referral flow demonstration finished!');
  } catch (error) {
    console.error('❌ Error during flow:', error);
  }
}

// ============================================
// QUICK TEST COMMANDS
// ============================================

/*
Run these individually from browser console:

1. Generate all codes:
   adminGenerateAllCodes().then(d => console.log(d.summary))

2. Check coverage:
   adminCheckStats().then(s => console.log(s.coveragePercentage))

3. Get my code:
   userGetMyCode().then(d => console.log(d.code))

4. Get my stats:
   userGetStats().then(s => console.log(s.totalInvited + ' invites sent'))

5. View leaderboard:
   viewLeaderboard(5).then(l => console.log(l))

6. Run complete flow:
   runCompleteReferralFlow()
*/
