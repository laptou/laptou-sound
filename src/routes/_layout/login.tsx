// login page

import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { toast } from "solid-sonner";
import { EmailPasswordLoginForm } from "@/components/login/EmailPasswordLoginForm";
import { LoginLayout } from "@/components/login/LoginLayout";
import { LoginMethodToggle } from "@/components/login/LoginMethodToggle";
import { MagicLinkLoginForm } from "@/components/login/MagicLinkLoginForm";

export const Route = createFileRoute("/_layout/login")({
	component: LoginPage,
});

function LoginPage() {
	const [useMagicLink, setUseMagicLink] = createSignal(false);

	const handleEmailPasswordError = (err: string | null) => {
		if (err) {
			toast.error(err);
		}
	}

	const handleMagicLinkError = (err: string | null) => {
		if (err) {
			toast.error(err);
		}
	}

	const handleMagicLinkSuccess = () => {
		toast.success("Check your email for a magic link to sign in.", {
			duration: Infinity, // don't auto-dismiss - user needs to check email
		})
	}

	return (
		<LoginLayout>
			<LoginMethodToggle
				useMagicLink={useMagicLink}
				onToggle={(value) => {
					setUseMagicLink(value);
				}}
			/>

			<Show
				when={!useMagicLink()}
				fallback={
					<MagicLinkLoginForm
						onSuccess={handleMagicLinkSuccess}
						onError={handleMagicLinkError}
					/>
				}
			>
				<EmailPasswordLoginForm onError={handleEmailPasswordError} />
			</Show>
		</LoginLayout>
	)
}
