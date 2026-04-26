export const metadata = {
  title: "Login · Blackstart Labs",
  description: "Sign in to Blackstart Labs",
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-bsl-muted">Blackstart Labs</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Login</h1>
        <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
          Authentication is not wired up yet. Account flows, SSO, and API keys will land here in a later change.
        </p>
      </div>

      <div className="rounded-2xl border border-bsl-border border-dashed bg-bsl-panel/30 p-8 text-center">
        <p className="text-sm text-bsl-muted">Sign-in form and session handling coming soon.</p>
      </div>
    </div>
  );
}
