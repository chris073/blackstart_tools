import { notFound } from "next/navigation";

import { readHandbookBySlug } from "@/lib/handbook";

import { HandbookMarkdown } from "../HandbookMarkdown";

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const segments = slug?.map((s) => decodeURIComponent(s)) ?? [];
  if (segments.length === 0) {
    return { title: "Handbook · Blackstart Labs" };
  }
  const doc = await readHandbookBySlug(segments);
  if (!doc) {
    return { title: "Not found · Handbook" };
  }
  const leaf = doc.relPath.replace(/\.md$/i, "").split("/").pop() ?? "Note";
  return { title: `${leaf} · Handbook` };
}

export default async function HandbookDocPage({ params }: Props) {
  const { slug } = await params;
  const segments = slug?.map((s) => decodeURIComponent(s)) ?? [];

  if (segments.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-bsl-text">Overview</h2>
        <p className="text-sm text-bsl-muted">
          Select a note in the sidebar to render it here. Add or edit <span className="font-mono">.md</span> files under
          your handbook directory; refresh the page to pick up changes.
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
      <HandbookMarkdown content={doc.content} />
    </article>
  );
}
