"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HandbookMarkdown } from "./HandbookMarkdown";

type Props = {
  slug: string[];
  initialContent: string;
};

export function HandbookEditor({ slug, initialContent }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [content, setContent] = useState(initialContent);
  const [draft, setDraft] = useState(initialContent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => mode === "edit" && draft !== content, [mode, draft, content]);

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/handbook/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, content: draft }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        throw new Error(j.error || res.statusText);
      }
      setContent(draft);
      setMode("view");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onCancel() {
    setDraft(content);
    setMode("view");
    setError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-bsl-muted">
          {mode === "edit" ? (dirty ? "Editing (unsaved changes)" : "Editing") : "Viewing"}
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "view" ? (
            <button
              type="button"
              onClick={() => {
                setDraft(content);
                setMode("edit");
                setError(null);
              }}
              className="rounded-lg border border-bsl-border bg-bsl-panel/60 px-3 py-1.5 text-[11px] font-semibold text-bsl-muted transition hover:text-bsl-text"
            >
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onSave}
                className="rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-50 transition hover:bg-emerald-500/25 disabled:opacity-45"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="rounded-lg border border-bsl-border bg-bsl-panel/60 px-3 py-1.5 text-[11px] font-semibold text-bsl-muted transition hover:text-bsl-text disabled:opacity-45"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/95">
          {error}
        </div>
      ) : null}

      {mode === "edit" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Markdown</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              rows={24}
              className="min-h-[60vh] w-full resize-y rounded-xl border border-bsl-border bg-bsl-bg/80 px-3 py-2 font-mono text-xs leading-relaxed text-bsl-text/95 outline-none focus:border-emerald-500/35 focus:ring-1 focus:ring-emerald-400/25"
            />
          </label>
          <div className="min-w-0">
            <div className="mb-1 text-xs font-medium text-bsl-muted">Preview</div>
            <div className="min-h-[60vh] overflow-auto rounded-xl border border-bsl-border bg-bsl-panel/30 p-4 backdrop-blur">
              <HandbookMarkdown content={draft} />
            </div>
          </div>
        </div>
      ) : (
        <HandbookMarkdown content={content} />
      )}
    </div>
  );
}
