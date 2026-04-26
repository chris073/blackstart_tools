import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-bsl-muted">That path does not exist or was moved.</p>
      <Link href="/tools" className="inline-block text-sm text-emerald-200/90 hover:text-emerald-100">
        Tools
      </Link>
    </div>
  );
}
