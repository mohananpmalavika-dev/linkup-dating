const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require('../config/sequelize.js')[env];

const db = {};

let sequelize;
const envConnectionString = config.use_env_variable
  ? process.env[config.use_env_variable]
  : null;

if (envConnectionString) {
  sequelize = new Sequelize(envConnectionString, config);
} else {
  if (config.use_env_variable) {
    console.warn(
      `${config.use_env_variable} is not set; falling back to discrete DB settings for Sequelize models.`
    );
  }

  sequelize = new Sequelize(
    config.database || process.env.DB_NAME || 'linkup_dating',
    config.username || process.env.DB_USER || 'postgres',
    config.password || process.env.DB_PASSWORD || 'postgres',
    {
      ...config,
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || 5432
    }
  );
}

// Read all model files and import them
fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Set up associations after all models are loaded
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
