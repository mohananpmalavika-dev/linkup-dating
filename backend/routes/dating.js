const express = require('express');
const router = express.Router();
const db = require('../config/database');
const spamFraudService = require('../services/spamFraudService');
const userNotificationService = require('../services/userNotificationService');

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MULTIPART_FORM_DATA_PATTERN = /^multipart\/form-data/i;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = String(value).trim();
  return normalizedValue ? normalizedValue : null;
};

const getRequestMetadata = (req) => ({
  ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null,
  userAgent: req.headers['user-agent'] || null
});

const countRowValue = (value) => Number.parseInt(value, 10) || 0;

const hasMeaningfulFilters = (filters = {}) =>
  Object.values(filters).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (value && typeof value === 'object') {
      return hasMeaningfulFilters(value);
    }

    return value !== undefined && value !== null && String(value).trim() !== '';
  });

const recordSearchHistory = async ({ userId, source = 'search', filters = {}, resultCount = 0 }) => {
  if (!userId || !hasMeaningfulFilters(filters)) {
    return;
  }

  try {
    await db.query(
      `INSERT INTO user_search_history (user_id, source, filters, result_count)
       VALUES ($1, $2, $3, $4)`,
      [userId, source, JSON.stringify(filters), resultCount]
    );
  } catch (error) {
    console.error('Search history record error:', error);
  }
};

const normalizeSearchHistoryRow = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  source: row.source,
  filters: row.filters || {},
  resultCount: row.result_count || 0,
  createdAt: row.created_at
});

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

const normalizeInterestList = (interests = []) =>
  (Array.isArray(interests) ? interests : [])
    .map((interest) => String(interest || '').trim())
    .filter(Boolean);

const buildIcebreakerSuggestions = (profile, sharedInterests = []) => {
  const suggestions = [];
  const firstSharedInterest = sharedInterests[0];
  const firstInterest = normalizeInterestList(profile?.interests)[0];

  if (firstSharedInterest) {
    suggestions.push(`I noticed we both like ${firstSharedInterest}. What got you into it?`);
  }

  if (profile?.occupation) {
    suggestions.push(`What's something you genuinely enjoy about working in ${profile.occupation}?`);
  }

  if (profile?.relationshipGoals) {
    suggestions.push(`What does a great ${profile.relationshipGoals} connection look like to you?`);
  }

  if (profile?.location?.city) {
    suggestions.push(`What do you enjoy most about living in ${profile.location.city}?`);
  }

  if (firstInterest && firstInterest !== firstSharedInterest) {
    suggestions.push(`If I wanted to learn more about ${firstInterest}, where should I start?`);
  }

  suggestions.push('What kind of conversation always keeps you interested?');
  suggestions.push('What is something simple that can make your whole day better?');

  return [...new Set(suggestions)].slice(0, 4);
};

const buildCompatibilitySuggestion = (currentProfile, candidateProfile) => {
  if (!candidateProfile) {
    return {
      compatibilityScore: 0,
      compatibilityReasons: [],
      icebreakers: []
    };
  }

  if (!currentProfile) {
    return {
      compatibilityScore: 60,
      compatibilityReasons: ['Complete your profile to unlock smarter match suggestions.'],
      icebreakers: buildIcebreakerSuggestions(candidateProfile)
    };
  }

  const currentInterests = normalizeInterestList(currentProfile.interests);
  const candidateInterests = normalizeInterestList(candidateProfile.interests);
  const currentInterestLookup = new Set(currentInterests.map((interest) => interest.toLowerCase()));
  const sharedInterests = candidateInterests.filter((interest) =>
    currentInterestLookup.has(interest.toLowerCase())
  );

  let score = 48;
  const reasons = [];

  if (sharedInterests.length > 0) {
    score += Math.min(24, sharedInterests.length * 8);
    reasons.push(`Shared interests: ${sharedInterests.slice(0, 2).join(' and ')}`);
  }

  if (
    currentProfile.relationshipGoals &&
    candidateProfile.relationshipGoals &&
    currentProfile.relationshipGoals === candidateProfile.relationshipGoals
  ) {
    score += 18;
    reasons.push(`Both of you are looking for ${candidateProfile.relationshipGoals}`);
  }

  const currentCity = currentProfile.location?.city?.toLowerCase?.() || '';
  const candidateCity = candidateProfile.location?.city?.toLowerCase?.() || '';
  const currentState = currentProfile.location?.state?.toLowerCase?.() || '';
  const candidateState = candidateProfile.location?.state?.toLowerCase?.() || '';

  if (currentCity && candidateCity && currentCity === candidateCity) {
    score += 12;
    reasons.push(`You are both in ${candidateProfile.location.city}`);
  } else if (currentState && candidateState && currentState === candidateState) {
    score += 7;
    reasons.push(`You are in the same region`);
  }

  if (Number.isFinite(currentProfile.age) && Number.isFinite(candidateProfile.age)) {
    const ageGap = Math.abs(currentProfile.age - candidateProfile.age);

    if (ageGap <= 2) {
      score += 10;
    } else if (ageGap <= 5) {
      score += 7;
    } else if (ageGap <= 8) {
      score += 4;
    }
  }

  if (candidateProfile.profileVerified) {
    score += 5;
  }

  if (candidateProfile.bio) {
    score += 3;
  }

  return {
    compatibilityScore: Math.max(52, Math.min(99, score)),
    compatibilityReasons: reasons.slice(0, 3),
    icebreakers: buildIcebreakerSuggestions(candidateProfile, sharedInterests)
  };
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
    const currentUserId = req.user.id;
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

    if (Number(currentUserId) !== Number(userId)) {
      const requestMetadata = getRequestMetadata(req);
      spamFraudService.trackUserActivity({
        userId: currentUserId,
        action: 'profile_view',
        analyticsUpdates: { profiles_viewed: 1 },
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        runSpamCheck: true,
        runFraudCheck: true
      });
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
    await recordSearchHistory({
      userId,
      source: 'browse_search',
      filters: {
        ageRange: ageRange || {},
        relationshipGoals: Array.isArray(relationshipGoals) ? relationshipGoals : [],
        heightRange: heightRange || {},
        interests: normalizedInterests
      },
      resultCount: result.rows.length
    });

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
    const limit = parseInt(req.query.limit, 10) || 10;
    const discoveryFilters = {
      ageMin: normalizeInteger(req.query.ageMin),
      ageMax: normalizeInteger(req.query.ageMax),
      relationshipGoals: normalizeOptionalText(req.query.relationshipGoals),
      interests: normalizeOptionalText(req.query.interests),
      distance: normalizeInteger(req.query.distance)
    };

    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }

    const currentProfileResult = await db.query(
      `SELECT dp.*,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       WHERE dp.user_id = $1
       LIMIT 1`,
      [userId]
    );
    const currentProfile = normalizeProfileRow(currentProfileResult.rows[0] || null);

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
       ORDER BY dp.updated_at DESC
       LIMIT 100`,
      [userId]
    );

    const profiles = result.rows
      .map((profileRow) => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const compatibility = buildCompatibilitySuggestion(currentProfile, normalizedProfile);

        return {
          ...normalizedProfile,
          ...compatibility
        };
      })
      .sort((leftProfile, rightProfile) => rightProfile.compatibilityScore - leftProfile.compatibilityScore)
      .slice(0, limit);

    const requestMetadata = getRequestMetadata(req);
    spamFraudService.trackUserActivity({
      userId,
      action: 'discovery_feed_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });
    await recordSearchHistory({
      userId,
      source: 'discovery',
      filters: discoveryFilters,
      resultCount: profiles.length
    });

    res.json({ profiles });
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
    const requestMetadata = getRequestMetadata(req);

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

    spamFraudService.trackUserActivity({
      userId: fromUserId,
      action: 'like_profile',
      analyticsUpdates: { likes_sent: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

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

      if (typeof req.emitToUser === 'function') {
        const participantIds = [fromUserId, userId];

        participantIds.forEach((participantId) => {
          req.emitToUser(participantId, 'new_match', {
            match: persistedMatch,
            user: { id: fromUserId },
            matchedUserId: participantId === fromUserId ? userId : fromUserId,
            createdAt: new Date().toISOString()
          });
        });
      }

      await Promise.all([
        userNotificationService.createNotification(fromUserId, {
          type: 'new_match',
          title: 'You have a new match',
          body: 'Someone liked you back. Open the chat to say hello.',
          metadata: {
            matchId: persistedMatch.id,
            matchedUserId: userId
          }
        }),
        userNotificationService.createNotification(userId, {
          type: 'new_match',
          title: 'It is a match',
          body: 'You matched with someone new. Start the conversation when you are ready.',
          metadata: {
            matchId: persistedMatch.id,
            matchedUserId: fromUserId
          }
        })
      ]);

      spamFraudService.updateUserAnalytics(fromUserId, { matches_made: 1 });
      spamFraudService.updateUserAnalytics(userId, { matches_made: 1 });
      spamFraudService.refreshSystemMetrics();

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

    await userNotificationService.createNotification(userId, {
      type: 'verification_complete',
      title: 'Verification updated',
      body: `${verificationType} verification has been added to your profile.`,
      metadata: {
        verificationType,
        profileVerified: true
      }
    });

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

// 17. FAVORITE A PROFILE
router.post('/favorites', async (req, res) => {
  try {
    const userId = req.user.id;
    const favoriteUserId = normalizeInteger(req.body.favoriteUserId || req.body.userId);

    if (!favoriteUserId) {
      return res.status(400).json({ error: 'Favorite user ID is required' });
    }

    if (Number(userId) === Number(favoriteUserId)) {
      return res.status(400).json({ error: 'You cannot favorite your own profile' });
    }

    const userExists = await db.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [favoriteUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.query(
      `INSERT INTO favorite_profiles (user_id, favorite_user_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, favorite_user_id) DO NOTHING`,
      [userId, favoriteUserId]
    );

    res.json({ success: true, message: 'Profile saved to favorites' });
  } catch (err) {
    console.error('Favorite profile error:', err);
    res.status(500).json({ error: 'Failed to save favorite profile' });
  }
});

// 18. GET FAVORITE PROFILES
router.get('/favorites', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT fp.created_at as favorited_at,
              dp.*,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos
               WHERE user_id = dp.user_id) as photos
       FROM favorite_profiles fp
       INNER JOIN dating_profiles dp ON dp.user_id = fp.favorite_user_id
       WHERE fp.user_id = $1
       ORDER BY fp.created_at DESC`,
      [userId]
    );

    res.json({
      favorites: result.rows.map((row) => ({
        ...normalizeProfileRow(row),
        favoritedAt: row.favorited_at
      }))
    });
  } catch (err) {
    console.error('Get favorites error:', err);
    res.status(500).json({ error: 'Failed to fetch favorite profiles' });
  }
});

// 19. REMOVE FAVORITE PROFILE
router.delete('/favorites/:favoriteUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const favoriteUserId = normalizeInteger(req.params.favoriteUserId);

    await db.query(
      `DELETE FROM favorite_profiles
       WHERE user_id = $1 AND favorite_user_id = $2`,
      [userId, favoriteUserId]
    );

    res.json({ success: true, message: 'Favorite removed' });
  } catch (err) {
    console.error('Remove favorite error:', err);
    res.status(500).json({ error: 'Failed to remove favorite profile' });
  }
});

// 20. GET SEARCH HISTORY
router.get('/search-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 20, 100);

    const result = await db.query(
      `SELECT *
       FROM user_search_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      history: result.rows.map(normalizeSearchHistoryRow)
    });
  } catch (err) {
    console.error('Get search history error:', err);
    res.status(500).json({ error: 'Failed to fetch search history' });
  }
});

// 21. CLEAR SEARCH HISTORY
router.delete('/search-history', async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(
      `DELETE FROM user_search_history
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'Search history cleared' });
  } catch (err) {
    console.error('Clear search history error:', err);
    res.status(500).json({ error: 'Failed to clear search history' });
  }
});

// 22. GET USER NOTIFICATIONS
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(normalizeInteger(req.query.limit) || 25, 100);
    const notifications = await userNotificationService.getNotificationsForUser(userId, { limit });
    const unreadCount = await userNotificationService.getUnreadCount(userId);

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 23. GET UNREAD NOTIFICATION COUNT
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const unreadCount = await userNotificationService.getUnreadCount(req.user.id);
    res.json({ unreadCount });
  } catch (err) {
    console.error('Get unread notification count error:', err);
    res.status(500).json({ error: 'Failed to fetch unread notification count' });
  }
});

// 24. MARK NOTIFICATION AS READ
router.post('/notifications/:notificationId/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = normalizeInteger(req.params.notificationId);
    const notification = await userNotificationService.markAsRead(userId, notificationId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// 25. MARK ALL NOTIFICATIONS AS READ
router.post('/notifications/read-all', async (req, res) => {
  try {
    await userNotificationService.markAllAsRead(req.user.id);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// 26. BLOCK A USER
router.post('/blocks', async (req, res) => {
  try {
    const userId = req.user.id;
    const { blockedUserId } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({ error: 'Blocked user ID is required' });
    }

    if (userId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Check if user exists
    const userExists = await db.query('SELECT id FROM users WHERE id = $1', [blockedUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert block
    await db.query(
      `INSERT INTO user_blocks (blocking_user_id, blocked_user_id) 
       VALUES ($1, $2) 
       ON CONFLICT DO NOTHING`,
      [userId, blockedUserId]
    );

    res.json({ success: true, message: 'User blocked successfully' });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// 18. GET MY BLOCKED USERS
router.get('/blocks', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT ub.id, ub.blocked_user_id, dp.first_name, dp.age, 
              dp.location_city, dp.location_state,
              (SELECT photo_url FROM profile_photos WHERE user_id = ub.blocked_user_id LIMIT 1) as photo_url,
              ub.created_at
       FROM user_blocks ub
       JOIN users u ON ub.blocked_user_id = u.id
       JOIN dating_profiles dp ON dp.user_id = u.id
       WHERE ub.blocking_user_id = $1
       ORDER BY ub.created_at DESC`,
      [userId]
    );

    res.json({
      blockedUsers: result.rows.map(row => ({
        id: row.blocked_user_id,
        firstName: row.first_name,
        age: row.age,
        location: {
          city: row.location_city,
          state: row.location_state
        },
        photoUrl: row.photo_url,
        blockedAt: row.created_at
      }))
    });
  } catch (err) {
    console.error('Get blocked users error:', err);
    res.status(500).json({ error: 'Failed to get blocked users' });
  }
});

// 19. UNBLOCK A USER
router.delete('/blocks/:blockedUserId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { blockedUserId } = req.params;

    await db.query(
      `DELETE FROM user_blocks 
       WHERE blocking_user_id = $1 AND blocked_user_id = $2`,
      [userId, parseInt(blockedUserId, 10)]
    );

    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// 20. REPORT A USER
router.post('/reports', async (req, res) => {
  try {
    const userId = req.user.id;
    const { reportedUserId, reason, description } = req.body;
    const requestMetadata = getRequestMetadata(req);

    if (!reportedUserId || !reason) {
      return res.status(400).json({ error: 'Reported user ID and reason are required' });
    }

    if (userId === reportedUserId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    // Check if user exists
    const userExists = await db.query('SELECT id FROM users WHERE id = $1', [reportedUserId]);
    if (userExists.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert report
    const result = await db.query(
      `INSERT INTO user_reports (reporting_user_id, reported_user_id, reason, description) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, created_at`,
      [userId, reportedUserId, reason, description || null]
    );

    spamFraudService.trackUserActivity({
      userId,
      action: 'report_submitted',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runFraudCheck: false
    });
    spamFraudService.checkForFraud(reportedUserId);
    spamFraudService.refreshSystemMetrics();

    res.json({ 
      success: true, 
      message: 'Report submitted successfully',
      reportId: result.rows[0].id,
      createdAt: result.rows[0].created_at
    });
  } catch (err) {
    console.error('Report user error:', err);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 27. GET USER PREFERENCES
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      return res.json({
        ageRangeMin: 18,
        ageRangeMax: 50,
        locationRadius: 50,
        genderPreferences: [],
        relationshipGoals: [],
        interests: [],
        heightRangeMin: null,
        heightRangeMax: null,
        bodyTypes: [],
        showMyProfile: true,
        allowMessages: true,
        notificationsEnabled: true
      });
    }

    const row = result.rows[0];
    res.json({
      ageRangeMin: row.age_range_min ?? 18,
      ageRangeMax: row.age_range_max ?? 50,
      locationRadius: row.location_radius ?? 50,
      genderPreferences: row.gender_preferences || [],
      relationshipGoals: row.relationship_goals || [],
      interests: row.interests || [],
      heightRangeMin: row.height_range_min,
      heightRangeMax: row.height_range_max,
      bodyTypes: row.body_types || [],
      showMyProfile: row.show_my_profile ?? true,
      allowMessages: row.allow_messages ?? true,
      notificationsEnabled: row.notifications_enabled ?? true
    });
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// 28. UPDATE USER PREFERENCES
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      ageRangeMin,
      ageRangeMax,
      locationRadius,
      genderPreferences,
      relationshipGoals,
      interests,
      heightRangeMin,
      heightRangeMax,
      bodyTypes,
      showMyProfile,
      allowMessages,
      notificationsEnabled
    } = req.body;

    const result = await db.query(
      `INSERT INTO user_preferences (
         user_id, age_range_min, age_range_max, location_radius,
         gender_preferences, relationship_goals, interests,
         height_range_min, height_range_max, body_types,
         show_my_profile, allow_messages, notifications_enabled
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (user_id) DO UPDATE
       SET age_range_min = EXCLUDED.age_range_min,
           age_range_max = EXCLUDED.age_range_max,
           location_radius = EXCLUDED.location_radius,
           gender_preferences = EXCLUDED.gender_preferences,
           relationship_goals = EXCLUDED.relationship_goals,
           interests = EXCLUDED.interests,
           height_range_min = EXCLUDED.height_range_min,
           height_range_max = EXCLUDED.height_range_max,
           body_types = EXCLUDED.body_types,
           show_my_profile = EXCLUDED.show_my_profile,
           allow_messages = EXCLUDED.allow_messages,
           notifications_enabled = EXCLUDED.notifications_enabled,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        normalizeInteger(ageRangeMin) ?? 18,
        normalizeInteger(ageRangeMax) ?? 50,
        normalizeInteger(locationRadius) ?? 50,
        Array.isArray(genderPreferences) ? genderPreferences : [],
        Array.isArray(relationshipGoals) ? relationshipGoals : [],
        Array.isArray(interests) ? interests : [],
        normalizeInteger(heightRangeMin),
        normalizeInteger(heightRangeMax),
        Array.isArray(bodyTypes) ? bodyTypes : [],
        normalizeBoolean(showMyProfile),
        normalizeBoolean(allowMessages),
        normalizeBoolean(notificationsEnabled)
      ]
    );


    const row = result.rows[0];
    res.json({
      message: 'Preferences updated',
      preferences: {
        ageRangeMin: row.age_range_min,
        ageRangeMax: row.age_range_max,
        locationRadius: row.location_radius,
        genderPreferences: row.gender_preferences,
        relationshipGoals: row.relationship_goals,
        interests: row.interests,
        heightRangeMin: row.height_range_min,
        heightRangeMax: row.height_range_max,
        bodyTypes: row.body_types,
        showMyProfile: row.show_my_profile,
        allowMessages: row.allow_messages,
        notificationsEnabled: row.notifications_enabled
      }
    });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// 29. SUPERLIKE PROFILE
router.post('/interactions/superlike', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;
    const requestMetadata = getRequestMetadata(req);

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await db.query(
      `SELECT superlikes_used FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
      [fromUserId, today]
    );

    const superlikesUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].superlikes_used || 0) : 0;
    const superlikeLimit = 1;
    if (superlikesUsed >= superlikeLimit) {
      return res.status(429).json({ error: 'Daily superlike limit reached', limit: superlikeLimit, used: superlikesUsed, remaining: 0 });
    }

    await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type) VALUES ($1, $2, 'superlike') ON CONFLICT DO NOTHING`,
      [fromUserId, userId]
    );

    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, superlikes_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET superlikes_used = user_analytics.superlikes_used + 1`,
      [fromUserId, today]
    );

    spamFraudService.trackUserActivity({ userId: fromUserId, action: 'superlike_profile', analyticsUpdates: { superlikes_sent: 1 }, ipAddress: requestMetadata.ipAddress, userAgent: requestMetadata.userAgent, runSpamCheck: true, runFraudCheck: true });

    const mutualResult = await db.query(
      `SELECT * FROM interactions WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type IN ('like', 'superlike')`,
      [userId, fromUserId]
    );

    if (mutualResult.rows.length > 0) {
      const matchResult = await db.query(
        `INSERT INTO matches (user_id_1, user_id_2) VALUES (LEAST($1, $2), GREATEST($1, $2)) ON CONFLICT DO NOTHING RETURNING *`,
        [fromUserId, userId]
      );
      const persistedMatch = matchResult.rows[0] || (await db.query(`SELECT * FROM matches WHERE user_id_1 = LEAST($1, $2) AND user_id_2 = GREATEST($1, $2) LIMIT 1`, [fromUserId, userId])).rows[0];

      if (typeof req.emitToUser === 'function') {
        [fromUserId, userId].forEach((pid) => {
          req.emitToUser(pid, 'new_match', { match: persistedMatch, user: { id: fromUserId }, matchedUserId: pid === fromUserId ? userId : fromUserId, createdAt: new Date().toISOString(), superlike: true });
        });
      }

      await Promise.all([
        userNotificationService.createNotification(fromUserId, { type: 'new_match', title: 'Super Like Match!', body: 'They liked you back! Start chatting now.', metadata: { matchId: persistedMatch.id, matchedUserId: userId } }),
        userNotificationService.createNotification(userId, { type: 'new_match', title: 'Someone Super Liked You!', body: 'You matched with someone who super liked you!', metadata: { matchId: persistedMatch.id, matchedUserId: fromUserId } })
      ]);

      spamFraudService.updateUserAnalytics(fromUserId, { matches_made: 1 });
      spamFraudService.updateUserAnalytics(userId, { matches_made: 1 });
      spamFraudService.refreshSystemMetrics();

      return res.json({ message: 'Super Like Match!', isMatch: true, match: persistedMatch, superlike: true });
    }

    res.json({ message: 'Profile super liked', isMatch: false, superlike: true });
  } catch (err) {
    console.error('Superlike error:', err);
    res.status(500).json({ error: 'Failed to superlike profile' });
  }
});

// 30. GET DAILY LIMITS
router.get('/daily-limits', async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const analyticsResult = await db.query(
      `SELECT likes_used, superlikes_used, rewinds_used
       FROM user_analytics
       WHERE user_id = $1 AND activity_date = $2`,
      [userId, today]
    );

    const likesUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].likes_used || 0) : 0;
    const superlikesUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].superlikes_used || 0) : 0;
    const rewindsUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].rewinds_used || 0) : 0;

    const likeLimit = 50;
    const superlikeLimit = 1;
    const rewindLimit = 3;

    res.json({
      likeLimit, superlikeLimit, rewindLimit, likesUsed, superlikesUsed, rewindsUsed,
      remainingLikes: Math.max(0, likeLimit - likesUsed),
      remainingSuperlikes: Math.max(0, superlikeLimit - superlikesUsed),
      remainingRewinds: Math.max(0, rewindLimit - rewindsUsed),
      resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (err) {
    console.error('Get daily limits error:', err);
    res.status(500).json({ error: 'Failed to get daily limits' });
  }
});

// 31. LIKE PROFILE (with daily limit check)
router.post('/interactions/like', async (req, res) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, targetUserId } = req.body;
    const userId = toUserId || targetUserId;
    const requestMetadata = getRequestMetadata(req);

    if (!userId) {
      return res.status(400).json({ error: 'toUserId or targetUserId required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await db.query(
      `SELECT likes_used FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
      [fromUserId, today]
    );

    const likesUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].likes_used || 0) : 0;
    const likeLimit = 50;
    if (likesUsed >= likeLimit) {
      return res.status(429).json({ error: 'Daily like limit reached', limit: likeLimit, used: likesUsed, remaining: 0 });
    }

    await db.query(
      `INSERT INTO interactions (from_user_id, to_user_id, interaction_type) VALUES ($1, $2, 'like') ON CONFLICT DO NOTHING`,
      [fromUserId, userId]
    );

    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, likes_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET likes_used = user_analytics.likes_used + 1`,
      [fromUserId, today]
    );

    spamFraudService.trackUserActivity({ userId: fromUserId, action: 'like_profile', analyticsUpdates: { likes_sent: 1 }, ipAddress: requestMetadata.ipAddress, userAgent: requestMetadata.userAgent, runSpamCheck: true, runFraudCheck: true });

    const mutualResult = await db.query(
      `SELECT * FROM interactions WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type IN ('like', 'superlike')`,
      [userId, fromUserId]
    );

    if (mutualResult.rows.length > 0) {
      const matchResult = await db.query(
        `INSERT INTO matches (user_id_1, user_id_2) VALUES (LEAST($1, $2), GREATEST($1, $2)) ON CONFLICT DO NOTHING RETURNING *`,
        [fromUserId, userId]
      );
      const persistedMatch = matchResult.rows[0] || (await db.query(`SELECT * FROM matches WHERE user_id_1 = LEAST($1, $2) AND user_id_2 = GREATEST($1, $2) LIMIT 1`, [fromUserId, userId])).rows[0];

      if (typeof req.emitToUser === 'function') {
        [fromUserId, userId].forEach((pid) => {
          req.emitToUser(pid, 'new_match', { match: persistedMatch, user: { id: fromUserId }, matchedUserId: pid === fromUserId ? userId : fromUserId, createdAt: new Date().toISOString() });
        });
      }

      await Promise.all([
        userNotificationService.createNotification(fromUserId, { type: 'new_match', title: 'You have a new match', body: 'Someone liked you back. Open the chat to say hello.', metadata: { matchId: persistedMatch.id, matchedUserId: userId } }),
        userNotificationService.createNotification(userId, { type: 'new_match', title: 'It is a match', body: 'You matched with someone new. Start the conversation when you are ready.', metadata: { matchId: persistedMatch.id, matchedUserId: fromUserId } })
      ]);

      spamFraudService.updateUserAnalytics(fromUserId, { matches_made: 1 });
      spamFraudService.updateUserAnalytics(userId, { matches_made: 1 });
      spamFraudService.refreshSystemMetrics();

      return res.json({ message: 'Its a match!', isMatch: true, match: persistedMatch });
    }

    res.json({ message: 'Profile liked', isMatch: false });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like profile' });
  }
});

// 32. GET TOP PICKS (Most Compatible Profiles)
router.get('/top-picks', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

    // Get current user's profile and preferences
    const currentProfileResult = await db.query(
      `SELECT dp.*, up.gender_preferences, up.age_range_min, up.age_range_max, up.location_radius,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       LEFT JOIN user_preferences up ON up.user_id = dp.user_id
       WHERE dp.user_id = $1
       LIMIT 1`,
      [userId]
    );
    const currentProfile = normalizeProfileRow(currentProfileResult.rows[0] || null);

    if (!currentProfile) {
      return res.status(404).json({ error: 'Profile not found. Complete your profile first.' });
    }

    // Get candidates excluding already interacted users
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
       ORDER BY dp.updated_at DESC
       LIMIT 100`,
      [userId]
    );

    // Score and rank profiles
    const scoredProfiles = result.rows
      .map((profileRow) => {
        const normalizedProfile = normalizeProfileRow(profileRow);
        const compatibility = buildCompatibilitySuggestion(currentProfile, normalizedProfile);

        return {
          ...normalizedProfile,
          ...compatibility,
          topPickScore: compatibility.compatibilityScore
        };
      })
      .sort((leftProfile, rightProfile) => rightProfile.topPickScore - leftProfile.topPickScore)
      .slice(0, limit);

    // Record analytics
    const requestMetadata = getRequestMetadata(req);
    spamFraudService.trackUserActivity({
      userId,
      action: 'top_picks_view',
      analyticsUpdates: {},
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    res.json({
      profiles: scoredProfiles,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (err) {
    console.error('Top picks error:', err);
    res.status(500).json({ error: 'Failed to get top picks' });
  }
});

// 33. REWIND PASS (Undo last pass)
router.post('/interactions/rewind', async (req, res) => {
  try {
    const userId = req.user.id;
    const requestMetadata = getRequestMetadata(req);

    // Check daily rewind limit
    const today = new Date().toISOString().split('T')[0];
    const analyticsResult = await db.query(
      `SELECT rewinds_used FROM user_analytics WHERE user_id = $1 AND activity_date = $2`,
      [userId, today]
    );

    const rewindsUsed = analyticsResult.rows.length > 0 ? (analyticsResult.rows[0].rewinds_used || 0) : 0;
    const rewindLimit = 3; // Free tier: 3/day

    if (rewindsUsed >= rewindLimit) {
      return res.status(429).json({
        error: 'Daily rewind limit reached',
        limit: rewindLimit,
        used: rewindsUsed,
        remaining: 0
      });
    }

    // Find most recent pass interaction
    const passResult = await db.query(
      `SELECT * FROM interactions
       WHERE from_user_id = $1 AND interaction_type = 'pass'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (passResult.rows.length === 0) {
      return res.status(404).json({ error: 'No passes to rewind' });
    }

    const lastPass = passResult.rows[0];

    // Delete the pass interaction
    await db.query(
      `DELETE FROM interactions
       WHERE from_user_id = $1 AND to_user_id = $2 AND interaction_type = 'pass'`,
      [userId, lastPass.to_user_id]
    );

    // Update rewind count
    await db.query(
      `INSERT INTO user_analytics (user_id, activity_date, rewinds_used)
       VALUES ($1, $2, 1)
       ON CONFLICT (user_id, activity_date) DO UPDATE
       SET rewinds_used = user_analytics.rewinds_used + 1`,
      [userId, today]
    );

    spamFraudService.trackUserActivity({
      userId,
      action: 'rewind_pass',
      analyticsUpdates: { rewinds_used: 1 },
      ipAddress: requestMetadata.ipAddress,
      userAgent: requestMetadata.userAgent,
      runSpamCheck: true,
      runFraudCheck: true
    });

    // Get the restored profile
    const restoredProfileResult = await db.query(
      `SELECT dp.*,
              (SELECT json_agg(json_build_object('id', id, 'photo_url', photo_url, 'position', position) ORDER BY position)
               FROM profile_photos WHERE user_id = dp.user_id) as photos
       FROM dating_profiles dp
       WHERE dp.user_id = $1`,
      [lastPass.to_user_id]
    );

    res.json({
      message: 'Pass rewound successfully',
      restoredProfile: normalizeProfileRow(restoredProfileResult.rows[0] || null),
      rewindsUsed: rewindsUsed + 1,
      rewindsRemaining: Math.max(0, rewindLimit - (rewindsUsed + 1))
    });
  } catch (err) {
    console.error('Rewind error:', err);
    res.status(500).json({ error: 'Failed to rewind pass' });
  }
});

// 34. GET DAILY PROMPTS
const DAILY_PROMPTS = [
  {
    id: 'prompt-1',
    category: 'personality',
    text: 'What is something you are passionate about that most people do not know?',
    icon: '💭'
  },
  {
    id: 'prompt-2',
    category: 'lifestyle',
    text: 'My perfect Sunday looks like...',
    icon: '☀️'
  },
  {
    id: 'prompt-3',
    category: 'goals',
    text: 'A goal I am currently working towards...',
    icon: '🎯'
  },
  {
    id: 'prompt-4',
    category: 'fun',
    text: 'Two truths and a lie about me...',
    icon: '🎲'
  },
  {
    id: 'prompt-5',
    category: 'personality',
    text: 'The way to my heart is...',
    icon: '❤️'
  },
  {
    id: 'prompt-6',
    category: 'lifestyle',
    text: 'My ideal travel destination and why...',
    icon: '✈️'
  },
  {
    id: 'prompt-7',
    category: 'preferences',
    text: 'I am looking for someone who...',
    icon: '🔍'
  },
  {
    id: 'prompt-8',
    category: 'fun',
    text: 'My most controversial opinion is...',
    icon: '🔥'
  },
  {
    id: 'prompt-9',
    category: 'personality',
    text: 'A book or movie that changed my perspective...',
    icon: '📚'
  },
  {
    id: 'prompt-10',
    category: 'lifestyle',
    text: 'My happy place is...',
    icon: '🏖️'
  }
];

router.get('/daily-prompts', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's answered prompts
    const answeredResult = await db.query(
      `SELECT prompt_id, response FROM daily_prompt_responses WHERE user_id = $1`,
      [userId]
    );

    const answeredPromptIds = new Set(answeredResult.rows.map(row => row.prompt_id));

    // Return prompts with answered status
    const prompts = DAILY_PROMPTS.map(prompt => ({
      ...prompt,
      isAnswered: answeredPromptIds.has(prompt.id),
      response: answeredResult.rows.find(row => row.prompt_id === prompt.id)?.response || null
    }));

    res.json({ prompts });
  } catch (err) {
    console.error('Get daily prompts error:', err);
    res.status(500).json({ error: 'Failed to get daily prompts' });
  }
});

// 35. ANSWER DAILY PROMPT
router.post('/daily-prompts/:promptId/answer', async (req, res) => {
  try {
    const userId = req.user.id;
    const { promptId } = req.params;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return res.status(400).json({ error: 'Response is required' });
    }

    if (response.trim().length > 500) {
      return res.status(400).json({ error: 'Response must be 500 characters or less' });
    }

    const prompt = DAILY_PROMPTS.find(p => p.id === promptId);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    await db.query(
      `INSERT INTO daily_prompt_responses (user_id, prompt_id, response)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, prompt_id) DO UPDATE
       SET response = EXCLUDED.response,
           updated_at = CURRENT_TIMESTAMP`,
      [userId, promptId, response.trim()]
    );

    res.json({
      message: 'Prompt answered',
      prompt: {
        ...prompt,
        isAnswered: true,
        response: response.trim()
      }
    });
  } catch (err) {
    console.error('Answer prompt error:', err);
    res.status(500).json({ error: 'Failed to answer prompt' });
  }
});

// 36. DELETE DAILY PROMPT ANSWER
router.delete('/daily-prompts/:promptId/answer', async (req, res) => {
  try {
    const userId = req.user.id;
    const { promptId } = req.params;

    await db.query(
      `DELETE FROM daily_prompt_responses WHERE user_id = $1 AND prompt_id = $2`,
      [userId, promptId]
    );

    res.json({ message: 'Prompt answer removed' });
  } catch (err) {
    console.error('Delete prompt answer error:', err);
    res.status(500).json({ error: 'Failed to remove prompt answer' });
  }
});

// 37. GET USER ANSWERED PROMPTS (for profile display)
router.get('/profiles/me/prompts', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT dpr.prompt_id, dpr.response, dpr.created_at
       FROM daily_prompt_responses dpr
       WHERE dpr.user_id = $1
       ORDER BY dpr.created_at DESC`,
      [userId]
    );

    const answeredPrompts = result.rows.map(row => {
      const prompt = DAILY_PROMPTS.find(p => p.id === row.prompt_id);
      return {
        ...prompt,
        response: row.response,
        answeredAt: row.created_at
      };
    }).filter(Boolean);

    res.json({ prompts: answeredPrompts });
  } catch (err) {
    console.error('Get profile prompts error:', err);
    res.status(500).json({ error: 'Failed to get profile prompts' });
  }
});

// 38. UPDATE NOTIFICATION PREFERENCES
router.put('/notification-preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      newMatch,
      newMessage,
      likeReceived,
      superlikeReceived,
      profileViewed,
      dailyDigest,
      weeklyDigest,
      pushEnabled,
      emailEnabled
    } = req.body;

    const result = await db.query(
      `INSERT INTO notification_preferences (
         user_id,
         new_match,
         new_message,
         like_received,
         superlike_received,
         profile_viewed,
         daily_digest,
         weekly_digest,
         push_enabled,
         email_enabled
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id) DO UPDATE
       SET new_match = EXCLUDED.new_match,
           new_message = EXCLUDED.new_message,
           like_received = EXCLUDED.like_received,
           superlike_received = EXCLUDED.superlike_received,
           profile_viewed = EXCLUDED.profile_viewed,
           daily_digest = EXCLUDED.daily_digest,
           weekly_digest = EXCLUDED.weekly_digest,
           push_enabled = EXCLUDED.push_enabled,
           email_enabled = EXCLUDED.email_enabled,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        userId,
        normalizeBoolean(newMatch),
        normalizeBoolean(newMessage),
        normalizeBoolean(likeReceived),
        normalizeBoolean(superlikeReceived),
        normalizeBoolean(profileViewed),
        normalizeBoolean(dailyDigest),
        normalizeBoolean(weeklyDigest),
        normalizeBoolean(pushEnabled),
        normalizeBoolean(emailEnabled)
      ]
    );

    const row = result.rows[0];
    res.json({
      message: 'Notification preferences updated',
      preferences: {
        newMatch: row.new_match,
        newMessage: row.new_message,
        likeReceived: row.like_received,
        superlikeReceived: row.superlike_received,
        profileViewed: row.profile_viewed,
        dailyDigest: row.daily_digest,
        weeklyDigest: row.weekly_digest,
        pushEnabled: row.push_enabled,
        emailEnabled: row.email_enabled
      }
    });
  } catch (err) {
    console.error('Update notification preferences error:', err);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// 39. GET NOTIFICATION PREFERENCES
router.get('/notification-preferences', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        newMatch: true,
        newMessage: true,
        likeReceived: true,
        superlikeReceived: true,
        profileViewed: false,
        dailyDigest: false,
        weeklyDigest: true,
        pushEnabled: true,
        emailEnabled: false
      });
    }

    const row = result.rows[0];
    res.json({
      newMatch: row.new_match,
      newMessage: row.new_message,
      likeReceived: row.like_received,
      superlikeReceived: row.superlike_received,
      profileViewed: row.profile_viewed,
      dailyDigest: row.daily_digest,
      weeklyDigest: row.weekly_digest,
      pushEnabled: row.push_enabled,
      emailEnabled: row.email_enabled
    });
  } catch (err) {
    console.error('Get notification preferences error:', err);
    res.status(500).json({ error: 'Failed to get notification preferences' });
  }
});

module.exports = router;
