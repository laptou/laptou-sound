// auth query and mutation options

import { signIn, signUp } from "./auth-client";

// email/password login mutation
export const emailPasswordLoginMutationOptions = () => ({
	mutationFn: async (variables: { email: string; password: string }) => {
		const result = await signIn.email({
			email: variables.email,
			password: variables.password,
		});

		if (result.error) {
			throw new Error(result.error.message || "Login failed");
		}

		return result;
	},
});

// magic link login mutation
export const magicLinkLoginMutationOptions = () => ({
	mutationFn: async (variables: { email: string }) => {
		const result = await signIn.magicLink({
			email: variables.email,
		});

		if (result.error) {
			throw new Error(result.error.message || "Failed to send magic link");
		}

		return result;
	},
});

// signup mutation
export const signupMutationOptions = () => ({
	mutationFn: async (variables: {
		email: string;
		password: string;
		name: string;
	}) => {
		const result = await signUp.email({
			email: variables.email,
			password: variables.password,
			name: variables.name,
		});

		if (result.error) {
			throw new Error(result.error.message || "Signup failed");
		}

		return result;
	},
});

