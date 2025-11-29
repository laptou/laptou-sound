// health check endpoint for monitoring

import { createFileRoute } from "@tanstack/solid-router";
import { json } from "@tanstack/solid-start";
import { getDb } from "@/db";
import { logInfo } from "@/lib/logger";

export const Route = createFileRoute("/health")({
	server: {
		handlers: {
			GET: async () => {
				const startTime = Date.now();

				// check database connectivity
				let dbStatus = "unknown";
				let dbLatency = 0;
				try {
					const dbStart = Date.now();
					const db = getDb();
					// simple query to test connection
					await db.execute("SELECT 1");
					dbLatency = Date.now() - dbStart;
					dbStatus = "connected";
				} catch (error) {
					dbStatus = "error";
					logInfo("Health check: database error", {
						error: error instanceof Error ? error.message : String(error),
					});
				}

				const totalLatency = Date.now() - startTime;

				const health = {
					status: dbStatus === "connected" ? "healthy" : "degraded",
					timestamp: new Date().toISOString(),
					uptime: typeof process !== "undefined" ? process.uptime() : 0,
					checks: {
						database: {
							status: dbStatus,
							latency: `${dbLatency}ms`,
						},
					},
					responseTime: `${totalLatency}ms`,
				};

				const statusCode = health.status === "healthy" ? 200 : 503;

				return json(health, { status: statusCode });
			},
		},
	},
});

