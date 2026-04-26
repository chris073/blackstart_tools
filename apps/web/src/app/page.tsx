import Link from "next/link";
import { headers } from "next/headers";
import { BrandLogo } from "@/components/BrandLogo";
import { isLocalHost } from "@/lib/local-dev";

export default async function HomePage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const showPrivateLocal = isLocalHost(host);

  return (
    <div className="space-y-10 pb-8">
      <section className="text-center">
        <BrandLogo variant="hero" priority />

        <h1 className="mx-auto mt-10 max-w-3xl text-3xl font-semibold tracking-tight text-bsl-text sm:text-4xl">
          Cold start. Live signal.
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-bsl-muted sm:text-lg">
          In power engineering, a{" "}
          <span className="text-bsl-text/95">blackstart</span> is how you bring a system back without leaning on the
          outside world for juice. We treat software the same way: measured boots, honest telemetry, and tools that work
          when nothing else has come online yet.
        </p>

        <p className="mx-auto mt-4 max-w-xl text-sm italic text-bsl-muted/90">
          Welcome to the lab—where the first watts are always yours.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {showPrivateLocal ? (
            <Link
              href="/tools"
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-2.5 text-sm font-medium text-emerald-50 shadow-[0_0_28px_rgba(16,185,129,0.18)] transition hover:border-emerald-400/55 hover:bg-emerald-500/25"
            >
              Open tools
            </Link>
          ) : null}
          <Link
            href="/about"
            className="rounded-xl border border-bsl-border bg-bsl-panel/50 px-5 py-2.5 text-sm text-bsl-muted transition hover:border-white/15 hover:bg-bsl-panel hover:text-bsl-text"
          >
            Why we exist
          </Link>
        </div>
      </section>
    </div>
  );
}
