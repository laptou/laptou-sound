// better auth api handler
// handles all /api/auth/* requests

import { createFileRoute } from "@tanstack/solid-router";
import { createAuth } from "@/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
	server: {
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
