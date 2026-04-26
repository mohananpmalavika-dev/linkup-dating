/**
 * ChatBackup Model
 * Stores chat backups and exports for users
 */
module.exports = (sequelize, DataTypes) => {
  const ChatBackup = sequelize.define('ChatBackup', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    matchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'match_id',
      references: {
        model: 'matches',
        key: 'id'
      }
    },
    backupType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'backup_type',
      // Types: auto, manual, export
      validate: {
        isIn: [['auto', 'manual', 'export']]
      }
    },
    format: {
      type: DataTypes.STRING(20),
      allowNull: false,
      // Formats: json, csv, pdf, html, txt
      validate: {
        isIn: [['json', 'csv', 'pdf', 'html', 'txt']]
      }
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
    messageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'message_count'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'start_date'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'end_date'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    downloadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'download_count'
    },
    isEncrypted: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_encrypted'
    }
  }, {
    tableName: 'chat_backups',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['match_id'] },
      { fields: ['backup_type'] },
      { fields: ['created_at'] }
    ]
  });

  ChatBackup.associate = (models) => {
    ChatBackup.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
    ChatBackup.belongsTo(models.Match, { foreignKey: 'match_id', as: 'match', onDelete: 'CASCADE' });
  };

  return ChatBackup;
};
