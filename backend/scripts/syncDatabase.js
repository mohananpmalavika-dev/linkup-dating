#!/usr/bin/env node
/**
 * Database Sync Script
 * Ensures all Sequelize models are synced with the database
 * Usage: node scripts/syncDatabase.js
 */

const path = require('path');
const models = require('../models');
const { syncModelsInOrder } = require('../utils/syncModels');

// Simple logger
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || '')
};

async function runSync() {
  try {
    logger.info('Starting database sync...');
    
    // Test database connection
    await models.sequelize.authenticate();
    logger.info('✓ Database connection successful');
    
    // Sync models in order
    await syncModelsInOrder(models.sequelize, models, logger);
    logger.info('✓ All models synchronized successfully');
    
    // Exit successfully
    process.exit(0);
  } catch (error) {
    logger.error('Database sync failed', {
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

runSync();
