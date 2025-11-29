// login page

import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, Show } from "solid-js";
import { EmailPasswordLoginForm } from "@/components/login/EmailPasswordLoginForm";
import { LoginLayout } from "@/components/login/LoginLayout";
import { LoginMethodToggle } from "@/components/login/LoginMethodToggle";
import { MagicLinkLoginForm } from "@/components/login/MagicLinkLoginForm";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const [useMagicLink, setUseMagicLink] = createSignal(false);
	const [magicLinkSent, setMagicLinkSent] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);

	const handleEmailPasswordError = (err: string | null) => {
		setError(err);
	};

	const handleMagicLinkError = (err: string | null) => {
		setError(err);
	};

	const handleMagicLinkSuccess = () => {
		setMagicLinkSent(true);
		setError(null);
	};

	return (
		<LoginLayout error={() => error()} magicLinkSent={() => magicLinkSent()}>
			<LoginMethodToggle
				useMagicLink={useMagicLink}
				onToggle={(value) => {
					setUseMagicLink(value);
					setError(null);
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
	);
}
