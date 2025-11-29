// magic link login form component

import { createForm } from "@tanstack/solid-form";
import { useMutation } from "@tanstack/solid-query";
import { Button } from "@ui/button";
import { FormField } from "@/components/FormField";
import { magicLinkLoginMutationOptions } from "@/lib/auth-queries";

type MagicLinkLoginFormProps = {
	onSuccess?: () => void;
	onError?: (error: string | null) => void;
};

export function MagicLinkLoginForm(props: MagicLinkLoginFormProps) {
	const login = useMutation(() => magicLinkLoginMutationOptions());

	const form = createForm(() => ({
		defaultValues: {
			email: "",
		},
		onSubmit: async ({ value }) => {
			try {
				await login.mutateAsync({
					email: value.email,
				});
				props.onSuccess?.();
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
						{loading() || state().isSubmitting
							? "Please wait..."
							: "Send Magic Link"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
