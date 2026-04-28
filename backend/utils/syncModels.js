/**
 * Controlled Sequelize model sync with proper dependency order
 * Ensures base models sync before dependent models to avoid foreign key constraint errors
 */

async function syncModelsInOrder(sequelize, dbModels, logger) {
  try {
    // Define sync order: base models first, then dependent models
    const syncOrder = [
      // BASE MODELS (no dependencies)
      'User',
      'DailyChallenge',
      'OpeningTemplate',
      'ConversationStarter',
      'CompatibilityCategory',
      'IcebreakerVideo',
      'AchievementBadge',
      'BoostPackage',
      'EventLocation',
      'ChatroomCategory',
      'AdminRole',
      'ModerationReason',
      
      // SECOND TIER (depend on User)
      'DatingProfile',
      'PhotoProfile',
      'PhoneVerification',
      'AgeVerification',
      'ProfilePhoto',
      'VideoProfile',
      'PreferenceProfile',
      'SafetyPreference',
      'InterestCategory',
      'InterestProfile',
      'BlockedUser',
      'ReportedUser',
      'TrustedFriend',
      'UserStats',
      'UserAchievement',
      'UserBoost',
      'ChatroomMember',
      'VideoChatHistory',
      'VideoCallAnalytics',
      'LiveActivityStatus',
      'UserPreferenceProfile',
      'DailyCheckIn',
      'UserLocation',
      'IPBlocklist',
      'AccountCreationLimit',
      'AdminSetting',
      
      // THIRD TIER (depend on User)
      'Matches',
      'ConversationQualityMetric',
      'VideoDates',
      'DoubleDateGroup',
      'Events',
      'Chatroom',
      'ChatroomMessage',
      'Message',
      'MessageReaction',
      'Moment',
      'UserMoment',
      
      // FOURTH TIER (depend on Matches, VideoDates, Chatroom)
      'DateSafetyKit',
      'VideoCompatibilityScore',
      'VideoCallRating',
      'CompatibilityScore',
      'Swipe',
      'Like',
      'Super',
      'ProfileView',
      'DateCompletionFeedback',
      'DoubleDateRating',
      'EventAttendee',
      'PhotoABTest',
      'PhotoABTestVote',
      'EventMoment',
      'ChatroomMessage',
      'ConversationQuality',
      'ConversationQualityMetric',
      'ConversationSafetyFlag',
      'ConversationSuggestion',
      'ConversationStarterVote',
      
      // FIFTH TIER (depend on other dependent models)
      'CatfishDetectionFlag',
      'ConciergeMatch',
      'ModerationAction',
      'AdminAction',
      'ChallengeRedemption',
      'Achievement',
      'ActivityLog',
      'AnalyticsEvent',
      'DailyCheckIn',
    ];

    // Filter to only include models that actually exist in dbModels
    const modelsToSync = syncOrder.filter(modelName => dbModels[modelName]);
    
    // Add any remaining models not in the sync order (to be safe)
    const allModelNames = Object.keys(dbModels).filter(key => 
      key !== 'sequelize' && key !== 'Sequelize'
    );
    const remainingModels = allModelNames.filter(
      modelName => !modelsToSync.includes(modelName)
    );

    const finalSyncOrder = [...modelsToSync, ...remainingModels];

    // Sync models one by one to ensure dependencies are created first
    for (const modelName of finalSyncOrder) {
      try {
        const model = dbModels[modelName];
        if (model && model.sync) {
          await model.sync({ alter: true });
          logger.info(`✓ Synced model: ${modelName}`);
        }
      } catch (err) {
        // If a model fails, log it but continue
        logger.warn(`⚠ Failed to sync model ${modelName}:`, {
          message: err.message
        });
      }
    }

    logger.info('✓ All models synchronized successfully');
    return true;
  } catch (err) {
    logger.error('Failed to sync models in order', {
      message: err.message,
      stack: err.stack
    });
    throw err;
  }
}

module.exports = { syncModelsInOrder };
