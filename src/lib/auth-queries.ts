// auth query and mutation options

import type { MutationFunctionContext, MutationOptions } from "@tanstack/solid-query";
import {
	changeEmail,
	changePassword,
	signInEmail,
	signInMagicLink,
	signUpEmail,
	updateUser,
} from "./auth-client";
import { redeemInviteCode } from "@/server/auth";

// email/password login mutation
export const emailPasswordLoginMutationOptions = () => ({
	mutationFn: async (variables: { email: string; password: string }, context: MutationFunctionContext) =>
		await signInEmail(context.client, {
			email: variables.email,
			password: variables.password,
		}),
});

// magic link login mutation
export const magicLinkLoginMutationOptions = () => ({
	mutationFn: async (variables: { email: string }, context: MutationFunctionContext) =>
		await signInMagicLink(context.client, {
			email: variables.email,
		}),
});

// signup mutation
export const signupMutationOptions = () =>
	({
		mutationFn: async (variables: {
			email: string;
			password: string;
			name: string;	
			inviteCode?: string;
		}, context: MutationFunctionContext) =>
			await signUpEmail(context.client, {
				email: variables.email,
				password: variables.password,
				name: variables.name,
			}),
	}) satisfies MutationOptions<
		unknown,
		unknown,
		{
			email: string;
			password: string;
			name: string;
		}
	>;

// update user profile mutation
export const updateProfileMutationOptions = () => ({
	mutationFn: async (variables: { name?: string; image?: string | null }, context: MutationFunctionContext) =>
		await updateUser(context.client, variables),
});

// change email mutation
export const changeEmailMutationOptions = () => ({
	mutationFn: async (variables: { newEmail: string }, context: MutationFunctionContext) =>
		await changeEmail(context.client, variables),
});

// change password mutation
export const changePasswordMutationOptions = () => ({
	mutationFn: async (variables: {
		currentPassword: string;
		newPassword: string;
	}, context: MutationFunctionContext) => await changePassword(context.client, variables),
});

// redeem invite code mutation
export const redeemInviteCodeMutationOptions = () => ({
	mutationFn: async (variables: { code: string }, _context: MutationFunctionContext) =>
		await redeemInviteCode({ data: variables }),
});
