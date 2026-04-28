const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const MomentView = sequelize.define(
    'MomentView',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      moment_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Moments',
          key: 'id',
        },
      },
      viewer_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      viewed_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'moment_views',
      timestamps: false,
      underscored: true,
      indexes: [
        { fields: ['moment_id'] },
        { fields: ['viewer_user_id'] },
        { fields: ['moment_id', 'viewer_user_id'], unique: true },
      ],
    }
  );

  return MomentView;
};
