/**
 * EncryptionKey Model
 * Stores encryption keys for end-to-end encrypted messaging
 */
module.exports = (sequelize, DataTypes) => {
  const EncryptionKey = sequelize.define('EncryptionKey', {
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
      allowNull: false,
      field: 'match_id',
      references: {
        model: 'matches',
        key: 'id'
      }
    },
    publicKey: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'public_key'
    },
    encryptedPrivateKey: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'encrypted_private_key'
    },
    keyVersion: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'key_version'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    }
  }, {
    tableName: 'encryption_keys',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['match_id'] },
      { fields: ['user_id', 'match_id'], unique: true },
      { fields: ['is_active'] }
    ]
  });

  EncryptionKey.associate = (models) => {
    EncryptionKey.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
    EncryptionKey.belongsTo(models.Match, { foreignKey: 'match_id', as: 'match', onDelete: 'CASCADE' });
  };

  return EncryptionKey;
};
