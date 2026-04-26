module.exports = (sequelize, DataTypes) => {
  const FraudFlag = sequelize.define('FraudFlag', {
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
    flagType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'flag_type',
      validate: {
        isIn: [['fake_profile', 'scam', 'catfish', 'solicitation', 'underage', 'identity_theft', 'other']]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    confidenceScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'confidence_score',
      validate: {
        min: 0,
        max: 1
      }
    },
    isResolved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_resolved'
    },
    actionTaken: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'action_taken'
    }
  }, {
    tableName: 'fraud_flags',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['flag_type'] },
      { fields: ['is_resolved'] },
      { fields: ['created_at'] }
    ]
  });

  FraudFlag.associate = (models) => {
    FraudFlag.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'CASCADE' });
  };

  return FraudFlag;
};
