import {
  buildDateCheckInReminderPayload,
  buildDateSafetyReminderPayload,
  extractReminderId,
  formatDateSafetyCopy,
  getDateSafetyShareTarget,
  getShareTypeLabel,
  normalizeTrustedContacts,
} from './dateSafety';

describe('dateSafety', () => {
  test('prefers accepted proposals for safety sharing', () => {
    const target = getDateSafetyShareTarget({
      acceptedProposal: { id: 'accepted-1' },
      outgoingPendingProposal: { id: 'outgoing-1' },
    });

    expect(target).toEqual({
      type: 'accepted',
      proposal: { id: 'accepted-1' },
    });
  });

  test('builds readable date safety copy', () => {
    const copy = formatDateSafetyCopy(
      {
        proposedDate: '2030-05-20',
        proposedTime: '18:30',
        suggestedActivity: 'Coffee',
        notes: 'Riverside cafe',
      },
      'Maya',
      'date'
    );

    expect(copy).toContain('Date plan with Maya');
    expect(copy).toContain('Coffee');
    expect(copy).toContain('Notes: Riverside cafe');
  });

  test('builds a reminder payload for trusted contact sharing', () => {
    const payload = buildDateSafetyReminderPayload({
      proposal: {
        proposedDate: '2030-05-20',
        proposedTime: '18:30',
        suggestedActivity: 'Walk',
      },
      partnerName: 'Noah',
      shareType: 'tentative plan',
      note: 'Checking in after the date would help.',
    });

    expect(payload).toEqual(
      expect.objectContaining({
        title: 'Tentative plan with Noah',
        dueDate: '2030-05-20',
        dueTime: '18:30',
        category: 'Personal',
      })
    );
    expect(payload.description).toContain('Safety note: Checking in after the date would help.');
  });

  test('builds a follow-up check-in reminder after the date start time', () => {
    const payload = buildDateCheckInReminderPayload({
      proposal: {
        proposedDate: '2030-05-20',
        proposedTime: '18:30',
        suggestedActivity: 'Dinner',
      },
      partnerName: 'Noah',
      minutesAfterStart: 150,
      note: 'If I do not reply by then, please call me.',
    });

    expect(payload).toEqual(
      expect.objectContaining({
        title: 'Safety check-in after Noah',
        dueDate: '2030-05-20',
        dueTime: '21:00',
        category: 'Personal',
      })
    );
    expect(payload.description).toContain('Expected check-in by');
    expect(payload.description).toContain('Check-in note: If I do not reply by then, please call me.');
  });

  test('extracts reminder ids from common API shapes', () => {
    expect(extractReminderId({ data: { _id: 'rem-1' } })).toBe('rem-1');
    expect(extractReminderId({ id: 'rem-2' })).toBe('rem-2');
  });

  test('normalizes trusted contact payloads from service responses', () => {
    const contacts = normalizeTrustedContacts({
      contacts: [
        {
          _id: 'contact-1',
          firstName: 'Anu',
          relationship: 'Friend',
          phone: '12345',
        },
      ],
    });

    expect(contacts).toEqual([
      {
        id: 'contact-1',
        name: 'Anu',
        relationship: 'Friend',
        note: '12345',
      },
    ]);
    expect(getShareTypeLabel('accepted')).toBe('date');
    expect(getShareTypeLabel('outgoing')).toBe('tentative plan');
  });
});
