// processing status indicator with animated dots
import { Show, createSignal, onMount, onCleanup } from "solid-js";
import { CheckCircle2, XCircle, Loader2 } from "lucide-solid";
import type { ProcessingStatus as Status } from "../lib/db/types";

interface Props {
  status: Status;
  onComplete?: () => void;
}

export default function ProcessingStatus(props: Props) {
  return (
    <div class="flex items-center gap-2">
      <Show when={props.status === "pending"}>
        <div class="flex items-center gap-1.5 text-surface-500">
          <div class="flex gap-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-current animate-bounce-soft" style="animation-delay: 0ms" />
            <span class="w-1.5 h-1.5 rounded-full bg-current animate-bounce-soft" style="animation-delay: 150ms" />
            <span class="w-1.5 h-1.5 rounded-full bg-current animate-bounce-soft" style="animation-delay: 300ms" />
          </div>
          <span class="text-sm">Queued</span>
        </div>
      </Show>

      <Show when={props.status === "processing"}>
        <div class="flex items-center gap-1.5 text-accent-500">
          <Loader2 class="w-4 h-4 animate-spin-slow" />
          <span class="text-sm">Processing</span>
        </div>
      </Show>

      <Show when={props.status === "complete"}>
        <div class="flex items-center gap-1.5 text-green-500">
          <CheckCircle2 class="w-4 h-4" />
          <span class="text-sm">Ready</span>
        </div>
      </Show>

      <Show when={props.status === "failed"}>
        <div class="flex items-center gap-1.5 text-red-500">
          <XCircle class="w-4 h-4" />
          <span class="text-sm">Failed</span>
        </div>
      </Show>
    </div>
  );
}

// polling wrapper for status updates
export function ProcessingStatusPoller(props: {
  versionId: string;
  initialStatus: Status;
  onStatusChange?: (status: Status) => void;
}) {
  const [status, setStatus] = createSignal<Status>(props.initialStatus);
  let intervalId: number | undefined;

  onMount(() => {
    // poll for status updates if not complete/failed
    if (props.initialStatus === "pending" || props.initialStatus === "processing") {
      intervalId = window.setInterval(async () => {
        try {
          const res = await fetch(`/api/status/${props.versionId}`);
          const data = await res.json();
          setStatus(data.status);
          props.onStatusChange?.(data.status);

          // stop polling when done
          if (data.status === "complete" || data.status === "failed") {
            clearInterval(intervalId);
          }
        } catch (e) {
          console.error("Failed to poll status:", e);
        }
      }, 3000);
    }
  });

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId);
  });

  return <ProcessingStatus status={status()} />;
}

