-- ============================================================
-- add_jitsi_room.sql
-- Adds jitsi_room_name to existing PeerLink sessions table.
-- Run once against your peerlink database.
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

-- Unique room identifier generated once when payment is confirmed
CALL AddColumnIfNotExists('sessions', 'jitsi_room_name', 'VARCHAR(100) NULL');

DROP PROCEDURE IF EXISTS AddColumnIfNotExists;
