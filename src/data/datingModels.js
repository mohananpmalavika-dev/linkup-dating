/**
 * Dating Profile Data Models
 * Defines the structure for dating profiles, preferences, and interactions
 */

export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-Binary' },
  { value: 'other', label: 'Other' },
];

export const RELATIONSHIP_GOALS = [
  { value: 'casual', label: 'Casual Dating' },
  { value: 'dating', label: 'Looking to Date' },
  { value: 'relationship', label: 'Serious Relationship' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'friendship', label: 'Friendship' },
];

export const INTERESTS = [
  'Travel', 'Fitness', 'Music', 'Art', 'Cooking', 'Gaming', 'Sports',
  'Hiking', 'Photography', 'Reading', 'Movies', 'Yoga', 'Meditation',
  'Volunteering', 'Technology', 'Business', 'Fashion', 'Gardening',
  'Dance', 'Comedy', 'Social Events', 'Outdoor Activities', 'Wine Tasting',
];

export const VERIFICATION_TYPES = [
  { value: 'email', label: 'Email Verification' },
  { value: 'phone', label: 'Phone Verification' },
  { value: 'id', label: 'ID Verification' },
  { value: 'video', label: 'Video Verification' },
];

/**
 * Profile Schema
 */
export const EMPTY_DATING_PROFILE = {
  userId: '',
  firstName: '',
  age: null,
  gender: 'male',
  location: {
    city: '',
    state: '',
    country: '',
    coordinates: { lat: null, lng: null },
  },
  bio: '',
  photos: [], // Array of photo URLs
  interests: [],
  relationshipGoals: 'dating',
  occupation: '',
  education: '',
  height: null, // in cm
  bodyType: '', // slim, average, athletic, curvy
  ethnicity: '',
  religion: '',
  smoking: false,
  drinking: false,
  hasKids: false,
  wantsKids: null, // yes, no, undecided
  profileVerified: false,
  verifications: {
    email: false,
    phone: false,
    id: false,
    video: false,
  },
  badges: [], // verified, premium, etc.
  createdAt: null,
  updatedAt: null,
  lastActive: null,
  isActive: true,
};

/**
 * Preferences Schema
 */
export const EMPTY_PREFERENCES = {
  ageRange: { min: 18, max: 65 },
  locationRadius: 50, // km
  genderPreferences: ['female'],
  relationshipGoals: ['dating', 'relationship'],
  interests: [],
  heightRange: { min: 150, max: 210 },
  bodyType: [],
  showMyProfile: true,
  allowMessages: true,
  notificationsEnabled: true,
};

/**
 * Match Schema
 */
export const EMPTY_MATCH = {
  matchId: '',
  userId1: '',
  userId2: '',
  profile1: null,
  profile2: null,
  matchedAt: null,
  messageCount: 0,
  lastMessage: null,
  status: 'active', // active, blocked, unmatched
};

/**
 * Interaction Schema
 */
export const EMPTY_INTERACTION = {
  interactionId: '',
  fromUserId: '',
  toUserId: '',
  type: 'like', // like, pass, message, view
  timestamp: null,
  isMutual: false, // true if it's a match
};

/**
 * Video Date Schema
 */
export const EMPTY_VIDEO_DATE = {
  dateId: '',
  participants: [], // [userId1, userId2]
  scheduledTime: null,
  status: 'scheduled', // scheduled, ongoing, completed, cancelled
  roomId: '',
  duration: 0,
  createdAt: null,
};
