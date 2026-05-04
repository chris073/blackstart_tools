import { notFound } from "next/navigation";

import { readHandbookBySlug } from "@/lib/handbook";

import { HandbookEditor } from "../HandbookEditor";

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const segments = slug?.map((s) => decodeURIComponent(s)) ?? [];
  if (segments.length === 0) {
    return { title: "Markdown notes · Tools" };
  }
  const doc = await readHandbookBySlug(segments);
  if (!doc) {
    return { title: "Not found · Notes" };
  }
  const leaf = doc.relPath.replace(/\.md$/i, "").split("/").pop() ?? "Note";
  return { title: `${leaf} · Notes` };
}

export default async function ToolsHandbookDocPage({ params }: Props) {
  const { slug } = await params;
  const segments = slug?.map((s) => decodeURIComponent(s)) ?? [];

  if (segments.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-bsl-text">Overview</h2>
        <p className="text-sm text-bsl-muted">
          Select a note in the sidebar to render it here. Add or edit <span className="font-mono">.md</span> files under
          your configured content directory, or use the in-browser editor when{" "}
          <span className="font-mono text-bsl-text/85">HANDBOOK_EDITABLE=1</span> is set in{" "}
          <span className="font-mono text-bsl-text/85">.env.local</span>.
        </p>
      </div>
    );
  }

  const doc = await readHandbookBySlug(segments);
  if (!doc) {
    notFound();
  }

  return (
    <article>
      <HandbookEditor slug={segments} initialContent={doc.content} />
    </article>
  );
}
