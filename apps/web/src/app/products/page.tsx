import Link from "next/link";

export const metadata = {
  title: "Products · Blackstart Labs",
  description: "Open tools and offerings from Blackstart Labs",
};

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-bsl-muted">Blackstart Labs</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Products</h1>
        <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
          Open offerings we maintain or ship. More listings will appear here as they graduate from the lab.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/products/caiso-rig"
          className="group rounded-2xl border border-bsl-border bg-bsl-panel/60 p-5 backdrop-blur transition hover:border-emerald-500/35 hover:bg-bsl-panel"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-bsl-text">CAISO RIG (open source)</div>
              <div className="mt-1 text-sm text-bsl-muted">
                California ISO resource integration tooling—schemas, adapters, and reference flows you can run and
                extend.
              </div>
            </div>
            <div className="mt-0.5 text-xs text-bsl-muted transition group-hover:text-emerald-200">Open →</div>
          </div>
        </Link>

        <div className="rounded-2xl border border-bsl-border border-dashed bg-bsl-panel/25 p-5 text-sm text-bsl-muted">
          Additional products will be listed here.
        </div>
      </div>
    </div>
  );
}
