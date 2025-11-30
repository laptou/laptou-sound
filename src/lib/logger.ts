// isomorphic logger utility for detailed logging and error tracking

import { createIsomorphicFn } from "@tanstack/solid-start";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

interface LogContext {
	[key: string]: unknown;
}

// structured logger with environment-specific behavior
export const logger = createIsomorphicFn()
	.server((level: LogLevel, message: string, ...contexts: LogContext[]) => {
		const timestamp = new Date().toISOString();
		// merge all context objects, later ones override earlier ones
		const context = contexts.length > 0 ? Object.assign({}, ...contexts) : undefined;
		const logEntry = {
			timestamp,
			level,
			message,
			context,
			environment: "server",
			service: "laptou-sound",
		};

		if (process.env.NODE_ENV === "development") {
			// development: detailed console logging with colors
			const levelColors = {
				trace: "\x1b[90m", // muted gray
				debug: "\x1b[36m", // cyan
				info: "\x1b[32m", // green
				warn: "\x1b[33m", // yellow
				error: "\x1b[31m", // red
			};
			const reset = "\x1b[0m";
			const color = levelColors[level] || reset;

			console[level === "debug" || level === "trace" ? "log" : level](
				`${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`,
				...(contexts.length > 0 ? contexts : [""]),
			);
		} else {
			// production: structured json logging
			console.log(JSON.stringify(logEntry));
		}
	})
	.client((level: LogLevel, message: string, ...contexts: LogContext[]) => {
		const timestamp = new Date().toISOString();
		// merge all context objects, later ones override earlier ones
		const context = contexts.length > 0 ? Object.assign({}, ...contexts) : undefined;
		const logEntry = {
			timestamp,
			level,
			message,
			context,
			environment: "client",
			service: "laptou-sound",
			url: typeof window !== "undefined" ? window.location.href : undefined,
			userAgent:
				typeof navigator !== "undefined" ? navigator.userAgent : undefined,
		};

		if (import.meta.env.DEV) {
			// development: detailed console logging
			const mutedStyle = level === "trace" ? "color: #888" : "";
			console[level === "debug" || level === "trace" ? "log" : level](
				`%c[CLIENT] [${timestamp}] [${level.toUpperCase()}] ${message}`,
				mutedStyle,
				...contexts,
			);
		} else {
			// production: structured logging (could send to analytics)
			console[level === "debug" || level === "trace" ? "log" : level](
				JSON.stringify(logEntry),
			);
			// TODO: integrate with analytics service if needed
			// analytics.track('client_log', logEntry)
		}
	});

// convenience methods
export const logTrace = (message: string, ...contexts: LogContext[]) =>
	logger("trace", message, ...contexts);
export const logDebug = (message: string, ...contexts: LogContext[]) =>
	logger("debug", message, ...contexts);
export const logInfo = (message: string, ...contexts: LogContext[]) =>
	logger("info", message, ...contexts);
export const logWarn = (message: string, ...contexts: LogContext[]) =>
	logger("warn", message, ...contexts);
export const logError = (message: string, ...contexts: LogContext[]) =>
	logger("error", message, ...contexts);

// error reporting with stack traces
export const reportError = createIsomorphicFn()
	.server((error: Error, ...contexts: LogContext[]) => {
		const errorContext = {
			name: error.name,
			message: error.message,
			stack: error.stack,
			...(contexts.length > 0 ? Object.assign({}, ...contexts) : {}),
		};

		logger("error", `Error: ${error.message}`, errorContext);

		// TODO: integrate with error tracking service (e.g., Sentry)
		// Sentry.captureException(error, { extra: contexts })
	})
	.client((error: Error, ...contexts: LogContext[]) => {
		const errorContext = {
			name: error.name,
			message: error.message,
			stack: error.stack,
			url: window.location.href,
			userAgent: navigator.userAgent,
			...(contexts.length > 0 ? Object.assign({}, ...contexts) : {}),
		};

		logger("error", `Client Error: ${error.message}`, errorContext);

		// TODO: integrate with error tracking service (e.g., Sentry)
		// Sentry.captureException(error, { extra: contexts })
	});
