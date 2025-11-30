// auth query and mutation options

import type { MutationOptions } from "@tanstack/solid-query";
import { signInEmail, signInMagicLink, signUpEmail } from "./auth-client";

// email/password login mutation
export const emailPasswordLoginMutationOptions = () =>
	({
		mutationFn: async (variables: { email: string; password: string }) =>
			await signInEmail({
				email: variables.email,
				password: variables.password,
			}),
	}) satisfies MutationOptions;

// magic link login mutation
export const magicLinkLoginMutationOptions = () =>
	({
		mutationFn: async (variables: { email: string }) =>
			await signInMagicLink({
				email: variables.email,
			}),
	}) satisfies MutationOptions;

// signup mutation
export const signupMutationOptions = () =>
	({
		mutationFn: async (variables: {
			email: string;
			password: string;
			name: string;
		}) =>
			await signUpEmail({
				email: variables.email,
				password: variables.password,
				name: variables.name,
			}),
	}) satisfies MutationOptions;
