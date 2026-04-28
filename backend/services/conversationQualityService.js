const { ConversationQuality, ConversationSuggestion, ChatroomMessage, Match, User } = require('../models');
const { Op } = require('sequelize');

class ConversationQualityService {
  /**
   * Analyze conversation quality for a specific match
   */
  async analyzeConversationQuality(matchId, userId) {
    try {
      // Get match details
      const match = await Match.findByPk(matchId, {
        include: [
          { model: User, as: 'userOne', attributes: ['id'] },
          { model: User, as: 'userTwo', attributes: ['id'] }
        ]
      });

      if (!match) throw new Error('Match not found');

      // Determine partner ID
      const partnerId = match.userOne.id === userId ? match.userTwo.id : match.userOne.id;

      // Get conversation messages
      const messages = await ChatroomMessage.findAll({
        where: {
          chatroom_id: match.chatroom_id
        },
        order: [['createdAt', 'ASC']],
        limit: 500
      });

      if (messages.length === 0) {
        return {
          totalMessages: 0,
          conversationDepthScore: 0,
          engagementScore: 0,
          connectionQuality: 'developing',
          percentileRank: 0,
          message: 'Start the conversation to see quality metrics'
        };
      }

      // Calculate metrics
      const metrics = this.calculateMetrics(messages, userId, partnerId);
      const engagement = this.calculateEngagement(messages);
      const depthScore = this.calculateDepthScore(metrics, engagement);
      const engagementScore = this.calculateEngagementScore(engagement);
      const connectionQuality = this.determineConnectionQuality(depthScore, engagementScore);
      const percentileRank = await this.calculatePercentileRank(depthScore);

      // Update or create conversation quality record
      const [qualityRecord] = await ConversationQuality.findOrCreate({
        where: { match_id: matchId },
        defaults: {
          match_id: matchId,
          user_id: userId,
          partner_user_id: partnerId,
          total_messages: metrics.totalMessages,
          avg_message_length: metrics.avgMessageLength,
          avg_response_time: metrics.avgResponseTime,
          conversation_depth_score: depthScore,
          engagement_score: engagementScore,
          connection_quality: connectionQuality,
          percentile_rank: percentileRank,
          topics_discussed: metrics.topicsDiscussed,
          question_asked_count: metrics.questionsAsked,
          last_analyzed_at: new Date()
        }
      });

      // Update if exists
      if (qualityRecord.id) {
        await qualityRecord.update({
          total_messages: metrics.totalMessages,
          avg_message_length: metrics.avgMessageLength,
          avg_response_time: metrics.avgResponseTime,
          conversation_depth_score: depthScore,
          engagement_score: engagementScore,
          connection_quality: connectionQuality,
          percentile_rank: percentileRank,
          topics_discussed: metrics.topicsDiscussed,
          question_asked_count: metrics.questionsAsked,
          last_analyzed_at: new Date()
        });
      }

      return {
        totalMessages: metrics.totalMessages,
        avgMessageLength: Math.round(metrics.avgMessageLength),
        avgResponseTime: Math.round(metrics.avgResponseTime),
        conversationDepthScore: Math.round(depthScore),
        engagementScore: Math.round(engagementScore),
        connectionQuality,
        percentileRank: Math.round(percentileRank),
        topicsDiscussed: metrics.topicsDiscussed,
        questionsAsked: metrics.questionsAsked,
        depthMetrics: {
          messageLength: metrics.avgMessageLength > 50 ? 'Excellent' : metrics.avgMessageLength > 30 ? 'Good' : 'Could be deeper',
          responseTime: metrics.avgResponseTime < 60 ? 'Fast' : metrics.avgResponseTime < 240 ? 'Normal' : 'Slow',
          questions: metrics.questionsAsked > 0 ? 'Curious' : 'Could ask more',
          topics: metrics.topicsDiscussed.length,
          variety: metrics.topicsDiscussed.length > 3 ? 'Diverse' : 'Limited'
        }
      };
    } catch (error) {
      console.error('Error analyzing conversation quality:', error);
      throw error;
    }
  }

  /**
   * Calculate core metrics from messages
   */
  calculateMetrics(messages, userId, partnerId) {
    let totalMessageLength = 0;
    let userMessages = [];
    let partnerMessages = [];
    let questionsAsked = 0;
    let topicsSet = new Set();
    let responseTimes = [];

    // Separate messages by sender
    messages.forEach((msg, index) => {
      const isFromUser = msg.sender_id === userId;
      const text = msg.message || '';

      totalMessageLength += text.length;

      if (isFromUser) {
        userMessages.push(msg);
      } else {
        partnerMessages.push(msg);
      }

      // Count questions
      if (text.includes('?')) {
        questionsAsked++;
      }

      // Extract topics (simple keyword detection)
      topicsSet = this.extractTopics(text, topicsSet);

      // Calculate response time
      if (index > 0) {
        const prevMessage = messages[index - 1];
        if (prevMessage.sender_id !== msg.sender_id) {
          const timeDiff = new Date(msg.createdAt) - new Date(prevMessage.createdAt);
          responseTimes.push(timeDiff / 60000); // Convert to minutes
        }
      }
    });

    const avgMessageLength = messages.length > 0 ? totalMessageLength / messages.length : 0;
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    return {
      totalMessages: messages.length,
      avgMessageLength,
      avgResponseTime,
      questionsAsked,
      topicsDiscussed: Array.from(topicsSet),
      userMessageCount: userMessages.length,
      partnerMessageCount: partnerMessages.length
    };
  }

  /**
   * Extract topics from message text
   */
  extractTopics(text, topicsSet) {
    const topicKeywords = {
      'travel': ['travel', 'trip', 'vacation', 'adventure', 'destination', 'flew', 'visited'],
      'work': ['work', 'job', 'career', 'boss', 'company', 'project', 'industry'],
      'hobbies': ['hobby', 'hobbies', 'interested in', 'like', 'enjoy', 'love doing', 'passion'],
      'family': ['family', 'parents', 'siblings', 'mother', 'father', 'brother', 'sister'],
      'food': ['food', 'restaurant', 'cook', 'eat', 'pizza', 'sushi', 'dinner', 'lunch'],
      'movies': ['movie', 'film', 'watch', 'netflix', 'cinema', 'actor', 'show'],
      'sports': ['sports', 'gym', 'workout', 'run', 'football', 'basketball', 'tennis'],
      'music': ['music', 'song', 'concert', 'artist', 'band', 'listen', 'spotify'],
      'education': ['school', 'university', 'college', 'degree', 'study', 'graduate', 'major'],
      'goals': ['goal', 'plan', 'want to', 'dream', 'future', 'aspiration', 'bucket list'],
      'relationships': ['relationship', 'date', 'ex', 'love', 'connected', 'single'],
      'personality': ['introvert', 'extrovert', 'personality', 'type', 'trait', 'character']
    };

    const lowerText = text.toLowerCase();

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        topicsSet.add(topic);
      }
    }

    return topicsSet;
  }

  /**
   * Calculate engagement score
   */
  calculateEngagement(messages) {
    // Analyze engagement indicators
    const emojis = messages.filter(m => /\p{Emoji}/u.test(m.message || '')).length;
    const exclamations = messages.filter(m => (m.message || '').includes('!')).length;
    const questions = messages.filter(m => (m.message || '').includes('?')).length;

    return {
      emojiUsage: emojis / messages.length,
      exclamationUsage: exclamations / messages.length,
      questionUsage: questions / messages.length
    };
  }

  /**
   * Calculate depth score (0-100)
   */
  calculateDepthScore(metrics, engagement) {
    const messageLengthScore = Math.min((metrics.avgMessageLength / 100) * 30, 30);
    const responseTimeScore = this.getResponseTimeScore(metrics.avgResponseTime);
    const questionScore = Math.min((metrics.questionsAsked / 5) * 20, 20);
    const topicsScore = Math.min((metrics.topicsDiscussed.length / 6) * 20, 20);
    const engagementScore = ((engagement.emojiUsage + engagement.exclamationUsage) * 10);

    return Math.min(
      messageLengthScore + responseTimeScore + questionScore + topicsScore + engagementScore,
      100
    );
  }

  /**
   * Calculate engagement score (0-100)
   */
  calculateEngagementScore(engagement) {
    const emojiScore = Math.min(engagement.emojiUsage * 100, 25);
    const questionScore = Math.min(engagement.questionUsage * 100, 35);
    const exclamationScore = Math.min(engagement.exclamationUsage * 100, 40);

    return Math.min(emojiScore + questionScore + exclamationScore, 100);
  }

  /**
   * Score based on response time
   */
  getResponseTimeScore(avgResponseTime) {
    if (avgResponseTime < 5) return 30; // Very fast
    if (avgResponseTime < 15) return 28; // Fast
    if (avgResponseTime < 60) return 25; // Reasonable
    if (avgResponseTime < 240) return 20; // Slow but okay
    return 10; // Very slow
  }

  /**
   * Determine connection quality level
   */
  determineConnectionQuality(depthScore, engagementScore) {
    const combined = (depthScore + engagementScore) / 2;

    if (combined >= 75) return 'excellent';
    if (combined >= 55) return 'good';
    if (combined >= 35) return 'moderate';
    return 'developing';
  }

  /**
   * Calculate percentile rank (what percentage of conversations is this better than)
   */
  async calculatePercentileRank(depthScore) {
    const totalConversations = await ConversationQuality.count();
    
    if (totalConversations === 0) return 50; // Default to middle

    const betterConversations = await ConversationQuality.count({
      where: {
        conversation_depth_score: { [Op.gt]: depthScore }
      }
    });

    return Math.round(((totalConversations - betterConversations) / totalConversations) * 100);
  }

  /**
   * Generate AI-powered suggestions
   */
  async generateSuggestions(matchId, userId) {
    try {
      // Get conversation quality
      const quality = await this.analyzeConversationQuality(matchId, userId);

      // Get recent messages
      const match = await Match.findByPk(matchId);
      const recentMessages = await ChatroomMessage.findAll({
        where: { chatroom_id: match.chatroom_id },
        order: [['createdAt', 'DESC']],
        limit: 30
      });

      const suggestions = [];

      // Rule 1: If conversation is new, suggest icebreaker
      if (quality.totalMessages < 5) {
        suggestions.push({
          type: 'icebreaker',
          text: this.generateIcebreakerSuggestion(),
          reason: 'Start with a fun icebreaker to break the ice'
        });
      }

      // Rule 2: If few questions asked, suggest asking questions
      if (quality.questionsAsked < quality.totalMessages * 0.1) {
        suggestions.push({
          type: 'question',
          text: this.generateCuriousQuestion(quality.topicsDiscussed),
          reason: 'Ask a question to show genuine interest'
        });
      }

      // Rule 3: If response time is slow, suggest something engaging
      if (quality.avgResponseTime > 180) {
        suggestions.push({
          type: 'light_topic',
          text: this.generateLightTopic(),
          reason: 'Try a fun/light topic to re-engage'
        });
      }

      // Rule 4: If conversation is progressing well, suggest deeper topic
      if (quality.conversationDepthScore > 50 && quality.totalMessages > 20) {
        suggestions.push({
          type: 'deep_dive',
          text: this.generateDeepDiveQuestion(quality.topicsDiscussed),
          reason: 'Deepen the conversation with meaningful questions'
        });
      }

      // Rule 5: Continue existing topics
      if (quality.topicsDiscussed.length > 0) {
        suggestions.push({
          type: 'topic_continuation',
          text: this.generateTopicContinuation(quality.topicsDiscussed),
          reason: `Continue discussing ${quality.topicsDiscussed[0]}`
        });
      }

      // Rule 6: If excellent depth, suggest connection builder
      if (quality.conversationDepthScore > 70) {
        suggestions.push({
          type: 'connection_builder',
          text: this.generateConnectionBuilder(),
          reason: 'Take it to the next level with a meaningful gesture'
        });
      }

      // Save top 3 suggestions
      const topSuggestions = suggestions.slice(0, 3);

      for (const suggestion of topSuggestions) {
        await ConversationSuggestion.create({
          match_id: matchId,
          user_id: userId,
          suggestion_type: suggestion.type,
          suggestion_text: suggestion.text,
          context: { reason: suggestion.reason },
          relevant_topics: quality.topicsDiscussed
        });
      }

      return topSuggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      throw error;
    }
  }

  /**
   * Icebreaker suggestions
   */
  generateIcebreakerSuggestion() {
    const icebreakers = [
      "So what's your story? How did you end up here in the city?",
      "What's something people always get wrong about you?",
      "If you could have dinner with anyone, who would it be?",
      "What's your go-to karaoke song? 🎤",
      "What's the weirdest talent you have?",
      "If you could live anywhere, where would it be?",
      "What's your unpopular opinion? 👀",
      "Beach or mountains for vacation?",
      "What's your comfort show/movie you watch over and over?"
    ];

    return icebreakers[Math.floor(Math.random() * icebreakers.length)];
  }

  /**
   * Generate curious questions
   */
  generateCuriousQuestion(topics) {
    const questionsByTopic = {
      'travel': [
        "What's the most memorable trip you've taken?",
        "Where's on your bucket list that you haven't been yet?",
        "Best travel story you have?"
      ],
      'work': [
        "What's your dream job?",
        "What do you love most about what you do?",
        "Any big projects you're working on?"
      ],
      'hobbies': [
        "How did you get into that hobby?",
        "What's the most rewarding part about it?",
        "Any hidden talents you're working on?"
      ],
      'food': [
        "What's your go-to comfort food?",
        "Any cuisines you're dying to try?",
        "You cook or prefer dining out?"
      ],
      'movies': [
        "What was the last movie that really stuck with you?",
        "Any underrated films you'd recommend?",
        "Netflix binger or movie theater enthusiast?"
      ],
      'goals': [
        "What's something you're working towards right now?",
        "Where do you see yourself in 5 years?",
        "What would feel like a win for you?"
      ]
    };

    if (topics.length > 0) {
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const questions = questionsByTopic[topic] || questionsByTopic['hobbies'];
      return questions[Math.floor(Math.random() * questions.length)];
    }

    return "What's something you're passionate about?";
  }

  /**
   * Generate light/fun topics
   */
  generateLightTopic() {
    const lightTopics = [
      "Random question: If you were a pizza topping, what would you be? 🍕",
      "What's your take on hot dogs - sandwich or not? 🌭",
      "Okay but what's your Starbucks order? ☕",
      "Tea or coffee person? And why are you right? 😄",
      "If you could have any superpower for just one day, what would it be?",
      "What's a skill you wish you had?",
      "What always makes you laugh?"
    ];

    return lightTopics[Math.floor(Math.random() * lightTopics.length)];
  }

  /**
   * Generate deep dive questions
   */
  generateDeepDiveQuestion(topics) {
    const deepQuestions = [
      "What's something you believe that most people don't?",
      "What's a life lesson that really changed your perspective?",
      "What are you looking for in a meaningful connection?",
      "What's something you're scared to try but want to?",
      "What do you value most in the people you're close to?",
      "What's a goal that feels really important but also really scary?",
      "What does your ideal weekend look like, and why?"
    ];

    return deepQuestions[Math.floor(Math.random() * deepQuestions.length)];
  }

  /**
   * Generate topic continuation
   */
  generateTopicContinuation(topics) {
    if (topics.length === 0) return "Tell me more about that!";
    
    const topic = topics[0];
    const continuations = {
      'travel': `I love that you mentioned travel! Tell me more about your travel style - are you a planner or spontaneous adventurer?`,
      'work': `That's cool what you do! What's the best part about your job?`,
      'hobbies': `That sounds awesome! How often do you get to do that?`,
      'family': `Family's important! How do you stay close with them?`,
      'goals': `I respect that! What's your plan to make it happen?`,
      'music': `Great taste! What got you into that artist/genre?`,
      'sports': `That's awesome! How long have you been into that?`
    };

    return continuations[topic] || `Tell me more about ${topic}!`;
  }

  /**
   * Generate connection builder
   */
  generateConnectionBuilder() {
    const builders = [
      "I've really enjoyed getting to know you. Want to grab coffee and continue this in person?",
      "This conversation has been great. I'd love to see you and explore more!",
      "You seem really cool. Should we make this real and meet up soon?",
      "I'm feeling a real connection here. Interested in meeting up?",
      "I could talk to you for hours. Want to continue this over dinner? 🍽️"
    ];

    return builders[Math.floor(Math.random() * builders.length)];
  }

  /**
   * Get previous suggestions for a match
   */
  async getPreviousSuggestions(matchId, userId, limit = 5) {
    try {
      const suggestions = await ConversationSuggestion.findAll({
        where: {
          match_id: matchId,
          user_id: userId
        },
        order: [['suggested_at', 'DESC']],
        limit
      });

      return suggestions;
    } catch (error) {
      console.error('Error fetching previous suggestions:', error);
      throw error;
    }
  }

  /**
   * Mark suggestion as used
   */
  async markSuggestionUsed(suggestionId, rating = null) {
    try {
      const suggestion = await ConversationSuggestion.findByPk(suggestionId);

      if (!suggestion) throw new Error('Suggestion not found');

      await suggestion.update({
        was_used: true,
        used_at: new Date(),
        user_rating: rating
      });

      return suggestion;
    } catch (error) {
      console.error('Error marking suggestion used:', error);
      throw error;
    }
  }

  /**
   * Get quality insights
   */
  async getQualityInsights(matchId) {
    try {
      const quality = await ConversationQuality.findOne({
        where: { match_id: matchId }
      });

      if (!quality) {
        return { message: 'No data yet' };
      }

      const insights = [];

      if (quality.conversation_depth_score > 70) {
        insights.push({
          type: 'excellent',
          message: `🔥 This conversation is in the top 10% for depth!`,
          detail: `You've built an amazing connection with ${quality.percentile_rank}th percentile ranking.`
        });
      } else if (quality.conversation_depth_score > 50) {
        insights.push({
          type: 'good',
          message: `👍 Good connection building here`,
          detail: `Keep asking questions and sharing more to deepen it.`
        });
      } else if (quality.conversation_depth_score > 30) {
        insights.push({
          type: 'developing',
          message: `💭 Conversation is just getting started`,
          detail: `Try asking some deeper questions to build more connection.`
        });
      }

      // Response time insight
      if (quality.avg_response_time < 5) {
        insights.push({
          type: 'engagement',
          message: `⚡ You're both super engaged!`,
          detail: `Quick back-and-forth conversations are a great sign.`
        });
      } else if (quality.avg_response_time > 240) {
        insights.push({
          type: 'caution',
          message: `⏱️ Responses are slow on average`,
          detail: `Try sending something that gets them excited to reply!`
        });
      }

      // Topics insight
      if (quality.topics_discussed.length >= 5) {
        insights.push({
          type: 'variety',
          message: `🌈 Great topic variety!`,
          detail: `You've discussed ${quality.topics_discussed.length} different topics - that's a strong sign.`
        });
      }

      return { insights, quality };
    } catch (error) {
      console.error('Error getting quality insights:', error);
      throw error;
    }
  }
}

module.exports = new ConversationQualityService();
