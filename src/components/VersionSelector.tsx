// version selector dropdown for tracks with multiple versions
import { createSignal, Show, For } from "solid-js";
import { ChevronDown, CheckCircle2, Clock, AlertCircle } from "lucide-solid";
import type { TrackVersion } from "../lib/db/types";

interface Props {
  versions: TrackVersion[];
  currentVersionId: string;
  onVersionChange: (versionId: string) => void;
}

export default function VersionSelector(props: Props) {
  const [isOpen, setIsOpen] = createSignal(false);

  const currentVersion = () =>
    props.versions.find((v) => v.id === props.currentVersionId);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 class="w-4 h-4 text-green-500" />;
      case "processing":
      case "pending":
        return <Clock class="w-4 h-4 text-amber-500 animate-pulse-soft" />;
      case "failed":
        return <AlertCircle class="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const handleSelect = (versionId: string) => {
    props.onVersionChange(versionId);
    setIsOpen(false);
  };

  // don't show if only one version
  if (props.versions.length <= 1) {
    return null;
  }

  return (
    <div class="relative">
      <button
        onClick={() => setIsOpen(!isOpen())}
        class="btn-secondary text-sm"
        aria-expanded={isOpen()}
        aria-haspopup="listbox"
      >
        <span>Version {currentVersion()?.version_number}</span>
        <ChevronDown
          class={`w-4 h-4 transition-transform ${isOpen() ? "rotate-180" : ""}`}
        />
      </button>

      <Show when={isOpen()}>
        {/* backdrop */}
        <div
          class="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />

        {/* dropdown */}
        <div class="absolute right-0 mt-2 w-64 card p-2 z-50 animate-scale-in origin-top-right">
          <ul role="listbox" class="space-y-1">
            <For each={props.versions}>
              {(version) => (
                <li>
                  <button
                    role="option"
                    aria-selected={version.id === props.currentVersionId}
                    onClick={() => handleSelect(version.id)}
                    class={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                      version.id === props.currentVersionId
                        ? "bg-accent-50 dark:bg-accent-950"
                        : "hover:bg-surface-100 dark:hover:bg-surface-800"
                    }`}
                    disabled={version.processing_status !== "complete"}
                  >
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">
                          Version {version.version_number}
                        </span>
                        {statusIcon(version.processing_status)}
                      </div>
                      <p class="text-xs text-surface-500 mt-0.5">
                        {formatDate(version.created_at)}
                      </p>
                    </div>
                    <Show when={version.id === props.currentVersionId}>
                      <CheckCircle2 class="w-5 h-5 text-accent-500" />
                    </Show>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}

