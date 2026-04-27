module.exports = (sequelize, DataTypes) => {
  const DateLocation = sequelize.define('DateLocation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Venue name (e.g., "Brew Haven Coffee")'
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
    type: {
      type: DataTypes.ENUM('coffee_shop', 'restaurant', 'bar', 'park', 'museum', 'cinema', 'activity', 'other'),
      defaultValue: 'coffee_shop',
      field: 'type'
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
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'address'
    },
    googlePlacesId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'google_places_id'
    },
    userRating: {
      type: DataTypes.DECIMAL(2, 1),
      allowNull: true,
      field: 'user_rating',
      validate: {
        min: 1,
        max: 5
      }
    },
    ratingCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'rating_count'
    },
    firstDateSuccessRate: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'first_date_success_rate',
      validate: {
        min: 0,
        max: 1
      },
      comment: 'Percentage of first dates at this venue that lead to second date'
    },
    firstDateCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'first_date_count'
    },
    atmosphereType: {
      type: DataTypes.ENUM('quiet', 'moderate', 'lively', 'romantic', 'casual', 'upscale'),
      defaultValue: 'casual',
      field: 'atmosphere_type'
    },
    priceRange: {
      type: DataTypes.ENUM('budget', 'moderate', 'upscale', 'luxury'),
      defaultValue: 'moderate',
      field: 'price_range'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_verified',
      comment: 'Verified by admin team'
    },
    suggestedByUserCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'suggested_by_user_count'
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
    tableName: 'date_locations',
    timestamps: true
  });

  return DateLocation;
};
