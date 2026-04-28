const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Moment = sequelize.define(
    'Moment',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      photo_url: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'URL to the uploaded photo (S3 or similar)',
      },
      photo_key: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Storage key for deleting from S3/storage',
      },
      caption: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional caption (max 200 chars)',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: '24 hours after creation',
      },
      view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Number of unique users who viewed',
      },
      is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Soft delete flag',
      },
    },
    {
      tableName: 'moments',
      timestamps: false,
      underscored: true,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['expires_at'] },
        { fields: ['created_at', 'user_id'] },
      ],
    }
  );

  return Moment;
};
