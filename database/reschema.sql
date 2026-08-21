-- ============================================================
-- reschema.sql
-- Idempotent schema + data update for EXISTING PeerLink MySQL databases.
-- Safe to re-run in phpMyAdmin or via MySQL CLI.
-- ============================================================

-- 1. MESSAGES — system messages support
ALTER TABLE messages MODIFY sender_id BIGINT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system TINYINT(1) NOT NULL DEFAULT 0;

-- 2. SESSIONS — completion confirmations & learning mode
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS student_complete_confirmed_at DATETIME NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tutor_complete_confirmed_at DATETIME NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS learning_mode VARCHAR(20) NULL;

-- 3. CONVERSATION PAYMENTS — session linking
ALTER TABLE conversation_payments ADD COLUMN IF NOT EXISTS session_id BIGINT NULL;
ALTER TABLE conversation_payments ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(300) NULL;

-- 4. TUTOR APPLICATIONS — storage for tutor registration flow
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

-- 5. USER REPORTS
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

-- 6. TUTOR PROFILES — verification status
ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending';

-- 7. PASSWORD RESET TOKENS
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

-- 8. USER MODERATION & WARNINGS
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until DATETIME NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT NULL;

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

-- 9. USERS — name change tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS name_changes_count INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name_changes_reset_at DATETIME NULL;