/**
 * Leaderboard Service
 * Handles monthly rankings, voting, and leaderboard updates
 */

const db = require('../config/database');

class LeaderboardService {
  /**
   * Update monthly leaderboards for a city/interest
   */
  static async updateMonthlyLeaderboards() {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Get all cities
      const citiesResult = await db.query(
        `SELECT DISTINCT location_city FROM dating_profiles WHERE location_city IS NOT NULL`
      );

      // Update "Most Active" by city
      for (const row of citiesResult.rows) {
        const city = row.location_city;
        await this.updateCityLeaderboard(city, month, year);
      }

      // Get all interests
      const interestsResult = await db.query(
        `SELECT DISTINCT unnest(interests) as interest FROM dating_profiles WHERE interests IS NOT NULL`
      );

      // Update "Most Active" by interest
      for (const row of interestsResult.rows) {
        const interest = row.interest;
        await this.updateInterestLeaderboard(interest, month, year);
      }

      // Update "Best Conversation Starters"
      await this.updateConversationStartersLeaderboard(month, year);

      return { success: true, month, year };
    } catch (error) {
      console.error('Error updating leaderboards:', error);
      throw error;
    }
  }

  /**
   * Update "Most Active" leaderboard for a specific city
   */
  static async updateCityLeaderboard(city, month, year) {
    try {
      // Get users in city with activity score (messages sent/received in current month)
      const query = `
        WITH user_scores AS (
          SELECT 
            u.id as user_id,
            COUNT(m.id) as activity_score
          FROM users u
          JOIN dating_profiles dp ON u.id = dp.user_id
          LEFT JOIN messages m ON (m.from_user_id = u.id OR m.to_user_id = u.id)
            AND EXTRACT(YEAR FROM m.created_at) = $2
            AND EXTRACT(MONTH FROM m.created_at) = $1
          WHERE dp.location_city = $3
          GROUP BY u.id
          HAVING COUNT(m.id) > 0
          ORDER BY activity_score DESC
        ),
        ranked_users AS (
          SELECT 
            user_id,
            activity_score,
            ROW_NUMBER() OVER (ORDER BY activity_score DESC) as rank
          FROM user_scores
          LIMIT 100
        )
        SELECT * FROM ranked_users
      `;

      const result = await db.query(query, [month, year, city]);

      // Clear old entries for this city/month/year
      await db.query(
        `DELETE FROM leaderboards 
         WHERE leaderboard_type = 'most_active_city' 
         AND city = $1 AND month = $2 AND year = $3`,
        [city, month, year]
      );

      // Insert new rankings
      for (const row of result.rows) {
        await db.query(
          `INSERT INTO leaderboards (
            user_id, leaderboard_type, city, rank, score, period, month, year, is_active
          ) VALUES ($1, 'most_active_city', $2, $3, $4, 'monthly', $5, $6, TRUE)`,
          [row.user_id, city, row.rank, row.activity_score, month, year]
        );
      }

      return result.rows.length;
    } catch (error) {
      console.error('Error updating city leaderboard:', error);
      throw error;
    }
  }

  /**
   * Update "Most Active" leaderboard for a specific interest
   */
  static async updateInterestLeaderboard(interest, month, year) {
    try {
      const query = `
        WITH user_scores AS (
          SELECT 
            u.id as user_id,
            COUNT(m.id) as activity_score
          FROM users u
          JOIN dating_profiles dp ON u.id = dp.user_id
          LEFT JOIN messages m ON (m.from_user_id = u.id OR m.to_user_id = u.id)
            AND EXTRACT(YEAR FROM m.created_at) = $2
            AND EXTRACT(MONTH FROM m.created_at) = $1
          WHERE dp.interests @> ARRAY[$3]
          GROUP BY u.id
          HAVING COUNT(m.id) > 0
          ORDER BY activity_score DESC
        ),
        ranked_users AS (
          SELECT 
            user_id,
            activity_score,
            ROW_NUMBER() OVER (ORDER BY activity_score DESC) as rank
          FROM user_scores
          LIMIT 100
        )
        SELECT * FROM ranked_users
      `;

      const result = await db.query(query, [month, year, interest]);

      // Clear old entries
      await db.query(
        `DELETE FROM leaderboards 
         WHERE leaderboard_type = 'most_active_interest' 
         AND interest = $1 AND month = $2 AND year = $3`,
        [interest, month, year]
      );

      // Insert new rankings
      for (const row of result.rows) {
        await db.query(
          `INSERT INTO leaderboards (
            user_id, leaderboard_type, interest, rank, score, period, month, year, is_active
          ) VALUES ($1, 'most_active_interest', $2, $3, $4, 'monthly', $5, $6, TRUE)`,
          [row.user_id, interest, row.rank, row.activity_score, month, year]
        );
      }

      return result.rows.length;
    } catch (error) {
      console.error('Error updating interest leaderboard:', error);
      throw error;
    }
  }

  /**
   * Update "Best Conversation Starters" leaderboard (vote-based)
   */
  static async updateConversationStartersLeaderboard(month, year) {
    try {
      // Clear old entries
      await db.query(
        `DELETE FROM leaderboards 
         WHERE leaderboard_type = 'best_conversation_starters' 
         AND month = $1 AND year = $2`,
        [month, year]
      );

      const query = `
        WITH ranked_starters AS (
          SELECT 
            csv.voted_for_user_id as user_id,
            COUNT(csv.id) as vote_count,
            ROW_NUMBER() OVER (ORDER BY COUNT(csv.id) DESC) as rank
          FROM conversation_starter_votes csv
          WHERE EXTRACT(YEAR FROM csv.created_at) = $2
            AND EXTRACT(MONTH FROM csv.created_at) = $1
          GROUP BY csv.voted_for_user_id
          ORDER BY vote_count DESC
          LIMIT 100
        )
        SELECT * FROM ranked_starters
      `;

      const result = await db.query(query, [month, year]);

      // Insert new rankings
      for (const row of result.rows) {
        await db.query(
          `INSERT INTO leaderboards (
            user_id, leaderboard_type, rank, score, period, month, year, votes_received, is_active
          ) VALUES ($1, 'best_conversation_starters', $2, $3, 'monthly', $4, $5, $6, TRUE)`,
          [row.user_id, row.rank, row.vote_count, month, year, row.vote_count]
        );
      }

      return result.rows.length;
    } catch (error) {
      console.error('Error updating conversation starters leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard for a city
   */
  static async getCityLeaderboard(city, limit = 20) {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Special case for "global" - aggregate all cities
      if (city.toLowerCase() === 'global') {
        const result = await db.query(
          `SELECT 
            l.rank, l.score, u.id, dp.first_name, dp.age, dp.location_city,
            (SELECT COUNT(*) FROM profile_photos WHERE user_id = u.id LIMIT 1) as photo_count
           FROM leaderboards l
           JOIN users u ON u.id = l.user_id
           JOIN dating_profiles dp ON dp.user_id = u.id
           WHERE l.leaderboard_type = 'most_active_city'
           AND l.month = $1
           AND l.year = $2
           ORDER BY l.rank ASC
           LIMIT $3`,
          [month, year, limit]
        );

        return result.rows;
      }

      const result = await db.query(
        `SELECT 
          l.rank, l.score, u.id, dp.first_name, dp.age, dp.location_city,
          (SELECT COUNT(*) FROM profile_photos WHERE user_id = u.id LIMIT 1) as photo_count
         FROM leaderboards l
         JOIN users u ON u.id = l.user_id
         JOIN dating_profiles dp ON dp.user_id = u.id
         WHERE l.leaderboard_type = 'most_active_city'
         AND l.city = $1
         AND l.month = $2
         AND l.year = $3
         ORDER BY l.rank ASC
         LIMIT $4`,
        [city, month, year, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting city leaderboard:', error);
      return [];
    }
  }

  /**
   * Get leaderboard for an interest
   */
  static async getInterestLeaderboard(interest, limit = 20) {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const result = await db.query(
        `SELECT 
          l.rank, l.score, u.id, dp.first_name, dp.age,
          (SELECT COUNT(*) FROM profile_photos WHERE user_id = u.id LIMIT 1) as photo_count
         FROM leaderboards l
         JOIN users u ON u.id = l.user_id
         JOIN dating_profiles dp ON dp.user_id = u.id
         WHERE l.leaderboard_type = 'most_active_interest'
         AND l.interest = $1
         AND l.month = $2
         AND l.year = $3
         ORDER BY l.rank ASC
         LIMIT $4`,
        [interest, month, year, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting interest leaderboard:', error);
      return [];
    }
  }

  /**
   * Get "Best Conversation Starters" leaderboard
   */
  static async getConversationStartersLeaderboard(limit = 20) {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const result = await db.query(
        `SELECT 
          l.rank, l.votes_received as score, u.id, dp.first_name, dp.age,
          (SELECT COUNT(*) FROM profile_photos WHERE user_id = u.id LIMIT 1) as photo_count,
          (SELECT STRING_AGG(reason, '; ') FROM conversation_starter_votes WHERE voted_for_user_id = u.id LIMIT 5) as top_reasons
         FROM leaderboards l
         JOIN users u ON u.id = l.user_id
         JOIN dating_profiles dp ON dp.user_id = u.id
         WHERE l.leaderboard_type = 'best_conversation_starters'
         AND l.month = $1
         AND l.year = $2
         ORDER BY l.rank ASC
         LIMIT $3`,
        [month, year, limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting conversation starters leaderboard:', error);
      return [];
    }
  }

  /**
   * Vote for someone as a great conversation starter
   */
  static async voteConversationStarter(votedByUserId, votedForUserId, reason = null) {
    try {
      // Check if already voted
      const existingResult = await db.query(
        `SELECT id FROM conversation_starter_votes 
         WHERE voted_by_user_id = $1 AND voted_for_user_id = $2`,
        [votedByUserId, votedForUserId]
      );

      if (existingResult.rows.length > 0) {
        // Update existing vote
        await db.query(
          `UPDATE conversation_starter_votes SET reason = $1, created_at = NOW()
           WHERE voted_by_user_id = $2 AND voted_for_user_id = $3`,
          [reason, votedByUserId, votedForUserId]
        );
        return { success: true, action: 'updated' };
      }

      // Create new vote
      await db.query(
        `INSERT INTO conversation_starter_votes (voted_by_user_id, voted_for_user_id, reason)
         VALUES ($1, $2, $3)`,
        [votedByUserId, votedForUserId, reason]
      );

      return { success: true, action: 'created' };
    } catch (error) {
      console.error('Error voting for conversation starter:', error);
      throw error;
    }
  }

  /**
   * Get user's leaderboard positions
   */
  static async getUserLeaderboardPositions(userId) {
    try {
      const result = await db.query(
        `SELECT 
          leaderboard_type, city, interest, rank, score, period,
          MONTH, YEAR, votes_received
         FROM leaderboards
         WHERE user_id = $1
         ORDER BY rank ASC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting user leaderboard positions:', error);
      return [];
    }
  }

  /**
   * Get all distinct cities
   */
  static async getCities() {
    try {
      const result = await db.query(
        `SELECT DISTINCT location_city as city 
         FROM dating_profiles 
         WHERE location_city IS NOT NULL 
         ORDER BY location_city ASC`
      );

      return result.rows.map(row => row.city).filter(city => city && city.trim());
    } catch (error) {
      console.error('Error getting cities:', error);
      return [];
    }
  }

  /**
   * Get all distinct interests
   */
  static async getInterests() {
    try {
      const result = await db.query(
        `SELECT DISTINCT unnest(interests) as interest 
         FROM dating_profiles 
         WHERE interests IS NOT NULL AND array_length(interests, 1) > 0
         ORDER BY interest ASC`
      );

      return result.rows.map(row => row.interest).filter(interest => interest && interest.trim());
    } catch (error) {
      console.error('Error getting interests:', error);
      return [];
    }
  }
}

module.exports = LeaderboardService;
