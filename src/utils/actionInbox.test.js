import { buildActionInboxItems, mergeInboundLikes } from './actionInbox';

describe('mergeInboundLikes', () => {
  test('prefers who-liked-you reveal state when duplicate users exist', () => {
    const mergedLikes = mergeInboundLikes(
      [
        {
          from_user_id: 12,
          first_name: 'Asha',
          location_city: 'Bengaluru',
          created_at: '2026-04-28T10:00:00.000Z'
        }
      ],
      [
        {
          userId: 12,
          firstName: 'Asha',
          isRevealed: false,
          likedAt: '2026-04-28T11:00:00.000Z'
        }
      ]
    );

    expect(mergedLikes).toHaveLength(1);
    expect(mergedLikes[0]).toMatchObject({
      userId: 12,
      firstName: 'Asha',
      isRevealed: false
    });
  });
});

describe('buildActionInboxItems', () => {
  test('orders requests before likes and rescue nudges', () => {
    const items = buildActionInboxItems({
      likesReceived: [
        {
          from_user_id: 7,
          first_name: 'Mira',
          location_city: 'Kochi',
          created_at: '2026-04-28T09:00:00.000Z'
        }
      ],
      messageRequests: [
        {
          id: 4,
          firstName: 'Noah',
          location: { city: 'Chennai' },
          message: 'Would love to say hi.',
          createdAt: '2026-04-28T12:00:00.000Z'
        }
      ],
      actionableMatches: [
        {
          match: {
            id: 9,
            matchedAt: '2026-04-28T08:00:00.000Z'
          },
          suggestion: {
            kind: 'ready_to_plan',
            title: 'This feels ready for a plan',
            description: 'Suggest something easy while the momentum is there.',
            ctaLabel: 'Plan date'
          }
        }
      ]
    });

    expect(items.map((item) => item.kind)).toEqual(['request', 'like', 'rescue']);
    expect(items[0]).toMatchObject({
      title: 'Noah sent a message request',
      primaryLabel: 'Accept'
    });
  });

  test('places pending date proposals ahead of likes and rescue nudges', () => {
    const items = buildActionInboxItems({
      likesReceived: [
        {
          from_user_id: 7,
          first_name: 'Mira',
          location_city: 'Kochi',
          created_at: '2026-04-28T09:00:00.000Z'
        }
      ],
      dateProposals: [
        {
          id: 19,
          proposerName: 'Nila',
          recipientName: 'You',
          suggestedActivity: 'Coffee',
          proposedDate: '2026-04-30',
          proposedTime: '18:30',
          status: 'pending',
          isReceived: true,
          createdAt: '2026-04-28T12:30:00.000Z'
        }
      ],
      actionableMatches: [
        {
          match: {
            id: 9,
            matchedAt: '2026-04-28T08:00:00.000Z'
          },
          suggestion: {
            kind: 'ready_to_plan',
            title: 'This feels ready for a plan',
            description: 'Suggest something easy while the momentum is there.',
            ctaLabel: 'Plan date'
          }
        }
      ]
    });

    expect(items.map((item) => item.kind)).toEqual(['date', 'like', 'rescue']);
    expect(items[0]).toMatchObject({
      title: 'Nila suggested Coffee',
      primaryLabel: 'Review plan'
    });
  });
});
