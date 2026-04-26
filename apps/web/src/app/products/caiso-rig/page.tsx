import Link from "next/link";

export const metadata = {
  title: "CAISO RIG (open source) · Blackstart Labs",
  description: "Open source California ISO resource integration tooling from Blackstart Labs",
};

export default function CaisoRigProductPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-bsl-muted">
          <Link href="/products" className="text-bsl-muted hover:text-bsl-text">
            Products
          </Link>
          <span className="mx-2 text-bsl-border">/</span>
          <span className="text-bsl-text/80">CAISO RIG</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">CAISO RIG</h1>
        <p className="mt-2 max-w-2xl text-lg text-bsl-muted">
          An open source toolkit for working with California ISO (CAISO) market and grid interfaces—clear contracts,
          testable adapters, and opinionated reference paths so you can integrate without reinventing the wheel.
        </p>
      </div>

      <div className="rounded-2xl border border-bsl-border bg-bsl-panel/50 p-5 backdrop-blur md:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-bsl-muted">Why open source</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-bsl-muted">
          Grid-edge and market participation software is too important to hide behind opaque binaries. RIG is meant to be
          read, forked, and improved in public: shared vocabulary for messages and schedules, reproducible fixtures, and
          documentation that stays next to the code.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-bsl-border bg-bsl-panel/40 p-5">
          <h2 className="text-sm font-semibold text-bsl-text">What you get</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-bsl-muted marker:text-emerald-500/80">
            <li>Reference models for common CAISO-facing payloads and timelines</li>
            <li>Adapter patterns for bridging internal telemetry to market-ready representations</li>
            <li>Test harnesses and sample data aimed at CI, not just demos</li>
            <li>Docs that describe failure modes and versioning—not only happy paths</li>
          </ul>
        </section>
        <section className="rounded-2xl border border-bsl-border bg-bsl-panel/40 p-5">
          <h2 className="text-sm font-semibold text-bsl-text">Who it is for</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-bsl-muted marker:text-emerald-500/80">
            <li>Teams building DER aggregation, storage, or hybrid plant participation in CAISO</li>
            <li>Engineers who want inspectable tooling instead of black-box vendor SDKs</li>
            <li>Contributors improving interoperability across the Western grid ecosystem</li>
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-dashed border-bsl-border bg-bsl-panel/25 p-5 md:p-6">
        <h2 className="text-sm font-semibold text-bsl-text">Repository and releases</h2>
        <p className="mt-3 max-w-3xl text-sm text-bsl-muted">
          Source, issue tracker, and release notes will be linked here as the public repository is published. If you are
          collaborating with Blackstart Labs already, use your usual channel for early access.
        </p>
        <p className="mt-4 text-xs text-bsl-muted">
          RIG is offered as open source software; CAISO trademarks and service marks belong to their respective owners.
          This page describes intent and scope—not a endorsement by CAISO.
        </p>
      </section>

      <div>
        <Link
          href="/products"
          className="text-sm text-emerald-200/90 hover:text-emerald-100"
        >
          ← All products
        </Link>
      </div>
    </div>
  );
}
