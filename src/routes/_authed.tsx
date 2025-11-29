// authenticated routes layout
// redirects to login if not authenticated

import { createFileRoute, Outlet, redirect } from "@tanstack/solid-router";
import { getSession } from "@/server/auth";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => {
		const session = await getSession();

		if (!session) {
			throw redirect({ to: "/login" });
		}

		return { user: session.user };
	},
	component: AuthedLayout,
});

function AuthedLayout() {
	return <Outlet />;
}
