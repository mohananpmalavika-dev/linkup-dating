import {
  buildLocalIdentityPack,
  buildTrustSummary,
  calculateConversationHealth,
  buildVideoDateExperience
} from './datingPhaseTwo';

describe('datingPhaseTwo helpers', () => {
  test('builds local identity packs with city prompts, language starters, and cultural badges', () => {
    const pack = buildLocalIdentityPack(
      {
        location: { city: 'Bengaluru' },
        languages: ['English', 'Kannada'],
        communityPreference: 'Malayali',
        conversationStyle: 'deep'
      },
      {
        languages: ['English']
      }
    );

    expect(pack.cityVibe).toBe('Cafe-and-curiosity');
    expect(pack.cityBasedPrompts.length).toBeGreaterThan(0);
    expect(pack.languageIcebreakers[0]).toMatch(/We both speak English/i);
    expect(pack.culturalBadges.map((badge) => badge.label)).toEqual(
      expect.arrayContaining(['Bengaluru local', 'Multilingual', 'Malayali', 'deep communicator'])
    );
  });

  test('treats Trivandrum as Thiruvananthapuram for Kerala-local identity packs', () => {
    const pack = buildLocalIdentityPack({
      location: {
        city: 'Trivandrum',
        locality: 'Kowdiar',
        district: 'Thiruvananthapuram',
        keralaRegion: 'south'
      }
    });

    expect(pack.cityVibe).toBe('Coastal-and-composed');
    expect(pack.culturalBadges.map((badge) => badge.label)).toEqual(
      expect.arrayContaining(['Kowdiar nearby', 'Thiruvananthapuram local', 'South Kerala'])
    );
  });

  test('builds a clearer trust summary with ladder steps and warnings', () => {
    const summary = buildTrustSummary({
      profile: {
        photos: ['one'],
        voiceIntroUrl: null,
        verifications: { email: true, phone: true, id: false },
        profileVerified: false
      },
      trustScore: {
        trustScore: {
          overallScore: 72,
          riskLevel: 'low',
          verifications: {
            photoVerified: false,
            emailVerified: true,
            phoneVerified: true
          }
        }
      },
      verificationStatus: {
        verificationStatus: 'pending'
      }
    });

    expect(summary.level).toBe('pending');
    expect(summary.ladder.find((step) => step.key === 'email')?.completed).toBe(true);
    expect(summary.photoChecks.find((check) => check.label === 'At least 3 photos')?.passed).toBe(false);
    expect(summary.warnings).toEqual(
      expect.arrayContaining([
        'Verification is still in progress.',
        'More clear photos would strengthen trust.'
      ])
    );
  });

  test('scores a healthy conversation and identifies when a call nudge makes sense', () => {
    const health = calculateConversationHealth({
      match: { messageCount: 8 },
      currentUserId: 10,
      messages: [
        { id: 1, fromUserId: 10, text: 'I liked the part of your profile about travel. What place changed you the most?', createdAt: new Date().toISOString() },
        { id: 2, fromUserId: 42, text: 'Probably Hampi. It slowed me down in a good way. What about you?', createdAt: new Date().toISOString() },
        { id: 3, fromUserId: 10, text: 'Kochi does that for me. I can talk about places and food for hours.', createdAt: new Date().toISOString() }
      ]
    });

    expect(health.score).toBeGreaterThanOrEqual(60);
    expect(health.readyForCall).toBe(true);
    expect(health.nextBestMove).toBe('Suggest a call or date');
  });

  test('suggests booking another date after a strong video call', () => {
    const experience = buildVideoDateExperience({
      match: {
        firstName: 'Asha',
        interests: ['Photography']
      },
      identityPack: {
        cityBasedPrompts: ['What part of your city still surprises you?'],
        languageIcebreakers: ['We both speak English. What phrase feels most like you?']
      },
      feedback: {
        rating: 5,
        wouldMeetInPerson: true
      },
      latestSession: {
        note: 'Talk about your favorite weekend reset'
      }
    });

    expect(experience.preCallPrompts.length).toBeGreaterThan(0);
    expect(experience.postCallSuggestions[0]).toMatch(/strong call/i);
    expect(experience.showBookAnotherDateCta).toBe(true);
  });
});
