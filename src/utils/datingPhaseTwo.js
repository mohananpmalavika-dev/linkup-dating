const DAY_MS = 24 * 60 * 60 * 1000;

const CITY_PACKS = {
  bengaluru: {
    vibe: 'Cafe-and-curiosity',
    prompts: [
      'What part of Bengaluru still feels exciting to you, even after a long week?',
      'Are you more likely to choose an early coffee plan or a late-night walk here?'
    ],
    dateIdeas: [
      {
        type: 'coffee',
        title: 'Third-wave coffee and a long conversation',
        reason: "A low-pressure plan that fits Bengaluru's cafe culture."
      },
      {
        type: 'walk',
        title: 'Sunset walk in a green pocket of the city',
        reason: 'Good for matches who want something thoughtful but easy.'
      }
    ]
  },
  kochi: {
    vibe: 'Waterfront-and-foodie',
    prompts: [
      'What is your favorite way to slow down in Kochi when the week gets noisy?',
      'If you had to introduce Kochi through one meal and one view, what would you pick?'
    ],
    dateIdeas: [
      {
        type: 'food',
        title: 'A harbor-side chai or seafood stop',
        reason: 'Simple, local, and easy to turn into a longer date if the vibe is good.'
      },
      {
        type: 'walk',
        title: 'Fort Kochi walk with a coffee reset',
        reason: 'A strong first-date format for curious, talkative matches.'
      }
    ]
  },
  chennai: {
    vibe: 'Beach-and-banter',
    prompts: [
      'Are you more of a sunrise Marina person or an evening-food-stall person?',
      'What part of Chennai always reminds you why you like living here?'
    ],
    dateIdeas: [
      {
        type: 'walk',
        title: 'A breezy evening walk near the water',
        reason: 'A low-pressure first plan that naturally creates conversation.'
      },
      {
        type: 'coffee',
        title: 'Filter coffee and a catch-up',
        reason: 'A grounded option for direct, intentional matches.'
      }
    ]
  },
  hyderabad: {
    vibe: 'Night-drive-and-biryani',
    prompts: [
      'What kind of Hyderabad plan feels more like you: old-city culture or a modern cafe night?',
      'What is your ideal low-effort but memorable date in Hyderabad?'
    ],
    dateIdeas: [
      {
        type: 'food',
        title: 'Food-led first date with room to keep talking',
        reason: 'Works especially well for conversational matches with a playful vibe.'
      },
      {
        type: 'coffee',
        title: 'Cafe first, then decide if the night keeps going',
        reason: 'Lets both people keep things easy without losing intention.'
      }
    ]
  },
  mumbai: {
    vibe: 'Fast-city, clear-intent',
    prompts: [
      'How do you make space for a real connection in a city that is always moving?',
      'Which Mumbai plan feels most like you: a sea-face walk, coffee, or late dinner?'
    ],
    dateIdeas: [
      {
        type: 'walk',
        title: 'Sea-face walk and a real conversation',
        reason: 'Easy to start and easy to extend if there is chemistry.'
      },
      {
        type: 'coffee',
        title: 'Intentional coffee date between busy schedules',
        reason: 'Good for matches who want clarity without pressure.'
      }
    ]
  }
};

const DEFAULT_CITY_PACK = {
  vibe: 'Local-and-intentional',
  prompts: [
    'What is a very local thing you genuinely love about your city?',
    'What kind of date feels easiest and most natural where you live?'
  ],
  dateIdeas: [
    {
      type: 'coffee',
      title: 'A simple coffee date nearby',
      reason: 'Easy to agree to, easy to leave, and easy to extend if it feels good.'
    },
    {
      type: 'walk',
      title: 'Short walk in a familiar area',
      reason: 'Useful when you want something comfortable and low pressure.'
    }
  ]
};

const normalizeArray = (value) =>
  Array.isArray(value)
    ? value.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];

const normalizeText = (value) => String(value || '').trim();

const normalizeCityKey = (city) => normalizeText(city).toLowerCase();

const unique = (items) => [...new Set(items.filter(Boolean))];

const parseTrustNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
};

const toDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getMessageList = (messages = [], match = {}) => {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages;
  }

  if (match.lastMessage) {
    return [match.lastMessage];
  }

  return [];
};

const getLanguageIcebreakers = (languages = [], viewerLanguages = []) => {
  const normalizedLanguages = normalizeArray(languages);
  if (!normalizedLanguages.length) {
    return [];
  }

  const viewerLanguageSet = new Set(
    normalizeArray(viewerLanguages).map((language) => language.toLowerCase())
  );

  return normalizedLanguages.slice(0, 3).map((language) => {
    const sharedLanguage = viewerLanguageSet.has(language.toLowerCase());

    if (sharedLanguage) {
      return `We both speak ${language}. What is a phrase in ${language} that feels especially you?`;
    }

    return `I noticed ${language} on your profile. Is there a word or expression in it that you love?`;
  });
};

export const buildLocalIdentityPack = (profile = {}, viewerProfile = {}) => {
  const cityName = normalizeText(profile.location?.city || profile.city);
  const cityPack = CITY_PACKS[normalizeCityKey(cityName)] || DEFAULT_CITY_PACK;
  const languages = normalizeArray(profile.languages);
  const viewerLanguages = normalizeArray(viewerProfile.languages);
  const sharedLanguages = languages.filter((language) =>
    viewerLanguages.some(
      (viewerLanguage) => viewerLanguage.toLowerCase() === language.toLowerCase()
    )
  );
  const communityPreference = normalizeText(profile.communityPreference);
  const religion = normalizeText(profile.religion);
  const conversationStyle = normalizeText(profile.conversationStyle);

  const badges = unique([
    cityName ? `${cityName} local` : '',
    languages.length >= 2 ? 'Multilingual' : '',
    sharedLanguages.length > 0 ? `Shared language: ${sharedLanguages[0]}` : '',
    communityPreference ? communityPreference : '',
    religion ? religion : '',
    conversationStyle ? `${conversationStyle} communicator` : ''
  ]).map((label) => ({
    label,
    tone:
      label.includes('Shared language') || label === 'Multilingual'
        ? 'language'
        : label.includes('local')
          ? 'city'
          : 'culture'
  }));

  return {
    cityName,
    cityVibe: cityPack.vibe,
    cityBasedPrompts: cityPack.prompts,
    languageIcebreakers: getLanguageIcebreakers(languages, viewerLanguages),
    culturalBadges: badges,
    localDateSuggestions: cityPack.dateIdeas.map((idea) => ({
      ...idea,
      cityName
    }))
  };
};

export const buildTrustSummary = ({
  profile = {},
  trustScore = null,
  verificationStatus = null
} = {}) => {
  const trustData = trustScore?.trustScore || trustScore || {};
  const verificationData = verificationStatus || {};
  const profileVerifications = profile.verifications || {};
  const verificationSignals = trustData.verifications || {};
  const overallScore = parseTrustNumber(
    trustData.overallScore ?? trustData.overall_trust_score ?? trustData.trust_score
  );
  const photoCount = Array.isArray(profile.photos) ? profile.photos.length : 0;
  const reviewStatus = normalizeText(
    verificationData.verificationStatus ||
      trustData.verification_level ||
      trustData.verification_status ||
      'unverified'
  ).toLowerCase();
  const riskLevel = normalizeText(trustData.riskLevel || trustData.fraud_risk_level || 'low').toLowerCase();

  const steps = [
    {
      key: 'email',
      label: 'Email confirmed',
      completed: Boolean(profileVerifications.email || verificationSignals.emailVerified)
    },
    {
      key: 'phone',
      label: 'Phone confirmed',
      completed: Boolean(profileVerifications.phone || verificationSignals.phoneVerified)
    },
    {
      key: 'photo',
      label: 'Photo check',
      completed: Boolean(profile.profileVerified || verificationSignals.photoVerified || reviewStatus === 'approved')
    },
    {
      key: 'id',
      label: 'Government ID',
      completed: Boolean(profileVerifications.id)
    },
    {
      key: 'behavior',
      label: 'Trust behavior',
      completed: (overallScore || 0) >= 70 && riskLevel !== 'high'
    }
  ];

  let level = 'new';
  if (riskLevel === 'high' || reviewStatus === 'rejected') {
    level = 'watch';
  } else if (reviewStatus === 'pending') {
    level = 'pending';
  } else if ((overallScore || 0) >= 85) {
    level = 'trusted';
  } else if ((overallScore || 0) >= 65 || steps.filter((step) => step.completed).length >= 3) {
    level = 'strong';
  } else if (steps.some((step) => step.completed)) {
    level = 'basic';
  }

  const badges = unique([
    steps[2].completed ? 'Photo verified' : '',
    steps[3].completed ? 'ID checked' : '',
    steps[0].completed && steps[1].completed ? 'Contact confirmed' : '',
    photoCount >= 3 ? 'Clear photo set' : '',
    level === 'trusted' ? 'High trust' : '',
    profile.voiceIntroUrl ? 'Voice intro added' : ''
  ]).map((label) => ({
    label,
    tone: label === 'High trust' ? 'strong' : label.includes('Photo') ? 'photo' : 'standard'
  }));

  const photoChecks = [
    {
      label: 'At least 3 photos',
      passed: photoCount >= 3,
      detail: photoCount >= 3 ? `${photoCount} photos live` : 'Add more clear photos'
    },
    {
      label: 'Primary photo ready',
      passed: photoCount >= 1,
      detail: photoCount >= 1 ? 'Primary photo available' : 'Upload a primary photo'
    },
    {
      label: 'Verification selfie',
      passed: reviewStatus === 'approved',
      detail:
        reviewStatus === 'approved'
          ? 'Approved'
          : reviewStatus === 'pending'
            ? 'Pending review'
            : reviewStatus === 'rejected'
              ? 'Needs another try'
              : 'Not started'
    }
  ];

  return {
    level,
    overallScore,
    riskLevel,
    badges,
    ladder: steps,
    photoChecks,
    warnings: unique([
      riskLevel === 'high' ? 'Proceed carefully while this profile is reviewed.' : '',
      reviewStatus === 'pending' ? 'Verification is still in progress.' : '',
      reviewStatus === 'rejected' ? 'Verification needs clearer photos or better lighting.' : '',
      photoCount < 3 ? 'More clear photos would strengthen trust.' : ''
    ])
  };
};

export const calculateConversationHealth = ({
  match = {},
  messages = [],
  currentUserId = null,
  now = Date.now()
} = {}) => {
  const messageList = getMessageList(messages, match);
  const loadedMessageCount = Array.isArray(messages) ? messages.length : 0;
  const declaredMessageCount = Number(match.messageCount || messageList.length || 0);
  const messageCount = Math.max(loadedMessageCount, declaredMessageCount);

  const latestMessage = messageList
    .map((message) => ({
      ...message,
      parsedDate: toDate(message.timestamp || message.createdAt || message.created_at)
    }))
    .filter((message) => message.parsedDate)
    .sort((left, right) => right.parsedDate.getTime() - left.parsedDate.getTime())[0] || null;

  const inactiveDays = latestMessage
    ? Math.floor((now - latestMessage.parsedDate.getTime()) / DAY_MS)
    : 0;

  const senderIds = unique(
    messageList.map((message) => Number(message.senderId || message.fromUserId || message.from_user_id))
  ).filter((userId) => Number.isFinite(userId));

  const reciprocityScore =
    senderIds.length >= 2
      ? 25
      : messageCount >= 2
        ? 12
        : 4;

  const averageLength = messageList.length > 0
    ? Math.round(
        messageList.reduce(
          (total, message) => total + normalizeText(message.text || message.message).length,
          0
        ) / messageList.length
      )
    : normalizeText(match.lastMessage?.text).length;

  const depthScore =
    averageLength >= 70
      ? 20
      : averageLength >= 35
        ? 14
        : averageLength > 0
          ? 8
          : 0;

  const recencyScore =
    inactiveDays <= 1
      ? 30
      : inactiveDays <= 3
        ? 22
        : inactiveDays <= 7
          ? 10
          : 2;

  const momentumScore =
    messageCount >= 12
      ? 25
      : messageCount >= 6
        ? 18
        : messageCount >= 3
          ? 10
          : messageCount > 0
            ? 4
            : 0;

  const score = Math.max(
    0,
    Math.min(100, reciprocityScore + depthScore + recencyScore + momentumScore)
  );

  let label = 'Needs spark';
  if (score >= 80) {
    label = 'Very warm';
  } else if (score >= 65) {
    label = 'Healthy';
  } else if (score >= 45) {
    label = 'Recoverable';
  } else if (messageCount > 0 && inactiveDays >= 3) {
    label = 'Cooling off';
  }

  const latestSenderId = latestMessage
    ? Number(
        latestMessage.senderId || latestMessage.fromUserId || latestMessage.from_user_id || 0
      )
    : null;
  const waitingOnCurrentUser =
    currentUserId !== null &&
    latestSenderId !== null &&
    Number(currentUserId) !== latestSenderId &&
    inactiveDays <= 2;

  return {
    score,
    label,
    messageCount,
    averageLength,
    inactiveDays,
    readyForCall: score >= 62 && messageCount >= 6 && inactiveDays <= 3,
    needsRevive: messageCount > 0 && inactiveDays >= 3,
    waitingOnCurrentUser,
    nextBestMove:
      score >= 70 && messageCount >= 8
        ? 'Suggest a call or date'
        : inactiveDays >= 3
          ? 'Send a light revive note'
          : waitingOnCurrentUser
            ? 'Reply while the thread is still warm'
            : 'Keep the chat moving with one specific question'
  };
};

export const buildSmartRevivePrompts = ({
  match = {},
  health = {},
  identityPack = {}
} = {}) => {
  const name = normalizeText(match.firstName) || 'there';
  const leadInterest = normalizeArray(match.interests)[0];
  const cityName = normalizeText(match.location?.city);
  const cityPrompt = identityPack.cityBasedPrompts?.[0];

  return unique([
    leadInterest
      ? `Hey ${name}, I still want your ${leadInterest} take. What have you been into lately?`
      : '',
    cityName
      ? `Hey ${name}, I wanted to circle back. Has anything surprisingly fun happened in ${cityName} lately?`
      : '',
    cityPrompt ? `Hey ${name}, random but real question: ${cityPrompt.toLowerCase()}` : '',
    health.readyForCall
      ? `Hey ${name}, this has felt easy so far. Want to do a quick 15-minute video vibe check this week?`
      : '',
    `Hey ${name}, this conversation still feels worth revisiting. How has your week been?`
  ]).slice(0, 4);
};

export const buildVideoDateExperience = ({
  match = {},
  identityPack = {},
  feedback = {},
  latestSession = {}
} = {}) => {
  const partnerName = normalizeText(match.firstName) || 'your match';
  const leadInterest = normalizeArray(match.interests)[0];
  const cityPrompt = identityPack.cityBasedPrompts?.[0];
  const languagePrompt = identityPack.languageIcebreakers?.[0];
  const rating = Number(feedback.rating || 0);
  const wouldMeetInPerson = Boolean(feedback.wouldMeetInPerson);

  const preCallPrompts = unique([
    leadInterest
      ? `Ask ${partnerName} what drew them into ${leadInterest} in the first place.`
      : '',
    cityPrompt ? `Open with something local: ${cityPrompt}` : '',
    languagePrompt ? `Use the shared-language angle: ${languagePrompt}` : '',
    latestSession.note ? `Revisit the note from the last plan: ${latestSession.note}` : ''
  ]).slice(0, 3);

  const postCallSuggestions = unique([
    rating >= 4 && wouldMeetInPerson
      ? `You both had a strong call. Suggest booking another date while the energy is still real.`
      : '',
    rating >= 4 && !wouldMeetInPerson
      ? `The call landed well. A second video date could keep the connection moving without pressure.`
      : '',
    rating > 0 && rating < 4
      ? `Keep the next step light. A short follow-up message may be better than another date right away.`
      : '',
    `Share one specific thing you enjoyed about talking with ${partnerName}.`
  ]).slice(0, 3);

  return {
    preCallPrompts,
    postCallSuggestions,
    showBookAnotherDateCta: rating >= 4 && wouldMeetInPerson
  };
};
