/**
 * Age Verification Utility
 * Enforces 18+ requirement for LinkUp dating app
 * Supports multiple verification methods (DOB, ID verification, etc.)
 */

const calculateAgeFromDOB = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  
  return age;
};

const isValidDOB = (dob) => {
  if (!dob) return false;
  
  const dobDate = new Date(dob);
  
  // Check if date is valid
  if (isNaN(dobDate.getTime())) return false;
  
  // Check if DOB is in the past
  if (dobDate > new Date()) return false;
  
  // Check if DOB is reasonable (not more than 120 years ago)
  const maxAge = 120;
  const age = calculateAgeFromDOB(dobDate);
  if (age > maxAge || age < 0) return false;
  
  return true;
};

const isOldEnough = (dateOfBirth, minimumAge = 18) => {
  if (!isValidDOB(dateOfBirth)) return false;
  
  const dobDate = new Date(dateOfBirth);
  const age = calculateAgeFromDOB(dobDate);
  
  return age >= minimumAge;
};

const validateAgeVerification = (ageVerification, userId) => {
  const errors = [];
  
  if (!ageVerification) {
    errors.push('Age verification data required');
    return { valid: false, errors };
  }
  
  const { method, dateOfBirth, idVerificationId, selfiePhotoId } = ageVerification;
  
  if (!method || !['dob', 'id_verification', 'selfie_dob'].includes(method)) {
    errors.push('Valid verification method required (dob, id_verification, or selfie_dob)');
  }
  
  if (method === 'dob' || method === 'selfie_dob') {
    if (!dateOfBirth) {
      errors.push('Date of birth required for this verification method');
    } else if (!isValidDOB(dateOfBirth)) {
      errors.push('Invalid date of birth provided');
    } else if (!isOldEnough(dateOfBirth, 18)) {
      errors.push('You must be at least 18 years old to use LinkUp');
    }
  }
  
  if (method === 'id_verification') {
    if (!idVerificationId) {
      errors.push('ID verification ID required');
    }
    // Additional validation would check against actual ID verification service
  }
  
  if (method === 'selfie_dob') {
    if (!selfiePhotoId) {
      errors.push('Selfie photo ID required for selfie verification');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    isOver18: isOldEnough(dateOfBirth, 18)
  };
};

const requireAgeVerification = (req, res, next) => {
  const { ageVerification } = req.body;
  
  const validation = validateAgeVerification(ageVerification, req.user?.id);
  
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Age verification failed',
      details: validation.errors
    });
  }
  
  // Attach verified age to request
  req.verifiedAge = {
    method: ageVerification.method,
    dateOfBirth: ageVerification.dateOfBirth,
    verifiedAt: new Date(),
    isOver18: validation.isOver18
  };
  
  next();
};

const formatDOB = (dateOfBirth) => {
  const date = new Date(dateOfBirth);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
};

const getAgeVerificationStatus = async (db, userId) => {
  try {
    const result = await db.query(
      `SELECT id, user_id, verification_method, date_of_birth, verified_at, is_verified
       FROM age_verifications
       WHERE user_id = $1
       ORDER BY verified_at DESC
       LIMIT 1`,
      [userId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error getting age verification status:', error);
    return null;
  }
};

const storeAgeVerification = async (db, userId, ageVerification) => {
  try {
    const { method, dateOfBirth } = ageVerification;
    
    const result = await db.query(
      `INSERT INTO age_verifications (user_id, verification_method, date_of_birth, is_verified, verified_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
       SET verification_method = $2,
           date_of_birth = $3,
           is_verified = $4,
           verified_at = CURRENT_TIMESTAMP
       RETURNING id, user_id, verification_method, date_of_birth, verified_at, is_verified`,
      [userId, method, dateOfBirth || null, true]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error storing age verification:', error);
    throw error;
  }
};

const canAccessPlatform = async (db, userId) => {
  try {
    const ageVerification = await getAgeVerificationStatus(db, userId);
    
    if (!ageVerification || !ageVerification.is_verified) {
      return false;
    }
    
    // Verify they're still 18+
    if (ageVerification.date_of_birth) {
      const isOld = isOldEnough(ageVerification.date_of_birth, 18);
      return isOld;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking platform access:', error);
    return false;
  }
};

module.exports = {
  calculateAgeFromDOB,
  isValidDOB,
  isOldEnough,
  validateAgeVerification,
  requireAgeVerification,
  formatDOB,
  getAgeVerificationStatus,
  storeAgeVerification,
  canAccessPlatform
};
