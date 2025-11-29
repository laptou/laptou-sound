// admin invite codes management page
import { createFileRoute, redirect } from "@tanstack/solid-router";
import { createSignal, Show, For, createResource } from "solid-js";
import { Link } from "@tanstack/solid-router";
import {
  ArrowLeft,
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
  Clock,
  User,
} from "lucide-solid";
import { getSession } from "../../lib/server/auth";
import {
  fetchInviteCodes,
  generateInviteCode,
  deleteInviteCode,
} from "../../lib/server/admin";

export const Route = createFileRoute("/admin/invites")({
  head: () => ({
    meta: [{ title: "Invite Codes - Admin - laptou sound" }],
  }),
  beforeLoad: async () => {
    const session = await getSession();
    if (!session?.user || session.role !== "admin") {
      throw redirect({ to: "/" });
    }
    return { session };
  },
  component: InviteCodesPage,
});

function InviteCodesPage() {
  const [codes, { refetch }] = createResource(fetchInviteCodes);
  const [generating, setGenerating] = createSignal(false);
  const [newRole, setNewRole] = createSignal<"uploader" | "admin">("uploader");
  const [expiresInDays, setExpiresInDays] = createSignal<number | undefined>(
    undefined
  );
  const [copiedId, setCopiedId] = createSignal<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateInviteCode({
        data: {
          role: newRole(),
          expiresInDays: expiresInDays(),
        },
      });
      refetch();
    } catch (e) {
      console.error("Failed to generate invite code:", e);
      alert("Failed to generate invite code");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (codeId: string) => {
    if (!confirm("Are you sure you want to delete this invite code?")) {
      return;
    }

    try {
      await deleteInviteCode({ data: codeId });
      refetch();
    } catch (e) {
      console.error("Failed to delete invite code:", e);
      alert("Failed to delete invite code");
    }
  };

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div class="animate-fade-in">
        {/* header */}
        <div class="flex items-center gap-4 mb-8">
          <Link href="/admin" class="btn-icon btn-ghost">
            <ArrowLeft class="w-5 h-5" />
          </Link>
          <div class="flex-1">
            <h1 class="text-title">Invite Codes</h1>
            <p class="text-small">Generate and manage invite codes</p>
          </div>
        </div>

        {/* generate new code */}
        <div class="card p-6 mb-8">
          <h2 class="text-subtitle mb-4">Generate New Code</h2>

          <div class="flex flex-wrap gap-4 items-end">
            <div>
              <label class="block text-sm font-medium mb-2">Role</label>
              <select
                value={newRole()}
                onChange={(e) =>
                  setNewRole(e.currentTarget.value as "uploader" | "admin")
                }
                class="input"
              >
                <option value="uploader">Uploader</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">
                Expires in (days)
              </label>
              <select
                value={expiresInDays() ?? ""}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  setExpiresInDays(val ? parseInt(val) : undefined);
                }}
                class="input"
              >
                <option value="">Never</option>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>

            <button
              onClick={handleGenerate}
              class="btn-primary"
              disabled={generating()}
            >
              <Plus class="w-4 h-4" />
              {generating() ? "Generating..." : "Generate Code"}
            </button>
          </div>
        </div>

        {/* codes list */}
        <div class="space-y-4">
          <Show
            when={codes() && codes()!.length > 0}
            fallback={
              <div class="card p-8 text-center text-small">
                No invite codes yet. Generate one above.
              </div>
            }
          >
            <For each={codes()}>
              {(code, index) => (
                <div
                  class={`card p-4 animate-fade-in stagger-${Math.min(
                    index() + 1,
                    8
                  )}`}
                >
                  <div class="flex flex-wrap items-center gap-4">
                    {/* code display */}
                    <div class="flex items-center gap-2">
                      <code class="text-mono text-lg font-bold tracking-wider bg-surface-100 dark:bg-surface-800 px-3 py-1 rounded-lg">
                        {code.code}
                      </code>
                      <button
                        onClick={() => handleCopy(code.code, code.id)}
                        class="btn-icon btn-ghost"
                        title="Copy code"
                      >
                        <Show
                          when={copiedId() === code.id}
                          fallback={<Copy class="w-4 h-4" />}
                        >
                          <CheckCircle2 class="w-4 h-4 text-green-500" />
                        </Show>
                      </button>
                    </div>

                    {/* role badge */}
                    <span
                      class={`badge ${
                        code.role === "admin" ? "badge-error" : "badge-accent"
                      }`}
                    >
                      {code.role}
                    </span>

                    {/* status */}
                    <div class="flex-1 flex flex-wrap items-center gap-4 text-small">
                      <Show
                        when={code.used_by}
                        fallback={
                          <span class="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 class="w-4 h-4" />
                            Available
                          </span>
                        }
                      >
                        <span class="flex items-center gap-1 text-surface-500">
                          <User class="w-4 h-4" />
                          Used by {(code as any).used_by_name || "Unknown"}
                        </span>
                      </Show>

                      <Show when={code.expires_at}>
                        <span class="flex items-center gap-1 text-surface-500">
                          <Clock class="w-4 h-4" />
                          Expires {formatDate(code.expires_at)}
                        </span>
                      </Show>
                    </div>

                    {/* delete button */}
                    <Show when={!code.used_by}>
                      <button
                        onClick={() => handleDelete(code.id)}
                        class="btn-icon btn-ghost text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        title="Delete code"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </Show>
                  </div>

                  {/* meta info */}
                  <div class="mt-2 text-xs text-surface-400">
                    Created by {(code as any).creator_name || "Unknown"} on{" "}
                    {formatDate(code.created_at)}
                  </div>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
}

