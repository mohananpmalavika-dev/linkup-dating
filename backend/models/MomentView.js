const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MomentView = sequelize.define(
    'MomentView',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      moment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'moments',
          key: 'id',
        },
      },
      viewer_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
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
