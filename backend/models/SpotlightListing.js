const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SpotlightListing = sequelize.define(
    'SpotlightListing',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      spotlight_type: {
        type: DataTypes.ENUM('bronze', 'silver', 'gold', 'platinum'),
        allowNull: false,
        comment: 'Bronze (2hr), Silver (24hr), Gold (7day), Platinum (30day)'
      },
      visibility_multiplier: {
        type: DataTypes.DECIMAL(3, 1),
        allowNull: false,
        comment: 'Bronze: 3x, Silver: 5x, Gold: 10x, Platinum: 15x'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      started_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Auto-expires based on tier'
      },
      price_paid: {
        type: DataTypes.DECIMAL(10, 2),
        comment: 'Amount paid in USD'
      },
      impressions: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Times profile shown in Spotlight section'
      },
      clicks: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Times user clicked to view profile'
      },
      likes_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Likes received during spotlight period'
      },
      cancelled_at: {
        type: DataTypes.DATE,
        comment: 'When cancelled early (if applicable)'
      },
      refund_amount: {
        type: DataTypes.DECIMAL(10, 2),
        comment: 'Refund issued if cancelled early'
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        onUpdate: DataTypes.NOW
      }
    },
    {
      tableName: 'spotlight_listings',
      timestamps: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['is_active', 'expires_at'] },
        { fields: ['expires_at'] }
      ]
    }
  );

  SpotlightListing.associate = (db) => {
    SpotlightListing.belongsTo(db.User, { foreignKey: 'user_id' });
  };

  return SpotlightListing;
};
