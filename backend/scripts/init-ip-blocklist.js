#!/usr/bin/env node
/**
 * Create IP Blocklist Table (Direct SQL)
 * This script directly creates the table using raw SQL queries
 * Useful when Sequelize sync fails or for emergency creation
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'linkup_dating'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createTableSQL = `
CREATE TABLE IF NOT EXISTS "ip_blocklist" (
  "id" SERIAL PRIMARY KEY,
  "ip_address" VARCHAR(45) NOT NULL,
  "reason" VARCHAR(255) DEFAULT 'underage_attempt',
  "block_duration_hours" INTEGER DEFAULT 2,
  "blocked_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP NOT NULL,
  "attempted_email" VARCHAR(255),
  "attempted_age" INTEGER,
  "attempt_count" INTEGER DEFAULT 1,
  "is_active" BOOLEAN DEFAULT true,
  "removed_at" TIMESTAMP,
  "removed_by_admin_id" INTEGER,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("ip_address")
);
`;

const createIndexesSQL = `
CREATE INDEX IF NOT EXISTS "idx_ip_blocklist_ip_active_expires" 
  ON "ip_blocklist" ("ip_address", "is_active", "expires_at");

CREATE INDEX IF NOT EXISTS "idx_ip_blocklist_expires_at" 
  ON "ip_blocklist" ("expires_at");

CREATE INDEX IF NOT EXISTS "idx_ip_blocklist_is_active" 
  ON "ip_blocklist" ("is_active");

CREATE INDEX IF NOT EXISTS "idx_ip_blocklist_admin_id" 
  ON "ip_blocklist" ("removed_by_admin_id");
`;

async function createTable() {
  const client = await pool.connect();

  try {
    console.log('[IP Blocklist] Creating table...');
    
    // Create table
    await client.query(createTableSQL);
    console.log('✓ Table "ip_blocklist" created (or already exists)');

    // Create indexes
    const indexStatements = createIndexesSQL.split(';').filter(s => s.trim());
    for (const statement of indexStatements) {
      if (statement.trim()) {
        await client.query(statement + ';');
      }
    }
    console.log('✓ Indexes created (or already exist)');

    // Verify table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ip_blocklist'
      );
    `);

    if (result.rows[0].exists) {
      console.log('✓ Verification: ip_blocklist table exists and is ready');
      return true;
    } else {
      console.error('✗ Verification failed: ip_blocklist table not found');
      return false;
    }
  } catch (error) {
    console.error('Error creating ip_blocklist table:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    throw error;
  } finally {
    await client.end();
    await pool.end();
  }
}

createTable()
  .then(() => {
    console.log('✓ IP Blocklist initialization complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('✗ IP Blocklist initialization failed:', err.message);
    process.exit(1);
  });
