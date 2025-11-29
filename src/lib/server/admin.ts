// server functions for admin operations
import { createServerFn } from "@tanstack/solid-start/server";
import { getDB, getDrizzleDB } from "./context";
import { getSession } from "./auth";
import { createInviteCode, getUserRole, setUserRole } from "../db";
import * as schema from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { InviteCode, UserRole } from "../db/types";

// get all invite codes (admin only)
// note: uses raw D1 for user table joins (Better Auth managed)
export const fetchInviteCodes = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSession();
    if (!session?.user || session.role !== "admin") {
      throw new Error("Admin access required");
    }

    const db = getDB(); // raw D1 for user table joins
    const { results } = await db
      .prepare(
        `SELECT ic.*, 
          creator.name as creator_name, 
          used_user.name as used_by_name
         FROM invite_code ic
         LEFT JOIN user creator ON creator.id = ic.created_by
         LEFT JOIN user used_user ON used_user.id = ic.used_by
         ORDER BY ic.created_at DESC`
      )
      .all<
        InviteCode & { creator_name: string | null; used_by_name: string | null }
      >();

    return results;
  }
);

// create new invite code (admin only)
export const generateInviteCode = createServerFn({ method: "POST" })
  .validator(
    (data: { role: "uploader" | "admin"; expiresInDays?: number }) => data
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session?.user || session.role !== "admin") {
      throw new Error("Admin access required");
    }

    const db = getDrizzleDB();

    // create auth context for authorization checks
    const context = session
      ? { userId: session.user.id, role: session.role }
      : null;

    // calculate expiration if specified
    let expiresAt: string | undefined;
    if (data.expiresInDays) {
      const date = new Date();
      date.setDate(date.getDate() + data.expiresInDays);
      expiresAt = date.toISOString();
    }

    return createInviteCode(db, session.user.id, data.role, expiresAt, context);
  });

// delete invite code (admin only)
export const deleteInviteCode = createServerFn({ method: "POST" })
  .validator((codeId: string) => codeId)
  .handler(async ({ data: codeId }) => {
    const session = await getSession();
    if (!session?.user || session.role !== "admin") {
      throw new Error("Admin access required");
    }

    const db = getDrizzleDB();
    await db.delete(schema.inviteCode).where(eq(schema.inviteCode.id, codeId));

    return { deleted: true };
  });

// get all users with roles (admin only)
// note: uses raw D1 for user table (Better Auth managed)
export const fetchUsers = createServerFn({ method: "GET" })
  .validator((data?: { limit?: number; offset?: number }) => data ?? {})
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session?.user || session.role !== "admin") {
      throw new Error("Admin access required");
    }

    const db = getDB(); // raw D1 for user table
    const { results } = await db
      .prepare(
        `SELECT u.*, ur.role 
         FROM user u
         LEFT JOIN user_role ur ON ur.user_id = u.id
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(data.limit ?? 50, data.offset ?? 0)
      .all<{
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        created_at: string;
        role: UserRole | null;
      }>();

    return results.map((u) => ({
      ...u,
      role: u.role ?? "commenter",
    }));
  });

// update user role (admin only)
export const updateUserRole = createServerFn({ method: "POST" })
  .validator((data: { userId: string; role: UserRole }) => data)
  .handler(async ({ data }) => {
    const session = await getSession();
    if (!session?.user || session.role !== "admin") {
      throw new Error("Admin access required");
    }

    // prevent demoting yourself
    if (data.userId === session.user.id && data.role !== "admin") {
      throw new Error("Cannot demote yourself");
    }

    const db = getDrizzleDB();
    // create auth context for authorization checks
    const context = session
      ? { userId: session.user.id, role: session.role }
      : null;

    await setUserRole(db, data.userId, data.role, context);

    return { updated: true };
  });

// get admin dashboard stats
// note: uses raw D1 for user table and complex aggregations
export const fetchAdminStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSession();
    if (!session?.user || session.role !== "admin") {
      throw new Error("Admin access required");
    }

    const db = getDB(); // raw D1 for user table and aggregations
    const drizzleDb = getDrizzleDB(); // Drizzle for app tables

    // get various counts using appropriate access method
    const [users, tracks, plays, comments] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as count FROM user`).first<{ count: number }>(), // Better Auth table
      drizzleDb.select({ count: sql<number>`COUNT(*)` }).from(schema.track).then((r) => ({ count: Number(r[0]?.count ?? 0) })),
      drizzleDb.select({ count: sql<number>`COUNT(*)` }).from(schema.playCount).then((r) => ({ count: Number(r[0]?.count ?? 0) })),
      drizzleDb.select({ count: sql<number>`COUNT(*)` }).from(schema.comment).then((r) => ({ count: Number(r[0]?.count ?? 0) })),
    ]);

    // get role distribution (uses user table - Better Auth)
    const { results: roleDistribution } = await db
      .prepare(
        `SELECT COALESCE(ur.role, 'commenter') as role, COUNT(*) as count
         FROM user u
         LEFT JOIN user_role ur ON ur.user_id = u.id
         GROUP BY COALESCE(ur.role, 'commenter')`
      )
      .all<{ role: string; count: number }>();

    return {
      totalUsers: users?.count ?? 0,
      totalTracks: tracks.count,
      totalPlays: plays.count,
      totalComments: comments.count,
      roleDistribution,
    };
  }
);

