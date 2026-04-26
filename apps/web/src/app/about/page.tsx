export const metadata = {
  title: "About · Blackstart Labs",
  description: "What we build",
};

export default function AboutPage() {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-bsl-muted">Blackstart Labs</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">About</h1>
      </div>
      <div className="max-w-2xl space-y-3 text-sm text-bsl-muted">
        <p>
          Blackstart Labs builds internal tools for measurement, data access, and the glue that keeps engineering teams
          moving—especially when you are bootstrapping from a cold state.
        </p>
        <p className="text-bsl-text/90">
          This site is the front door to those utilities: APIs behind the scenes, a careful UI up front, and the same
          discipline you&apos;d expect when the outside grid isn&apos;t there to hold your hand.
        </p>
      </div>
    </div>
  );
}
