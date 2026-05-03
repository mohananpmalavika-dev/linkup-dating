/**
 * Database Migration Runner
 * Executes SQL migration files in order
 */

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

/**
 * Get all migration files sorted by name (timestamp prefix)
 */
const getMigrationFiles = () => {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  return files;
};

/**
 * Create migrations tracking table if it doesn't exist
 */
const ensureMigrationsTable = async (client) => {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (error) {
    console.error('Error creating migrations table:', error);
    throw error;
  }
};

/**
 * Get list of already executed migrations
 */
const getExecutedMigrations = async (client) => {
  try {
    const result = await client.query('SELECT name FROM migrations ORDER BY executed_at');
    return result.rows.map(row => row.name);
  } catch (error) {
    console.error('Error getting executed migrations:', error);
    return [];
  }
};

/**
 * Execute a single migration file
 */
const executeMigration = async (client, filename) => {
  try {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf8');
    
    // Execute the SQL file
    await client.query(sql);
    
    // Record the migration as executed
    await client.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [filename]
    );
    
    console.log(`✓ Migration executed: ${filename}`);
    return true;
  } catch (error) {
    console.error(`✗ Error executing migration ${filename}:`, error.message);
    throw error;
  }
};

/**
 * Run all pending migrations
 */
const runMigrations = async () => {
  let client;
  let ownPool;
  
  try {
    console.log('🔄 Starting database migrations...');
    
    // Get a client from the pool
    let pool = db.pool;
    
    // If db.pool doesn't exist, create our own
    if (!pool) {
      const { Pool } = require('pg');
      pool = new Pool({
        connectionString: process.env.DATABASE_URL || 
          `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'linkup_dating'}`,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      ownPool = pool;
    }
    
    client = await pool.connect();
    
    // Ensure migrations table exists
    await ensureMigrationsTable(client);
    
    // Get list of executed migrations
    const executedMigrations = await getExecutedMigrations(client);
    console.log(`📋 Already executed migrations: ${executedMigrations.length}`);
    
    // Get all migration files
    const migrationFiles = getMigrationFiles();
    console.log(`📁 Total migration files found: ${migrationFiles.length}`);
    
    // Filter out already executed migrations
    const pendingMigrations = migrationFiles.filter(file => !executedMigrations.includes(file));
    
    if (pendingMigrations.length === 0) {
      console.log('✓ All migrations already executed');
      return { success: true, executed: 0, pending: 0 };
    }
    
    console.log(`⏳ Pending migrations to execute: ${pendingMigrations.length}`);
    
    // Execute pending migrations in order
    for (const migrationFile of pendingMigrations) {
      await executeMigration(client, migrationFile);
    }
    
    console.log('✓ All migrations completed successfully');
    return { success: true, executed: pendingMigrations.length, pending: 0 };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  } finally {
    if (client) {
      client.release();
    }
    // Close our own pool if we created it
    if (ownPool) {
      await ownPool.end();
    }
  }
};

module.exports = { runMigrations, getMigrationFiles };
