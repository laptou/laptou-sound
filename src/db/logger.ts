// drizzle orm logger integration with our logging system

import type { Logger } from "drizzle-orm/logger";

import { logInfo, logDebug } from "@/lib/logger";

// custom drizzle logger that integrates with our logging system
export class DrizzleLogger implements Logger {
	logQuery(query: string, params: unknown[]): void {
		const trimmedQuery = query.trim();
		const hasParams = params.length > 0;

		// log query with context
		// use debug level for production, info level for development
		if (process.env.NODE_ENV === "development") {
			logInfo("[db]", {
				query: trimmedQuery,
				params: hasParams ? params : undefined,
				paramCount: params.length,
			});
		} else {
			// in production, log at debug level to reduce noise
			logDebug("[db]", {
				query: trimmedQuery,
				paramCount: params.length,
				// don't log params in production for security
			});
		}
	}
}
