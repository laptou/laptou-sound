// server functions for comment operations
import { createServerFn } from "@tanstack/solid-start/server";
import { getDB } from "./context";
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
    const db = getDB();
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
    if (!session?.user) {
      throw new Error("Unauthorized: Must be logged in to comment");
    }

    const db = getDB();

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
      data.timestampSeconds
    );
  });

// delete a comment (owner or admin only)
export const removeComment = createServerFn({ method: "POST" })
  .validator((commentId: string) => commentId)
  .handler(async ({ data: commentId }) => {
    const session = await getSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const db = getDB();

    // get comment to check ownership
    const comment = await db
      .prepare(`SELECT * FROM comment WHERE id = ?`)
      .bind(commentId)
      .first<{ id: string; user_id: string }>();

    if (!comment) {
      throw new Error("Comment not found");
    }

    // check permission
    if (comment.user_id !== session.user.id && session.role !== "admin") {
      throw new Error("You can only delete your own comments");
    }

    await deleteComment(db, commentId);

    return { deleted: true };
  });

