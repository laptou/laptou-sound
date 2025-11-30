// better auth client for solidjs
// provides hooks and methods for client-side auth

import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { useRouteContext } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:3000",
	plugins: [magicLinkClient()],
});

// export commonly used methods
export const { getSession } = authClient;

export const signInEmail = createClientOnlyFn(
	async (...params: Parameters<typeof authClient.signIn.email>) => {
		const result = await authClient.signIn.email(...params);
		if (result.error) throw result.error;

		useQueryClient().invalidateQueries({ queryKey: ["session"] });
		return result.data;
	},
);

export const signInMagicLink = createClientOnlyFn(
	async (...params: Parameters<typeof authClient.signIn.magicLink>) => {
		const result = await authClient.signIn.magicLink(...params);
		if (result.error) throw result.error;

		useQueryClient().invalidateQueries({ queryKey: ["session"] });
		return result.data;
	},
);

export const signOut = createClientOnlyFn(async () => {
	const result = await authClient.signOut();
	if (result.error) throw result.error;

	useQueryClient().invalidateQueries({ queryKey: ["session"] });
	return result.data;
});

export const signUpEmail = createClientOnlyFn(
	async (...params: Parameters<typeof authClient.signUp.email>) => {
		const result = await authClient.signUp.email(...params);
		if (result.error) throw result.error;

		useQueryClient().invalidateQueries({ queryKey: ["session"] });
		return result.data;
	},
);

export const useSession = () => {
	const context = useRouteContext({ from: "__root__" });

	return useQuery(() => ({
		queryKey: ["session"],
		queryFn: async () => {
			const result = await authClient.getSession();
			if (result.error) throw result.error;
			return result.data;
		},
		initialData: context()?.session,
		enabled: true,
		retry: false,
		retryDelay: 0,
		retryOnMount: false,
		retryOnReconnect: false,
		retryOnWindowFocus: false,
		retryBackoff: false,
		retryBackoffDelay: 0,
	}));
};
