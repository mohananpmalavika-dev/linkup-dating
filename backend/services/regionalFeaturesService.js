/**
 * Regional Features Service
 * Handles Malayalam localization, Kerala districts, and regional safety features
 */

const db = require('../config/database');

class RegionalFeaturesService {
  // Get all available languages
  static LANGUAGES = {
    en: { name: 'English', nativeName: 'English', flag: '🇬🇧' },
    ml: { name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
  };

  // Kerala Districts with codes
  static KERALA_DISTRICTS = [
    { code: 'TVM', name: 'Thiruvananthapuram', malName: 'തിരുവനന്തപുരം', taluk: ['Nedumangad', 'Thiruvananthapuram'] },
    { code: 'KLM', name: 'Kollam', malName: 'കൊല്ലം', taluk: ['Kottarakkara', 'Kollam'] },
    { code: 'PTA', name: 'Pathanamthitta', malName: 'പത്തനംതിട്ട', taluk: ['Ranni', 'Pathanamthitta'] },
    { code: 'ALP', name: 'Alappuzha', malName: 'ആലപ്പുഴ', taluk: ['Chengannur', 'Alappuzha'] },
    { code: 'KTM', name: 'Kottayam', malName: 'കോട്ടയം', taluk: ['Meenachil', 'Kottayam'] },
    { code: 'IDK', name: 'Idukki', malName: 'ഇടുക്കി', taluk: ['Thodupuzha', 'Idukki'] },
    { code: 'ERN', name: 'Ernakulam', malName: 'എര്നാകുളം', taluk: ['Ernakulam', 'Kochi'] },
    { code: 'TRV', name: 'Thrissur', malName: 'തൃശ്ശൂര്', taluk: ['Kunnamkulam', 'Thrissur'] },
    { code: 'MLP', name: 'Malappuram', malName: 'മലപ്പുരം', taluk: ['Nilambur', 'Malappuram'] },
    { code: 'KZH', name: 'Kozhikode', malName: 'കോഴിക്കോട്', taluk: ['Kurur', 'Kozhikode'] },
    { code: 'WYD', name: 'Wayanad', malName: 'വയനാട്', taluk: ['Kalpetta', 'Wayanad'] },
    { code: 'KNN', name: 'Kannur', malName: 'കണ്ണൂര്', taluk: ['Kumbanad', 'Kannur'] },
    { code: 'KSD', name: 'Kasaragod', malName: 'കാസരഗോട്', taluk: ['Kasaragod', 'Padanadapuram'] },
  ];

  // Regional helplines
  static REGIONAL_HELPLINES = {
    GENERAL_EMERGENCY: {
      number: '112',
      name: 'Emergency',
      description: 'Police, Ambulance, Fire',
    },
    WOMEN_HELPLINE_KERALA: {
      number: '0471-2551055',
      name: 'Women\'s Helpline Kerala',
      description: '24/7 assistance for women',
    },
    CHILD_HELPLINE: {
      number: '1098',
      name: 'Child Helpline',
      description: 'Child abuse and exploitation',
    },
    CYBER_CRIME: {
      number: '1930',
      name: 'Cyber Crime Helpline',
      description: 'Online fraud and cyber harassment',
    },
    SENIOR_CITIZEN_HELPLINE: {
      number: '1090',
      name: 'Senior Citizen Helpline',
      description: 'Elder abuse complaints',
    },
  };

  // District-specific helplines
  static DISTRICT_POLICE_STATIONS = {
    TVM: { district: 'Thiruvananthapuram', headquarters: 'Police Commissioner Office, Trivandrum' },
    KLM: { district: 'Kollam', headquarters: 'Police Commissioner Office, Kollam' },
    PTA: { district: 'Pathanamthitta', headquarters: 'Police Headquarters, Pathanamthitta' },
    ALP: { district: 'Alappuzha', headquarters: 'District Police Office, Alappuzha' },
    KTM: { district: 'Kottayam', headquarters: 'District Police Office, Kottayam' },
    IDK: { district: 'Idukki', headquarters: 'District Police Office, Idukki' },
    ERN: { district: 'Ernakulam', headquarters: 'Police Commissioner Office, Kochi' },
    TRV: { district: 'Thrissur', headquarters: 'District Police Office, Thrissur' },
    MLP: { district: 'Malappuram', headquarters: 'District Police Office, Malappuram' },
    KZH: { district: 'Kozhikode', headquarters: 'Police Commissioner Office, Kozhikode' },
    WYD: { district: 'Wayanad', headquarters: 'District Police Office, Wayanad' },
    KNN: { district: 'Kannur', headquarters: 'District Police Office, Kannur' },
    KSD: { district: 'Kasaragod', headquarters: 'District Police Office, Kasaragod' },
  };

  // Safety tips for dating in Kerala
  static DATING_SAFETY_TIPS_ML = {
    beforeMeeting: [
      { title: 'പരിചയസ്ഥരുമായി സ്ഥാനം പങ്കിടുക', desc: 'Share your location with trusted friends' },
      { title: 'കാലപരിധി നിശ്ചയിക്കുക', desc: 'Set a time limit for the date' },
      { title: 'പൊതു സ്ഥലത്ത് കാണുക', desc: 'Always meet in public places' },
      { title: 'വ്യക്തിഗത വിവരങ്ങൾ സ്വതന്ത്രമായി പങ്കിടരുത്', desc: 'Avoid sharing personal details' },
    ],
    duringMeeting: [
      { title: 'ബോധമുള്ളായിരുന്നു', desc: 'Stay alert and aware' },
      { title: 'നിരാപത്തം പ്രഥമം', desc: 'Trust your instincts' },
      { title: 'ഒരാളെ അറിയിക്കുക', desc: 'Keep someone informed' },
    ],
    afterMeeting: [
      { title: 'സൗരഭമുള്ളായിരിക്കുക', desc: 'Confirm you reached home safely' },
    ],
  };

  /**
   * Set user language preference
   */
  async setUserLanguage(userId, languageCode) {
    if (!RegionalFeaturesService.LANGUAGES[languageCode]) {
      throw new Error('Language not supported');
    }

    await db.query(
      'UPDATE users SET preferred_language = ? WHERE id = ?',
      [languageCode, userId]
    );

    return { success: true, language: languageCode };
  }

  /**
   * Get user language preference
   */
  async getUserLanguage(userId) {
    const [user] = await db.query(
      'SELECT preferred_language FROM users WHERE id = ?',
      [userId]
    );

    return user?.preferred_language || 'en';
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages() {
    return Object.entries(RegionalFeaturesService.LANGUAGES).map(([code, data]) => ({
      code,
      ...data,
    }));
  }

  /**
   * Set district preference
   */
  async setDistrictPreference(userId, districtCode) {
    const district = RegionalFeaturesService.KERALA_DISTRICTS.find(d => d.code === districtCode);
    if (!district) {
      throw new Error('Invalid district code');
    }

    await db.query(
      'UPDATE user_preferences SET preferred_district = ? WHERE user_id = ?',
      [districtCode, userId]
    );

    // Also update profile location for matching
    await db.query(
      'UPDATE users SET region = ? WHERE id = ?',
      [district.name, userId]
    );

    return { success: true, district: district.name };
  }

  /**
   * Get Kerala districts
   */
  getKeralaDistricts() {
    return RegionalFeaturesService.KERALA_DISTRICTS;
  }

  /**
   * Get district-specific safety info
   */
  getDistrictSafetyInfo(districtCode) {
    const district = RegionalFeaturesService.KERALA_DISTRICTS.find(d => d.code === districtCode);
    const policeInfo = RegionalFeaturesService.DISTRICT_POLICE_STATIONS[districtCode];

    if (!district) {
      return null;
    }

    return {
      district: district.name,
      malName: district.malName,
      policeHeadquarters: policeInfo?.headquarters,
      helplines: RegionalFeaturesService.REGIONAL_HELPLINES,
      safetyTips: RegionalFeaturesService.DATING_SAFETY_TIPS_ML,
    };
  }

  /**
   * Record content takedown request
   */
  async recordContentTakedown(contentId, reportedBy, reason, contentType) {
    const [result] = await db.query(
      `INSERT INTO content_takedowns 
      (content_id, reported_by, reason, content_type, status, reported_at, scheduled_removal_at)
      VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [contentId, reportedBy, reason, contentType, 'PENDING']
    );

    // If illegal content, expedite
    const isIllegal = ['hate_speech', 'child_abuse', 'non_consensual_image', 'violence'].includes(reason);
    if (isIllegal) {
      await db.query(
        'UPDATE content_takedowns SET scheduled_removal_at = NOW(), urgent = 1 WHERE id = ?',
        [result.insertId]
      );
    }

    return result.insertId;
  }

  /**
   * Get pending content removals for admin
   */
  async getPendingContentRemovals() {
    return db.query(
      `SELECT 
        id,
        content_id,
        content_type,
        reason,
        reported_at,
        scheduled_removal_at,
        urgent,
        status
      FROM content_takedowns 
      WHERE status IN ('PENDING', 'IN_REVIEW')
      ORDER BY urgent DESC, reported_at ASC`
    );
  }

  /**
   * Get Aadhaar verification status
   */
  async getAadhaarStatus(userId) {
    const [status] = await db.query(
      'SELECT aadhaar_verified, aadhaar_verified_at, aadhaar_hash FROM users WHERE id = ?',
      [userId]
    );

    return {
      verified: status?.aadhaar_verified || false,
      verifiedAt: status?.aadhaar_verified_at,
      // Never return actual Aadhaar number
    };
  }

  /**
   * Initiate Aadhaar e-KYC verification
   */
  async initiateAadhaarVerification(userId, aadhaarNumber) {
    // In production, integrate with UIDAI API
    // For now, just hash and store for later verification
    
    const crypto = require('crypto');
    const aadhaarHash = crypto
      .createHash('sha256')
      .update(aadhaarNumber)
      .digest('hex');

    const verificationToken = crypto.randomBytes(32).toString('hex');

    await db.query(
      `INSERT INTO aadhaar_verification_requests 
      (user_id, aadhaar_hash, verification_token, status, created_at)
      VALUES (?, ?, ?, ?, NOW())`,
      [userId, aadhaarHash, verificationToken, 'PENDING']
    );

    return {
      success: true,
      message: 'Aadhaar verification initiated',
      verificationToken,
      // In real implementation, send OTP via SMS
    };
  }

  /**
   * Get localized error messages
   */
  getLocalizedMessages(languageCode) {
    const messages = {
      en: {
        welcome: 'Welcome to DatingHub',
        selectDistrict: 'Select your district',
        selectLanguage: 'Select your preferred language',
        accountDeleted: 'Your account has been deleted',
        dataExported: 'Your data export is ready',
      },
      ml: {
        welcome: 'ലിങ്കআപ്പിലേക്ക് സ്വാഗതം',
        selectDistrict: 'നിങ്ങളുടെ ജില്ല തിരഞ്ഞെടുക്കുക',
        selectLanguage: 'നിങ്ങളുടെ ഭാഷാ സാധ്യത തിരഞ്ഞെടുക്കുക',
        accountDeleted: 'നിങ്ങളുടെ അക്കൗണ്ട് ഇല്ലാതാകി',
        dataExported: 'നിങ്ങളുടെ ഡാറ്റ എക്സ്പോർട്ട് തയ്യാറാണ്',
      },
    };

    return messages[languageCode] || messages.en;
  }
}

module.exports = RegionalFeaturesService;
