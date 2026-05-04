import { NextResponse } from "next/server";

import { writeHandbookBySlug } from "@/lib/handbook";

export async function POST(req: Request) {
  if (process.env.HANDBOOK_EDITABLE !== "1") {
    return NextResponse.json(
      { ok: false, error: "Markdown editing is disabled (set HANDBOOK_EDITABLE=1)." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const slug = (body as { slug?: unknown }).slug;
  const content = (body as { content?: unknown }).content;

  if (!Array.isArray(slug) || !slug.every((s) => typeof s === "string")) {
    return NextResponse.json({ ok: false, error: "slug must be a string[] array." }, { status: 400 });
  }
  if (typeof content !== "string") {
    return NextResponse.json({ ok: false, error: "content must be a string." }, { status: 400 });
  }
  if (content.length > 2_000_000) {
    return NextResponse.json({ ok: false, error: "content too large." }, { status: 413 });
  }

  const res = await writeHandbookBySlug(slug, content);
  if (!res) {
    return NextResponse.json(
      { ok: false, error: "Could not write file (check HANDBOOK_CONTENT_PATH)." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, relPath: res.relPath });
}
