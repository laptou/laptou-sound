import { hydrate } from "solid-js/web";
import "solid-devtools";
import { StartClient, hydrateStart } from "@tanstack/solid-start/client";

hydrateStart().then((router) => {
	hydrate(() => <StartClient router={router} />, document);
});
