/**
 * Streak Tracking Migration
 * Ensures message_streak_trackers table exists with proper schema
 * Run: npm run migrate
 */

module.exports = {
  up: async (sequelize, Sequelize) => {
    const transaction = await sequelize.transaction();

    try {
      // Create message_streak_trackers table if it doesn't exist
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS message_streak_trackers (
          id SERIAL PRIMARY KEY,
          user_id_1 INTEGER NOT NULL,
          user_id_2 INTEGER NOT NULL,
          match_id INTEGER NOT NULL UNIQUE,
          streak_days INTEGER DEFAULT 1,
          is_active BOOLEAN DEFAULT true,
          streak_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_message_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          streak_broken_date TIMESTAMP,
          milestone_3_days BOOLEAN DEFAULT false,
          milestone_7_days BOOLEAN DEFAULT false,
          milestone_30_days BOOLEAN DEFAULT false,
          total_messages INTEGER DEFAULT 0,
          total_reactions INTEGER DEFAULT 0,
          engagement_score FLOAT DEFAULT 0,
          notification_sent BOOLEAN DEFAULT false,
          last_notification_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          
          FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
        );
      `, { transaction });

      // Create indexes
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_mst_user_id_1 ON message_streak_trackers(user_id_1);
      `, { transaction });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_mst_user_id_2 ON message_streak_trackers(user_id_2);
      `, { transaction });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_mst_match_id ON message_streak_trackers(match_id);
      `, { transaction });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_mst_is_active ON message_streak_trackers(is_active);
      `, { transaction });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_mst_streak_days ON message_streak_trackers(streak_days DESC);
      `, { transaction });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_mst_last_message_date ON message_streak_trackers(last_message_date DESC);
      `, { transaction });

      // Unique constraint on user pairs (normalized)
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_mst_user_pair 
        ON message_streak_trackers(
          LEAST(user_id_1, user_id_2), 
          GREATEST(user_id_1, user_id_2)
        );
      `, { transaction });

      await transaction.commit();
      console.log('✅ Streak tracking migration completed successfully');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Streak tracking migration failed:', error);
      throw error;
    }
  },

  down: async (sequelize, Sequelize) => {
    const transaction = await sequelize.transaction();

    try {
      // Drop indexes
      await sequelize.query(`
        DROP INDEX IF EXISTS idx_mst_user_id_1;
        DROP INDEX IF EXISTS idx_mst_user_id_2;
        DROP INDEX IF EXISTS idx_mst_match_id;
        DROP INDEX IF EXISTS idx_mst_is_active;
        DROP INDEX IF EXISTS idx_mst_streak_days;
        DROP INDEX IF EXISTS idx_mst_last_message_date;
        DROP INDEX IF EXISTS idx_mst_user_pair;
      `, { transaction });

      // Drop table
      await sequelize.query(`
        DROP TABLE IF EXISTS message_streak_trackers;
      `, { transaction });

      await transaction.commit();
      console.log('✅ Streak tracking migration rolled back');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Streak tracking rollback failed:', error);
      throw error;
    }
  }
};
