const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '.env')
});

const bcrypt = require('bcryptjs');
const db = require('../config/database');

const REVIEWER_ACCOUNTS = [
  {
    label: 'Reviewer 1',
    email: 'reviewer1@linkupdating.com',
    password: 'ReviewPass2026!',
    mpin: '2468',
    dateOfBirth: '1996-04-18',
    profile: {
      username: 'reviewer_one',
      firstName: 'Ananya',
      age: 30,
      gender: 'female',
      locationCity: 'Bengaluru',
      locationState: 'Karnataka',
      locationCountry: 'India',
      relationshipGoal: 'serious',
      bio: 'Primary Google Play reviewer account with seeded conversations and likes.',
      interests: ['Travel', 'Coffee', 'Movies']
    }
  },
  {
    label: 'Reviewer 2',
    email: 'reviewer2@linkupdating.com',
    password: 'ReviewPass2026!',
    mpin: '1357',
    dateOfBirth: '1994-09-07',
    profile: {
      username: 'reviewer_two',
      firstName: 'Arjun',
      age: 31,
      gender: 'male',
      locationCity: 'Kochi',
      locationState: 'Kerala',
      locationCountry: 'India',
      relationshipGoal: 'serious',
      bio: 'Seeded match account for reviewer testing and messaging.',
      interests: ['Music', 'Food', 'Hiking']
    }
  },
  {
    label: 'Reviewer 3',
    email: 'reviewer3@linkupdating.com',
    password: 'ReviewPass2026!',
    mpin: '8080',
    dateOfBirth: '1998-01-22',
    profile: {
      username: 'reviewer_three',
      firstName: 'Nikhil',
      age: 28,
      gender: 'male',
      locationCity: 'Chennai',
      locationState: 'Tamil Nadu',
      locationCountry: 'India',
      relationshipGoal: 'friendship',
      bio: 'Seeded like account so the primary reviewer profile has a pending action to test.',
      interests: ['Fitness', 'Gaming', 'Photography']
    }
  }
];

const INTEREST_MATCHING_DEFAULTS = ['male', 'female', 'non-binary', 'other'];
const RELATIONSHIP_GOAL_DEFAULTS = ['serious', 'casual', 'friendship', 'marriage'];

const ensureReviewerAccount = async (client, account) => {
  const passwordHash = await bcrypt.hash(account.password, 10);
  const mpinHash = await bcrypt.hash(account.mpin, 10);

  const userResult = await client.query(
    `INSERT INTO users (
       email,
       password,
       phone,
       mpin_hash,
       phone_verified,
       email_verified,
       is_admin,
       created_at,
       updated_at
     )
     VALUES ($1, $2, NULL, $3, FALSE, TRUE, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (email) DO UPDATE
     SET password = EXCLUDED.password,
         mpin_hash = EXCLUDED.mpin_hash,
         email_verified = TRUE,
         updated_at = CURRENT_TIMESTAMP
     RETURNING id, email`,
    [account.email.toLowerCase(), passwordHash, mpinHash]
  );

  const user = userResult.rows[0];

  await client.query(
    `INSERT INTO age_verifications (
       user_id,
       verification_method,
       date_of_birth,
       is_verified,
       verified_at,
       created_at,
       updated_at
     )
     VALUES ($1, 'seeded_reviewer_account', $2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE
     SET verification_method = EXCLUDED.verification_method,
         date_of_birth = EXCLUDED.date_of_birth,
         is_verified = TRUE,
         verified_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
    [user.id, account.dateOfBirth]
  );

  await client.query(
    `INSERT INTO dating_profiles (
       user_id,
       username,
       first_name,
       age,
       gender,
       location_city,
       location_state,
       location_country,
       bio,
       interests,
       relationship_goals,
       profile_verified,
       verifications,
       profile_completion_percent,
       is_active,
       last_active,
       created_at,
       updated_at
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9,
       $10, $11, TRUE, $12::jsonb, 85, TRUE,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     )
     ON CONFLICT (user_id) DO UPDATE
     SET username = EXCLUDED.username,
         first_name = EXCLUDED.first_name,
         age = EXCLUDED.age,
         gender = EXCLUDED.gender,
         location_city = EXCLUDED.location_city,
         location_state = EXCLUDED.location_state,
         location_country = EXCLUDED.location_country,
         bio = EXCLUDED.bio,
         interests = EXCLUDED.interests,
         relationship_goals = EXCLUDED.relationship_goals,
         profile_verified = TRUE,
         verifications = EXCLUDED.verifications,
         profile_completion_percent = GREATEST(dating_profiles.profile_completion_percent, 85),
         is_active = TRUE,
         last_active = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
    [
      user.id,
      account.profile.username,
      account.profile.firstName,
      account.profile.age,
      account.profile.gender,
      account.profile.locationCity,
      account.profile.locationState,
      account.profile.locationCountry,
      account.profile.bio,
      account.profile.interests,
      account.profile.relationshipGoal,
      JSON.stringify({
        email: true,
        seededFor: 'google_play_review'
      })
    ]
  );

  await client.query(
    `INSERT INTO user_preferences (
       user_id,
       gender_preferences,
       relationship_goals,
       interests,
       show_my_profile,
       allow_messages,
       notifications_enabled,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, TRUE, TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE
     SET gender_preferences = EXCLUDED.gender_preferences,
         relationship_goals = EXCLUDED.relationship_goals,
         interests = EXCLUDED.interests,
         show_my_profile = TRUE,
         allow_messages = TRUE,
         notifications_enabled = TRUE,
         updated_at = CURRENT_TIMESTAMP`,
    [
      user.id,
      INTEREST_MATCHING_DEFAULTS,
      RELATIONSHIP_GOAL_DEFAULTS,
      account.profile.interests
    ]
  );

  return {
    id: user.id,
    email: user.email,
    mpin: account.mpin,
    label: account.label,
    firstName: account.profile.firstName
  };
};

const ensureInteraction = async (client, fromUserId, toUserId, type, isMutual) => {
  await client.query(
    `INSERT INTO interactions (
       from_user_id,
       to_user_id,
       interaction_type,
       is_mutual,
       created_at
     )
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (from_user_id, to_user_id, interaction_type) DO UPDATE
     SET is_mutual = interactions.is_mutual OR EXCLUDED.is_mutual,
         created_at = CURRENT_TIMESTAMP`,
    [fromUserId, toUserId, type, isMutual]
  );
};

const ensureMatch = async (client, firstUserId, secondUserId) => {
  const [userId1, userId2] = [firstUserId, secondUserId].sort((left, right) => left - right);

  const existingMatch = await client.query(
    `SELECT id
     FROM matches
     WHERE (user_id_1 = $1 AND user_id_2 = $2)
        OR (user_id_1 = $2 AND user_id_2 = $1)
     LIMIT 1`,
    [userId1, userId2]
  );

  if (existingMatch.rows[0]) {
    await client.query(
      `UPDATE matches
       SET status = 'active',
           matched_at = COALESCE(matched_at, CURRENT_TIMESTAMP),
           created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
       WHERE id = $1`,
      [existingMatch.rows[0].id]
    );

    return existingMatch.rows[0].id;
  }

  const createdMatch = await client.query(
    `INSERT INTO matches (
       user_id_1,
       user_id_2,
       matched_at,
       status,
       last_message_at,
       message_count,
       created_at
     )
     VALUES ($1, $2, CURRENT_TIMESTAMP, 'active', NULL, 0, CURRENT_TIMESTAMP)
     RETURNING id`,
    [userId1, userId2]
  );

  return createdMatch.rows[0].id;
};

const ensureStarterConversation = async (client, matchId, reviewerOne, reviewerTwo) => {
  const existingMessages = await client.query(
    `SELECT COUNT(*)::int AS message_count
     FROM messages
     WHERE match_id = $1`,
    [matchId]
  );

  if ((existingMessages.rows[0]?.message_count || 0) === 0) {
    await client.query(
      `INSERT INTO messages (
         match_id,
         from_user_id,
         to_user_id,
         message,
         message_type,
         is_read,
         read_at,
         created_at
       )
       VALUES
       ($1, $2, $3, $4, 'text', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '8 minutes'),
       ($1, $3, $2, $5, 'text', FALSE, NULL, CURRENT_TIMESTAMP - INTERVAL '3 minutes')`,
      [
        matchId,
        reviewerOne.id,
        reviewerTwo.id,
        'Hi! I just joined LinkUp and wanted to say hello.',
        'Nice to meet you. Want to test the chat flow together?'
      ]
    );
  }

  await client.query(
    `UPDATE matches
     SET last_message_at = (
           SELECT MAX(created_at)
           FROM messages
           WHERE match_id = $1
         ),
         message_count = (
           SELECT COUNT(*)
           FROM messages
           WHERE match_id = $1
         ),
         status = 'active'
     WHERE id = $1`,
    [matchId]
  );
};

const ensureSeedNotifications = async (client, reviewerOne, reviewerTwo, reviewerThree, matchId) => {
  await client.query(
    `DELETE FROM user_notifications
     WHERE user_id = $1
       AND metadata ->> 'seededFor' = 'google_play_review'`,
    [reviewerOne.id]
  );

  await client.query(
    `INSERT INTO user_notifications (
       user_id,
       notification_type,
       title,
       body,
       metadata,
       is_read,
       created_at
     )
     VALUES
       ($1, 'new_match', $2, $3, $4::jsonb, FALSE, CURRENT_TIMESTAMP - INTERVAL '4 minutes'),
       ($1, 'new_like', $5, $6, $7::jsonb, FALSE, CURRENT_TIMESTAMP - INTERVAL '2 minutes')`,
    [
      reviewerOne.id,
      `You matched with ${reviewerTwo.firstName}`,
      'Open Messages to view the seeded conversation.',
      JSON.stringify({ matchId, fromUserId: reviewerTwo.id, seededFor: 'google_play_review' }),
      `${reviewerThree.firstName} liked your profile`,
      'Like back from the Likes section to create another match.',
      JSON.stringify({ fromUserId: reviewerThree.id, seededFor: 'google_play_review' })
    ]
  );
};

const seedGooglePlayReviewers = async ({ closePool = true } = {}) => {
  const initialized = await db.init();

  if (!initialized) {
    throw new Error('Database connection is unavailable. Could not seed reviewer accounts.');
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const createdAccounts = [];
    for (const account of REVIEWER_ACCOUNTS) {
      createdAccounts.push(await ensureReviewerAccount(client, account));
    }

    const reviewerOne = createdAccounts[0];
    const reviewerTwo = createdAccounts[1];
    const reviewerThree = createdAccounts[2];

    await ensureInteraction(client, reviewerOne.id, reviewerTwo.id, 'like', true);
    await ensureInteraction(client, reviewerTwo.id, reviewerOne.id, 'like', true);

    const reviewerThreeMatch = await client.query(
      `SELECT id
       FROM matches
       WHERE (user_id_1 = $1 AND user_id_2 = $2)
          OR (user_id_1 = $2 AND user_id_2 = $1)
       LIMIT 1`,
      [reviewerOne.id, reviewerThree.id]
    );

    if (!reviewerThreeMatch.rows[0]) {
      await ensureInteraction(client, reviewerThree.id, reviewerOne.id, 'like', false);
    }

    const matchId = await ensureMatch(client, reviewerOne.id, reviewerTwo.id);
    await ensureStarterConversation(client, matchId, reviewerOne, reviewerTwo);
    await ensureSeedNotifications(client, reviewerOne, reviewerTwo, reviewerThree, matchId);

    await client.query('COMMIT');

    console.log('Google Play reviewer accounts are ready.');
    console.log('');
    createdAccounts.forEach((account) => {
      console.log(`- ${account.label}: ${account.email} / MPIN ${account.mpin}`);
    });
    console.log('');
    console.log('Seeded state:');
    console.log(`- ${reviewerOne.email} has an active match with ${reviewerTwo.email}.`);
    console.log(`- ${reviewerThree.email} has already liked ${reviewerOne.email}.`);
    console.log(`- Match ID ${matchId} has starter messages for chat review.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    if (closePool) {
      await db.pool.end();
    }
  }
};

if (require.main === module) {
  seedGooglePlayReviewers().catch((error) => {
    console.error('Failed to create Google Play reviewer accounts:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  seedGooglePlayReviewers
};
