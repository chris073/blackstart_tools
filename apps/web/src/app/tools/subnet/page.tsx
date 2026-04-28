"use client";

import { useMemo, useState } from "react";

type Calc = {
  input: string;
  ip: string;
  prefix: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string | null;
  lastHost: string | null;
  totalAddrs: number;
  usableHosts: number;
};

function parseIpv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = (out << 8) | n;
  }
  return out >>> 0;
}

function intToIpv4(n: number): string {
  const a = (n >>> 24) & 255;
  const b = (n >>> 16) & 255;
  const c = (n >>> 8) & 255;
  const d = n & 255;
  return `${a}.${b}.${c}.${d}`;
}

function prefixToMaskInt(prefix: number): number {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff >>> 0;
  return ((0xffffffff << (32 - prefix)) >>> 0) >>> 0;
}

function parseInput(raw: string): { ip: string; prefix: number } | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(.+?)(?:\s*\/\s*(\d{1,2}))?\s*$/);
  if (!m) return null;
  const ip = m[1].trim();
  const prefix = m[2] == null ? 32 : Number(m[2]);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  if (parseIpv4ToInt(ip) == null) return null;
  return { ip, prefix };
}

function calcSubnet(raw: string): { ok: true; value: Calc } | { ok: false; error: string } {
  const parsed = parseInput(raw);
  if (!parsed) return { ok: false, error: "Enter a subnet like 192.168.1.0/24 (CIDR required for subnets)." };
  const ipInt = parseIpv4ToInt(parsed.ip);
  if (ipInt == null) return { ok: false, error: "Invalid IPv4 address." };
  const prefix = parsed.prefix;
  const maskInt = prefixToMaskInt(prefix);
  const wildcardInt = (~maskInt) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | wildcardInt) >>> 0;
  const totalAddrs = prefix === 32 ? 1 : 2 ** (32 - prefix);

  // Treat input as a subnet (CIDR network). Reject host bits set.
  if (ipInt !== networkInt) {
    const suggested = `${intToIpv4(networkInt)}/${prefix}`;
    return { ok: false, error: `Invalid subnet: host bits are set. Did you mean ${suggested}?` };
  }

  let firstHost: string | null = null;
  let lastHost: string | null = null;
  let usableHosts = 0;
  if (prefix === 32) {
    firstHost = intToIpv4(ipInt);
    lastHost = intToIpv4(ipInt);
    usableHosts = 1;
  } else if (prefix === 31) {
    // RFC 3021: two usable addresses for point-to-point.
    firstHost = intToIpv4(networkInt);
    lastHost = intToIpv4(broadcastInt);
    usableHosts = 2;
  } else {
    const fh = (networkInt + 1) >>> 0;
    const lh = (broadcastInt - 1) >>> 0;
    firstHost = intToIpv4(fh);
    lastHost = intToIpv4(lh);
    usableHosts = Math.max(0, totalAddrs - 2);
  }

  return {
    ok: true,
    value: {
      input: raw.trim(),
      ip: parsed.ip,
      prefix,
      mask: intToIpv4(maskInt),
      wildcard: intToIpv4(wildcardInt),
      network: intToIpv4(networkInt),
      broadcast: intToIpv4(broadcastInt),
      firstHost,
      lastHost,
      totalAddrs,
      usableHosts,
    },
  };
}

function Row({ k, v, mono = true }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-bsl-border/60 py-2">
      <div className="text-xs font-medium text-bsl-muted">{k}</div>
      <div className={`${mono ? "font-mono" : ""} text-sm text-bsl-text`}>{v}</div>
    </div>
  );
}

function usableHostsForPrefix(prefix: number): number {
  if (prefix === 32) return 1;
  if (prefix === 31) return 2;
  if (prefix >= 0 && prefix <= 30) return Math.max(0, 2 ** (32 - prefix) - 2);
  return 0;
}

export default function SubnetToolPage() {
  const [input, setInput] = useState("192.168.1.0/24");

  const res = useMemo(() => calcSubnet(input), [input]);
  const activePrefix = res.ok ? res.value.prefix : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-bsl-muted">Tool</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Subnet Calculator</h1>
        <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
          IPv4 CIDR calculator for quick network, mask, wildcard, and host range checks.
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-bsl-muted">IPv4 / CIDR</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 font-mono text-sm text-bsl-text outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-400/20"
          placeholder="10.0.0.0/16"
        />
        <p className="mt-1 text-[11px] text-bsl-muted/85">
          This tool expects a <span className="font-semibold">subnet</span> (network address aligned to the prefix).
          Examples: <span className="font-mono">10.0.0.0/16</span>, <span className="font-mono">172.16.0.0/20</span>,{" "}
          <span className="font-mono">192.168.1.0/24</span>, <span className="font-mono">192.168.1.5/32</span>.
        </p>
      </label>

      {!res.ok ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/95">
          {res.error}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-bsl-border bg-bsl-panel/40 p-5 backdrop-blur">
            <h2 className="text-sm font-semibold tracking-tight text-bsl-text">Summary</h2>
            <div className="mt-3">
              <Row k="Input" v={`${res.value.ip}/${res.value.prefix}`} />
              <Row k="Subnet mask" v={res.value.mask} />
              <Row k="Wildcard mask" v={res.value.wildcard} />
              <Row k="Network" v={res.value.network} />
              <Row k="Broadcast" v={res.value.broadcast} />
            </div>
          </section>

          <section className="rounded-2xl border border-bsl-border bg-bsl-panel/40 p-5 backdrop-blur">
            <h2 className="text-sm font-semibold tracking-tight text-bsl-text">Hosts</h2>
            <div className="mt-3">
              <Row k="Total addresses" v={String(res.value.totalAddrs)} mono={false} />
              <Row k="Usable hosts" v={String(res.value.usableHosts)} mono={false} />
              <Row k="First host" v={res.value.firstHost ?? "—"} />
              <Row k="Last host" v={res.value.lastHost ?? "—"} />
              <div className="pt-2 text-[11px] text-bsl-muted/85">
                Notes: <span className="font-mono">/31</span> is treated as point-to-point (2 usable).{" "}
                <span className="font-mono">/32</span> is a single host.
              </div>
            </div>
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-bsl-border bg-bsl-panel/25 p-5 backdrop-blur">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-bsl-text">CIDR quick reference</h2>
            <p className="mt-1 text-[11px] text-bsl-muted/85">Prefix, subnet mask, total addresses, and usable hosts.</p>
          </div>
          {activePrefix != null ? (
            <div className="text-[11px] text-bsl-muted">
              Highlight: <span className="font-mono text-bsl-text/85">/{activePrefix}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-bsl-border bg-bsl-bg/40">
          <div className="max-h-[22rem] overflow-auto [scrollbar-gutter:stable]">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 bg-bsl-panel/80 backdrop-blur">
                <tr className="border-b border-bsl-border">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-bsl-muted">CIDR</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold tracking-wide text-bsl-muted">Mask</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-bsl-muted">
                    Total
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold tracking-wide text-bsl-muted">
                    Usable
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 33 }, (_, i) => 32 - i).map((prefix) => {
                  const mask = intToIpv4(prefixToMaskInt(prefix));
                  const total = prefix === 32 ? 1 : 2 ** (32 - prefix);
                  const usable = usableHostsForPrefix(prefix);
                  const active = activePrefix === prefix;
                  return (
                    <tr
                      key={prefix}
                      className={`border-b border-bsl-border/60 ${active ? "bg-emerald-500/10" : "hover:bg-bsl-panel/40"}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-bsl-text">{`/${prefix}`}</td>
                      <td className="px-3 py-2 font-mono text-xs text-bsl-text">{mask}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-bsl-text">{String(total)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-bsl-text">{String(usable)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

