// server middleware for logging and error handling

import { createMiddleware } from "@tanstack/solid-start";
import { logInfo, logError, logWarn, reportError } from "./logger";
import { trackError } from "./error-reporter";

// request/response logging middleware
export const requestLogger = createMiddleware().server(async ({ next, request }) => {
	const startTime = Date.now();
	const timestamp = new Date().toISOString();
	const url = new URL(request.url);

	logInfo(`Incoming ${request.method} ${url.pathname}`, {
		method: request.method,
		path: url.pathname,
		query: Object.fromEntries(url.searchParams),
		userAgent: request.headers.get("user-agent"),
		timestamp,
	});

	try {
		const result = await next();
		const duration = Date.now() - startTime;

		logInfo(`Completed ${request.method} ${url.pathname}`, {
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

		logError(`Error in ${request.method} ${url.pathname}`, {
			method: request.method,
			path: url.pathname,
			duration: `${duration}ms`,
			error: err.message,
			stack: err.stack,
			timestamp: new Date().toISOString(),
		});

		trackError(err, {
			method: request.method,
			path: url.pathname,
			duration: `${duration}ms`,
		});

		reportError(err, {
			method: request.method,
			path: url.pathname,
			duration: `${duration}ms`,
		});

		throw error;
	}
});

// error handling middleware
export const errorHandler = createMiddleware().server(async ({ next, request }) => {
	try {
		return await next();
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		const url = new URL(request.url);

		// log and track error
		logError(`Unhandled error in middleware`, {
			method: request.method,
			path: url.pathname,
			error: err.message,
			stack: err.stack,
		});

		trackError(err, {
			method: request.method,
			path: url.pathname,
			middleware: true,
		});

		// re-throw to let route handlers handle it
		throw error;
	}
});

// performance monitoring middleware
export const performanceMonitor = createMiddleware().server(async ({ next, request }) => {
	const startTime = Date.now();
	const url = new URL(request.url);

	try {
		const response = await next();
		const duration = Date.now() - startTime;

		// warn on slow requests
		if (duration > 1000) {
			logWarn(`Slow request detected: ${request.method} ${url.pathname}`, {
				method: request.method,
				path: url.pathname,
				duration: `${duration}ms`,
			});
		}

		return response;
	} catch (error) {
		const duration = Date.now() - startTime;
		logError(`Request failed after ${duration}ms`, {
			method: request.method,
			path: url.pathname,
			duration: `${duration}ms`,
		});
		throw error;
	}
});

// combined middleware for common use cases
export const commonMiddleware = [requestLogger, errorHandler, performanceMonitor];

