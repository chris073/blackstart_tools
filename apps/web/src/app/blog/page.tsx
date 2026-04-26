export const metadata = {
  title: "Blog · Blackstart Labs",
  description: "Notes from the lab",
};

export default function BlogPage() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-bsl-muted">Blackstart Labs</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Blog</h1>
      </div>
      <p className="max-w-2xl text-sm text-bsl-muted">
        The feed is quiet for now—check back when we publish field notes, release write-ups, and the occasional waveform
        obsession.
      </p>
    </div>
  );
}
