CREATE TABLE `fields` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`background_url` text,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` integer NOT NULL,
	`file_url` text NOT NULL,
	`thumbnail_url` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`purchased_at` integer NOT NULL,
	`payment_status` text DEFAULT 'mock' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`field_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`position_x` integer NOT NULL,
	`position_y` integer NOT NULL,
	FOREIGN KEY (`field_id`) REFERENCES `fields`(`id`) ON UPDATE no action ON DELETE no action
);
