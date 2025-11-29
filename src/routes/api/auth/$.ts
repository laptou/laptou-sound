// better auth api handler
// handles all /api/auth/* requests

import { createFileRoute } from "@tanstack/solid-router";
import { createAuth } from "@/lib/auth";
import { commonMiddleware } from "@/lib/middleware";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		middleware: commonMiddleware,
		handlers: {
			GET: async ({ request }) => {
				const auth = createAuth();
				return auth.handler(request);
			},
			POST: async ({ request }) => {
				const auth = createAuth();
				return auth.handler(request);
			},
		},
	},
});
