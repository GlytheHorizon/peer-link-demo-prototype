-- ============================================================
-- PeerLink - Peer Tutoring Platform
-- MySQL / MariaDB Schema + Seed Data (phpMyAdmin ready)
-- Normalized 4-tier architecture database layer
--
-- HOW TO USE: Open phpMyAdmin (or MySQL CLI / Workbench),
-- select your `peerlink` database, go to the Import tab (or SQL tab),
-- paste this whole file and click Go.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS user_warnings;
DROP TABLE IF EXISTS user_reports;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS conversation_payments;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS reschedule_requests;
DROP TABLE IF EXISTS evaluations;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS tutor_subjects;
DROP TABLE IF EXISTS student_subjects;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS tutor_profiles;
DROP TABLE IF EXISTS student_profiles;
DROP TABLE IF EXISTS subject_requests;
DROP TABLE IF EXISTS tutor_applications;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE users (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  email               VARCHAR(190) NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,
  first_name          VARCHAR(100) NOT NULL,
  last_name           VARCHAR(100) NOT NULL,
  role                ENUM('student','tutor','faculty','admin') NOT NULL DEFAULT 'student',
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  suspended_until     DATETIME NULL,
  suspension_reason   TEXT NULL,
  is_banned           TINYINT(1) NOT NULL DEFAULT 0,
  ban_reason          TEXT NULL,
  name_changes_count  INT NOT NULL DEFAULT 0,
  name_changes_reset_at DATETIME NULL,
  last_seen_at        DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- STUDENT PROFILES
-- ------------------------------------------------------------
CREATE TABLE student_profiles (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id            BIGINT NOT NULL,
  year_level         SMALLINT NULL,
  course             VARCHAR(150) NULL,
  bio                TEXT NULL,
  age                SMALLINT NULL,
  grade_level        VARCHAR(50) NULL,
  school             VARCHAR(150) NULL,
  strand             VARCHAR(50) NULL,
  contact_no         VARCHAR(20) NULL,
  gender             VARCHAR(20) NULL,
  subjects_needed    JSON NULL,
  learning_mode      VARCHAR(20) NULL,
  preferred_schedule JSON NULL,
  preferred_time     VARCHAR(60) NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_user (user_id),
  CONSTRAINT fk_student_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TUTOR PROFILES
-- Availability stored as JSON: {"Mon":["09:00-11:00"],"Tue":[...]}
-- ------------------------------------------------------------
CREATE TABLE tutor_profiles (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id            BIGINT NOT NULL,
  course             VARCHAR(150) NULL,
  max_year_level     SMALLINT NOT NULL DEFAULT 5,
  bio                TEXT NULL,
  availability       JSON NULL,
  tags               JSON NULL,
  age                SMALLINT NULL,
  grade_level        VARCHAR(50) NULL,
  school             VARCHAR(150) NULL,
  strand             VARCHAR(50) NULL,
  contact_no         VARCHAR(20) NULL,
  gender             VARCHAR(20) NULL,
  subjects_teach     JSON NULL,
  learning_mode      VARCHAR(20) NULL,
  preferred_schedule JSON NULL,
  preferred_time     VARCHAR(60) NULL,
  verification_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tutor_user (user_id),
  CONSTRAINT fk_tutor_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- SUBJECTS
-- ------------------------------------------------------------
CREATE TABLE subjects (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(20) NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT NULL,
  strand      VARCHAR(20) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_subjects_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- STUDENT SUBJECTS
-- ------------------------------------------------------------
CREATE TABLE student_subjects (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_profile_id BIGINT NOT NULL,
  subject_id         BIGINT NOT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_student_subject (student_profile_id, subject_id),
  KEY idx_student_subjects_subject (subject_id),
  CONSTRAINT fk_student_subjects_profile FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_student_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TUTOR SUBJECTS
-- ------------------------------------------------------------
CREATE TABLE tutor_subjects (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  tutor_profile_id BIGINT NOT NULL,
  subject_id       BIGINT NOT NULL,
  proficiency      SMALLINT NOT NULL DEFAULT 3,
  rate_per_hour    DECIMAL(10,2) NOT NULL DEFAULT 100.00,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tutor_subject (tutor_profile_id, subject_id),
  KEY idx_tutor_subjects_subject (subject_id),
  CONSTRAINT fk_tutor_subjects_profile FOREIGN KEY (tutor_profile_id) REFERENCES tutor_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_tutor_subjects_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- MATCHES
-- ------------------------------------------------------------
CREATE TABLE matches (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_profile_id  BIGINT NOT NULL,
  tutor_profile_id    BIGINT NOT NULL,
  subject_id          BIGINT NOT NULL,
  compatibility_score DECIMAL(5,2) NOT NULL,
  score_breakdown     JSON NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_match (student_profile_id, tutor_profile_id, subject_id),
  KEY idx_matches_student_score (student_profile_id, compatibility_score),
  CONSTRAINT fk_matches_student FOREIGN KEY (student_profile_id) REFERENCES student_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_tutor FOREIGN KEY (tutor_profile_id) REFERENCES tutor_profiles (id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- CONVERSATIONS
-- ------------------------------------------------------------
CREATE TABLE conversations (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT NOT NULL,
  tutor_id   BIGINT NOT NULL,
  subject_id BIGINT NULL,
  deleted_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_conversations_tutor (tutor_id),
  CONSTRAINT fk_conversations_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_conversations_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- MESSAGES
-- ------------------------------------------------------------
CREATE TABLE messages (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_id       BIGINT NULL,
  body            TEXT NOT NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  is_system       TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_messages_conversation (conversation_id, created_at),
  KEY idx_messages_sender (sender_id),
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- SESSIONS
-- ------------------------------------------------------------
CREATE TABLE sessions (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id      BIGINT NOT NULL,
  tutor_id        BIGINT NOT NULL,
  subject_id      BIGINT NOT NULL,
  conversation_id BIGINT NULL,
  status          ENUM('pending','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
  learning_mode   VARCHAR(20) NULL,
  scheduled_start DATETIME NOT NULL,
  scheduled_end   DATETIME NOT NULL,
  topic           VARCHAR(255) NULL,
  notes           TEXT NULL,
  reject_reason   VARCHAR(300) NULL,
  cancel_reason   VARCHAR(300) NULL,
  cancelled_at    DATETIME NULL,
  student_complete_confirmed_at DATETIME NULL,
  tutor_complete_confirmed_at   DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_sessions_tutor_time (tutor_id, status, scheduled_start),
  KEY idx_sessions_student_time (student_id, scheduled_start),
  KEY idx_sessions_subject (subject_id),
  CONSTRAINT fk_sessions_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- RESCHEDULE REQUESTS
-- ------------------------------------------------------------
CREATE TABLE reschedule_requests (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id     BIGINT NOT NULL,
  requester_id   BIGINT NOT NULL,
  proposed_start DATETIME NOT NULL,
  proposed_end   DATETIME NOT NULL,
  reason         VARCHAR(500) NULL,
  status         ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at   DATETIME NULL,
  KEY idx_reschedule_session_status (session_id, status),
  CONSTRAINT fk_reschedule_session FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_reschedule_requester FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- PAYMENTS
-- ------------------------------------------------------------
CREATE TABLE payments (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  method     ENUM('gcash','maya','bank_card') NOT NULL,
  amount     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status     ENUM('paid','refunded') NOT NULL DEFAULT 'paid',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payments_session (session_id),
  KEY idx_payments_student (student_id),
  CONSTRAINT fk_payments_session FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- CONVERSATION PAYMENTS
-- ------------------------------------------------------------
CREATE TABLE conversation_payments (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  session_id      BIGINT NULL,
  student_id      BIGINT NOT NULL,
  tutor_id        BIGINT NOT NULL,
  amount          DECIMAL(10,2) NULL,
  reference       VARCHAR(150) NULL,
  status          ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  reject_reason   VARCHAR(300) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at     DATETIME NULL,
  KEY idx_convpayments_conversation (conversation_id, status),
  KEY idx_convpayments_session (session_id),
  CONSTRAINT fk_convpayments_conversation FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT fk_convpayments_session FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_convpayments_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_convpayments_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- EVALUATIONS
-- ------------------------------------------------------------
CREATE TABLE evaluations (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  tutor_id   BIGINT NOT NULL,
  rating     SMALLINT NOT NULL,
  comment    TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_evaluation_session (session_id),
  KEY idx_evaluations_tutor (tutor_id),
  CONSTRAINT fk_evaluations_session FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
  CONSTRAINT fk_evaluations_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_evaluations_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- USER REPORTS
-- ------------------------------------------------------------
CREATE TABLE user_reports (
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

-- ------------------------------------------------------------
-- USER WARNINGS
-- ------------------------------------------------------------
CREATE TABLE user_warnings (
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

-- ------------------------------------------------------------
-- PASSWORD RESET TOKENS
-- ------------------------------------------------------------
CREATE TABLE password_reset_tokens (
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

-- ------------------------------------------------------------
-- ACTIVITY LOGS
-- ------------------------------------------------------------
CREATE TABLE activity_logs (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id   BIGINT NULL,
  details     JSON NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_logs_user (user_id),
  KEY idx_logs_action (action),
  KEY idx_logs_created (created_at),
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- SUBJECT REQUESTS
-- ------------------------------------------------------------
CREATE TABLE subject_requests (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  tutor_id      BIGINT NOT NULL,
  code          VARCHAR(20) NOT NULL,
  name          VARCHAR(150) NOT NULL,
  description   TEXT NULL,
  proficiency   SMALLINT NOT NULL DEFAULT 3,
  strand        VARCHAR(20) NULL,
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   DATETIME NULL,
  UNIQUE KEY uq_subject_request (tutor_id, code),
  KEY idx_subject_requests_status (status),
  CONSTRAINT fk_subject_requests_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TUTOR APPLICATIONS
-- ------------------------------------------------------------
CREATE TABLE tutor_applications (
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

-- ------------------------------------------------------------
-- RESOURCES
-- ------------------------------------------------------------
CREATE TABLE resources (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  tutor_id    BIGINT NOT NULL,
  subject_id  BIGINT NULL,
  title       VARCHAR(255) NOT NULL,
  file_name   VARCHAR(255) NULL,
  file_type   VARCHAR(20) NOT NULL DEFAULT 'PDF',
  size_bytes  BIGINT NULL,
  description TEXT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_resources_tutor (tutor_id),
  KEY idx_resources_subject (subject_id),
  CONSTRAINT fk_resources_tutor FOREIGN KEY (tutor_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_resources_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEED DATA
-- Default passwords: Admin@123 / Faculty@123 / Tutor@123 / Student@123
-- Hashes generated with bcryptjs (cost 10)
-- ============================================================

INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active) VALUES
(1, 'admin@peerlink.edu',     '$2a$10$vvDNXhEYATRXuM6NXzQW.eweNMp6/DT4iri5L6FyLcQG3ZUHzijgi', 'Alex',    'Admin',    'admin',   1),
(2, 'faculty@peerlink.edu',   '$2a$10$JDusT272YLpZvBJ/CRJM0u0NnxGraIk0QqtNtms78LYSJzTipY56i', 'Dana',    'Faculty',  'faculty', 1),
(3, 'maria@peerlink.edu',     '$2a$10$oqZpYzmn5EjTMD0mpfSbk.3YFAsP3MU.zcgnc8ozv2P8qMKam7h5u', 'Maria',   'Tutor',    'tutor',   1),
(4, 'student@peerlink.edu',   '$2a$10$sxsfR9PejLT4wmo1A6i2Uer0XPVLGpd2RGZD6ptBm2lB9HBQ8Vt8K', 'Juswa',   'Student',  'student', 1),
(5, 'gerome@peerlink.edu',    '$2a$10$oqZpYzmn5EjTMD0mpfSbk.3YFAsP3MU.zcgnc8ozv2P8qMKam7h5u', 'Gerome',  'Sanchez',  'tutor',   1),
(6, 'kiel@peerlink.edu',      '$2a$10$oqZpYzmn5EjTMD0mpfSbk.3YFAsP3MU.zcgnc8ozv2P8qMKam7h5u', 'Kiel',    'Reyes',    'tutor',   1),
(7, 'mike.chen@peerlink.edu', '$2a$10$sxsfR9PejLT4wmo1A6i2Uer0XPVLGpd2RGZD6ptBm2lB9HBQ8Vt8K', 'Mike',    'Chen',     'student', 1);

INSERT INTO student_profiles (id, user_id, year_level, course, bio) VALUES
(1, 4, 2, 'Computer Science', 'Second year CS student looking for help with math and programming.'),
(2, 7, 1, 'Computer Science', 'Freshman CS student, struggling with calculus.');

INSERT INTO tutor_profiles (id, user_id, course, max_year_level, bio, availability, verification_status) VALUES
(1, 3, 'Computer Science', 4, 'Senior CS student. Strong in math and programming, patient with beginners.', '{"Mon":["09:00-12:00","15:00-17:00"],"Tue":["10:00-13:00"],"Wed":["09:00-11:00","14:00-16:00"],"Thu":["10:00-12:00"],"Fri":["09:00-12:00"]}', 'pending'),
(2, 5, 'Mathematics', 5, 'History and mathematics tutor. Clear, structured review sessions with guides.', '{"Mon":["09:00-11:00"],"Tue":["14:00-17:00"],"Wed":["09:00-11:00","15:00-17:00"],"Thu":["14:00-16:00"],"Fri":["13:00-17:00"]}', 'approved'),
(3, 6, 'Networking', 5, 'Networking specialist. TCP/IP, routing, and subnetting made simple.', '{"Mon":["13:00-16:00"],"Tue":["09:00-11:00"],"Wed":["13:00-15:00"],"Thu":["15:00-17:00"],"Fri":["09:00-12:00"]}', 'pending');

INSERT INTO subjects (id, code, name, description, strand) VALUES
(1,  'MATH101', 'Calculus I',                     'Limits, derivatives, and integrals of single-variable functions.', 'STEM'),
(2,  'MATH210', 'Linear Algebra',                 'Vectors, matrices, eigenvalues, and linear transformations.', 'STEM'),
(3,  'CS220',   'Data Structures',                'Stacks, queues, trees, graphs, and algorithmic analysis.', 'ICT'),
(4,  'CS330',   'Web Development',                'HTML, CSS, JavaScript, and modern web frameworks.', 'ICT'),
(5,  'ENG110',  'English Composition',            'Academic writing, essays, and research papers.', NULL),
(6,  'PHYS101', 'Physics I',                      'Mechanics: kinematics, forces, energy, and momentum.', 'STEM'),
(7,  'CS240',   'Database Systems',               'SQL, database design, normalization, and transactions.', 'ICT'),
(8,  'STAT150', 'Statistics',                     'Descriptive statistics, probability, and hypothesis testing.', NULL),
(9,  'HIST101', 'History',                        'World history, Philippine history, and social studies.', 'HUMSS'),
(10, 'NET101',  'Computer Networking',            'OSI model, TCP/IP, routing, and network configuration.', 'ICT'),
(11, 'PRG101',  'Programming Fundamentals',       'Logic, control structures, functions, and problem solving.', 'ICT'),
(12, 'BIO101',  'Biology',                        'Cell biology, genetics, and human anatomy.', 'STEM'),
(13, 'CS230',   'Embedded Systems',               'Microcontrollers, sensors, and embedded C programming.', 'ICT'),
(14, 'GEN101',  'Oral Communication',             'Speech, listening and interpersonal communication skills.', NULL),
(15, 'GEN102',  'Reading and Writing',            'Critical reading strategies and academic writing skills.', NULL),
(16, 'GEN103',  'Filipino Language and Literature','Komunikasyon at pananaliksik sa wika at kulturang Filipino.', NULL),
(17, 'GEN104',  '21st Century Literature',        'Literature from the Philippines and around the world.', NULL),
(18, 'GEN105',  'Contemporary Philippine Arts',   'Contemporary art forms and practices from the regions.', NULL),
(19, 'GEN106',  'Media and Information Literacy', 'Understanding media, information sources, and digital literacy.', NULL),
(20, 'GEN107',  'General Mathematics',            'Functions, logarithms, business math and logic.', NULL),
(21, 'GEN109',  'Earth and Life Science',         'Earth systems, geology, and life processes.', NULL),
(22, 'GEN110',  'Physical Science',               'Chemistry and physics concepts in everyday life.', NULL),
(23, 'GEN111',  'Personal Development',           'Self-awareness, emotional intelligence, and career planning.', NULL),
(24, 'GEN112',  'Understanding Culture, Society and Politics', 'Culture, society, and political structures.', NULL),
(25, 'GEN113',  'Introduction to the Philosophy of the Human Person', 'Philosophical reflection on human existence.', NULL),
(26, 'GEN114',  'Physical Education and Health',  'Fitness, sports, and healthy lifestyle practices.', NULL),
(27, 'GEN115',  'Practical Research 1',           'Qualitative research methods and writing.', NULL),
(28, 'GEN116',  'Practical Research 2',           'Quantitative research methods and statistical treatment.', NULL),
(29, 'GEN117',  'Inquiries, Investigation and Immersion', 'Immersive research experience and reporting.', NULL),
(30, 'GEN118',  'Empowerment Technologies',       'ICT tools, productivity software, and online safety.', NULL),
(31, 'GEN119',  'Entrepreneurship',               'Business idea development and small business planning.', NULL),
(32, 'STEM09',  'Pre-Calculus',                   'Trigonometry, conic sections, and series.', 'STEM'),
(33, 'STEM10',  'Basic Calculus',                 'Limits, derivatives and integrals in the SHS curriculum.', 'STEM'),
(34, 'STEM11',  'General Biology 1',              'Cell biology and life processes.', 'STEM'),
(35, 'STEM12',  'General Chemistry 1',            'Atomic structure, chemical bonding, and stoichiometry.', 'STEM'),
(36, 'STEM13',  'General Chemistry 2',            'Thermodynamics, kinetics, and organic chemistry.', 'STEM'),
(37, 'STEM14',  'General Physics 1',              'Mechanics, waves, and heat.', 'STEM'),
(38, 'STEM15',  'General Physics 2',              'Electricity, magnetism, optics, and modern physics.', 'STEM'),
(39, 'STEM16',  'Research Project / Capstone',    'Independent STEM research culminating in a capstone project.', 'STEM'),
(40, 'ABM01',   'Organization and Management',    'Management theories, functions, and organizational structures.', 'ABM'),
(41, 'ABM02',   'Business Mathematics',           'Profit and loss, ratios, and business computations.', 'ABM'),
(42, 'ABM03',   'Principles of Marketing',        'Marketing concepts, consumer behavior, and branding.', 'ABM'),
(43, 'ABM04',   'Fundamentals of Accountancy, Business and Management 1', 'Accounting basics, journal entries, and financial statements.', 'ABM'),
(44, 'ABM05',   'Fundamentals of Accountancy, Business and Management 2', 'Advanced accounting cycles and business management.', 'ABM'),
(45, 'ABM06',   'Applied Economics',              'Economic principles applied to current issues.', 'ABM'),
(46, 'ABM07',   'Business Ethics and Social Responsibility', 'Ethical decision-making in business.', 'ABM'),
(47, 'ABM08',   'Business Finance',               'Financial management, risk, and investment basics.', 'ABM'),
(48, 'HUMSS01', 'Philippine Politics and Governance', 'Philippine government structure and political dynamics.', 'HUMSS'),
(49, 'HUMSS02', 'Trends, Networks, and Critical Thinking', 'Trend analysis, networks, and critical thinking skills.', 'HUMSS'),
(50, 'HUMSS03', 'Community Engagement, Solidarity and Citizenship', 'Community dynamics and civic participation.', 'HUMSS'),
(51, 'HUMSS04', 'Discipline and Ideas in the Social Sciences', 'Foundations of the social science disciplines.', 'HUMSS'),
(52, 'HUMSS05', 'Disciplines and Ideas in the Applied Social Sciences', 'Applied fields: counseling, social work, and communication.', 'HUMSS'),
(53, 'HUMSS06', 'Creative Writing',               'Poetry, fiction, and drama writing practice.', 'HUMSS'),
(54, 'HUMSS07', 'Creative Nonfiction',            'Literary journalism, memoir, and personal essays.', 'HUMSS'),
(55, 'HUMSS08', 'Introduction to World Religions and Belief Systems', 'Comparative study of major world religions.', 'HUMSS'),
(56, 'GAS01',   'Earth Science',                  'Geology, meteorology, and environmental science.', 'GAS'),
(57, 'GAS02',   'Economics',                      'Microeconomics, macroeconomics, and economic systems.', 'GAS'),
(58, 'GAS03',   'English for Academic and Professional Purposes', 'Academic language and workplace communication.', 'GAS'),
(59, 'ICT01',   'Computer System Servicing',      'Hardware assembly, maintenance, and system configuration.', 'ICT'),
(60, 'ICT02',   'Animation',                      '2D/3D animation principles and production.', 'ICT');

INSERT INTO tutor_subjects (tutor_profile_id, subject_id, proficiency) VALUES
(1, 1, 5), (1, 3, 5), (1, 5, 4),
(2, 1, 4), (2, 9, 5),
(3, 10, 5);
