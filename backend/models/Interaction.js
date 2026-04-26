module.exports = (sequelize, DataTypes) => {
  const Interaction = sequelize.define('Interaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    fromUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'from_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    toUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'to_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    interactionType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'interaction_type',
      validate: {
        isIn: [['like', 'pass', 'superlike', 'view', 'message']]
      }
    },
    isMutual: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_mutual'
    }
  }, {
    tableName: 'interactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['from_user_id', 'to_user_id', 'interaction_type'], unique: true },
      { fields: ['from_user_id'] },
      { fields: ['to_user_id'] },
      { fields: ['interaction_type'] },
      { fields: ['created_at'] }
    ]
  });

  Interaction.associate = (models) => {
    Interaction.belongsTo(models.User, { foreignKey: 'from_user_id', as: 'fromUser', onDelete: 'CASCADE' });
    Interaction.belongsTo(models.User, { foreignKey: 'to_user_id', as: 'toUser', onDelete: 'CASCADE' });
  };

  return Interaction;
};
