// client-side auth hooks for solidjs
import { createAuthClient } from "better-auth/solid";

// create the auth client - connects to our api routes
export const authClient = createAuthClient({
	baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

// export commonly used hooks and methods
export const useSession = authClient.useSession;
export const signIn = authClient.signIn;
export const signUp = authClient.signUp;
export const signOut = authClient.signOut;
