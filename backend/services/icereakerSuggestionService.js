/**
 * Icebreaker Suggestion Service
 * Generates AI-powered, context-aware opening message templates based on mutual interests
 * Tracks template performance and provides recommendations
 */

const db = require('../config/database');
const dbModels = require('../models');

/**
 * Extract common interests between two users
 */
const findMutualInterests = (user1Interests = [], user2Interests = []) => {
  if (!Array.isArray(user1Interests) || !Array.isArray(user2Interests)) {
    return [];
  }
  return user1Interests.filter(interest => 
    user2Interests.some(u2Interest => 
      u2Interest.toLowerCase().trim() === interest.toLowerCase().trim()
    )
  );
};

/**
 * AI-Generated icebreaker templates based on interests
 */
const ICEBREAKER_TEMPLATES = {
  hiking: [
    { text: "What's your favorite trail near {city}? I'm always looking for new adventure recommendations! 🥾", category: 'activity_suggestion', emoji: '🥾' },
    { text: "I noticed we both love hiking! Have you done any challenging trails recently?", category: 'shared_interest', emoji: '⛰️' },
    { text: "Mountain or forest hikes? I'm curious about your favorite type of trail.", category: 'question_based', emoji: '🏔️' }
  ],
  cooking: [
    { text: "What's your go-to recipe? I'd love to hear about your culinary adventures! 👨‍🍳", category: 'activity_suggestion', emoji: '👨‍🍳' },
    { text: "I see we're both foodies! Do you prefer cooking at home or exploring restaurants?", category: 'shared_interest', emoji: '🍳' },
    { text: "What cuisine do you enjoy cooking the most?", category: 'question_based', emoji: '🍲' }
  ],
  travel: [
    { text: "Where's on your travel bucket list? I'd love to compare notes! ✈️", category: 'activity_suggestion', emoji: '✈️' },
    { text: "We both love exploring! What was your favorite trip?", category: 'shared_interest', emoji: '🗺️' },
    { text: "Beach or mountains? Adventure or relaxation travel?", category: 'question_based', emoji: '🏖️' }
  ],
  fitness: [
    { text: "What's your favorite workout? I'm always looking for new fitness ideas! 💪", category: 'activity_suggestion', emoji: '💪' },
    { text: "I love that we're both into fitness! What's your usual routine?", category: 'shared_interest', emoji: '🏃' },
    { text: "Gym, yoga, running, or something else? Tell me about your fitness journey.", category: 'question_based', emoji: '🧘' }
  ],
  reading: [
    { text: "What books are you reading right now? I'm always looking for recommendations! 📚", category: 'activity_suggestion', emoji: '📚' },
    { text: "I see we're both bookworms! What's your favorite genre?", category: 'shared_interest', emoji: '📖' },
    { text: "Fiction or non-fiction? I'd love to hear what you're currently reading.", category: 'question_based', emoji: '✨' }
  ],
  music: [
    { text: "What's currently on your playlist? Let's compare music taste! 🎵", category: 'activity_suggestion', emoji: '🎵' },
    { text: "We both love music! What's your favorite artist right now?", category: 'shared_interest', emoji: '🎸' },
    { text: "Live concerts or studio recordings? What's your music preference?", category: 'question_based', emoji: '🎤' }
  ],
  photography: [
    { text: "What do you love photographing most? I'd love to see your work! 📸", category: 'activity_suggestion', emoji: '📸' },
    { text: "I love that we're both into photography! What's your favorite subject?", category: 'shared_interest', emoji: '🎥' },
    { text: "Landscapes, portraits, or street photography? Tell me about your style.", category: 'question_based', emoji: '🌅' }
  ],
  gaming: [
    { text: "What's your current favorite game? I'd love to join if possible! 🎮", category: 'activity_suggestion', emoji: '🎮' },
    { text: "We're both gamers! What genres do you usually play?", category: 'shared_interest', emoji: '👾' },
    { text: "Console, PC, or mobile? What's your gaming setup like?", category: 'question_based', emoji: '🕹️' }
  ],
  art: [
    { text: "What kind of art speaks to you? I'd love to discuss your favorites! 🎨", category: 'activity_suggestion', emoji: '🎨' },
    { text: "I see we both appreciate art! Museum visits or creating your own?", category: 'shared_interest', emoji: '🖼️' },
    { text: "What's the best art exhibition you've been to?", category: 'question_based', emoji: '✨' }
  ],
  coffee: [
    { text: "Coffee or tea? What's your perfect coffee shop vibe? ☕", category: 'activity_suggestion', emoji: '☕' },
    { text: "Fellow coffee lover here! What's your usual order?", category: 'shared_interest', emoji: '😋' },
    { text: "Favorite local coffee spot in {city}?", category: 'location_based', emoji: '🏪' }
  ],
  yoga: [
    { text: "What style of yoga do you practice? I'd love to compare routines! 🧘", category: 'activity_suggestion', emoji: '🧘' },
    { text: "We're both into yoga! How long have you been practicing?", category: 'shared_interest', emoji: '✨' },
    { text: "Vinyasa, Hatha, or something else? Tell me about your practice.", category: 'question_based', emoji: '🕉️' }
  ],
  wine: [
    { text: "What's your favorite wine? Let's explore a vineyard together! 🍷", category: 'activity_suggestion', emoji: '🍷' },
    { text: "I see we both enjoy wine! Red or white person?", category: 'shared_interest', emoji: '🍇' },
    { text: "Favorite wine region or varietal?", category: 'question_based', emoji: '🌾' }
  ],
  dogs: [
    { text: "Tell me about your dog! I'd love to hear their story 🐕", category: 'activity_suggestion', emoji: '🐕' },
    { text: "We're both dog lovers! What's your pup like?", category: 'shared_interest', emoji: '❤️' },
    { text: "Breed preferences? Are you a park person or homebody with your dog?", category: 'question_based', emoji: '🦴' }
  ],
  cats: [
    { text: "What's your cat's name and personality? I'd love to hear about them! 🐱", category: 'activity_suggestion', emoji: '🐱' },
    { text: "Fellow cat lover! How many do you have?", category: 'shared_interest', emoji: '😸' },
    { text: "Indoor or outdoor? Tell me about your feline friends.", category: 'question_based', emoji: '🐾' }
  ],
  volunteering: [
    { text: "What cause do you volunteer for? I love meeting passionate people! ❤️", category: 'activity_suggestion', emoji: '❤️' },
    { text: "We both volunteer! What organization are you involved with?", category: 'shared_interest', emoji: '🤝' },
    { text: "What drives your passion for volunteering?", category: 'question_based', emoji: '✨' }
  ]
};

/**
 * Generic icebreakers when specific interests aren't available
 */
const GENERIC_ICEBREAKERS = [
  { text: "Hi {firstName}! I love your profile. What's something most people don't know about you?", category: 'thoughtful', emoji: '😊' },
  { text: "You seem like an interesting person! What's your favorite way to spend a Saturday?", category: 'question_based', emoji: '✨' },
  { text: "I'd love to get to know you better. What's your biggest passion outside of work?", category: 'thoughtful', emoji: '💭' },
  { text: "Hey! Looking at your profile, I'm curious – what's your ideal date look like?", category: 'flirtation', emoji: '😄' },
  { text: "I noticed we might have some things in common. What's been making you happy lately?", category: 'shared_interest', emoji: '😊' },
  { text: "Hi {firstName}! If you could do anything this weekend, what would it be?", category: 'activity_suggestion', emoji: '🎯' }
];

/**
 * Generate context-specific icebreaker suggestions
 * @param {Object} senderProfile - Sender's dating profile
 * @param {Object} recipientProfile - Recipient's dating profile
 * @param {string} senderUserId - Sender's user ID
 * @returns {Array} Array of suggested opening messages
 */
const generateIcebreakerSuggestions = async (senderProfile, recipientProfile, senderUserId) => {
  const suggestions = [];
  const recipientCity = recipientProfile.locationCity || 'your area';
  
  try {
    // Find mutual interests
    const mutualInterests = findMutualInterests(
      senderProfile.interests || [],
      recipientProfile.interests || []
    );

    // Generate templates from mutual interests
    if (mutualInterests.length > 0) {
      for (const interest of mutualInterests.slice(0, 3)) {
        const interestKey = interest.toLowerCase().trim();
        const templates = ICEBREAKER_TEMPLATES[interestKey] || null;

        if (templates) {
          // Pick 1-2 random templates per interest
          const selected = templates.slice(0, 2);
          for (const template of selected) {
            suggestions.push({
              ...template,
              interestTrigger: interest,
              contextJson: {
                interests: [interest],
                topics: [],
                similarityFactors: ['shared_interest']
              },
              content: template.text
                .replace('{firstName}', recipientProfile.firstName || 'there')
                .replace('{city}', recipientCity),
              templateSource: 'ai_generated',
              isContextual: true
            });
          }
        }
      }
    }

    // If no mutual interests, use generic templates
    if (suggestions.length === 0) {
      const selected = GENERIC_ICEBREAKERS.slice(0, 3);
      for (const template of selected) {
        suggestions.push({
          ...template,
          content: template.text
            .replace('{firstName}', recipientProfile.firstName || 'there')
            .replace('{city}', recipientCity),
          templateSource: 'ai_generated',
          isContextual: false
        });
      }
    }

    // Add 1-2 complementary generic icebreakers
    if (suggestions.length < 4) {
      const additionalGeneric = GENERIC_ICEBREAKERS
        .filter(t => !suggestions.find(s => s.text === t.text))
        .slice(0, 4 - suggestions.length);
      
      for (const template of additionalGeneric) {
        suggestions.push({
          ...template,
          content: template.text
            .replace('{firstName}', recipientProfile.firstName || 'there')
            .replace('{city}', recipientCity),
          templateSource: 'ai_generated',
          isContextual: false
        });
      }
    }

    // Fetch any existing pinned templates from user
    const pinnedTemplates = await dbModels.MessageTemplate.findAll({
      where: {
        userId: senderUserId,
        isPinned: true
      },
      limit: 2,
      order: [['responseRatePercent', 'DESC']]
    });

    if (pinnedTemplates.length > 0) {
      const pinnedSuggestions = pinnedTemplates.map(t => ({
        id: t.id,
        content: t.content,
        category: t.category,
        emoji: t.emoji,
        interestTrigger: t.interestTrigger,
        templateSource: 'user_custom',
        isPinned: true,
        responseRate: t.responseRatePercent
      }));
      suggestions.push(...pinnedSuggestions);
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  } catch (error) {
    console.error('Error generating icebreaker suggestions:', error);
    
    // Return generic fallback
    return GENERIC_ICEBREAKERS.slice(0, 3).map(template => ({
      ...template,
      content: template.text
        .replace('{firstName}', recipientProfile.firstName || 'there')
        .replace('{city}', recipientCity),
      templateSource: 'ai_generated',
      isContextual: false
    }));
  }
};

/**
 * Track template usage and update performance metrics
 */
const trackTemplateUsage = async (templateId, matchId, fromUserId, toUserId) => {
  try {
    const template = await dbModels.MessageTemplate.findByPk(templateId);
    if (!template) return null;

    // Update usage count
    await template.update({
      usageCount: (template.usageCount || 0) + 1,
      lastUsedAt: new Date()
    });

    // Create message with template tracking
    const match = await dbModels.Match.findByPk(matchId);
    if (match) {
      // The actual message will be sent via Message.create
      // This just tracks the template usage
      return {
        templateId,
        usageCount: template.usageCount + 1,
        responseRate: template.responseRatePercent
      };
    }
  } catch (error) {
    console.error('Error tracking template usage:', error);
    throw error;
  }
};

/**
 * Track response to a template message
 */
const trackTemplateResponse = async (templateId, hasResponse = true) => {
  try {
    const template = await dbModels.MessageTemplate.findByPk(templateId);
    if (!template) return null;

    if (hasResponse) {
      const newResponseCount = (template.responseCount || 0) + 1;
      const responseRate = (newResponseCount / (template.usageCount || 1)) * 100;

      await template.update({
        responseCount: newResponseCount,
        responseRatePercent: responseRate,
        lastResponseAt: new Date(),
        engagementScore: Math.min(responseRate + 20, 100) // Boost engagement score
      });
    }

    return template;
  } catch (error) {
    console.error('Error tracking template response:', error);
    throw error;
  }
};

/**
 * Get user's top-performing templates
 */
const getTopPerformingTemplates = async (userId, limit = 10) => {
  try {
    return await dbModels.MessageTemplate.findAll({
      where: { userId },
      order: [
        ['responseRatePercent', 'DESC'],
        ['usageCount', 'DESC']
      ],
      limit,
      attributes: [
        'id', 'title', 'content', 'category', 'emoji',
        'usageCount', 'responseCount', 'responseRatePercent',
        'engagementScore', 'interestTrigger', 'lastUsedAt', 'lastResponseAt'
      ]
    });
  } catch (error) {
    console.error('Error fetching top templates:', error);
    throw error;
  }
};

/**
 * Get recommended templates based on user's best performers
 */
const getRecommendedTemplates = async (userId, limit = 5) => {
  try {
    // Get templates with good engagement that haven't been used in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return await dbModels.MessageTemplate.findAll({
      where: {
        userId,
        responseRatePercent: { [db.Sequelize.Op.gte]: 30 },
        [db.Sequelize.Op.or]: [
          { lastUsedAt: { [db.Sequelize.Op.lt]: thirtyDaysAgo } },
          { lastUsedAt: null }
        ]
      },
      order: [
        ['engagementScore', 'DESC'],
        ['responseRatePercent', 'DESC']
      ],
      limit,
      attributes: [
        'id', 'title', 'content', 'category', 'emoji',
        'responseRatePercent', 'engagementScore', 'interestTrigger'
      ]
    });
  } catch (error) {
    console.error('Error getting recommended templates:', error);
    throw error;
  }
};

/**
 * Create custom template from a sent message
 */
const saveMessageAsTemplate = async (userId, messageContent, matchId, interestTrigger = null) => {
  try {
    // Generate title from content
    const title = messageContent.substring(0, 50).trim() + (messageContent.length > 50 ? '...' : '');
    
    // Determine category based on content
    let category = 'general';
    const contentLower = messageContent.toLowerCase();
    if (contentLower.includes('question') || contentLower.includes('?')) {
      category = 'question_based';
    } else if (contentLower.includes('love') || contentLower.includes('amazing')) {
      category = 'compliment';
    }

    const template = await dbModels.MessageTemplate.create({
      userId,
      content: messageContent,
      title,
      category,
      templateSource: 'user_custom',
      interestTrigger,
      usageCount: 1,
      responseCount: 0,
      responseRatePercent: 0
    });

    return template;
  } catch (error) {
    console.error('Error saving message as template:', error);
    throw error;
  }
};

module.exports = {
  generateIcebreakerSuggestions,
  trackTemplateUsage,
  trackTemplateResponse,
  getTopPerformingTemplates,
  getRecommendedTemplates,
  saveMessageAsTemplate,
  findMutualInterests
};
