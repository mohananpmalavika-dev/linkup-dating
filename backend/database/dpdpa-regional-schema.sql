/**
 * DPDPA & Regional Features Database Schema
 * Tables for data protection, consent management, and regional features
 */

-- ============================================================================
-- DPDPA COMPLIANCE TABLES
-- ============================================================================

-- Consent Preferences Table
CREATE TABLE consent_preferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  marketing_emails BOOLEAN DEFAULT true,
  personalized_ads BOOLEAN DEFAULT true,
  data_analytics BOOLEAN DEFAULT true,
  third_party_sharing BOOLEAN DEFAULT false,
  location_tracking BOOLEAN DEFAULT false,
  push_notifications BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);

-- Data Deletion Requests Table
CREATE TABLE data_deletion_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  reason VARCHAR(255),
  feedback TEXT,
  status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_deletion_date DATETIME NOT NULL,
  cancelled_at DATETIME NULL,
  completed_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_scheduled_date (scheduled_deletion_date)
);

-- Data Export Requests Table
CREATE TABLE data_export_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  format ENUM('json', 'csv') DEFAULT 'json',
  status ENUM('PROCESSING', 'READY', 'FAILED', 'EXPIRED') DEFAULT 'PROCESSING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ready_at DATETIME NULL,
  expired_at DATETIME NULL,
  file_path VARCHAR(500),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);

-- Export Download Tokens (Secure access to exports)
CREATE TABLE export_download_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  export_id INT NOT NULL,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  downloaded_at DATETIME NULL,
  FOREIGN KEY (export_id) REFERENCES data_export_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at)
);

-- Terms Acceptance Log (Audit trail for compliance)
CREATE TABLE terms_acceptance_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  terms_version VARCHAR(20),
  privacy_version VARCHAR(20),
  guidelines_version VARCHAR(20),
  accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_accepted_at (accepted_at)
);

-- Content Takedown Requests (24-hour removal compliance)
CREATE TABLE content_takedowns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content_id VARCHAR(100) NOT NULL,
  reported_by INT NOT NULL,
  reason VARCHAR(100) NOT NULL,
  content_type ENUM('profile', 'message', 'photo', 'moment', 'video') NOT NULL,
  status ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'REMOVED') DEFAULT 'PENDING',
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_removal_at DATETIME,
  actual_removal_at DATETIME NULL,
  urgent BOOLEAN DEFAULT false,
  admin_notes TEXT,
  FOREIGN KEY (reported_by) REFERENCES users(id),
  INDEX idx_status (status),
  INDEX idx_scheduled_removal (scheduled_removal_at),
  INDEX idx_urgent (urgent)
);

-- ============================================================================
-- REGIONAL FEATURES TABLES
-- ============================================================================

-- User Language Preferences
-- Note: Add 'preferred_language' VARCHAR(10) DEFAULT 'en' to users table

-- User District Preferences
-- Note: Add 'preferred_district' VARCHAR(20) to user_preferences table

-- Aadhaar Verification (Optional e-KYC)
CREATE TABLE aadhaar_verification_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  aadhaar_hash VARCHAR(255) NOT NULL,
  verification_token VARCHAR(255) NOT NULL UNIQUE,
  status ENUM('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME NULL,
  expired_at DATETIME NULL,
  attempts INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status)
);

-- Regional Safety Information (Cached data)
CREATE TABLE regional_safety_info (
  id INT PRIMARY KEY AUTO_INCREMENT,
  district_code VARCHAR(10) NOT NULL UNIQUE,
  district_name VARCHAR(100),
  mal_name VARCHAR(100),
  police_headquarters TEXT,
  helpline_numbers JSON,
  safety_tips JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_district_code (district_code)
);

-- ============================================================================
-- AUDIT & COMPLIANCE TABLES
-- ============================================================================

-- Audit Trail (Track all data access and modifications)
CREATE TABLE audit_trail (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(100),
  changes JSON,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_timestamp (timestamp)
);

-- Data Processing Record (For DPDPA compliance documentation)
CREATE TABLE data_processing_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  processor_name VARCHAR(255),
  processing_purpose VARCHAR(255),
  data_categories TEXT,
  retention_period VARCHAR(100),
  security_measures TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================================
-- MIGRATION SCRIPT
-- ============================================================================
/*

To run these migrations:

1. Connect to your database
2. Execute all CREATE TABLE statements above
3. Add columns to existing tables:

ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) DEFAULT 'en' AFTER language;
ALTER TABLE user_preferences ADD COLUMN preferred_district VARCHAR(20) AFTER location;

4. Create indexes for performance:

CREATE INDEX idx_consent_prefs ON consent_preferences(user_id);
CREATE INDEX idx_deletion_requests ON data_deletion_requests(status, scheduled_deletion_date);
CREATE INDEX idx_export_requests ON data_export_requests(user_id, status);
CREATE INDEX idx_content_takedowns ON content_takedowns(status, scheduled_removal_at);
CREATE INDEX idx_audit_trail ON audit_trail(user_id, timestamp);

5. Insert initial regional safety data (see SQL below)

*/

-- ============================================================================
-- INITIAL DATA - Kerala Safety Information
-- ============================================================================

INSERT INTO regional_safety_info (district_code, district_name, mal_name, police_headquarters, updated_at) VALUES
('TVM', 'Thiruvananthapuram', 'തിരുവനന്തപുരം', 'Police Commissioner Office, Trivandrum', NOW()),
('KLM', 'Kollam', 'കൊല്ലം', 'Police Commissioner Office, Kollam', NOW()),
('PTA', 'Pathanamthitta', 'പത്തനംതിട്ട', 'Police Headquarters, Pathanamthitta', NOW()),
('ALP', 'Alappuzha', 'ആലപ്പുഴ', 'District Police Office, Alappuzha', NOW()),
('KTM', 'Kottayam', 'കോട്ടയം', 'District Police Office, Kottayam', NOW()),
('IDK', 'Idukki', 'ഇടുക്കി', 'District Police Office, Idukki', NOW()),
('ERN', 'Ernakulam', 'എര്നാകുളം', 'Police Commissioner Office, Kochi', NOW()),
('TRV', 'Thrissur', 'തൃശ്ശൂര്', 'District Police Office, Thrissur', NOW()),
('MLP', 'Malappuram', 'മലപ്പുരം', 'District Police Office, Malappuram', NOW()),
('KZH', 'Kozhikode', 'കോഴിക്കോട്', 'Police Commissioner Office, Kozhikode', NOW()),
('WYD', 'Wayanad', 'വയനാട്', 'District Police Office, Wayanad', NOW()),
('KNN', 'Kannur', 'കണ്ണൂര്', 'District Police Office, Kannur', NOW()),
('KSD', 'Kasaragod', 'കാസരഗോട്', 'District Police Office, Kasaragod', NOW());

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

-- Procedure to check pending deletions and execute them
DELIMITER //

CREATE PROCEDURE execute_pending_deletions()
BEGIN
  DECLARE affected_rows INT;
  
  -- Get all overdue deletion requests
  UPDATE data_deletion_requests 
  SET status = 'IN_PROGRESS'
  WHERE status = 'PENDING' 
    AND scheduled_deletion_date <= NOW();
  
  SET affected_rows = ROW_COUNT();
  
  -- Delete user data
  DELETE FROM users 
  WHERE id IN (
    SELECT user_id FROM data_deletion_requests 
    WHERE status = 'IN_PROGRESS'
  );
  
  -- Mark as completed
  UPDATE data_deletion_requests 
  SET status = 'COMPLETED', completed_at = NOW()
  WHERE status = 'IN_PROGRESS';
  
  -- Log the action
  INSERT INTO audit_trail (action, entity_type, changes)
  VALUES ('BATCH_DELETION', 'USER_ACCOUNT', 
    JSON_OBJECT('deleted_accounts', affected_rows, 'timestamp', NOW()));
  
END //

DELIMITER ;

-- Schedule this to run daily:
-- CREATE EVENT daily_cleanup_deletions
-- ON SCHEDULE EVERY 1 DAY
-- STARTS CURRENT_TIMESTAMP
-- DO CALL execute_pending_deletions();

