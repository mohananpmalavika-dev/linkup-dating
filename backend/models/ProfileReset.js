/**
 * ProfileReset Model
 * Tracks profile resets and monthly reset limits
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProfileReset = sequelize.define('ProfileReset', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    reset_type: {
      type: DataTypes.ENUM('premium', 'free'),
      allowNull: false,
      defaultValue: 'free',
      comment: 'Whether this is a premium or free tier reset'
    },
    photos_rotated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether photos were rotated during this reset'
    },
    bio_updated: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether bio was updated during this reset'
    },
    swipes_cleared: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether swipe history was cleared'
    },
    impressions_before: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Profile views before reset'
    },
    impressions_after_reset: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Profile views after reset'
    },
    matches_preserved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether existing matches were preserved'
    },
    reset_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'User feedback on why they reset'
    },
    reset_impact: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Analytics: impressions gain, new matches, etc.'
    },
    next_free_reset: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When next free reset is available'
    },
    total_resets_lifetime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Total resets used by this user'
    },
    reset_count_this_month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Count of resets used in current month'
    },
    month_year: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'MM-YYYY for tracking monthly resets',
      defaultValue: () => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return `${month}-${year}`;
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'profile_resets',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['reset_type'] },
      { fields: ['created_at'] },
      { fields: ['month_year'] },
      { fields: ['user_id', 'month_year'] },
      { fields: ['user_id', 'created_at'] }
    ]
  });

  ProfileReset.associate = (models) => {
    ProfileReset.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  // Scopes
  ProfileReset.addScope('recentResets', {
    where: {
      created_at: {
        [sequelize.Sequelize.Op.gte]: sequelize.Sequelize.fn(
          'NOW',
          sequelize.Sequelize.fn('INTERVAL', sequelize.Sequelize.literal("'30 days'"))
        )
      }
    }
  });

  ProfileReset.addScope('thisMonth', {
    where: sequelize.Sequelize.where(
      sequelize.Sequelize.fn('to_char', sequelize.Sequelize.col('created_at'), 'MM-YYYY'),
      sequelize.Sequelize.Op.eq,
      sequelize.Sequelize.fn('to_char', sequelize.Sequelize.fn('NOW'), 'MM-YYYY')
    )
  });

  ProfileReset.addScope('byUser', (userId) => ({
    where: { user_id: userId }
  }));

  ProfileReset.addScope('premium', {
    where: { reset_type: 'premium' }
  });

  ProfileReset.addScope('free', {
    where: { reset_type: 'free' }
  });

  return ProfileReset;
};
