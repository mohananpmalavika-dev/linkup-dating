module.exports = (sequelize, DataTypes) => {
  const DatingBenchmark = sequelize.define('DatingBenchmark', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    ageGroup: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'age_group',
      comment: '18-25, 26-35, 36-45, 46-55, 55+'
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'non-binary'),
      allowNull: false
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'City or region, null for global'
    },
    benchmarkDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'benchmark_date'
    },
    avgProfileViews: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'avg_profile_views'
    },
    avgLikesReceived: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      field: 'avg_likes_received'
    },
    avgMatchRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'avg_match_rate',
      comment: 'Percentage 0-100'
    },
    avgMessageResponseTime: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'avg_message_response_time',
      comment: 'Minutes'
    },
    avgVideoCallRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      field: 'avg_video_call_rate',
      comment: 'Percentage 0-100'
    },
    avgConversationDuration: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'avg_conversation_duration',
      comment: 'Minutes'
    },
    sampleSize: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'sample_size',
      comment: 'Number of users in sample'
    }
  }, {
    tableName: 'dating_benchmarks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      { fields: ['age_group', 'gender', 'location', 'benchmark_date'], unique: true },
      { fields: ['age_group', 'gender'] },
      { fields: ['benchmark_date'] }
    ]
  });

  return DatingBenchmark;
};
