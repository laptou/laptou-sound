// server middleware for logging and error handling

import { createMiddleware } from "@tanstack/solid-start";
import { createAuth } from "./auth";
import { trackError } from "./error-reporter";
import { logDebug, logError, logInfo, logWarn, reportError } from "./logger";

// request/response logging middleware
export const requestLogger = createMiddleware().server(
	async ({ next, request }) => {
		const startTime = Date.now();
		const timestamp = new Date().toISOString();
		const url = new URL(request.url);

		try {
			const result = await next();
			const duration = Date.now() - startTime;

			logDebug(`[request] completed`, {
				method: request.method,
				path: url.pathname,
				status: result.response.status,
				duration: `${duration}ms`,
				timestamp: new Date().toISOString(),
			});

			// add debug headers in development
			if (process.env.NODE_ENV === "development") {
				result.response.headers.set("X-Debug-Duration", `${duration}ms`);
				result.response.headers.set("X-Debug-Timestamp", timestamp);
			}

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;
			const err = error instanceof Error ? error : new Error(String(error));

			logError(`[request] failed`, {
				method: request.method,
				path: url.pathname,
				duration: `${duration}ms`,
				error: err.message,
				stack: err.stack,
				timestamp: new Date().toISOString(),
			});

			throw error;
		}
	},
);

// performance monitoring middleware
export const performanceMonitor = createMiddleware().server(
	async ({ next, request }) => {
		const startTime = Date.now();
		const url = new URL(request.url);

		try {
			const response = await next();
			return response;
		} finally {
			const duration = Date.now() - startTime;

			// warn on slow requests
			if (duration > 1000) {
				logWarn(`[request] slow`, {
					method: request.method,
					path: url.pathname,
					duration: `${duration}ms`,
				});
			}
		}
	},
);

export const authenticator = createMiddleware().server(
	async ({ next, request }) => {
		const session = await createAuth().api.getSession({
			headers: request.headers,
		});

		return next({
			context: {
				session: session?.session ?? null,
				user: session?.user ?? null,
			},
		});
	},
);

// combined middleware for common use cases
export const commonMiddleware = [
	requestLogger,
	performanceMonitor,
	authenticator,
];
