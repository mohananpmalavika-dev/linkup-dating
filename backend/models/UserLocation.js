module.exports = (sequelize, DataTypes) => {
  const UserLocation = sequelize.define('UserLocation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      field: 'latitude'
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false,
      field: 'longitude'
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'city'
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'state'
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'country'
    },
    distancePreferenceKm: {
      type: DataTypes.INTEGER,
      defaultValue: 25,
      field: 'distance_preference_km'
    },
    includeTraveling: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'include_traveling',
      comment: 'Show in discovery for travelers'
    },
    isTraveling: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_traveling'
    },
    travelingDestinationLat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: 'traveling_destination_lat'
    },
    travelingDestinationLng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      field: 'traveling_destination_lng'
    },
    travelingDestinationCity: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'traveling_destination_city'
    },
    travelingStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'traveling_start_date'
    },
    travelingEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'traveling_end_date'
    },
    travelPurpose: {
      type: DataTypes.ENUM('vacation', 'work', 'relocation', 'visiting_friends', 'other'),
      allowNull: true,
      field: 'travel_purpose'
    },
    lastUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'last_updated_at',
      defaultValue: DataTypes.NOW
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'user_locations',
    timestamps: true
  });

  UserLocation.associate = (models) => {
    UserLocation.belongsTo(models.User, {
      foreignKey: 'userId'
    });
  };

  return UserLocation;
};
