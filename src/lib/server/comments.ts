// server functions for comment operations
import { createServerFn } from "@tanstack/solid-start/server";
import { getDrizzleDB } from "./context";
import { getSession } from "./auth";
import {
  getTrackComments,
  createComment,
  deleteComment,
  getTrackById,
} from "../db";

// get comments for a track
export const fetchComments = createServerFn({ method: "GET" })
  .validator((trackId: string) => trackId)
  .handler(async ({ data: trackId }) => {
    const db = getDrizzleDB();
    return getTrackComments(db, trackId);
  });

// add a comment (any authenticated user)
export const addComment = createServerFn({ method: "POST" })
  .validator(
    (data: { trackId: string; content: string; timestampSeconds?: number }) =>
      data
  )
  .handler(async ({ data }) => {
    const session = await getSession();
    const db = getDrizzleDB();

    // create auth context for authorization checks
    const context = session
      ? { userId: session.user.id, role: session.role }
      : null;

    // verify track exists
    const track = await getTrackById(db, data.trackId);
    if (!track) {
      throw new Error("Track not found");
    }

    return createComment(
      db,
      data.trackId,
      session.user.id,
      data.content,
      data.timestampSeconds,
      context
    );
  });

// delete a comment (owner or admin only)
export const removeComment = createServerFn({ method: "POST" })
  .validator((commentId: string) => commentId)
  .handler(async ({ data: commentId }) => {
    const session = await getSession();
    const db = getDrizzleDB();

    // create auth context for authorization checks
    const context = session
      ? { userId: session.user.id, role: session.role }
      : null;

    // delete comment (authorization checked inside deleteComment)
    await deleteComment(db, commentId, context);

    return { deleted: true };
  });

