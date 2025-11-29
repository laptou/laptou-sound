// email/password login form component

import { createForm } from "@tanstack/solid-form";
import { useMutation } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { Button } from "@ui/button";
import { FormField } from "@/components/FormField";
import { emailPasswordLoginMutationOptions } from "@/lib/auth-queries";

type EmailPasswordLoginFormProps = {
	onError?: (error: string | null) => void;
};

export function EmailPasswordLoginForm(props: EmailPasswordLoginFormProps) {
	const navigate = useNavigate();

	const login = useMutation(() => emailPasswordLoginMutationOptions());

	const form = createForm(() => ({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			try {
				await login.mutateAsync({
					email: value.email,
					password: value.password,
				});
				navigate({ to: "/" });
			} catch {
				// error is handled by mutation state
				props.onError?.(login.error?.message || null);
			}
		},
	}));

	const loading = () => login.isPending;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				void form.handleSubmit();
			}}
			class="space-y-4"
		>
			<form.Field
				name="email"
				validators={{
					onChange: ({ value }) =>
						!value || !value.includes("@")
							? "Please enter a valid email"
							: undefined,
				}}
			>
				{(field) => (
					<FormField
						field={field}
						label="Email"
						type="email"
						placeholder="you@example.com"
					/>
				)}
			</form.Field>

			<form.Field
				name="password"
				validators={{
					onChange: ({ value }) =>
						!value || value.length < 8
							? "Password must be at least 8 characters"
							: undefined,
				}}
			>
				{(field) => (
					<FormField
						field={field}
						label="Password"
						type="password"
						placeholder="••••••••"
					/>
				)}
			</form.Field>

			<form.Subscribe
				selector={(state) => ({
					canSubmit: state.canSubmit,
					isSubmitting: state.isSubmitting,
				})}
			>
				{(state) => (
					<Button
						type="submit"
						disabled={!state().canSubmit || loading()}
						class="w-full"
					>
						{loading() || state().isSubmitting ? "Please wait..." : "Sign In"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
