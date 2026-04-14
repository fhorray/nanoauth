/**
 * Playground - Database Schema
 * 
 * Persistent storage using Drizzle ORM for SQLite
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
});
