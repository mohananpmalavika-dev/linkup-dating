const express = require('express');
const router = express.Router();
const db = require('../config/database');

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MULTIPART_FORM_DATA_PATTERN = /^multipart\/form-data/i;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue ? normalizedValue : null;
};

const normalizeInteger = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return Boolean(value);
};

const normalizeHeight = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const normalizedValue = String(value).trim();
  const feetAndInchesMatch = normalizedValue.match(/^(\d+)\s*'\s*(\d{1,2})/);

  if (feetAndInchesMatch) {
    const feet = Number.parseInt(feetAndInchesMatch[1], 10);
    const inches = Number.parseInt(feetAndInchesMatch[2], 10);
    return Math.round((feet * 12 + inches) * 2.54);
  }

  return normalizeInteger(normalizedValue.replace(/[^\d-]/g, ''));
};

const safeJsonParse = (value, fallbackValue = null) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallbackValue;
  }
};

const extractMultipartBoundary = (contentType = '') => {
  const boundaryMatch = String(contentType).match(/boundary=([^;]+)/i);
  return boundaryMatch ? boundaryMatch[1].replace(/^"|"$/g, '') : null;
};

const parseMultipartFormData = async (req) => {
  const boundary = extractMultipartBoundary(req.headers['content-type']);

  if (!boundary) {
    return { fields: {}, files: [] };
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let hasRejected = false;

    req.on('data', (chunk) => {
      if (hasRejected) {
        return;
      }

      totalBytes += chunk.length;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        hasRejected = true;
        reject(new Error('Photo upload payload too large'));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (hasRejected) {
        return;
      }

      try {
        const rawBody = Buffer.concat(chunks).toString('latin1');
        const parts = rawBody
          .split(`--${boundary}`)
          .slice(1, -1)
          .map((part) => (part.startsWith('\r\n') ? part.slice(2) : part))
          .map((part) => (part.endsWith('\r\n') ? part.slice(0, -2) : part))
          .filter(Boolean);
        const fields = {};
        const files = [];

        for (const part of parts) {
          const headerSeparatorIndex = part.indexOf('\r\n\r\n');
          if (headerSeparatorIndex === -1) {
            continue;
          }

          const rawHeaders = part.slice(0, headerSeparatorIndex);
          const rawValue = part.slice(headerSeparatorIndex + 4);
          const dispositionHeader = rawHeaders
            .split('\r\n')
            .find((header) => /^content-disposition:/i.test(header));
          const contentTypeHeader = rawHeaders
            .split('\r\n')
            .find((header) => /^content-type:/i.test(header));

          if (!dispositionHeader) {
            continue;
          }

          const nameMatch = dispositionHeader.match(/name="([^"]+)"/i);
          if (!nameMatch) {
            continue;
          }

          const filenameMatch = dispositionHeader.match(/filename="([^"]*)"/i);
          const fieldName = nameMatch[1];

          if (filenameMatch) {
            files.push({
              fieldName,
              filename: filenameMatch[1],
              contentType: contentTypeHeader
                ? contentTypeHeader.split(':')[1].trim()
                : 'application/octet-stream',
              buffer: Buffer.from(rawValue, 'latin1')
            });
            continue;
          }

          if (fields[fieldName] === undefined) {
            fields[fieldName] = rawValue;
          } else if (Array.isArray(fields[fieldName])) {
            fields[fieldName].push(rawValue);
          } else {
            fields[fieldName] = [fields[fieldName], rawValue];
          }
        }

        resolve({ fields, files });
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
};

const normalizeIncomingPhotos = (rawPhotos = []) => {
  let candidatePhotos = rawPhotos;

  if (typeof candidatePhotos === 'string') {
    candidatePhotos = safeJsonParse(candidatePhotos, [candidatePhotos]);
  }

  if (!Array.isArray(candidatePhotos)) {
    candidatePhotos = [candidatePhotos];
  }

  return candidatePhotos
    .map((photo, index) => {
      if (typeof photo === 'string') {
        const normalizedUrl = normalizeOptionalText(photo);
        return normalizedUrl ? { url: normalizedUrl, position: index } : null;
      }

      if (!photo || typeof photo !== 'object') {
        return null;
      }

      const normalizedUrl = normalizeOptionalText(photo.url || photo.photo_url);
      if (!normalizedUrl) {
        return null;
      }

      const parsedPosition = normalizeInteger(photo.position);
      return {
        url: normalizedUrl,
        position: parsedPosition !== null ? parsedPosition : index
      };
    })
    .filter(Boolean);
};

const convertFileToDataUrl = (file) =>
  `data:${file.contentType || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;

const collectPhotosFromRequest = async (req) => {
  const jsonPhotos = normalizeIncomingPhotos(req.body?.photos);
  if (jsonPhotos.length > 0) {
    return jsonPhotos;
  }

  const contentType = String(req.headers['content-type'] || '');
  if (!MULTIPART_FORM_DATA_PATTERN.test(contentType)) {
    return [];
  }

  const { fields, files } = await parseMultipartFormData(req);
  const uploadedPhotos = files
    .filter((file) => file.fieldName === 'photos')
    .map((file, index) => ({
      url: convertFileToDataUrl(file),
      position: index
    }));

  if (uploadedPhotos.length > 0) {
    return uploadedPhotos;
  }

  return normalizeIncomingPhotos(fields.photos);
};

const normalizePhotoDetails = (photos) => {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos
    .map((photo, index) => {
      if (typeof photo === 'string') {
        return {
          id: null,
          url: photo,
          position: index,
          isPrimary: index === 0
        };
      }

      const normalizedUrl = normalizeOptionalText(photo?.photo_url || photo?.url);
      if (!normalizedUrl) {
        return null;
      }

      const parsedPosition = normalizeInteger(photo?.position);
      return {
        id: photo?.id ?? null,
        url: normalizedUrl,
        position: parsedPosition !== null ? parsedPosition : index,
        isPrimary: photo?.is_primary === undefined ? index === 0 : Boolean(photo.is_primary)
      };
    })
    .filter(Boolean)
    .sort((leftPhoto, rightPhoto) => leftPhoto.position - rightPhoto.position);
};

const normalizeProfileRow = (profileRow) => {
  if (!profileRow) {
    return null;
  }

  const photoDetails = normalizePhotoDetails(profileRow.photos);

  return {
    id: profileRow.id,
    userId: profileRow.user_id,
    username: profileRow.username || null,
    firstName: profileRow.first_name || '',
    age: profileRow.age,
    gender: profileRow.gender || null,
    bio: profileRow.bio || '',
    relationshipGoals: profileRow.relationship_goals || null,
    interests: Array.isArray(profileRow.interests) ? profileRow.interests : [],
    height: profileRow.height,
    occupation: profileRow.occupation || '',
    education: profileRow.education || '',
    bodyType: profileRow.body_type || null,
    ethnicity: profileRow.ethnicity || null,
    religion: profileRow.religion || null,
    smoking: profileRow.smoking || null,
    drinking: profileRow.drinking || null,
    hasKids: Boolean(profileRow.has_kids),
    wantsKids: Boolean(profileRow.wants_kids),
    profileVerified: Boolean(profileRow.profile_verified),
    profileCompletionPercent: profileRow.profile_completion_percent || 0,
    isActive: profileRow.is_active !== false,
    lastActive: profileRow.last_active || null,
    createdAt: profileRow.created_at || null,
    updatedAt: profileRow.updated_at || null,
    verifications: profileRow.verifications || {},
    location: {
      city: profileRow.location_city || '',
      state: profileRow.location_state || '',
      country: profileRow.location_country || '',
      lat: profileRow.location_lat ?? null,
      lng: profileRow.location_lng ?? null
    },
    photos: photoDetails.map((photo) => photo.url),
    photoDetails
  };
};

const normalizeMatchRow = (matchRow) => {
  const matchedProfile = matchRow.matched_user_profile || {};
  const photoDetails = normalizePhotoDetails(matchRow.matched_user_photos);
  const lastMessage = matchRow.last_message
    ? {
        id: matchRow.last_message.id,
        text: matchRow.last_message.text || '',
        fromUserId: matchRow.last_message.from_user_id,
        toUserId: matchRow.last_message.to_user_id,
        createdAt: matchRow.last_message.created_at || null,
        isRead: Boolean(matchRow.last_message.is_read)
      }
    : null;

  return {
    id: matchRow.id,
    matchId: matchRow.id,
    userId: matchRow.matched_user_id,
    firstName: matchedProfile.first_name || '',
    age: matchedProfile.age ?? null,
    bio: matchedProfile.bio || '',
    occupation: matchedProfile.occupation || '',
    education: matchedProfile.education || '',
    relationshipGoals: matchedProfile.relationship_goals || null,
    interests: Array.isArray(matchedProfile.interests) ? matchedProfile.interests : [],
    profileVerified: Boolean(matchedProfile.profile_verified),
    matchedAt: matchRow.matched_at || null,
    createdAt: matchRow.created_at || null,
    lastMessageAt: matchRow.last_message_at || null,
    messageCount: matchRow.message_count || 0,
    unreadCount: Number.parseInt(matchRow.unread_count, 10) || 0,
    status: matchRow.status,
    location: {
      city: matchedProfile.location_city || '',
      state: matchedProfile.location_state || '',
      country: matchedProfile.location_country || ''
    },
    photos: photoDetails.map((photo) => photo.url),
    photoDetails,
    lastMessage
  };
};

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

    const normalizedFirstName = normalizeOptionalText(firstName);
    const normalizedAge = normalizeInteger(age);
    const normalizedGender = normalizeOptionalText(gender);
    const normalizedCity = normalizeOptionalText(city);
    const normalizedState = normalizeOptionalText(state);
    const normalizedCountry = normalizeOptionalText(country);
    const normalizedBio = normalizeOptionalText(bio);
    const normalizedHeight = normalizeHeight(height);
    const normalizedOccupation = normalizeOptionalText(occupation);
    const normalizedEducation = normalizeOptionalText(education);
    const normalizedBodyType = normalizeOptionalText(bodyType);
    const normalizedEthnicity = normalizeOptionalText(ethnicity);
    const normalizedReligion = normalizeOptionalText(religion);
    const normalizedSmoking = normalizeOptionalText(smoking);
    const normalizedDrinking = normalizeOptionalText(drinking);
    const normalizedRelationshipGoals = normalizeOptionalText(relationshipGoals);
    const normalizedInterests = Array.isArray(interests) ? interests.filter(Boolean) : [];

    if (!normalizedFirstName || !normalizedAge || !normalizedGender || !normalizedCity) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const result = await db.query(
      `INSERT INTO dating_profiles (
         user_id, first_name, age, gender, location_city, location_state,
         location_country, bio, relationship_goals, interests, height,
         occupation, education, body_type, ethnicity, religion, smoking,
         drinking, has_kids, wants_kids, profile_completion_percent, last_active
       )
       VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17,
         $18, $19, $20, $21, CURRENT_TIMESTAMP
       )
       ON CONFLICT (user_id) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           age = EXCLUDED.age,
           gender = EXCLUDED.gender,
           location_city = EXCLUDED.location_city,
           location_state = EXCLUDED.location_state,
           location_country = EXCLUDED.location_country,
           bio = EXCLUDED.bio,
           relationship_goals = EXCLUDED.relationship_goals,
           interests = EXCLUDED.interests,
           height = EXCLUDED.height,
           occupation = EXCLUDED.occupation,
           education = EXCLUDED.education,
           body_type = EXCLUDED.body_type,
           ethnicity = EXCLUDED.ethnicity,
           religion = EXCLUDED.religion,
           smoking = EXCLUDED.smoking,
           drinking = EXCLUDED.drinking,
           has_kids = EXCLUDED.has_kids,
           wants_kids = EXCLUDED.wants_kids,
           profile_completion_percent = GREATEST(COALESCE(dating_profiles.profile_completion_percent, 0), EXCLUDED.profile_completion_percent),
           updated_at = CURRENT_TIMESTAMP,
           last_active = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId, normalizedFirstName, normalizedAge, normalizedGender, normalizedCity, normalizedState,
        normalizedCountry, normalizedBio, normalizedRelationshipGoals, normalizedInterests, normalizedHeight,
        normalizedOccupation, normalizedEducation, normalizedBodyType, normalizedEthnicity, normalizedReligion, normalizedSmoking,
        normalizedDrinking, normalizeBoolean(hasKids), normalizeBoolean(wantsKids), 60
      ]
    );

    res.json({ message: 'Profile created', profile: normalizeProfileRow(result.rows[0]) });
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
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = $1) as photos
       FROM dating_profiles dp
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(normalizeProfileRow(result.rows[0]));
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
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = $1) as photos
       FROM dating_profiles dp
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(normalizeProfileRow(result.rows[0]));
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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile updated', profile: normalizeProfileRow(result.rows[0]) });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 5. UPLOAD PROFILE PHOTOS
router.post('/profiles/me/photos', async (req, res) => {
  try {
    const userId = req.user.id;
    const photos = await collectPhotosFromRequest(req);

    if (!photos.length) {
      return res.status(400).json({ error: 'Photos array required' });
    }

    // Delete existing photos
    await db.query('DELETE FROM profile_photos WHERE user_id = $1', [userId]);

    // Insert new photos
    const photoUrls = [];
    for (let i = 0; i < photos.length; i++) {
      const position = photos[i].position !== undefined ? photos[i].position : i;
      const result = await db.query(
        `INSERT INTO profile_photos (user_id, photo_url, position, is_primary)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, photos[i].url, position, i === 0]
      );
      photoUrls.push(result.rows[0]);
    }

    // Update profile completion
    await db.query(
      `UPDATE dating_profiles
       SET profile_completion_percent = GREATEST(COALESCE(profile_completion_percent, 0), 80),
           updated_at = CURRENT_TIMESTAMP,
           last_active = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    res.json({
      message: 'Photos uploaded',
      photos: normalizePhotoDetails(photoUrls).map((photo) => photo.url),
      photoDetails: normalizePhotoDetails(photoUrls)
    });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// 6. SEARCH PROFILES
router.post('/search', async (req, res) => {
  try {
    const userId = req.user.id;
    const { ageRange, relationshipGoals, heightRange, interests } = req.body;
    const normalizedInterests = Array.isArray(interests)
      ? interests.map((interest) => normalizeOptionalText(interest)).filter(Boolean)
      : [];

    let query = `
      SELECT dp.*, COUNT(*) OVER() as total_count,
             (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
              FROM profile_photos WHERE user_id = dp.user_id) as photos
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
    if (heightRange?.min) {
      query += ` AND dp.height >= $${paramIndex++}`;
      params.push(heightRange.min);
    }
    if (heightRange?.max) {
      query += ` AND dp.height <= $${paramIndex++}`;
      params.push(heightRange.max);
    }
    if (normalizedInterests.length > 0) {
      query += ` AND COALESCE(dp.interests, ARRAY[]::text[]) && $${paramIndex++}::text[]`;
      params.push(normalizedInterests);
    }

    query += ' ORDER BY dp.updated_at DESC LIMIT 20';

    const result = await db.query(query, params);
    res.json({
      profiles: result.rows.map(normalizeProfileRow),
      totalCount: result.rows.length > 0
        ? Number.parseInt(result.rows[0].total_count, 10) || result.rows.length
        : 0
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 7. GET DISCOVERY PROFILES (For swipe interface)
router.get('/discovery', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    console.log('Discovery request from user:', userId);

    const result = await db.query(
      `SELECT dp.*,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       WHERE dp.user_id != $1
         AND dp.is_active = true
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

    console.log('Discovery profiles found:', result.rows.length);
    res.json({ profiles: result.rows.map(normalizeProfileRow) });
  } catch (err) {
    console.error('Discovery error:', err);
    res.status(500).json({ error: 'Failed to get discovery profiles', details: err.message });
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
      const persistedMatch = matchResult.rows[0] || (
        await db.query(
          `SELECT *
           FROM matches
           WHERE user_id_1 = LEAST($1, $2)
             AND user_id_2 = GREATEST($1, $2)
           LIMIT 1`,
          [fromUserId, userId]
        )
      ).rows[0];

      // Notify matched user
      if (req.io) {
        req.io.emit('new_match', {
          match: persistedMatch,
          user: { id: fromUserId }
        });
      }

      return res.json({
        message: 'Its a match!',
        isMatch: true,
        match: persistedMatch
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
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const page = Number.parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT m.*,
              CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END as matched_user_id,
              (SELECT json_build_object(
                  'first_name', first_name,
                  'age', age,
                  'bio', bio,
                  'occupation', occupation,
                  'education', education,
                  'relationship_goals', relationship_goals,
                  'interests', interests,
                  'location_city', location_city,
                  'location_state', location_state,
                  'location_country', location_country,
                  'profile_verified', profile_verified
                )
               FROM dating_profiles 
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_profile,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_photos,
              (SELECT json_build_object(
                  'id', id,
                  'text', message,
                  'from_user_id', from_user_id,
                  'to_user_id', to_user_id,
                  'created_at', created_at,
                  'is_read', is_read
                )
               FROM messages
               WHERE match_id = m.id
               ORDER BY created_at DESC
               LIMIT 1) as last_message,
              (SELECT COUNT(*)
               FROM messages
               WHERE match_id = m.id
                 AND to_user_id = $1
                 AND is_read = false) as unread_count
       FROM matches m
       WHERE (m.user_id_1 = $1 OR m.user_id_2 = $1) AND m.status = 'active'
       ORDER BY m.matched_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ matches: result.rows.map(normalizeMatchRow) });
  } catch (err) {
    console.error('Get matches error:', err);
    res.status(500).json({ error: 'Failed to get matches' });
  }
});

// 11. CHECK MATCH
router.get('/matches/by-id/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT m.*,
              CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END as matched_user_id,
              (SELECT json_build_object(
                  'first_name', first_name,
                  'age', age,
                  'bio', bio,
                  'occupation', occupation,
                  'education', education,
                  'relationship_goals', relationship_goals,
                  'interests', interests,
                  'location_city', location_city,
                  'location_state', location_state,
                  'location_country', location_country,
                  'profile_verified', profile_verified
                )
               FROM dating_profiles
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_profile,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = CASE WHEN m.user_id_1 = $1 THEN m.user_id_2 ELSE m.user_id_1 END) as matched_user_photos,
              (SELECT json_build_object(
                  'id', id,
                  'text', message,
                  'from_user_id', from_user_id,
                  'to_user_id', to_user_id,
                  'created_at', created_at,
                  'is_read', is_read
                )
               FROM messages
               WHERE match_id = m.id
               ORDER BY created_at DESC
               LIMIT 1) as last_message,
              (SELECT COUNT(*)
               FROM messages
               WHERE match_id = m.id
                 AND to_user_id = $1
                 AND is_read = false) as unread_count
       FROM matches m
       WHERE m.id = $2
         AND (m.user_id_1 = $1 OR m.user_id_2 = $1)
         AND m.status = 'active'
       LIMIT 1`,
      [userId, matchId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ match: normalizeMatchRow(result.rows[0]) });
  } catch (err) {
    console.error('Get match by id error:', err);
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

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
const verifyIdentityHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    let verificationType = req.body?.verificationType;

    if (!verificationType && MULTIPART_FORM_DATA_PATTERN.test(String(req.headers['content-type'] || ''))) {
      const { fields } = await parseMultipartFormData(req);
      verificationType = fields.verificationType;
    }

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

    res.json({ message: 'Profile verified', profile: normalizeProfileRow(result.rows[0]) });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
};

router.post('/profiles/verify', verifyIdentityHandler);
router.post('/profiles/me/verify', verifyIdentityHandler);

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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({
      profileCompletionPercent: result.rows[0].profile_completion_percent || 0,
      firstName: result.rows[0].first_name || '',
      age: result.rows[0].age,
      gender: result.rows[0].gender || null,
      bio: result.rows[0].bio || '',
      interests: Array.isArray(result.rows[0].interests) ? result.rows[0].interests : [],
      photoCount: Number.parseInt(result.rows[0].photo_count, 10) || 0,
      location: {
        city: result.rows[0].location_city || ''
      }
    });
  } catch (err) {
    console.error('Completion check error:', err);
    res.status(500).json({ error: 'Failed to get completion status' });
  }
});

module.exports = router;
