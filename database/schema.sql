-- ============================================================
-- PeerLink - Peer Tutoring Platform
-- MySQL Schema + Seed Data
-- Normalized 4-tier architecture database layer
-- ============================================================

CREATE DATABASE IF NOT EXISTS peerlink
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE peerlink;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  role          ENUM('student','tutor','faculty','admin') NOT NULL DEFAULT 'student',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- STUDENT PROFILES
-- ------------------------------------------------------------
CREATE TABLE student_profiles (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  year_level TINYINT UNSIGNED NULL,
  course     VARCHAR(150) NULL,
  bio        TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_student_user (user_id),
  CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TUTOR PROFILES
-- Availability stored as JSON: {"Mon":["09:00-11:00"],"Tue":[...]}
-- ------------------------------------------------------------
CREATE TABLE tutor_profiles (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  course         VARCHAR(150) NULL,
  max_year_level TINYINT UNSIGNED NOT NULL DEFAULT 5,
  bio            TEXT NULL,
  availability   JSON NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tutor_user (user_id),
  CONSTRAINT fk_tutor_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SUBJECTS
-- ------------------------------------------------------------
CREATE TABLE subjects (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_code (code)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- STUDENT SUBJECTS (subjects a student needs help with)
-- ------------------------------------------------------------
CREATE TABLE student_subjects (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_profile_id INT UNSIGNED NOT NULL,
  subject_id         INT UNSIGNED NOT NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_student_subject (student_profile_id, subject_id),
  KEY idx_student_subjects_subject (subject_id),
  CONSTRAINT fk_student_subjects_profile FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_student_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TUTOR SUBJECTS (subjects a tutor teaches + proficiency 1-5)
-- ------------------------------------------------------------
CREATE TABLE tutor_subjects (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tutor_profile_id INT UNSIGNED NOT NULL,
  subject_id       INT UNSIGNED NOT NULL,
  proficiency      TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT '1-5',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tutor_subject (tutor_profile_id, subject_id),
  KEY idx_tutor_subjects_subject (subject_id),
  CONSTRAINT fk_tutor_subjects_profile FOREIGN KEY (tutor_profile_id) REFERENCES tutor_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_tutor_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT chk_tutor_proficiency CHECK (proficiency BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MATCHES (compatibility results, 0-100)
-- ------------------------------------------------------------
CREATE TABLE matches (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_profile_id   INT UNSIGNED NOT NULL,
  tutor_profile_id     INT UNSIGNED NOT NULL,
  subject_id           INT UNSIGNED NOT NULL,
  compatibility_score  DECIMAL(5,2) NOT NULL,
  score_breakdown      JSON NULL,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match (student_profile_id, tutor_profile_id, subject_id),
  KEY idx_matches_student_score (student_profile_id, compatibility_score),
  CONSTRAINT fk_matches_student FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_tutor FOREIGN KEY (tutor_profile_id) REFERENCES tutor_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CONVERSATIONS (between a student user and a tutor user on a subject)
-- ------------------------------------------------------------
CREATE TABLE conversations (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  tutor_id   INT UNSIGNED NOT NULL,
  subject_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_conversation (student_id, tutor_id, subject_id),
  KEY idx_conversations_tutor (tutor_id),
  CONSTRAINT fk_conversations_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MESSAGES
-- ------------------------------------------------------------
CREATE TABLE messages (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id INT UNSIGNED NOT NULL,
  sender_id       INT UNSIGNED NOT NULL,
  body            TEXT NOT NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_conversation (conversation_id, created_at),
  KEY idx_messages_sender (sender_id),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SESSIONS (tutoring sessions, full workflow)
-- ------------------------------------------------------------
CREATE TABLE sessions (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id      INT UNSIGNED NOT NULL,
  tutor_id        INT UNSIGNED NOT NULL,
  subject_id      INT UNSIGNED NOT NULL,
  conversation_id INT UNSIGNED NULL,
  status          ENUM('pending','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
  scheduled_start DATETIME NOT NULL,
  scheduled_end   DATETIME NOT NULL,
  topic           VARCHAR(255) NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sessions_tutor_time (tutor_id, status, scheduled_start),
  KEY idx_sessions_student_time (student_id, scheduled_start),
  KEY idx_sessions_subject (subject_id),
  CONSTRAINT fk_sessions_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE SET NULL,
  CONSTRAINT chk_sessions_end CHECK (scheduled_end > scheduled_start)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- EVALUATIONS (one per completed session)
-- ------------------------------------------------------------
CREATE TABLE evaluations (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED NOT NULL,
  tutor_id   INT UNSIGNED NOT NULL,
  rating     TINYINT UNSIGNED NOT NULL,
  comment    TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_evaluation_session (session_id),
  KEY idx_evaluations_tutor (tutor_id),
  CONSTRAINT fk_evaluations_session FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_evaluations_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_evaluations_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_evaluation_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- ACTIVITY LOGS
-- ------------------------------------------------------------
CREATE TABLE activity_logs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id   INT UNSIGNED NULL,
  details     JSON NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_logs_user (user_id),
  KEY idx_logs_action (action),
  KEY idx_logs_created (created_at),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA
-- Default passwords: Admin@123 / Faculty@123 / Tutor@123 / Student@123
-- Hashes generated with bcryptjs (cost 10)
-- ============================================================

INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active) VALUES
(1, 'admin@peerlink.edu', '$2a$10$vvDNXhEYATRXuM6NXzQW.eweNMp6/DT4iri5L6FyLcQG3ZUHzijgi', 'Alex', 'Admin', 'admin', 1),
(2, 'faculty@peerlink.edu', '$2a$10$JDusT272YLpZvBJ/CRJM0u0NnxGraIk0QqtNtms78LYSJzTipY56i', 'Dana', 'Faculty', 'faculty', 1),
(3, 'tutor@peerlink.edu', '$2a$10$oqZpYzmn5EjTMD0mpfSbk.3YFAsP3MU.zcgnc8ozv2P8qMKam7h5u', 'Maria', 'Tutor', 'tutor', 1),
(4, 'student@peerlink.edu', '$2a$10$sxsfR9PejLT4wmo1A6i2Uer0XPVLGpd2RGZD6ptBm2lB9HBQ8Vt8K', 'John', 'Student', 'student', 1),
(5, 'david.garcia@peerlink.edu', '$2a$10$oqZpYzmn5EjTMD0mpfSbk.3YFAsP3MU.zcgnc8ozv2P8qMKam7h5u', 'David', 'Garcia', 'tutor', 1),
(6, 'sara.kim@peerlink.edu', '$2a$10$oqZpYzmn5EjTMD0mpfSbk.3YFAsP3MU.zcgnc8ozv2P8qMKam7h5u', 'Sara', 'Kim', 'tutor', 1),
(7, 'mike.chen@peerlink.edu', '$2a$10$sxsfR9PejLT4wmo1A6i2Uer0XPVLGpd2RGZD6ptBm2lB9HBQ8Vt8K', 'Mike', 'Chen', 'student', 1);

INSERT INTO student_profiles (id, user_id, year_level, course, bio) VALUES
(1, 4, 2, 'Computer Science', 'Second year CS student looking for help with math and programming.'),
(2, 7, 1, 'Computer Science', 'Freshman CS student, struggling with calculus.');

INSERT INTO tutor_profiles (id, user_id, course, max_year_level, bio, availability) VALUES
(1, 3, 'Computer Science', 4, 'Senior CS student. Strong in math and programming, patient with beginners.', '{"Mon":["09:00-12:00","15:00-17:00"],"Tue":["10:00-13:00"],"Wed":["09:00-11:00","14:00-16:00"],"Thu":["10:00-12:00"],"Fri":["09:00-12:00"]}'),
(2, 5, 'Mathematics', 5, 'Math major, excellent at calculus and statistics. Offers structured lessons.', '{"Mon":["08:00-10:00"],"Tue":["08:00-10:00","13:00-15:00"],"Wed":["10:00-12:00"],"Thu":["09:00-11:00"],"Fri":["13:00-17:00"]}'),
(3, 6, 'Computer Science', 3, 'Third year CS student, web development and database systems enthusiast.', '{"Mon":["13:00-15:00"],"Tue":["15:00-17:00"],"Wed":["15:00-17:00"],"Thu":["13:00-15:00"],"Sat":["10:00-14:00"]}');

INSERT INTO subjects (id, code, name, description) VALUES
(1, 'MATH101', 'Calculus I', 'Limits, derivatives, and integrals of single-variable functions.'),
(2, 'MATH210', 'Linear Algebra', 'Vectors, matrices, eigenvalues, and linear transformations.'),
(3, 'CS220', 'Data Structures', 'Stacks, queues, trees, graphs, and algorithmic analysis.'),
(4, 'CS330', 'Web Development', 'HTML, CSS, JavaScript, and modern web frameworks.'),
(5, 'ENG110', 'English Composition', 'Academic writing, essays, and research papers.'),
(6, 'PHYS101', 'Physics I', 'Mechanics: kinematics, forces, energy, and momentum.'),
(7, 'CS240', 'Database Systems', 'SQL, database design, normalization, and transactions.'),
(8, 'STAT150', 'Statistics', 'Descriptive statistics, probability, and hypothesis testing.');

INSERT INTO student_subjects (student_profile_id, subject_id) VALUES
(1, 1), (1, 3), (1, 5), (2, 1), (2, 6);

INSERT INTO tutor_subjects (tutor_profile_id, subject_id, proficiency) VALUES
(1, 1, 5), (1, 3, 5), (1, 5, 4), (2, 1, 4), (2, 8, 5), (3, 4, 5), (3, 7, 4);

INSERT INTO matches (student_profile_id, tutor_profile_id, subject_id, compatibility_score, score_breakdown) VALUES
(1, 1, 1, 92.00, '{"subject":40,"proficiency":20,"course_year":10,"availability":12,"rating":10}'),
(1, 2, 1, 87.00, '{"subject":40,"proficiency":16,"course_year":15,"availability":11,"rating":5}'),
(2, 1, 1, 88.00, '{"subject":40,"proficiency":20,"course_year":10,"availability":13,"rating":5}');

INSERT INTO conversations (id, student_id, tutor_id, subject_id) VALUES
(1, 4, 3, 1),
(2, 4, 3, 3);

INSERT INTO messages (conversation_id, sender_id, body, is_read) VALUES
(1, 4, 'Hi Maria! I need help understanding derivatives for my upcoming exam. Do you have time this week?', 1),
(1, 3, 'Hi John! Sure, I would love to help. I am free Monday morning or Wednesday afternoon.', 1),
(1, 4, 'Monday morning works for me. Shall we say 10 AM?', 1),
(2, 4, 'Could you also help me with linked lists for CS220?', 1),
(2, 3, 'Of course! Let us set up a session for Thursday.', 1);

INSERT INTO sessions (id, student_id, tutor_id, subject_id, conversation_id, status, scheduled_start, scheduled_end, topic, notes) VALUES
(1, 4, 3, 1, 1, 'completed', '2026-08-10 10:00:00', '2026-08-10 11:00:00', 'Derivatives and chain rule', 'Covered derivative rules with practice problems.'),
(2, 4, 3, 3, 2, 'accepted', '2026-08-18 10:00:00', '2026-08-18 11:00:00', 'Linked lists', 'Review singly linked list operations.');

INSERT INTO evaluations (session_id, student_id, tutor_id, rating, comment) VALUES
(1, 4, 3, 5, 'Maria explains concepts very clearly and prepared great practice problems. Highly recommended!');

INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES
(1, 'system.seed', 'database', NULL, '{"note":"Initial seed data"}' , '127.0.0.1');

-- Reset auto-increment sequences after explicit ID inserts
ALTER TABLE users AUTO_INCREMENT = 8;
ALTER TABLE student_profiles AUTO_INCREMENT = 3;
ALTER TABLE tutor_profiles AUTO_INCREMENT = 4;
ALTER TABLE subjects AUTO_INCREMENT = 9;
ALTER TABLE conversations AUTO_INCREMENT = 3;
ALTER TABLE sessions AUTO_INCREMENT = 3;