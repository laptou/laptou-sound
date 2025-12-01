// auth query and mutation options

import {
	changeEmail,
	changePassword,
	signInEmail,
	signInMagicLink,
	signUpEmail,
	updateUser,
} from "./auth-client";

// email/password login mutation
export const emailPasswordLoginMutationOptions = () => ({
	mutationFn: async (variables: { email: string; password: string }) =>
		await signInEmail({
			email: variables.email,
			password: variables.password,
		}),
});

// magic link login mutation
export const magicLinkLoginMutationOptions = () => ({
	mutationFn: async (variables: { email: string }) =>
		await signInMagicLink({
			email: variables.email,
		}),
});

// signup mutation
export const signupMutationOptions = () => ({
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
});

// update user profile mutation
export const updateProfileMutationOptions = () => ({
	mutationFn: async (variables: { name?: string; image?: string | null }) =>
		await updateUser(variables),
});

// change email mutation
export const changeEmailMutationOptions = () => ({
	mutationFn: async (variables: { newEmail: string }) =>
		await changeEmail(variables),
});

// change password mutation
export const changePasswordMutationOptions = () => ({
	mutationFn: async (variables: {
		currentPassword: string;
		newPassword: string;
	}) => await changePassword(variables),
});
