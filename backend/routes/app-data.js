const express = require('express');
const router = express.Router();
const db = require('../config/database');

const DEFAULT_PUBLIC_LIMIT = 24;
let schemaInitPromise = null;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const firstProvided = (source, aliases = []) => {
  for (const alias of aliases) {
    if (hasOwn(source, alias)) {
      return { provided: true, value: source[alias] };
    }
  }

  return { provided: false, value: undefined };
};

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const normalizeBoolean = (value, fallbackValue = false) => {
  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }

  return fallbackValue;
};

const normalizeInteger = (value, fallbackValue = null) => {
  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
};

const normalizeDecimal = (value, fallbackValue = null) => {
  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallbackValue;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return fallbackValue;
  }

  if (!/^-?\d+(?:[.,]\d+)?$/.test(normalized.replace(/,/g, ''))) {
    return fallbackValue;
  }

  const parsed = Number.parseFloat(normalized.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallbackValue;
};

const normalizeAmount = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (!/^\d+(?:[.,]\d+)?$/.test(normalized.replace(/,/g, ''))) {
    return null;
  }

  const parsed = Number.parseFloat(normalized.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDateOnly = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

const normalizeJsonObject = (value) => {
  if (value === undefined || value === null || value === '') {
    return {};
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return {};
    }
  }

  return {};
};

const normalizeStringArray = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeOptionalText(entry)).filter(Boolean);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return [];
    }

    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => normalizeOptionalText(entry)).filter(Boolean);
      }
    } catch (error) {
      return normalized
        .split(',')
        .map((entry) => normalizeOptionalText(entry))
        .filter(Boolean);
    }
  }

  return [];
};

const normalizeAreaSqft = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const digitsOnly = normalized.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!digitsOnly) {
    return null;
  }

  const parsed = Number.parseFloat(digitsOnly[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const toJsonb = (value) => JSON.stringify(value ?? {});

const toCount = (value) => Number.parseInt(value, 10) || 0;

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPagination = (query, defaultLimit = 20, maxLimit = 100) => {
  const limit = Math.max(1, Math.min(normalizeInteger(query.limit, defaultLimit) || defaultLimit, maxLimit));
  const offset = Math.max(0, normalizeInteger(query.offset, 0) || 0);

  return { limit, offset };
};

const getListingImages = (source, arrayAliases, singleAliases = []) => {
  const arrayCandidate = firstProvided(source, arrayAliases);
  if (arrayCandidate.provided) {
    return normalizeStringArray(arrayCandidate.value);
  }

  const singleCandidate = firstProvided(source, singleAliases);
  if (!singleCandidate.provided) {
    return undefined;
  }

  const normalized = normalizeOptionalText(singleCandidate.value);
  return normalized ? [normalized] : [];
};

const serializeClassifiedsListing = (row) => {
  const images = Array.isArray(row.images) ? row.images : [];
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const priceAmount = toNumber(row.price_amount);
  const averageRating = row.average_rating === undefined ? null : toNumber(row.average_rating);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    price: priceAmount,
    price_amount: priceAmount,
    currency: row.currency,
    condition_label: row.condition_label,
    location: [row.location_city, row.location_district].filter(Boolean).join(', ') || null,
    location_city: row.location_city,
    location_district: row.location_district,
    seller: row.seller_name || row.seller_email || null,
    seller_name: row.seller_name,
    seller_email: row.seller_email,
    seller_phone: row.seller_phone,
    image: images[0] || null,
    images,
    tags,
    negotiable: Boolean(row.negotiable),
    status: row.status,
    moderation_status: row.moderation_status,
    moderation_notes: row.moderation_notes,
    featured: Boolean(row.featured),
    metadata: row.metadata || {},
    average_rating: averageRating,
    review_count: toCount(row.review_count),
    message_count: toCount(row.message_count),
    report_count: toCount(row.report_count),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
};

const serializeRealEstateListing = (row) => {
  const photos = Array.isArray(row.photos) ? row.photos : [];
  const amenities = Array.isArray(row.amenities) ? row.amenities : [];
  const priceAmount = toNumber(row.price_amount);
  const areaSqft = toNumber(row.area_sqft);
  const averageRating = row.average_rating === undefined ? null : toNumber(row.average_rating);

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    listing_type: row.listing_type,
    property_type: row.property_type,
    price: row.price_label || priceAmount,
    price_amount: priceAmount,
    price_label: row.price_label,
    currency: row.currency,
    area: areaSqft ? `${areaSqft} sqft` : null,
    area_sqft: areaSqft,
    location: [row.locality, row.city, row.district].filter(Boolean).join(', ') || null,
    address: row.address,
    city: row.city,
    district: row.district,
    locality: row.locality,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    type: row.property_type,
    bedrooms: row.bedrooms,
    bathrooms: toNumber(row.bathrooms),
    furnishing_status: row.furnishing_status,
    availability_date: row.availability_date,
    image: photos[0] || null,
    photos,
    amenities,
    seller_name: row.seller_name,
    seller_email: row.seller_email,
    seller_phone: row.seller_phone,
    status: row.status,
    moderation_status: row.moderation_status,
    moderation_notes: row.moderation_notes,
    featured: Boolean(row.featured),
    metadata: row.metadata || {},
    average_rating: averageRating,
    review_count: toCount(row.review_count),
    enquiry_count: toCount(row.enquiry_count),
    message_count: toCount(row.message_count),
    report_count: toCount(row.report_count),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
};

const buildClassifiedsPayload = (body, { partial = false } = {}) => {
  const payload = {};
  const setIfProvided = (targetKey, aliases, normalizer) => {
    const candidate = firstProvided(body, aliases);

    if (!partial || candidate.provided) {
      payload[targetKey] = normalizer(candidate.value);
    }
  };

  setIfProvided('title', ['title'], normalizeOptionalText);
  setIfProvided('description', ['description'], normalizeOptionalText);
  setIfProvided('category', ['category'], (value) => normalizeOptionalText(value) || 'General');
  setIfProvided('price_amount', ['price_amount', 'price'], normalizeAmount);
  setIfProvided('currency', ['currency'], (value) => normalizeOptionalText(value) || 'INR');
  setIfProvided('condition_label', ['condition_label', 'condition'], normalizeOptionalText);
  setIfProvided('location_city', ['location_city', 'location', 'city'], normalizeOptionalText);
  setIfProvided('location_district', ['location_district', 'district'], normalizeOptionalText);
  setIfProvided('seller_name', ['seller_name', 'sellerName', 'seller'], normalizeOptionalText);
  setIfProvided('seller_email', ['seller_email', 'sellerEmail', 'email'], normalizeOptionalText);
  setIfProvided('seller_phone', ['seller_phone', 'sellerPhone', 'phone'], normalizeOptionalText);
  setIfProvided('tags', ['tags'], normalizeStringArray);
  setIfProvided('negotiable', ['negotiable'], (value) => normalizeBoolean(value, false));
  setIfProvided('status', ['status'], (value) => normalizeOptionalText(value) || 'active');
  setIfProvided('moderation_status', ['moderation_status', 'moderationStatus'], (value) => normalizeOptionalText(value) || 'pending');
  setIfProvided('moderation_notes', ['moderation_notes', 'moderationNotes'], normalizeOptionalText);
  setIfProvided('featured', ['featured'], (value) => normalizeBoolean(value, false));
  setIfProvided('metadata', ['metadata'], normalizeJsonObject);

  const images = getListingImages(body, ['images'], ['image']);
  if (!partial || images !== undefined) {
    payload.images = images || [];
  }

  return payload;
};

const buildRealEstatePayload = (body, { partial = false } = {}) => {
  const payload = {};
  const setIfProvided = (targetKey, aliases, normalizer) => {
    const candidate = firstProvided(body, aliases);

    if (!partial || candidate.provided) {
      payload[targetKey] = normalizer(candidate.value);
    }
  };

  setIfProvided('title', ['title'], normalizeOptionalText);
  setIfProvided('description', ['description'], normalizeOptionalText);
  setIfProvided('listing_type', ['listing_type', 'listingType'], (value) => normalizeOptionalText(value) || 'sale');
  setIfProvided('property_type', ['property_type', 'propertyType', 'type'], (value) => normalizeOptionalText(value) || 'Apartment');
  setIfProvided('price_amount', ['price_amount'], normalizeAmount);
  setIfProvided('price_label', ['price_label'], normalizeOptionalText);
  setIfProvided('currency', ['currency'], (value) => normalizeOptionalText(value) || 'INR');
  setIfProvided('area_sqft', ['area_sqft', 'area'], normalizeAreaSqft);
  setIfProvided('bedrooms', ['bedrooms'], normalizeInteger);
  setIfProvided('bathrooms', ['bathrooms'], normalizeDecimal);
  setIfProvided('furnishing_status', ['furnishing_status', 'furnishingStatus'], normalizeOptionalText);
  setIfProvided('address', ['address'], normalizeOptionalText);
  setIfProvided('city', ['city', 'location'], normalizeOptionalText);
  setIfProvided('district', ['district'], normalizeOptionalText);
  setIfProvided('locality', ['locality'], normalizeOptionalText);
  setIfProvided('latitude', ['latitude', 'location_latitude'], normalizeDecimal);
  setIfProvided('longitude', ['longitude', 'location_longitude'], normalizeDecimal);
  setIfProvided('seller_name', ['seller_name', 'sellerName', 'seller'], normalizeOptionalText);
  setIfProvided('seller_email', ['seller_email', 'sellerEmail', 'email'], normalizeOptionalText);
  setIfProvided('seller_phone', ['seller_phone', 'sellerPhone', 'phone'], normalizeOptionalText);
  setIfProvided('amenities', ['amenities'], normalizeStringArray);
  setIfProvided('availability_date', ['availability_date', 'availabilityDate'], normalizeDateOnly);
  setIfProvided('status', ['status'], (value) => normalizeOptionalText(value) || 'active');
  setIfProvided('moderation_status', ['moderation_status', 'moderationStatus'], (value) => normalizeOptionalText(value) || 'pending');
  setIfProvided('moderation_notes', ['moderation_notes', 'moderationNotes'], normalizeOptionalText);
  setIfProvided('featured', ['featured'], (value) => normalizeBoolean(value, false));
  setIfProvided('metadata', ['metadata'], normalizeJsonObject);

  const rawPrice = firstProvided(body, ['price']);
  if ((!partial || rawPrice.provided) && payload.price_amount == null && !payload.price_label) {
    payload.price_label = normalizeOptionalText(rawPrice.value);
  }

  const photos = getListingImages(body, ['photos'], ['image']);
  if (!partial || photos !== undefined) {
    payload.photos = photos || [];
  }

  return payload;
};

const applyUpdates = async (tableName, id, payload, jsonbFields = []) => {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return null;
  }

  const assignments = [];
  const values = [];

  entries.forEach(([key, value]) => {
    values.push(jsonbFields.includes(key) ? toJsonb(value) : value);
    const paramIndex = values.length;
    assignments.push(`${key} = $${paramIndex}${jsonbFields.includes(key) ? '::jsonb' : ''}`);
  });

  values.push(id);

  const result = await db.query(
    `UPDATE ${tableName}
     SET ${assignments.join(', ')},
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $${values.length}
       AND deleted_at IS NULL
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
};

const fetchClassifiedsListingById = async (listingId) => {
  const result = await db.query(
    `SELECT l.*,
            COALESCE(reviews.review_count, 0)::int AS review_count,
            reviews.average_rating,
            COALESCE(messages.message_count, 0)::int AS message_count,
            COALESCE(reports.report_count, 0)::int AS report_count
     FROM classifieds_listings l
     LEFT JOIN (
       SELECT listing_id,
              COUNT(*)::int AS review_count,
              ROUND(AVG(rating)::numeric, 2) AS average_rating
       FROM classifieds_reviews
       GROUP BY listing_id
     ) reviews ON reviews.listing_id = l.id
     LEFT JOIN (
       SELECT listing_id, COUNT(*)::int AS message_count
       FROM classifieds_messages
       GROUP BY listing_id
     ) messages ON messages.listing_id = l.id
     LEFT JOIN (
       SELECT listing_id, COUNT(*)::int AS report_count
       FROM classifieds_reports
       GROUP BY listing_id
     ) reports ON reports.listing_id = l.id
     WHERE l.id = $1
       AND l.deleted_at IS NULL
     LIMIT 1`,
    [listingId]
  );

  return result.rows[0] || null;
};

const fetchRealEstateListingById = async (listingId) => {
  const result = await db.query(
    `SELECT l.*,
            COALESCE(reviews.review_count, 0)::int AS review_count,
            reviews.average_rating,
            COALESCE(enquiries.enquiry_count, 0)::int AS enquiry_count,
            COALESCE(messages.message_count, 0)::int AS message_count,
            COALESCE(reports.report_count, 0)::int AS report_count
     FROM realestate_listings l
     LEFT JOIN (
       SELECT listing_id,
              COUNT(*)::int AS review_count,
              ROUND(AVG(rating)::numeric, 2) AS average_rating
       FROM realestate_reviews
       GROUP BY listing_id
     ) reviews ON reviews.listing_id = l.id
     LEFT JOIN (
       SELECT listing_id, COUNT(*)::int AS enquiry_count
       FROM realestate_enquiries
       GROUP BY listing_id
     ) enquiries ON enquiries.listing_id = l.id
     LEFT JOIN (
       SELECT listing_id, COUNT(*)::int AS message_count
       FROM realestate_messages
       GROUP BY listing_id
     ) messages ON messages.listing_id = l.id
     LEFT JOIN (
       SELECT listing_id, COUNT(*)::int AS report_count
       FROM realestate_reports
       GROUP BY listing_id
     ) reports ON reports.listing_id = l.id
     WHERE l.id = $1
       AND l.deleted_at IS NULL
     LIMIT 1`,
    [listingId]
  );

  return result.rows[0] || null;
};

const ensureAppDataSchema = async () => {
  if (!schemaInitPromise) {
    schemaInitPromise = db.query(`
      CREATE TABLE IF NOT EXISTS classifieds_listings (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        price_amount NUMERIC(12, 2),
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        condition_label VARCHAR(80),
        location_city VARCHAR(120),
        location_district VARCHAR(120),
        seller_name VARCHAR(150),
        seller_email VARCHAR(255),
        seller_phone VARCHAR(30),
        images JSONB NOT NULL DEFAULT '[]'::jsonb,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        negotiable BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(40) NOT NULL DEFAULT 'active',
        moderation_status VARCHAR(40) NOT NULL DEFAULT 'pending',
        moderation_notes TEXT,
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS classifieds_messages (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES classifieds_listings(id) ON DELETE CASCADE,
        sender_name VARCHAR(150),
        sender_email VARCHAR(255),
        sender_phone VARCHAR(30),
        message TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS classifieds_reports (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES classifieds_listings(id) ON DELETE CASCADE,
        reporter_name VARCHAR(150),
        reporter_email VARCHAR(255),
        reason VARCHAR(120),
        description TEXT,
        status VARCHAR(40) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS classifieds_reviews (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES classifieds_listings(id) ON DELETE CASCADE,
        reviewer_name VARCHAR(150),
        reviewer_email VARCHAR(255),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS realestate_listings (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        listing_type VARCHAR(40) NOT NULL DEFAULT 'sale',
        property_type VARCHAR(80) NOT NULL DEFAULT 'Apartment',
        price_amount NUMERIC(14, 2),
        price_label VARCHAR(120),
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        area_sqft NUMERIC(12, 2),
        bedrooms INTEGER,
        bathrooms NUMERIC(4, 1),
        furnishing_status VARCHAR(80),
        address TEXT,
        city VARCHAR(120),
        district VARCHAR(120),
        locality VARCHAR(120),
        latitude NUMERIC(10, 8),
        longitude NUMERIC(11, 8),
        seller_name VARCHAR(150),
        seller_email VARCHAR(255),
        seller_phone VARCHAR(30),
        amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
        photos JSONB NOT NULL DEFAULT '[]'::jsonb,
        availability_date DATE,
        status VARCHAR(40) NOT NULL DEFAULT 'active',
        moderation_status VARCHAR(40) NOT NULL DEFAULT 'pending',
        moderation_notes TEXT,
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS realestate_enquiries (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES realestate_listings(id) ON DELETE CASCADE,
        sender_name VARCHAR(150),
        sender_email VARCHAR(255),
        sender_phone VARCHAR(30),
        message TEXT NOT NULL,
        budget NUMERIC(14, 2),
        preferred_visit_date DATE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS realestate_messages (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES realestate_listings(id) ON DELETE CASCADE,
        sender_name VARCHAR(150),
        sender_email VARCHAR(255),
        sender_phone VARCHAR(30),
        message TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS realestate_reports (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES realestate_listings(id) ON DELETE CASCADE,
        reporter_name VARCHAR(150),
        reporter_email VARCHAR(255),
        reason VARCHAR(120),
        description TEXT,
        status VARCHAR(40) NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS realestate_reviews (
        id SERIAL PRIMARY KEY,
        listing_id INTEGER NOT NULL REFERENCES realestate_listings(id) ON DELETE CASCADE,
        reviewer_name VARCHAR(150),
        reviewer_email VARCHAR(255),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        review TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_classifieds_listings_category
      ON classifieds_listings(category);

      CREATE INDEX IF NOT EXISTS idx_classifieds_listings_seller_email
      ON classifieds_listings(seller_email);

      CREATE INDEX IF NOT EXISTS idx_classifieds_listings_moderation_status
      ON classifieds_listings(moderation_status);

      CREATE INDEX IF NOT EXISTS idx_classifieds_messages_listing_id
      ON classifieds_messages(listing_id);

      CREATE INDEX IF NOT EXISTS idx_classifieds_reports_listing_id
      ON classifieds_reports(listing_id);

      CREATE INDEX IF NOT EXISTS idx_classifieds_reviews_listing_id
      ON classifieds_reviews(listing_id);

      CREATE INDEX IF NOT EXISTS idx_realestate_listings_listing_type
      ON realestate_listings(listing_type);

      CREATE INDEX IF NOT EXISTS idx_realestate_listings_property_type
      ON realestate_listings(property_type);

      CREATE INDEX IF NOT EXISTS idx_realestate_listings_seller_email
      ON realestate_listings(seller_email);

      CREATE INDEX IF NOT EXISTS idx_realestate_listings_moderation_status
      ON realestate_listings(moderation_status);

      CREATE INDEX IF NOT EXISTS idx_realestate_enquiries_listing_id
      ON realestate_enquiries(listing_id);

      CREATE INDEX IF NOT EXISTS idx_realestate_messages_listing_id
      ON realestate_messages(listing_id);

      CREATE INDEX IF NOT EXISTS idx_realestate_reports_listing_id
      ON realestate_reports(listing_id);

      CREATE INDEX IF NOT EXISTS idx_realestate_reviews_listing_id
      ON realestate_reviews(listing_id);
    `).catch((error) => {
      schemaInitPromise = null;
      throw error;
    });
  }

  await schemaInitPromise;
};

// GET PUBLIC APP DATA
router.get('/public', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const { limit } = buildPagination({ limit: req.query.limit, offset: 0 }, DEFAULT_PUBLIC_LIMIT, 100);

    const [
      classifiedsResult,
      realEstateResult,
      classifiedsCategoriesResult,
      realEstateCategoriesResult,
      realEstateAmenitiesResult,
      classifiedsStatsResult,
      realEstateStatsResult
    ] = await Promise.all([
      db.query(
        `SELECT l.*,
                COALESCE(reviews.review_count, 0)::int AS review_count,
                reviews.average_rating
         FROM classifieds_listings l
         LEFT JOIN (
           SELECT listing_id,
                  COUNT(*)::int AS review_count,
                  ROUND(AVG(rating)::numeric, 2) AS average_rating
           FROM classifieds_reviews
           GROUP BY listing_id
         ) reviews ON reviews.listing_id = l.id
         WHERE l.deleted_at IS NULL
           AND l.status = 'active'
           AND l.moderation_status IN ('approved', 'pending')
         ORDER BY l.featured DESC, l.created_at DESC, l.id DESC
         LIMIT $1`,
        [limit]
      ),
      db.query(
        `SELECT l.*,
                COALESCE(reviews.review_count, 0)::int AS review_count,
                reviews.average_rating
         FROM realestate_listings l
         LEFT JOIN (
           SELECT listing_id,
                  COUNT(*)::int AS review_count,
                  ROUND(AVG(rating)::numeric, 2) AS average_rating
           FROM realestate_reviews
           GROUP BY listing_id
         ) reviews ON reviews.listing_id = l.id
         WHERE l.deleted_at IS NULL
           AND l.status = 'active'
           AND l.moderation_status IN ('approved', 'pending')
         ORDER BY l.featured DESC, l.created_at DESC, l.id DESC
         LIMIT $1`,
        [limit]
      ),
      db.query(
        `SELECT category, COUNT(*)::int AS listing_count
         FROM classifieds_listings
         WHERE deleted_at IS NULL
           AND status = 'active'
         GROUP BY category
         ORDER BY listing_count DESC, category ASC`
      ),
      db.query(
        `SELECT property_type AS category, COUNT(*)::int AS listing_count
         FROM realestate_listings
         WHERE deleted_at IS NULL
           AND status = 'active'
         GROUP BY property_type
         ORDER BY listing_count DESC, category ASC`
      ),
      db.query(
        `SELECT DISTINCT amenity
         FROM (
           SELECT jsonb_array_elements_text(amenities) AS amenity
           FROM realestate_listings
           WHERE deleted_at IS NULL
             AND jsonb_typeof(amenities) = 'array'
         ) amenities
         WHERE amenity IS NOT NULL
           AND amenity <> ''
         ORDER BY amenity ASC`
      ),
      db.query(
        `SELECT COUNT(*)::int AS total_listings,
                COALESCE(SUM(CASE WHEN featured THEN 1 ELSE 0 END), 0)::int AS featured_listings,
                COALESCE((SELECT COUNT(*) FROM classifieds_messages), 0)::int AS total_messages,
                COALESCE((SELECT COUNT(*) FROM classifieds_reports), 0)::int AS total_reports
         FROM classifieds_listings
         WHERE deleted_at IS NULL`
      ),
      db.query(
        `SELECT COUNT(*)::int AS total_listings,
                COALESCE(SUM(CASE WHEN featured THEN 1 ELSE 0 END), 0)::int AS featured_listings,
                COALESCE((SELECT COUNT(*) FROM realestate_enquiries), 0)::int AS total_enquiries,
                COALESCE((SELECT COUNT(*) FROM realestate_messages), 0)::int AS total_messages,
                COALESCE((SELECT COUNT(*) FROM realestate_reports), 0)::int AS total_reports
         FROM realestate_listings
         WHERE deleted_at IS NULL`
      )
    ]);

    res.json({
      success: true,
      data: {
        moduleData: {
          ecommerceProducts: [],
          classifiedsListings: classifiedsResult.rows.map(serializeClassifiedsListing),
          classifiedsMessages: [],
          classifiedsReports: [],
          realestateProperties: realEstateResult.rows.map(serializeRealEstateListing),
          restaurants: [],
          services: [],
          classifiedsCategories: classifiedsCategoriesResult.rows.map((row) => ({
            name: row.category,
            listing_count: toCount(row.listing_count)
          })),
          realestateCategories: realEstateCategoriesResult.rows.map((row) => ({
            name: row.category,
            listing_count: toCount(row.listing_count)
          })),
          realestateAmenities: realEstateAmenitiesResult.rows.map((row) => row.amenity),
          restaurantCategories: [],
          serviceCategories: [],
          settings: {
            launchMarket: 'Kerala',
            liveModules: ['classifieds', 'realestate', 'events'],
            generatedAt: new Date().toISOString(),
            classifieds: classifiedsStatsResult.rows[0] || {
              total_listings: 0,
              featured_listings: 0,
              total_messages: 0,
              total_reports: 0
            },
            realestate: realEstateStatsResult.rows[0] || {
              total_listings: 0,
              featured_listings: 0,
              total_enquiries: 0,
              total_messages: 0,
              total_reports: 0
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Get public app data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load public app data'
    });
  }
});

// CLASSIFIEDS ENDPOINTS
router.post('/classifieds/listings', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const payload = buildClassifiedsPayload(req.body);
    if (!payload.title) {
      return res.status(400).json({
        success: false,
        message: 'Listing title is required'
      });
    }

    const result = await db.query(
      `INSERT INTO classifieds_listings (
        title, description, category, price_amount, currency, condition_label,
        location_city, location_district, seller_name, seller_email, seller_phone,
        images, tags, negotiable, status, moderation_status, moderation_notes, featured, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12::jsonb, $13::jsonb, $14, $15, $16, $17, $18, $19::jsonb
      )
      RETURNING *`,
      [
        payload.title,
        payload.description,
        payload.category,
        payload.price_amount,
        payload.currency,
        payload.condition_label,
        payload.location_city,
        payload.location_district,
        payload.seller_name,
        payload.seller_email,
        payload.seller_phone,
        toJsonb(payload.images),
        toJsonb(payload.tags),
        payload.negotiable,
        payload.status,
        payload.moderation_status,
        payload.moderation_notes,
        payload.featured,
        toJsonb(payload.metadata)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Classified listing created',
      data: serializeClassifiedsListing(result.rows[0])
    });
  } catch (error) {
    console.error('Create classified listing error:', error);
    res.status(500).json({ error: 'Failed to create classified listing' });
  }
});

router.get('/classifieds/listings/:listingId', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const [listing, reviewsResult] = await Promise.all([
      fetchClassifiedsListingById(listingId),
      db.query(
        `SELECT reviewer_name, reviewer_email, rating, review, created_at
         FROM classifieds_reviews
         WHERE listing_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 10`,
        [listingId]
      )
    ]);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Classified listing not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...serializeClassifiedsListing(listing),
        recent_reviews: reviewsResult.rows
      }
    });
  } catch (error) {
    console.error('Get classified listing error:', error);
    res.status(500).json({ error: 'Failed to get classified listing' });
  }
});

router.patch('/classifieds/listings/:listingId', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const payload = buildClassifiedsPayload(req.body, { partial: true });
    const updated = await applyUpdates(
      'classifieds_listings',
      listingId,
      payload,
      ['images', 'tags', 'metadata']
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Classified listing not found or no valid fields provided'
      });
    }

    res.json({
      success: true,
      message: 'Classified listing updated',
      data: serializeClassifiedsListing(updated)
    });
  } catch (error) {
    console.error('Update classified listing error:', error);
    res.status(500).json({ error: 'Failed to update classified listing' });
  }
});

router.delete('/classifieds/listings/:listingId', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const result = await db.query(
      `UPDATE classifieds_listings
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           status = 'deleted'
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id`,
      [listingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Classified listing not found'
      });
    }

    res.json({
      success: true,
      message: 'Classified listing deleted'
    });
  } catch (error) {
    console.error('Delete classified listing error:', error);
    res.status(500).json({ error: 'Failed to delete classified listing' });
  }
});

router.post('/classifieds/listings/:listingId/messages', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const listing = await fetchClassifiedsListingById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Classified listing not found'
      });
    }

    const message = normalizeOptionalText(req.body.message);
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const senderName = normalizeOptionalText(firstProvided(req.body, ['sender_name', 'senderName', 'name']).value);
    const senderEmail = normalizeOptionalText(firstProvided(req.body, ['sender_email', 'senderEmail', 'email']).value);
    const senderPhone = normalizeOptionalText(firstProvided(req.body, ['sender_phone', 'senderPhone', 'phone']).value);
    const metadata = normalizeJsonObject(req.body.metadata);

    const result = await db.query(
      `INSERT INTO classifieds_messages (
        listing_id, sender_name, sender_email, sender_phone, message, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6::jsonb
      )
      RETURNING id, created_at`,
      [listingId, senderName, senderEmail, senderPhone, message, toJsonb(metadata)]
    );

    res.status(201).json({
      success: true,
      message: 'Message sent',
      data: {
        id: result.rows[0].id,
        created_at: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Classified listing message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/classifieds/listings/:listingId/reports', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const listing = await fetchClassifiedsListingById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Classified listing not found'
      });
    }

    const reason = normalizeOptionalText(req.body.reason) || 'general';
    const description = normalizeOptionalText(req.body.description || req.body.details);
    const reporterName = normalizeOptionalText(firstProvided(req.body, ['reporter_name', 'reporterName', 'name']).value);
    const reporterEmail = normalizeOptionalText(firstProvided(req.body, ['reporter_email', 'reporterEmail', 'email']).value);

    const result = await db.query(
      `INSERT INTO classifieds_reports (
        listing_id, reporter_name, reporter_email, reason, description
      ) VALUES (
        $1, $2, $3, $4, $5
      )
      RETURNING id, created_at`,
      [listingId, reporterName, reporterEmail, reason, description]
    );

    res.status(201).json({
      success: true,
      message: 'Report submitted',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Classified listing report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

router.post('/classifieds/listings/:listingId/reviews', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    const rating = normalizeInteger(req.body.rating);

    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const listing = await fetchClassifiedsListingById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Classified listing not found'
      });
    }

    const reviewerName = normalizeOptionalText(firstProvided(req.body, ['reviewer_name', 'reviewerName', 'name']).value);
    const reviewerEmail = normalizeOptionalText(firstProvided(req.body, ['reviewer_email', 'reviewerEmail', 'email']).value);
    const review = normalizeOptionalText(req.body.review);

    const result = await db.query(
      `INSERT INTO classifieds_reviews (
        listing_id, reviewer_name, reviewer_email, rating, review
      ) VALUES (
        $1, $2, $3, $4, $5
      )
      RETURNING id, created_at`,
      [listingId, reviewerName, reviewerEmail, rating, review]
    );

    const updatedListing = await fetchClassifiedsListingById(listingId);

    res.status(201).json({
      success: true,
      message: 'Review added',
      data: {
        id: result.rows[0].id,
        created_at: result.rows[0].created_at,
        average_rating: updatedListing ? toNumber(updatedListing.average_rating) : null,
        review_count: updatedListing ? toCount(updatedListing.review_count) : 0
      }
    });
  } catch (error) {
    console.error('Classified listing review error:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

router.get('/classifieds/user/:sellerEmail/rating', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const sellerEmail = normalizeOptionalText(req.params.sellerEmail);
    if (!sellerEmail) {
      return res.status(400).json({ success: false, message: 'Seller email is required' });
    }

    const result = await db.query(
      `SELECT ROUND(AVG(r.rating)::numeric, 2) AS rating,
              COUNT(r.id)::int AS review_count
       FROM classifieds_listings l
       LEFT JOIN classifieds_reviews r ON r.listing_id = l.id
       WHERE LOWER(l.seller_email) = LOWER($1)
         AND l.deleted_at IS NULL`,
      [sellerEmail]
    );

    res.json({
      success: true,
      data: {
        sellerEmail,
        rating: toNumber(result.rows[0]?.rating) || 0,
        reviewCount: toCount(result.rows[0]?.review_count)
      }
    });
  } catch (error) {
    console.error('Get classifieds seller rating error:', error);
    res.status(500).json({ error: 'Failed to get seller rating' });
  }
});

router.patch('/classifieds/listings/:listingId/moderation', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const payload = buildClassifiedsPayload(req.body, { partial: true });
    const moderationPayload = {};

    if (payload.moderation_status !== undefined) {
      moderationPayload.moderation_status = payload.moderation_status;
    }
    if (payload.moderation_notes !== undefined) {
      moderationPayload.moderation_notes = payload.moderation_notes;
    }
    if (payload.featured !== undefined) {
      moderationPayload.featured = payload.featured;
    }
    if (payload.status !== undefined) {
      moderationPayload.status = payload.status;
    }

    const updated = await applyUpdates('classifieds_listings', listingId, moderationPayload, []);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Classified listing not found or no moderation fields provided'
      });
    }

    res.json({
      success: true,
      message: 'Listing moderation updated',
      data: serializeClassifiedsListing(updated)
    });
  } catch (error) {
    console.error('Update classifieds moderation error:', error);
    res.status(500).json({ error: 'Failed to update moderation' });
  }
});

// REAL ESTATE ENDPOINTS
router.post('/realestate/listings', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const payload = buildRealEstatePayload(req.body);
    if (!payload.title) {
      return res.status(400).json({
        success: false,
        message: 'Listing title is required'
      });
    }

    const result = await db.query(
      `INSERT INTO realestate_listings (
        title, description, listing_type, property_type, price_amount, price_label,
        currency, area_sqft, bedrooms, bathrooms, furnishing_status,
        address, city, district, locality, latitude, longitude,
        seller_name, seller_email, seller_phone, amenities, photos,
        availability_date, status, moderation_status, moderation_notes, featured, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21::jsonb, $22::jsonb,
        $23, $24, $25, $26, $27, $28::jsonb
      )
      RETURNING *`,
      [
        payload.title,
        payload.description,
        payload.listing_type,
        payload.property_type,
        payload.price_amount,
        payload.price_label,
        payload.currency,
        payload.area_sqft,
        payload.bedrooms,
        payload.bathrooms,
        payload.furnishing_status,
        payload.address,
        payload.city,
        payload.district,
        payload.locality,
        payload.latitude,
        payload.longitude,
        payload.seller_name,
        payload.seller_email,
        payload.seller_phone,
        toJsonb(payload.amenities),
        toJsonb(payload.photos),
        payload.availability_date,
        payload.status,
        payload.moderation_status,
        payload.moderation_notes,
        payload.featured,
        toJsonb(payload.metadata)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Real estate listing created',
      data: serializeRealEstateListing(result.rows[0])
    });
  } catch (error) {
    console.error('Create real estate listing error:', error);
    res.status(500).json({ error: 'Failed to create real estate listing' });
  }
});

router.patch('/realestate/listings/:listingId', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const payload = buildRealEstatePayload(req.body, { partial: true });
    const updated = await applyUpdates(
      'realestate_listings',
      listingId,
      payload,
      ['amenities', 'photos', 'metadata']
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Real estate listing not found or no valid fields provided'
      });
    }

    res.json({
      success: true,
      message: 'Real estate listing updated',
      data: serializeRealEstateListing(updated)
    });
  } catch (error) {
    console.error('Update real estate listing error:', error);
    res.status(500).json({ error: 'Failed to update real estate listing' });
  }
});

router.delete('/realestate/listings/:listingId', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const result = await db.query(
      `UPDATE realestate_listings
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           status = 'deleted'
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id`,
      [listingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Real estate listing not found'
      });
    }

    res.json({
      success: true,
      message: 'Real estate listing deleted'
    });
  } catch (error) {
    console.error('Delete real estate listing error:', error);
    res.status(500).json({ error: 'Failed to delete real estate listing' });
  }
});

router.post('/realestate/listings/:listingId/enquiries', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const listing = await fetchRealEstateListingById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Real estate listing not found'
      });
    }

    const message = normalizeOptionalText(req.body.message);
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const senderName = normalizeOptionalText(firstProvided(req.body, ['sender_name', 'senderName', 'name']).value);
    const senderEmail = normalizeOptionalText(firstProvided(req.body, ['sender_email', 'senderEmail', 'email']).value);
    const senderPhone = normalizeOptionalText(firstProvided(req.body, ['sender_phone', 'senderPhone', 'phone']).value);
    const budget = normalizeAmount(req.body.budget);
    const preferredVisitDate = normalizeDateOnly(req.body.preferred_visit_date || req.body.preferredVisitDate);
    const metadata = normalizeJsonObject(req.body.metadata);

    const result = await db.query(
      `INSERT INTO realestate_enquiries (
        listing_id, sender_name, sender_email, sender_phone,
        message, budget, preferred_visit_date, metadata
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8::jsonb
      )
      RETURNING id, created_at`,
      [
        listingId,
        senderName,
        senderEmail,
        senderPhone,
        message,
        budget,
        preferredVisitDate,
        toJsonb(metadata)
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Enquiry sent',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Real estate enquiry error:', error);
    res.status(500).json({ error: 'Failed to send enquiry' });
  }
});

router.post('/realestate/listings/:listingId/messages', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const listing = await fetchRealEstateListingById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Real estate listing not found'
      });
    }

    const message = normalizeOptionalText(req.body.message);
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const senderName = normalizeOptionalText(firstProvided(req.body, ['sender_name', 'senderName', 'name']).value);
    const senderEmail = normalizeOptionalText(firstProvided(req.body, ['sender_email', 'senderEmail', 'email']).value);
    const senderPhone = normalizeOptionalText(firstProvided(req.body, ['sender_phone', 'senderPhone', 'phone']).value);
    const metadata = normalizeJsonObject(req.body.metadata);

    const result = await db.query(
      `INSERT INTO realestate_messages (
        listing_id, sender_name, sender_email, sender_phone, message, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, $6::jsonb
      )
      RETURNING id, created_at`,
      [listingId, senderName, senderEmail, senderPhone, message, toJsonb(metadata)]
    );

    res.status(201).json({
      success: true,
      message: 'Message sent',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Real estate message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/realestate/listings/:listingId/reviews', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    const rating = normalizeInteger(req.body.rating);

    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const listing = await fetchRealEstateListingById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Real estate listing not found'
      });
    }

    const reviewerName = normalizeOptionalText(firstProvided(req.body, ['reviewer_name', 'reviewerName', 'name']).value);
    const reviewerEmail = normalizeOptionalText(firstProvided(req.body, ['reviewer_email', 'reviewerEmail', 'email']).value);
    const review = normalizeOptionalText(req.body.review);

    const result = await db.query(
      `INSERT INTO realestate_reviews (
        listing_id, reviewer_name, reviewer_email, rating, review
      ) VALUES (
        $1, $2, $3, $4, $5
      )
      RETURNING id, created_at`,
      [listingId, reviewerName, reviewerEmail, rating, review]
    );

    const updatedListing = await fetchRealEstateListingById(listingId);

    res.status(201).json({
      success: true,
      message: 'Review added',
      data: {
        id: result.rows[0].id,
        created_at: result.rows[0].created_at,
        average_rating: updatedListing ? toNumber(updatedListing.average_rating) : null,
        review_count: updatedListing ? toCount(updatedListing.review_count) : 0
      }
    });
  } catch (error) {
    console.error('Real estate review error:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

router.post('/realestate/listings/:listingId/reports', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const listing = await fetchRealEstateListingById(listingId);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Real estate listing not found'
      });
    }

    const reason = normalizeOptionalText(req.body.reason) || 'general';
    const description = normalizeOptionalText(req.body.description || req.body.details);
    const reporterName = normalizeOptionalText(firstProvided(req.body, ['reporter_name', 'reporterName', 'name']).value);
    const reporterEmail = normalizeOptionalText(firstProvided(req.body, ['reporter_email', 'reporterEmail', 'email']).value);

    const result = await db.query(
      `INSERT INTO realestate_reports (
        listing_id, reporter_name, reporter_email, reason, description
      ) VALUES (
        $1, $2, $3, $4, $5
      )
      RETURNING id, created_at`,
      [listingId, reporterName, reporterEmail, reason, description]
    );

    res.status(201).json({
      success: true,
      message: 'Report submitted',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Real estate report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

router.patch('/realestate/listings/:listingId/moderation', async (req, res) => {
  try {
    await ensureAppDataSchema();

    const listingId = normalizeInteger(req.params.listingId);
    if (!listingId) {
      return res.status(400).json({ success: false, message: 'Invalid listing id' });
    }

    const payload = buildRealEstatePayload(req.body, { partial: true });
    const moderationPayload = {};

    if (payload.moderation_status !== undefined) {
      moderationPayload.moderation_status = payload.moderation_status;
    }
    if (payload.moderation_notes !== undefined) {
      moderationPayload.moderation_notes = payload.moderation_notes;
    }
    if (payload.featured !== undefined) {
      moderationPayload.featured = payload.featured;
    }
    if (payload.status !== undefined) {
      moderationPayload.status = payload.status;
    }

    const updated = await applyUpdates('realestate_listings', listingId, moderationPayload, []);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Real estate listing not found or no moderation fields provided'
      });
    }

    res.json({
      success: true,
      message: 'Listing moderation updated',
      data: serializeRealEstateListing(updated)
    });
  } catch (error) {
    console.error('Update real estate moderation error:', error);
    res.status(500).json({ error: 'Failed to update moderation' });
  }
});

module.exports = router;
