module.exports = (sequelize, DataTypes) => {
  const VerificationToken = sequelize.define('VerificationToken', {
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
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    verificationType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'verification_type',
      validate: {
        isIn: [['email', 'phone', 'id', 'video', 'password_reset']]
      }
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    }
  }, {
    tableName: 'verification_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['token'], unique: true },
      { fields: ['expires_at'] }
    ]
  });

  VerificationToken.associate = (models) => {
    VerificationToken.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return VerificationToken;
};
