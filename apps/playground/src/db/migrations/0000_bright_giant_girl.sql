CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_id` text NOT NULL,
	`created_at` integer DEFAULT '"2026-04-15T15:08:28.129Z"',
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_idx` ON `accounts` (`provider`,`provider_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`data` text,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan` text NOT NULL,
	`reference_id` text NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`stripe_subscription_id` text,
	`status` text NOT NULL,
	`period_start` integer,
	`period_end` integer,
	`cancel_at_period_end` integer DEFAULT false,
	`seats` integer DEFAULT 1,
	`created_at` integer DEFAULT '"2026-04-15T15:08:28.128Z"',
	FOREIGN KEY (`reference_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`password` text,
	`role` text DEFAULT 'user',
	`avatar` text,
	`stripe_customer_id` text,
	`subscription_status` text DEFAULT 'none',
	`created_at` integer DEFAULT '"2026-04-15T15:08:28.128Z"'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);