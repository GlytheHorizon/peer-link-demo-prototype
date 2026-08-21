-- ============================================================
-- reschema.sql
-- Idempotent schema + data update for EXISTING PeerLink MySQL / MariaDB databases.
-- Fully compatible with XAMPP (MariaDB & MySQL 5.7 / 8.0+ / phpMyAdmin).
-- ============================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS AddColumnIfNotExists $$
CREATE PROCEDURE AddColumnIfNotExists(
  IN p_table_name VARCHAR(64),
  IN p_column_name VARCHAR(64),
  IN p_column_def VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND COLUMN_NAME = p_column_name
  ) THEN
    SET @s = CONCAT('ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ', p_column_def);
    PREPARE stmt FROM @s;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

-- Apply column additions safely across all MySQL / MariaDB versions
CALL AddColumnIfNotExists('messages', 'is_system', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL AddColumnIfNotExists('sessions', 'student_complete_confirmed_at', 'DATETIME NULL');
CALL AddColumnIfNotExists('sessions', 'tutor_complete_confirmed_at', 'DATETIME NULL');
CALL AddColumnIfNotExists('sessions', 'learning_mode', 'VARCHAR(20) NULL');
CALL AddColumnIfNotExists('conversation_payments', 'session_id', 'BIGINT NULL');
CALL AddColumnIfNotExists('conversation_payments', 'reject_reason', 'VARCHAR(300) NULL');
CALL AddColumnIfNotExists('tutor_profiles', 'verification_status', "ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending'");
CALL AddColumnIfNotExists('users', 'suspended_until', 'DATETIME NULL');
CALL AddColumnIfNotExists('users', 'suspension_reason', 'TEXT NULL');
CALL AddColumnIfNotExists('users', 'is_banned', 'TINYINT(1) NOT NULL DEFAULT 0');
CALL AddColumnIfNotExists('users', 'ban_reason', 'TEXT NULL');
CALL AddColumnIfNotExists('users', 'name_changes_count', 'INT NOT NULL DEFAULT 0');
CALL AddColumnIfNotExists('users', 'name_changes_reset_at', 'DATETIME NULL');

DROP PROCEDURE IF EXISTS AddColumnIfNotExists;

-- Ensure tables exist
CREATE TABLE IF NOT EXISTS tutor_applications (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(200) NOT NULL,
  email          VARCHAR(190) NOT NULL,
  phone          VARCHAR(30) NOT NULL,
  address        VARCHAR(255) NULL,
  hourly_rate    DECIMAL(10,2) NULL,
  subjects       JSON NULL,
  license_number VARCHAR(100) NULL,
  institution    VARCHAR(200) NULL,
  specialization VARCHAR(200) NULL,
  years_teaching SMALLINT NULL,
  license_file   VARCHAR(255) NULL,
  id_file        VARCHAR(255) NULL,
  status         ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_at    DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_tutor_applications_status (status),
  KEY idx_tutor_applications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_reports (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  reporter_id     BIGINT NOT NULL,
  reported_id     BIGINT NOT NULL,
  reason          VARCHAR(100) NOT NULL,
  session_id      BIGINT NULL,
  details         TEXT NULL,
  status          ENUM('open','resolved') NOT NULL DEFAULT 'open',
  action_taken    VARCHAR(50) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at     DATETIME NULL,
  KEY idx_user_reports_reporter (reporter_id),
  KEY idx_user_reports_reported (reported_id),
  KEY idx_user_reports_status (status),
  KEY idx_user_reports_created (created_at),
  CONSTRAINT fk_user_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_reports_reported FOREIGN KEY (reported_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_reports_session FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  token_hash   VARCHAR(255) NOT NULL,
  expires_at   DATETIME NOT NULL,
  used_at      DATETIME NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_password_reset_user (user_id),
  KEY idx_password_reset_token_hash (token_hash),
  KEY idx_password_reset_expires (expires_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_warnings (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT NOT NULL,
  admin_id        BIGINT NOT NULL,
  reason          TEXT NOT NULL,
  is_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  acknowledged_at DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_warnings_user (user_id, is_acknowledged),
  CONSTRAINT fk_user_warnings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_user_warnings_admin FOREIGN KEY (admin_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;