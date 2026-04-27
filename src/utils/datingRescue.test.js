import {
  buildFirstMessageSuggestion,
  buildPlanSuggestionMessage,
  buildReviveMessageSuggestion,
  getActionableMatches,
  getConversationRescuePlan,
  getMatchRescueSuggestion,
  hasActiveDatePlan,
} from './datingRescue';

describe('datingRescue', () => {
  const now = new Date('2030-05-20T12:00:00.000Z').getTime();

  test('builds a specific opener when a shared interest is available', () => {
    const suggestion = buildFirstMessageSuggestion({
      firstName: 'Asha',
      interests: ['hiking', 'music'],
    });

    expect(suggestion).toContain("we're both into hiking");
  });

  test('flags a brand-new match for a first message', () => {
    const suggestion = getMatchRescueSuggestion({
      id: 'match-1',
      firstName: 'Asha',
      interests: ['hiking'],
      messageCount: 0,
    }, now);

    expect(suggestion).toEqual(
      expect.objectContaining({
        kind: 'first_message',
        actionType: 'message',
      })
    );
    expect(suggestion.prefillMessage).toContain('hiking');
  });

  test('flags a quiet match for a revive nudge after three days', () => {
    const suggestion = getMatchRescueSuggestion({
      id: 'match-2',
      firstName: 'Milan',
      messageCount: 4,
      lastMessageAt: '2030-05-16T08:00:00.000Z',
      interests: ['reading'],
    }, now);

    expect(suggestion).toEqual(
      expect.objectContaining({
        kind: 'revive',
        actionType: 'message',
      })
    );
    expect(buildReviveMessageSuggestion({ firstName: 'Milan' }, 4)).toContain('checking back in');
  });

  test('marks active conversations as ready to plan', () => {
    const suggestion = getMatchRescueSuggestion({
      id: 'match-3',
      firstName: 'Nina',
      messageCount: 7,
      lastMessageAt: '2030-05-19T12:00:00.000Z',
    }, now);

    expect(suggestion).toEqual(
      expect.objectContaining({
        kind: 'ready_to_plan',
        actionType: 'plan',
        secondaryActionType: 'message',
      })
    );
    expect(buildPlanSuggestionMessage({ firstName: 'Nina' })).toContain('Would you be up for something easy');
  });

  test('suppresses rescue prompts when an active date plan already exists', () => {
    const match = {
      id: 'match-4',
      firstName: 'Dev',
      messageCount: 8,
      journey: {
        latestAcceptedProposal: {
          proposedDate: '2030-05-20',
          proposedTime: '18:30',
          status: 'accepted',
        },
      },
    };

    expect(hasActiveDatePlan(match, now)).toBe(true);
    expect(getMatchRescueSuggestion(match, now)).toBeNull();
  });

  test('sorts actionable matches by urgency', () => {
    const entries = getActionableMatches([
      {
        id: 'match-plan',
        firstName: 'Plan',
        messageCount: 7,
        lastMessageAt: '2030-05-19T12:00:00.000Z',
      },
      {
        id: 'match-new',
        firstName: 'New',
        messageCount: 0,
      },
      {
        id: 'match-stale',
        firstName: 'Stale',
        messageCount: 3,
        lastMessageAt: '2030-05-15T12:00:00.000Z',
      },
    ], now);

    expect(entries.map((entry) => entry.suggestion.kind)).toEqual([
      'first_message',
      'revive',
      'ready_to_plan',
    ]);
  });

  test('builds stale-chat rescue actions for an open conversation', () => {
    const rescuePlan = getConversationRescuePlan(
      {
        id: 'match-chat',
        firstName: 'Riya',
        interests: ['travel'],
      },
      [
        { id: 'm1', timestamp: '2030-05-16T09:00:00.000Z', text: 'Hey there' },
        { id: 'm2', timestamp: '2030-05-16T10:00:00.000Z', text: 'Hi' },
      ],
      now
    );

    expect(rescuePlan).toEqual(
      expect.objectContaining({
        label: 'Restart gently',
      })
    );
    expect(rescuePlan.actions[0]).toEqual(
      expect.objectContaining({
        type: 'message',
      })
    );
  });
});
