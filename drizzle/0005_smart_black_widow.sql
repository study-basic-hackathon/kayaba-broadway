ALTER TABLE `purchases` ADD `payment_intent_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `purchases` DROP COLUMN `session_id`;