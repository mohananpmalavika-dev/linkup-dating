const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// 1. CREATE PROFILE (Signup Step 2 & 3)
router.post('/profiles', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName,
      age,
      gender,
      city,
      state,
      country,
      bio,
      relationshipGoals,
      interests,
      height,
      occupation,
      education,
      bodyType,
      ethnicity,
      religion,
      smoking,
      drinking,
      hasKids,
      wantsKids
    } = req.body;

    if (!firstName || !age || !gender || !city) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const result = await db.query(
      `UPDATE dating_profiles 
       SET first_name = $1, age = $2, gender = $3, location_city = $4,
           location_state = $5, location_country = $6, bio = $7,
           relationship_goals = $8, interests = $9, height = $10,
           occupation = $11, education = $12, body_type = $13,
           ethnicity = $14, religion = $15, smoking = $16,
           drinking = $17, has_kids = $18, wants_kids = $19,
           profile_completion_percent = $20, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $21
       RETURNING *`,
      [
        firstName, age, gender, city, state, country, bio,
        relationshipGoals, interests, height, occupation, education,
        bodyType, ethnicity, religion, smoking, drinking,
        hasKids || false, wantsKids || false, 60, userId
      ]
    );

    res.json({ message: 'Profile created', profile: result.rows[0] });
  } catch (err) {
    console.error('Profile creation error:', err);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// 2. GET MY PROFILE
router.get('/profiles/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT dp.*, 
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position))
               FROM profile_photos WHERE user_id = $1 ORDER BY position) as photos
       FROM dating_profiles dp
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// 3. GET PROFILE BY ID
router.get('/profiles/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await db.query(
      `SELECT dp.*, 
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position))
               FROM profile_photos WHERE user_id = $1 ORDER BY position) as photos
       FROM dating_profiles dp
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// 4. UPDATE PROFILE
router.put('/profiles/me', async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, interests, relationshipGoals } = req.body;

    const result = await db.query(
      `UPDATE dating_profiles 
       SET bio = COALESCE($1, bio),
           interests = COALESCE($2, interests),
           relationship_goals = COALESCE($3, relationship_goals),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4
       RETURNING *`,
      [bio, interests, relationshipGoals, userId]
    );

    res.json({ message: 'Profile updated', profile: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 5. UPLOAD PROFILE PHOTOS
router.post('/profiles/me/photos', async (req, res) => {
  try {
    const userId = req.user.id;
    const { photos } = req.body; // Array of { url, position }

    if (!photos || !Array.isArray(photos)) {
      return res.status(400).json({ error: 'Photos array required' });
    }

    // Delete existing photos
    await db.query('DELETE FROM profile_photos WHERE user_id = $1', [userId]);

    // Insert new photos
    const photoUrls = [];
    for (let i = 0; i < photos.length; i++) {
      const result = await db.query(
        `INSERT INTO profile_photos (user_id, photo_url, position, is_primary)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, photos[i].url, i, i === 0]
      );
      photoUrls.push(result.rows[0]);
    }

    // Update profile completion
    await db.query(
      'UPDATE dating_profiles SET profile_completion_percent = 80, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId]
    );

    res.json({ message: 'Photos uploaded', photos: photoUrls });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// 6. SEARCH PROFILES
router.post('/search', async (req, res) => {
  try {
    const userId = req.user.id;
    const { ageRange, locationRadius, relationshipGoals, interests, heightRange } = req.body;

    let query = `
      SELECT dp.*, COUNT(*) OVER() as total_count,
             (SELECT json_agg(photo_url ORDER BY position) 
              FROM profile_photos WHERE user_id = dp.user_id LIMIT 1) as photos
      FROM dating_profiles dp
      WHERE dp.user_id != $1
        AND dp.is_active = true
        AND dp.profile_verified = true
    `;

    const params = [userId];
    let paramIndex = 2;

    if (ageRange?.min) {
      query += ` AND dp.age >= $${paramIndex++}`;
      params.push(ageRange.min);
    }
    if (ageRange?.max) {
      query += ` AND dp.age <= $${paramIndex++}`;
      params.push(ageRange.max);
    }
    if (relationshipGoals?.length > 0) {
      query += ` AND dp.relationship_goals = ANY($${paramIndex++})`;
      params.push(relationshipGoals);
    }

    query += ' ORDER BY dp.updated_at DESC LIMIT 20';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 7. GET DISCOVERY PROFILES (For swipe interface)
router.get('/discovery', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 10;

    const result = await db.query(
      `SELECT dp.*, 
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position))
               FROM profile_photos WHERE user_id = dp.user_id ORDER BY position) as photos
       FROM dating_profiles dp
       WHERE dp.user_id != $1
         AND dp.is_active = true
         AND dp.profile_verified = true
         AND dp.user_id NOT IN (
           SELECT CASE 
             WHEN from_user_id = $1 THEN to_user_id 
             ELSE from_user_id 
           END as excluded_user
           FROM interactions WHERE (from_user_id = $1 OR to_user_id = $1)
         )
       ORDER BY RANDOM()
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Discovery error:', err);
    res.status(500).json({ error: 'Failed to get discovery profiles' });
  }
});

// 8. LIKE PROFILE
router.post('/interactions/like', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    // Record the like
    await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'like')
       ON CONFLICT (from_user_id, to_user_id, interaction_type) DO NOTHING`,
      [fromUserId, userId]
    );

    // Check if mutual like exists
    const mutualResult = await db.query(
      `SELECT * FROM interactions 
       WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type = 'like'`,
      [userId, fromUserId]
    );

    if (mutualResult.rows.length > 0) {
      // Create match
      const matchResult = await db.query(
        `INSERT INTO matches (user_id_1, user_id_2)
         VALUES (LEAST($1, $2), GREATEST($1, $2))
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [fromUserId, userId]
      );

      // Notify matched user
      if (req.io) {
        req.io.emit('new_match', {
          match: matchResult.rows[0],
          user: { id: fromUserId }
        });
      }

      return res.json({
        message: 'Its a match!',
        isMatch: true,
        match: matchResult.rows[0]
      });
    }

    res.json({ message: 'Profile liked', isMatch: false });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like profile' });
  }
});

// 9. PASS PROFILE
router.post('/interactions/pass', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type)
       VALUES ($1, $2, 'pass')
       ON CONFLICT (from_user_id, to_user_id, interaction_type) DO NOTHING`,
      [fromUserId, userId]
    );

    res.json({ message: 'Profile passed' });
  } catch (err) {
    console.error('Pass error:', err);
    res.status(500).json({ error: 'Failed to pass profile' });
  }
});

// 10. GET MATCHES
router.get('/matches', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 20;
    const page = req.query.page || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT m.*,
              CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END as matched_user_id,
              (SELECT json_build_object('first_name', first_name, 'age', age, 'location_city', location_city, 'profile_verified', profile_verified)
               FROM dating_profiles 
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_profile,
              (SELECT photo_url FROM profile_photos 
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END
               ORDER BY position LIMIT 1) as matched_user_photo
       FROM matches m
       WHERE (m.user_id_1 = $1 OR m.user_id_2 = $1) AND m.status = 'active'
       ORDER BY m.matched_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// 11. CHECK MATCH
router.get('/matches/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const result = await db.query(
      `SELECT * FROM matches 
       WHERE (user_id_1 = $1 AND user_id_2 = $2) 
          OR (user_id_1 = $2 AND user_id_2 = $1)`,
      [currentUserId, userId]
    );

    if (result.rows.length === 0) {
      return res.json({ isMatched: false });
    }

    res.json({ isMatched: true, match: result.rows[0] });
  } catch (err) {
    console.error('Check match error:', err);
    res.status(500).json({ error: 'Failed to check match' });
  }
});

// 12. UNMATCH
router.delete('/matches/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE matches 
       SET status = 'unmatched'
       WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
       RETURNING *`,
      [matchId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Unmatched successfully' });
  } catch (err) {
    console.error('Unmatch error:', err);
    res.status(500).json({ error: 'Failed to unmatch' });
  }
});

// 12b. UNMATCH - POST variant (for frontend compatibility)
router.post('/matches/:matchId/unmatch', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `UPDATE matches 
       SET status = 'unmatched'
       WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
       RETURNING *`,
      [matchId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Unmatched successfully' });
  } catch (err) {
    console.error('Unmatch error:', err);
    res.status(500).json({ error: 'Failed to unmatch' });
  }
});

// 13. GET LIKES RECEIVED
router.get('/interactions/likes', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 20;
    const page = req.query.page || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT i.*, dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
       FROM interactions i
       JOIN dating_profiles dp ON i.from_user_id = dp.user_id
       WHERE i.to_user_id = $1 AND i.interaction_type = 'like'
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get likes error:', err);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// 13b. ALIAS - GET LIKES RECEIVED (alternate endpoint)
router.get('/likes-received', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 20;
    const page = req.query.page || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT i.*, dp.first_name, dp.age, dp.location_city,
              (SELECT photo_url FROM profile_photos WHERE user_id = i.from_user_id LIMIT 1) as photo_url
       FROM interactions i
       JOIN dating_profiles dp ON i.from_user_id = dp.user_id
       WHERE i.to_user_id = $1 AND i.interaction_type = 'like'
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get likes error:', err);
    res.status(500).json({ error: 'Failed to get likes' });
  }
});

// 14. GET INTERACTION HISTORY
router.get('/interactions/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 100;

    const result = await db.query(
      `SELECT * FROM interactions 
       WHERE from_user_id = $1 OR to_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to get interaction history' });
  }
});

// 14b. ALIAS - GET INTERACTION HISTORY (alternate endpoint)
router.get('/interaction-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit || 100;

    const result = await db.query(
      `SELECT * FROM interactions 
       WHERE from_user_id = $1 OR to_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Failed to get interaction history' });
  }
});

// 15. VERIFY IDENTITY
router.post('/profiles/verify', async (req, res) => {
  try {
    const userId = req.user.id;
    const { verificationType, verificationData } = req.body;

    if (!verificationType) {
      return res.status(400).json({ error: 'Verification type required' });
    }

    // In production, integrate with third-party verification service
    const result = await db.query(
      `UPDATE dating_profiles 
       SET verifications = jsonb_set(verifications, $1, $2),
           profile_verified = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3
       RETURNING *`,
      [
        `{${verificationType}}`,
        JSON.stringify({ status: 'verified', verifiedAt: new Date() }),
        userId
      ]
    );

    res.json({ message: 'Profile verified', profile: result.rows[0] });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// 16. GET PROFILE COMPLETION STATUS
router.get('/profiles/me/completion', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT profile_completion_percent, first_name, age, gender, location_city, bio, interests,
              (SELECT COUNT(*) FROM profile_photos WHERE user_id = $1) as photo_count
       FROM dating_profiles WHERE user_id = $1`,
      [userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Completion check error:', err);
    res.status(500).json({ error: 'Failed to get completion status' });
  }
});

module.exports = router;
