// server-side auth functions
import { createServerFn } from "@tanstack/solid-start/server";
import { getRequestEvent } from "solid-js/web";
import { getDB } from "./context";
import { getUserRole, setUserRole, useInviteCode } from "../db";
import type { UserRole } from "../db/types";

// get current session from request headers
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const event = getRequestEvent();
  if (!event) return null;

  // get session token from cookie
  const cookies = event.request.headers.get("cookie") || "";
  const sessionToken = cookies
    .split(";")
    .find((c) => c.trim().startsWith("better-auth.session_token="))
    ?.split("=")[1];

  if (!sessionToken) return null;

  const db = getDB();

  // look up session
  const session = await db
    .prepare(
      `SELECT s.*, u.id as user_id, u.email, u.name, u.image 
       FROM session s
       JOIN user u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    )
    .bind(sessionToken)
    .first<{
      id: string;
      user_id: string;
      email: string;
      name: string | null;
      image: string | null;
      expires_at: string;
    }>();

  if (!session) return null;

  // get user role
  const role = await getUserRole(db, session.user_id);

  return {
    user: {
      id: session.user_id,
      email: session.email,
      name: session.name,
      image: session.image,
    },
    role,
    expiresAt: session.expires_at,
  };
});

// get current user's role
export const getCurrentRole = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await getSession();
    return session?.role ?? "commenter";
  }
);

// check if user has required role
export const requireRole = createServerFn({ method: "GET" })
  .validator((allowedRoles: UserRole[]) => allowedRoles)
  .handler(async ({ data: allowedRoles }) => {
    const session = await getSession();

    if (!session?.user) {
      throw new Error("Unauthorized: Not logged in");
    }

    if (!allowedRoles.includes(session.role)) {
      throw new Error(`Forbidden: Requires one of: ${allowedRoles.join(", ")}`);
    }

    return session;
  });

// use an invite code during signup
export const applyInviteCode = createServerFn({ method: "POST" })
  .validator((data: { code: string; userId: string }) => data)
  .handler(async ({ data }) => {
    const db = getDB();
    const invite = await useInviteCode(db, data.code, data.userId);

    if (!invite) {
      throw new Error("Invalid or expired invite code");
    }

    return { role: invite.role };
  });

// helper to check if user can upload
export async function canUpload(userId: string): Promise<boolean> {
  const db = getDB();
  const role = await getUserRole(db, userId);
  return role === "uploader" || role === "admin";
}

// helper to check if user is admin
export async function isAdmin(userId: string): Promise<boolean> {
  const db = getDB();
  const role = await getUserRole(db, userId);
  return role === "admin";
}

