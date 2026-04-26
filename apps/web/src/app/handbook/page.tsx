export const metadata = {
  title: "Handbook · Blackstart Labs",
  description: "How we work and how to use the lab",
};

export default function HandbookPage() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-bsl-muted">Blackstart Labs</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Handbook</h1>
      </div>
      <p className="max-w-2xl text-sm text-bsl-muted">
        Runbooks, conventions, and how to get tools running locally will live here. For now it&apos;s a stub—fill it as
        your team writes the real chapters.
      </p>
    </div>
  );
}
