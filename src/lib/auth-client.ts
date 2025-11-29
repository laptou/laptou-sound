// better auth client for solidjs
// provides hooks and methods for client-side auth

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_BETTER_AUTH_URL || "http://localhost:3000",
	plugins: [magicLinkClient()],
});

// export commonly used methods
export const { signIn, signUp, signOut, useSession, getSession } = authClient;
