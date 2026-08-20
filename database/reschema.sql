-- ============================================================
-- reschema.sql
-- Idempotent schema + data update for EXISTING PeerLink databases.
-- Safe to re-run. Apply this in Supabase (SQL Editor) or via psql:
--
--   psql "$DATABASE_URL" -f database/reschema.sql
--
-- Fixes:
--   1. Adds the schema columns added after the initial deploy
--      (system messages, payment -> session linking, completion confirmations).
--   2. Backfills conversation_payments.session_id so sessions can resolve
--      their paid status again (payment_id was NULL in the UI).
--   3. Heals sessions that both sides confirmed under the old completion
--      logic but that never flipped to 'completed'.
--   4. Inserts the "Session Completed" system message into every completed
--      session's conversation so both sides see it in the chat.
-- ============================================================

-- 1. MESSAGES — system messages are authored by the app, not a user
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. SESSIONS — per-side completion confirmations
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS student_complete_confirmed_at TIMESTAMPTZ NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS tutor_complete_confirmed_at TIMESTAMPTZ NULL;

-- 3. CONVERSATION PAYMENTS — tie each payment to the exact session it paid for
ALTER TABLE conversation_payments ADD COLUMN IF NOT EXISTS session_id BIGINT NULL;
CREATE INDEX IF NOT EXISTS idx_convpayments_session ON conversation_payments (session_id);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_convpayments_session'
  ) THEN
    ALTER TABLE conversation_payments
      ADD CONSTRAINT fk_convpayments_session FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. BACKFILL: attach orphaned payments to the session they were made for
-- (the most recent session in the same conversation that existed when paid)
UPDATE conversation_payments cp
SET session_id = (
  SELECT s.id FROM sessions s
  WHERE s.conversation_id = cp.conversation_id
    AND s.created_at <= cp.created_at
    AND s.status IN ('accepted','completed','cancelled')
  ORDER BY s.created_at DESC, s.id DESC
  LIMIT 1
)
WHERE cp.session_id IS NULL;

-- 5. HEAL: sessions where BOTH sides confirmed but the status stayed 'accepted'
-- (older completion logic never flipped the status on the second confirm)
UPDATE sessions
SET status = 'completed'
WHERE status = 'accepted'
  AND student_complete_confirmed_at IS NOT NULL
  AND tutor_complete_confirmed_at IS NOT NULL;

-- 6. NOTIFY: post a "Session Completed" system message in the conversation of
-- every completed session that does not already have one
INSERT INTO messages (conversation_id, sender_id, body, is_system, is_read)
SELECT s.conversation_id, NULL, 'Session Completed', TRUE, TRUE
FROM sessions s
WHERE s.status = 'completed'
  AND s.conversation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.conversation_id = s.conversation_id
      AND m.is_system = TRUE
      AND m.body LIKE 'Session Completed%'
  );