-- AlterTable
ALTER TABLE `tb_notification_templates`
  ADD COLUMN `default_title_template` VARCHAR(255) NULL,
  ADD COLUMN `default_message_template` TEXT NULL;

-- Backfill defaults from the current (live) values so existing rows
-- have something to reset to.
UPDATE `tb_notification_templates`
SET
  `default_title_template` = `title_template`,
  `default_message_template` = `message_template`;