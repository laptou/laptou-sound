// comment management server functions

import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { comments, getDb, tracks, user } from "@/db";
import { createAuth } from "@/lib/auth";

// public comment info including author details
export interface CommentInfo {
	id: string;
	trackId: string;
	userId: string;
	userName: string;
	userImage: string | null;
	content: string;
	createdAt: Date;
	hidden: boolean;
	isOwn: boolean; // whether current user owns this comment
}

// get comments for a track
// returns visible comments for regular users, all non-deleted comments for admins
export const getTrackComments = createServerFn({ method: "GET" })
	.inputValidator((data: { trackId: string }) => data)
	.handler(async ({ data }): Promise<CommentInfo[]> => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		const db = getDb();
		const isAdmin = session?.user?.role === "admin";
		const currentUserId = session?.user?.id ?? null;

		// base query: join comments with users, exclude deleted
		const baseConditions = [
			eq(comments.trackId, data.trackId),
			isNull(comments.deletedAt),
		];

		// for non-admins, only show non-hidden comments or their own hidden comments
		if (!isAdmin && currentUserId) {
			baseConditions.push(
				or(
					eq(comments.hidden, false),
					eq(comments.userId, currentUserId),
				) as ReturnType<typeof eq>,
			);
		} else if (!isAdmin) {
			// anonymous users only see non-hidden comments
			baseConditions.push(eq(comments.hidden, false));
		}

		const result = await db
			.select({
				id: comments.id,
				trackId: comments.trackId,
				userId: comments.userId,
				userName: user.name,
				userImage: user.image,
				content: comments.content,
				createdAt: comments.createdAt,
				hidden: comments.hidden,
			})
			.from(comments)
			.innerJoin(user, eq(comments.userId, user.id))
			.where(and(...baseConditions))
			.orderBy(desc(comments.createdAt));

		return result.map((c) => ({
			...c,
			isOwn: c.userId === currentUserId,
		}));
	});

// create a new comment
export const createComment = createServerFn({ method: "POST" })
	.inputValidator((data: { trackId: string; content: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("You must be logged in to comment");
		}

		// validate content
		const content = data.content.trim();
		if (!content) {
			throw new Error("Comment cannot be empty");
		}
		if (content.length > 2000) {
			throw new Error("Comment is too long (max 2000 characters)");
		}

		const db = getDb();

		// verify track exists
		const track = await db
			.select({ id: tracks.id })
			.from(tracks)
			.where(eq(tracks.id, data.trackId))
			.limit(1);

		if (!track[0]) {
			throw new Error("Track not found");
		}

		const commentId = crypto.randomUUID();

		await db.insert(comments).values({
			id: commentId,
			trackId: data.trackId,
			userId: session.user.id,
			content,
			createdAt: new Date(),
			hidden: false,
		});

		return { id: commentId };
	});

// hide a comment (users can hide their own, admins can hide any)
export const hideComment = createServerFn({ method: "POST" })
	.inputValidator((data: { commentId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("You must be logged in");
		}

		const db = getDb();

		// get the comment
		const comment = await db
			.select()
			.from(comments)
			.where(eq(comments.id, data.commentId))
			.limit(1);

		if (!comment[0]) {
			throw new Error("Comment not found");
		}

		const isOwn = comment[0].userId === session.user.id;
		const isAdmin = session.user.role === "admin";

		if (!isOwn && !isAdmin) {
			throw new Error("You can only hide your own comments");
		}

		await db
			.update(comments)
			.set({ hidden: true })
			.where(eq(comments.id, data.commentId));

		return { success: true };
	});

// unhide a comment (only admins can unhide any comment)
export const unhideComment = createServerFn({ method: "POST" })
	.inputValidator((data: { commentId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("You must be logged in");
		}

		const isAdmin = session.user.role === "admin";
		if (!isAdmin) {
			throw new Error("Only admins can unhide comments");
		}

		const db = getDb();

		// verify comment exists
		const comment = await db
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.id, data.commentId))
			.limit(1);

		if (!comment[0]) {
			throw new Error("Comment not found");
		}

		await db
			.update(comments)
			.set({ hidden: false })
			.where(eq(comments.id, data.commentId));

		return { success: true };
	});

// delete a comment (admins only - soft delete)
export const deleteComment = createServerFn({ method: "POST" })
	.inputValidator((data: { commentId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		if (!session) {
			throw new Error("You must be logged in");
		}

		const isAdmin = session.user.role === "admin";
		if (!isAdmin) {
			throw new Error("Only admins can delete comments");
		}

		const db = getDb();

		// verify comment exists
		const comment = await db
			.select({ id: comments.id })
			.from(comments)
			.where(eq(comments.id, data.commentId))
			.limit(1);

		if (!comment[0]) {
			throw new Error("Comment not found");
		}

		await db
			.update(comments)
			.set({ deletedAt: new Date() })
			.where(eq(comments.id, data.commentId));

		return { success: true };
	});

// get comment count for a track (visible comments only for non-admins)
export const getCommentCount = createServerFn({ method: "GET" })
	.inputValidator((data: { trackId: string }) => data)
	.handler(async ({ data }) => {
		const request = getRequest();
		const auth = createAuth();
		const session = await auth.api.getSession({ headers: request.headers });

		const db = getDb();
		const isAdmin = session?.user?.role === "admin";

		const conditions = [
			eq(comments.trackId, data.trackId),
			isNull(comments.deletedAt),
		];

		// non-admins only count visible comments
		if (!isAdmin) {
			conditions.push(eq(comments.hidden, false));
		}

		const result = await db
			.select({ id: comments.id })
			.from(comments)
			.where(and(...conditions));

		return { count: result.length };
	});

