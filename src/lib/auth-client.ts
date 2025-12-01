// better auth client for solidjs
// provides hooks and methods for client-side auth

import type { QueryClient } from "@tanstack/solid-query";
import { useQuery } from "@tanstack/solid-query";
import { useRouteContext } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";
import { BetterAuthError } from "./errors";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:3000",
	plugins: [magicLinkClient()],
});

// export commonly used methods
export const { getSession } = authClient;

type BetterAuthErrorShape = {
	statusText: string;
	code?: string;
	message?: string;
	status: number;
};

type BetterAuthResult<T> =
	| { data: T; error?: null | undefined }
	| { error: BetterAuthErrorShape };

function unwrapBetterAuthResult<T>(result: BetterAuthResult<T>): T {
	if (result.error) {
		throw new BetterAuthError(
			result.error.message || result.error.statusText,
			result.error.code || `HTTP-${result.error.status}`,
		);
	}
	return result.data;
}

export const signInEmail = createClientOnlyFn(
	async (
		client: QueryClient | null,
		...params: Parameters<typeof authClient.signIn.email>
	) => {
		const result = unwrapBetterAuthResult(
			await authClient.signIn.email(...params),
		);

		client?.invalidateQueries({ queryKey: ["session"] });
		return result;
	},
);

export const signInMagicLink = createClientOnlyFn(
	async (
		client: QueryClient | null,
		...params: Parameters<typeof authClient.signIn.magicLink>
	) => {
		const result = unwrapBetterAuthResult(
			await authClient.signIn.magicLink(...params),
		);
		client?.invalidateQueries({ queryKey: ["session"] });
		return result;
	},
);

export const signOut = createClientOnlyFn(
	async (client: QueryClient | null) => {
		const result = unwrapBetterAuthResult(await authClient.signOut());
		client?.invalidateQueries({ queryKey: ["session"] });
		return result;
	},
);

export const signUpEmail = createClientOnlyFn(
	async (
		client: QueryClient | null,
		...params: Parameters<typeof authClient.signUp.email>
	) => {
		const result = unwrapBetterAuthResult(
			await authClient.signUp.email(...params),
		);
		client?.invalidateQueries({ queryKey: ["session"] });
		return result;
	},
);

// update user profile (name and image)
export const updateUser = createClientOnlyFn(
	async (
		client: QueryClient | null,
		data: { name?: string; image?: string | null },
	) => {
		const result = unwrapBetterAuthResult(await authClient.updateUser(data));
		client?.invalidateQueries({ queryKey: ["session"] });
		return result;
	},
);

// change email (sends verification email)
export const changeEmail = createClientOnlyFn(
	async (client: QueryClient | null, data: { newEmail: string }) => {
		const result = unwrapBetterAuthResult(await authClient.changeEmail(data));
		client?.invalidateQueries({ queryKey: ["session"] });
		return result;
	},
);

// change password
export const changePassword = createClientOnlyFn(
	async (
		client: QueryClient | null,
		data: { currentPassword: string; newPassword: string },
	) => {
		const result = unwrapBetterAuthResult(
			await authClient.changePassword(data),
		);
		client?.invalidateQueries({ queryKey: ["session"] });
		return result;
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
