// admin endpoint for viewing tracked errors

import { createFileRoute } from "@tanstack/solid-router";
import { json } from "@tanstack/solid-start";
import { createAuth } from "@/lib/auth";
import { getTrackedErrors } from "@/lib/error-reporter";
import { hasRole } from "@/server/auth";

export const Route = createFileRoute("/api/admin/errors")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const auth = createAuth();
				const session = await auth.api.getSession({ headers: request.headers });

				if (!session) {
					return json({ error: "Unauthorized" }, { status: 401 });
				}

				if (!hasRole(session.user.role as string, "admin")) {
					return json({ error: "Admin access required" }, { status: 403 });
				}

				const errors = getTrackedErrors();
				return json({ errors });
			},
		},
	},
});
