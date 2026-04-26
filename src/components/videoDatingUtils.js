export const CALL_QUALITY_OPTIONS = [
  {
    value: 'audio',
    label: 'Audio Saver',
    description: 'Lower data use with a lightweight video stream.'
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'A smoother everyday mix of clarity and stability.'
  },
  {
    value: 'hd',
    label: 'HD',
    description: 'Sharper video when your network can handle it.'
  }
];

export const BACKGROUND_OPTIONS = [
  {
    value: 'none',
    label: 'Natural',
    description: 'No visual treatment.'
  },
  {
    value: 'soft-focus',
    label: 'Soft Focus',
    description: 'Gentle blur and warmth for a calmer frame.'
  },
  {
    value: 'rose-studio',
    label: 'Rose Studio',
    description: 'A brighter romantic glow.'
  },
  {
    value: 'midnight-lounge',
    label: 'Midnight Lounge',
    description: 'A darker cinematic vibe.'
  }
];

export const REMINDER_MINUTE_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' }
];

const QUALITY_CONSTRAINTS = {
  audio: {
    width: { ideal: 320, max: 480 },
    height: { ideal: 180, max: 270 },
    frameRate: { ideal: 10, max: 15 }
  },
  balanced: {
    width: { ideal: 640, max: 960 },
    height: { ideal: 360, max: 540 },
    frameRate: { ideal: 20, max: 24 }
  },
  hd: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 30 }
  }
};

const QUALITY_BITRATES = {
  audio: 250000,
  balanced: 900000,
  hd: 2000000
};

export const getVideoConstraintsForQuality = (preset = 'balanced') =>
  QUALITY_CONSTRAINTS[preset] || QUALITY_CONSTRAINTS.balanced;

export const getMaxBitrateForQuality = (preset = 'balanced') =>
  QUALITY_BITRATES[preset] || QUALITY_BITRATES.balanced;

export const getQualityOption = (preset = 'balanced') =>
  CALL_QUALITY_OPTIONS.find((option) => option.value === preset) || CALL_QUALITY_OPTIONS[1];

export const getBackgroundOption = (preset = 'none') =>
  BACKGROUND_OPTIONS.find((option) => option.value === preset) || BACKGROUND_OPTIONS[0];

export const formatDuration = (seconds = 0) => {
  const totalSeconds = Math.max(0, Number.parseInt(seconds, 10) || 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      remainingSeconds
    ).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

export const formatScheduleTime = (value) => {
  if (!value) {
    return 'Not scheduled';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not scheduled';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const toLocalDateTimeInputValue = (value) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const safeDate = Number.isNaN(date.getTime()) ? new Date(Date.now() + 60 * 60 * 1000) : date;
  const timezoneOffsetMs = safeDate.getTimezoneOffset() * 60 * 1000;
  return new Date(safeDate.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

export const getSessionStatusLabel = (session = {}) => {
  if (!session) {
    return 'Ready for a call';
  }

  switch (session.status) {
    case 'ringing':
      return 'Waiting for both people to join';
    case 'ongoing':
      return 'Call in progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'declined':
      return 'Declined';
    case 'missed':
      return 'Missed';
    case 'scheduled':
    default:
      return session.isUpcoming ? 'Scheduled' : 'Ready to join';
  }
};

export const getEndedReasonLabel = (value) => {
  switch (value) {
    case 'declined':
      return 'Declined';
    case 'no_answer_timeout':
      return 'Timed out';
    case 'connection_timeout':
      return 'Connection timed out';
    case 'missed':
      return 'Missed';
    case 'switched_to_messages':
      return 'Moved back to chat';
    case 'left_call_screen':
      return 'Left call screen';
    case 'back_navigation':
      return 'Exited the call';
    case 'cancelled':
      return 'Cancelled';
    case 'ended':
    default:
      return 'Ended';
  }
};

export const getNoShowLabel = (value) => {
  switch (value) {
    case 'user_1_no_show':
    case 'user_2_no_show':
      return 'One person did not join';
    case 'mutual_no_show':
      return 'Neither person joined';
    case 'none':
    default:
      return '';
  }
};

export const getTimelineLabel = (event = {}) => event.label || 'Activity';
