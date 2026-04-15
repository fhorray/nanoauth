/**
 * Playground - Database Schema
 * 
 * Persistent storage using Drizzle ORM for SQLite
 */

import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Users Table
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  password: text('password'), // Optional for OAuth users
  role: text('role').$type<'admin' | 'user'>().default('user'),
  avatar: text('avatar'),
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionStatus: text('subscription_status').$type<'active' | 'trialing' | 'canceled' | 'none'>().default('none'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
});

/**
 * Subscriptions Table 💳
 */
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(), // Usually Stripe Subscription ID
  plan: text('plan').notNull(),
  referenceId: text('reference_id').notNull().references(() => users.id),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').notNull(), // active, canceled, trialing, etc.
  periodStart: integer('period_start', { mode: 'timestamp' }),
  periodEnd: integer('period_end', { mode: 'timestamp' }),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  seats: integer('seats').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
});

/**
 * Sessions Table
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  data: text('data'), // JSON stringified session claims
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

/**
 * OAuth Accounts (To link social profiles)
 */

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(),
  providerId: text('provider_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
}, (table) => [
  uniqueIndex('provider_idx').on(table.provider, table.providerId)
]);
