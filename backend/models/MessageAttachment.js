/**
 * MessageAttachment Model
 * Stores file attachments sent with messages
 */
module.exports = (sequelize, DataTypes) => {
  const MessageAttachment = sequelize.define('MessageAttachment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'message_id',
      references: {
        model: 'messages',
        key: 'id'
      }
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'file_name'
    },
    fileType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'file_type'
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'file_path'
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'file_size'
    },
    attachmentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'attachment_type',
      // Types: image, video, document, audio, location
      validate: {
        isIn: [['image', 'video', 'document', 'audio', 'location', 'other']]
      }
    },
    thumbnailPath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'thumbnail_path'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
      // Can store width/height for images, duration for videos, location coordinates, etc.
    },
    downloadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'download_count'
    }
  }, {
    tableName: 'message_attachments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['message_id'] },
      { fields: ['attachment_type'] }
    ]
  });

  MessageAttachment.associate = (models) => {
    MessageAttachment.belongsTo(models.Message, { foreignKey: 'message_id', as: 'message', onDelete: 'CASCADE' });
  };

  return MessageAttachment;
};
