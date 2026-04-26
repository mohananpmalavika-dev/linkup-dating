import {
  formatDuration,
  formatScheduleTime,
  getEndedReasonLabel,
  getNoShowLabel,
  getSessionStatusLabel,
  getVideoConstraintsForQuality,
  toLocalDateTimeInputValue
} from './videoDatingUtils';

describe('videoDatingUtils', () => {
  test('maps quality presets to video constraints', () => {
    expect(getVideoConstraintsForQuality('audio')).toMatchObject({
      width: { ideal: 320 },
      frameRate: { ideal: 10 }
    });

    expect(getVideoConstraintsForQuality('hd')).toMatchObject({
      width: { ideal: 1280 },
      height: { ideal: 720 }
    });
  });

  test('formats durations with zero padding', () => {
    expect(formatDuration(9)).toBe('00:09');
    expect(formatDuration(125)).toBe('02:05');
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  test('builds a datetime-local safe value', () => {
    expect(toLocalDateTimeInputValue('2026-04-27T10:45:00.000Z')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
    );
  });

  test('returns human readable session labels', () => {
    expect(getSessionStatusLabel({ status: 'ringing' })).toBe('Waiting for both people to join');
    expect(getSessionStatusLabel({ status: 'scheduled', isUpcoming: true })).toBe('Scheduled');
    expect(getEndedReasonLabel('no_answer_timeout')).toBe('Timed out');
    expect(getNoShowLabel('mutual_no_show')).toBe('Neither person joined');
  });

  test('formats schedule times defensively', () => {
    expect(formatScheduleTime(null)).toBe('Not scheduled');
    expect(formatScheduleTime('not-a-date')).toBe('Not scheduled');
  });
});
