/**
 * Playground - Database Implementation
 * 
 * Persistent storage using Drizzle ORM + Bun:Sqlite
 */

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq, and } from 'drizzle-orm';
import type { User } from 'nanoauth';
import * as schema from './schema';

// 1. Initialize SQLite Database
const sqlite = new Database('playground.db');
export const db = drizzle(sqlite, { schema });

/**
 * User Repository (Drizzle Implementation)
 */
export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    return (result as any) || null;
  },

  async findById(id: string): Promise<User | null> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).get();
    return (result as any) || null;
  },

  async findByOAuthId(provider: string, providerId: string): Promise<User | null> {
    const account = await db.select()
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.provider, provider),
          eq(schema.accounts.providerId, providerId)
        )
      )
      .get();

    if (!account) return null;
    return this.findById(account.userId);
  },

  async create(user: any): Promise<User> {
    await db.insert(schema.users).values(user);
    return user;
  },

  async linkAccount(userId: string, provider: string, providerId: string): Promise<void> {
    await db.insert(schema.accounts).values({
      id: crypto.randomUUID(),
      userId,
      provider,
      providerId,
      createdAt: new Date()
    });
  },

  async update(id: string, data: Partial<User>): Promise<User> {
    await db.update(schema.users).set(data as any).where(eq(schema.users.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new Error('User not found after update');
    return updated;
  },

  async updatePassword(userId: string, hash: string): Promise<void> {
    await db.update(schema.users).set({ password: hash }).where(eq(schema.users.id, userId));
  }
};

/**
 * Session Repository (Drizzle Implementation)
 */
export const sessionRepository = {
  async save(sessionId: string, userId: string, data: any, expiresAt: Date) {
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId,
      data: JSON.stringify(data),
      expiresAt
    }).onConflictDoUpdate({
      target: schema.sessions.id,
      set: { data: JSON.stringify(data), expiresAt }
    });
  },

  async delete(sessionId: string) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
  },

  async findById(sessionId: string) {
    return await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId)).get();
  }
}
