"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import { apiBaseUrl } from "@/lib/config";
import {
  deleteTerminalProfile,
  listTerminalProfiles,
  newProfileId,
  saveTerminalProfile,
  type TerminalProfile,
} from "@/lib/terminalProfiles";

type XtermTerminal = import("@xterm/xterm").Terminal;
type XtermFitAddon = import("@xterm/addon-fit").FitAddon;

function httpToWsBase(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return `wss://${httpUrl.slice("https://".length)}`;
  if (httpUrl.startsWith("http://")) return `ws://${httpUrl.slice("http://".length)}`;
  return httpUrl;
}

function safeFit(fit: XtermFitAddon, term: XtermTerminal): boolean {
  try {
    const d = fit.proposeDimensions();
    if (!d || d.cols < 1 || d.rows < 1) return false;
    fit.fit();
    return true;
  } catch {
    return false;
  }
}

function runAfterLayout(fn: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn);
  });
}

function profileToForm(p: TerminalProfile) {
  return {
    jumpEnabled: p.jumpEnabled,
    trustJumpHost: p.trustJumpHost,
    trustHost: p.trustHost,
    jumpHost: p.jumpHost,
    jumpPort: p.jumpPort,
    jumpUser: p.jumpUser,
    jumpPassword: p.jumpPassword,
    jumpKeyPem: p.jumpKeyPem,
    jumpKeyPassphrase: p.jumpKeyPassphrase,
    targetHost: p.targetHost,
    targetPort: p.targetPort,
    targetUser: p.targetUser,
    targetPassword: p.targetPassword,
    targetKeyPem: p.targetKeyPem,
    targetKeyPassphrase: p.targetKeyPassphrase,
  };
}

const emptyForm = {
  jumpEnabled: false,
  trustJumpHost: true,
  trustHost: true,
  jumpHost: "",
  jumpPort: "22",
  jumpUser: "",
  jumpPassword: "",
  jumpKeyPem: "",
  jumpKeyPassphrase: "",
  targetHost: "",
  targetPort: "22",
  targetUser: "",
  targetPassword: "",
  targetKeyPem: "",
  targetKeyPassphrase: "",
};

export default function TerminalToolPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XtermTerminal | null>(null);
  const fitRef = useRef<XtermFitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const jumpKeyInputRef = useRef<HTMLInputElement | null>(null);
  const targetKeyInputRef = useRef<HTMLInputElement | null>(null);

  const [jumpEnabled, setJumpEnabled] = useState(false);
  const [trustJumpHost, setTrustJumpHost] = useState(true);
  const [trustHost, setTrustHost] = useState(true);
  const [jumpHost, setJumpHost] = useState("");
  const [jumpPort, setJumpPort] = useState("22");
  const [jumpUser, setJumpUser] = useState("");
  const [jumpPassword, setJumpPassword] = useState("");
  const [jumpKeyPem, setJumpKeyPem] = useState("");
  const [jumpKeyPassphrase, setJumpKeyPassphrase] = useState("");
  const [targetHost, setTargetHost] = useState("");
  const [targetPort, setTargetPort] = useState("22");
  const [targetUser, setTargetUser] = useState("");
  const [targetPassword, setTargetPassword] = useState("");
  const [targetKeyPem, setTargetKeyPem] = useState("");
  const [targetKeyPassphrase, setTargetKeyPassphrase] = useState("");

  const [profileName, setProfileName] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [storeSecrets, setStoreSecrets] = useState(false);
  const [profileTick, setProfileTick] = useState(0);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);

  const profiles = useMemo(() => {
    void profileTick;
    return listTerminalProfiles();
  }, [profileTick]);

  const disconnect = useCallback(() => {
    const w = wsRef.current;
    if (w) {
      wsRef.current = null;
      w.close();
    }
    termRef.current?.reset();
    setSessionOpen(false);
    setStatus(null);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      // Dynamic import avoids `self is not defined` during server prerender.
      const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
      if (disposed) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        theme: {
          background: "#0c0e12",
          foreground: "#e6e9ef",
          cursor: "#3ecf8e",
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(el);
      termRef.current = term;
      fitRef.current = fit;
      runAfterLayout(() => {
        safeFit(fit, term);
      });
      term.onData((data) => {
        const socket = wsRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(data);
      });

      ro = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (!safeFit(fit, term)) return;
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          }
        });
      });
      ro.observe(el);
    })().catch(() => {
      // If xterm fails to load, just leave the container empty and show an error.
      setError("Terminal UI failed to load. Try refreshing the page.");
    });

    return () => {
      disposed = true;
      ro?.disconnect();
      disconnect();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [disconnect]);

  const applyProfile = useCallback((p: TerminalProfile) => {
    const f = profileToForm(p);
    setJumpEnabled(f.jumpEnabled);
    setTrustJumpHost(f.trustJumpHost);
    setTrustHost(f.trustHost);
    setJumpHost(f.jumpHost);
    setJumpPort(f.jumpPort);
    setJumpUser(f.jumpUser);
    setJumpPassword(f.jumpPassword);
    setJumpKeyPem(f.jumpKeyPem);
    setJumpKeyPassphrase(f.jumpKeyPassphrase);
    setTargetHost(f.targetHost);
    setTargetPort(f.targetPort);
    setTargetUser(f.targetUser);
    setTargetPassword(f.targetPassword);
    setTargetKeyPem(f.targetKeyPem);
    setTargetKeyPassphrase(f.targetKeyPassphrase);
    setProfileName(p.name);
    setSelectedProfileId(p.id);
  }, []);

  const onSelectProfile = useCallback(
    (id: string) => {
      setSelectedProfileId(id);
      if (!id) return;
      const p = profiles.find((x) => x.id === id);
      if (p) applyProfile(p);
    },
    [profiles, applyProfile],
  );

  const saveProfile = useCallback(() => {
    const name = profileName.trim();
    if (!name) {
      setError("Enter a profile name before saving.");
      return;
    }
    setError(null);
    const id = selectedProfileId || newProfileId();
    const secrets = storeSecrets;
    const p: TerminalProfile = {
      id,
      name,
      updatedAt: new Date().toISOString(),
      jumpEnabled,
      trustJumpHost,
      trustHost,
      jumpHost,
      jumpPort,
      jumpUser,
      jumpPassword: secrets ? jumpPassword : "",
      jumpKeyPem: secrets ? jumpKeyPem : "",
      jumpKeyPassphrase: secrets ? jumpKeyPassphrase : "",
      targetHost,
      targetPort,
      targetUser,
      targetPassword: secrets ? targetPassword : "",
      targetKeyPem: secrets ? targetKeyPem : "",
      targetKeyPassphrase: secrets ? targetKeyPassphrase : "",
    };
    saveTerminalProfile(p);
    setSelectedProfileId(id);
    setProfileTick((t) => t + 1);
  }, [
    profileName,
    selectedProfileId,
    storeSecrets,
    jumpEnabled,
    trustJumpHost,
    trustHost,
    jumpHost,
    jumpPort,
    jumpUser,
    jumpPassword,
    jumpKeyPem,
    jumpKeyPassphrase,
    targetHost,
    targetPort,
    targetUser,
    targetPassword,
    targetKeyPem,
    targetKeyPassphrase,
  ]);

  const removeProfile = useCallback(() => {
    if (!selectedProfileId) return;
    deleteTerminalProfile(selectedProfileId);
    setSelectedProfileId("");
    setProfileName("");
    const f = emptyForm;
    setJumpEnabled(f.jumpEnabled);
    setTrustJumpHost(f.trustJumpHost);
    setTrustHost(f.trustHost);
    setJumpHost(f.jumpHost);
    setJumpPort(f.jumpPort);
    setJumpUser(f.jumpUser);
    setJumpPassword(f.jumpPassword);
    setJumpKeyPem(f.jumpKeyPem);
    setJumpKeyPassphrase(f.jumpKeyPassphrase);
    setTargetHost(f.targetHost);
    setTargetPort(f.targetPort);
    setTargetUser(f.targetUser);
    setTargetPassword(f.targetPassword);
    setTargetKeyPem(f.targetKeyPem);
    setTargetKeyPassphrase(f.targetKeyPassphrase);
    setProfileTick((t) => t + 1);
  }, [selectedProfileId]);

  const newBlankProfile = useCallback(() => {
    setSelectedProfileId("");
    setProfileName("");
    const f = emptyForm;
    setJumpEnabled(f.jumpEnabled);
    setTrustJumpHost(f.trustJumpHost);
    setTrustHost(f.trustHost);
    setJumpHost(f.jumpHost);
    setJumpPort(f.jumpPort);
    setJumpUser(f.jumpUser);
    setJumpPassword(f.jumpPassword);
    setJumpKeyPem(f.jumpKeyPem);
    setJumpKeyPassphrase(f.jumpKeyPassphrase);
    setTargetHost(f.targetHost);
    setTargetPort(f.targetPort);
    setTargetUser(f.targetUser);
    setTargetPassword(f.targetPassword);
    setTargetKeyPem(f.targetKeyPem);
    setTargetKeyPassphrase(f.targetKeyPassphrase);
  }, []);

  const connect = useCallback(() => {
    setError(null);
    setStatus(null);
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;

    const th = targetHost.trim();
    const tu = targetUser.trim();
    const tp = parseInt(targetPort, 10);
    if (!th || !tu) {
      setError("Target host and username are required.");
      return;
    }
    if (!Number.isInteger(tp) || tp < 1 || tp > 65535) {
      setError("Target port must be between 1 and 65535.");
      return;
    }
    const hasTargetAuth = (targetPassword && targetPassword.length > 0) || (targetKeyPem && targetKeyPem.trim().length > 0);
    if (!hasTargetAuth) {
      setError("Target connection needs a password or a private key file.");
      return;
    }

    let jumpPayload: Record<string, unknown> | undefined;
    if (jumpEnabled) {
      const jh = jumpHost.trim();
      const ju = jumpUser.trim();
      const jp = parseInt(jumpPort, 10);
      if (!jh || !ju) {
        setError("Jump host and username are required when jump is enabled.");
        return;
      }
      if (!Number.isInteger(jp) || jp < 1 || jp > 65535) {
        setError("Jump port must be between 1 and 65535.");
        return;
      }
      const hasJumpAuth = (jumpPassword && jumpPassword.length > 0) || (jumpKeyPem && jumpKeyPem.trim().length > 0);
      if (!hasJumpAuth) {
        setError("Jump host needs a password or a private key file.");
        return;
      }
      jumpPayload = {
        host: jh,
        port: jp,
        username: ju,
        password: jumpPassword,
        private_key_pem: jumpKeyPem,
        private_key_passphrase: jumpKeyPassphrase,
      };
    }

    disconnect();

    runAfterLayout(() => {
      safeFit(fit, term);
      term.reset();

      const wsBase = httpToWsBase(apiBaseUrl.replace(/\/$/, ""));
      const ws = new WebSocket(`${wsBase}/terminal/ws`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      const targetLabel = `${tu}@${th}:${tp}`;
      const statusJump =
        jumpEnabled && jumpHost.trim()
          ? ` via ${jumpUser.trim()}@${jumpHost.trim()}:${jumpPort}`
          : "";

      ws.onopen = () => {
        setStatus("Connecting…");
        safeFit(fit, term);
        const msg: Record<string, unknown> = {
          type: "connect",
          trust_host: trustHost,
          trust_jump_host: trustJumpHost,
          cols: term.cols,
          rows: term.rows,
          target: {
            host: th,
            port: tp,
            username: tu,
            password: targetPassword,
            private_key_pem: targetKeyPem,
            private_key_passphrase: targetKeyPassphrase,
          },
        };
        if (jumpPayload) msg.jump = jumpPayload;
        ws.send(JSON.stringify(msg));
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") {
          try {
            const msg = JSON.parse(ev.data) as { type?: string; message?: string };
            if (msg.type === "error") {
              setError(msg.message ?? "Connection error");
              setStatus(null);
              setSessionOpen(false);
              ws.close();
              return;
            }
            if (msg.type === "connected") {
              setError(null);
              setStatus(`Session: ${targetLabel}${statusJump}`);
              setSessionOpen(true);
              term.focus();
              return;
            }
          } catch {
            /* not JSON */
          }
          return;
        }
        const buf = ev.data as ArrayBuffer;
        if (buf.byteLength) term.write(new Uint8Array(buf));
      };

      ws.onerror = () => {
        setError("WebSocket error (is the API running and reachable?)");
        setStatus(null);
        setSessionOpen(false);
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        setSessionOpen(false);
        setStatus((prev) => (prev?.startsWith("Session:") ? "Disconnected." : prev));
      };
    });
  }, [
    disconnect,
    jumpEnabled,
    jumpHost,
    jumpPort,
    jumpUser,
    jumpPassword,
    jumpKeyPem,
    jumpKeyPassphrase,
    targetHost,
    targetPort,
    targetUser,
    targetPassword,
    targetKeyPem,
    targetKeyPassphrase,
    trustHost,
    trustJumpHost,
  ]);

  const inputCls =
    "w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 font-mono text-sm text-bsl-text outline-none focus:border-emerald-500/40 disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-bsl-muted">Tool</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Terminal</h1>
        <p className="mt-2 max-w-3xl text-sm text-bsl-muted">
          SSH over WebSocket through the API. Optional <strong className="font-medium text-bsl-text/90">jump host</strong>{" "}
          (bastion) and <strong className="font-medium text-bsl-text/90">PEM private keys</strong> from your machine.
          Saved profiles live in <span className="font-mono text-bsl-text/85">localStorage</span> in this browser only.
        </p>
      </div>

      <section className="rounded-2xl border border-bsl-border bg-bsl-panel/40 p-4 backdrop-blur">
        <h2 className="text-xs font-semibold tracking-wide text-bsl-muted">Saved profiles</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-[10rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Load profile</span>
            <select
              value={selectedProfileId}
              onChange={(e) => onSelectProfile(e.target.value)}
              disabled={sessionOpen}
              className={inputCls}
            >
              <option value="">— Custom (not saved) —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[8rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Profile name</span>
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              disabled={sessionOpen}
              placeholder="e.g. Lab via bastion"
              className={inputCls}
            />
          </label>
          <button
            type="button"
            disabled={sessionOpen}
            onClick={saveProfile}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-45"
          >
            Save profile
          </button>
          <button
            type="button"
            disabled={sessionOpen || !selectedProfileId}
            onClick={removeProfile}
            className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100/90 transition hover:bg-rose-500/18 disabled:opacity-40"
          >
            Delete profile
          </button>
          <button
            type="button"
            disabled={sessionOpen}
            onClick={newBlankProfile}
            className="rounded-xl border border-bsl-border bg-bsl-panel/60 px-4 py-2 text-xs font-semibold text-bsl-muted transition hover:text-bsl-text disabled:opacity-45"
          >
            New blank
          </button>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-bsl-muted">
          <input
            type="checkbox"
            checked={storeSecrets}
            disabled={sessionOpen}
            onChange={(e) => setStoreSecrets(e.target.checked)}
            className="rounded border-bsl-border"
          />
          When saving, store passwords and private keys in this browser (localStorage — only use on trusted machines)
        </label>
      </section>

      <section className="space-y-3 rounded-2xl border border-bsl-border border-amber-500/20 bg-bsl-panel/25 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-bsl-text">Jump host (optional)</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-bsl-muted">
            <input
              type="checkbox"
              checked={jumpEnabled}
              disabled={sessionOpen}
              onChange={(e) => setJumpEnabled(e.target.checked)}
              className="rounded border-bsl-border"
            />
            Use jump host
          </label>
        </div>
        {jumpEnabled ? (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-bsl-muted">
              <input
                type="checkbox"
                checked={trustJumpHost}
                disabled={sessionOpen}
                onChange={(e) => setTrustJumpHost(e.target.checked)}
                className="rounded border-bsl-border"
              />
              Trust jump host key
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[8rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Jump host</span>
                <input
                  value={jumpHost}
                  onChange={(e) => setJumpHost(e.target.value)}
                  disabled={sessionOpen}
                  spellCheck={false}
                  className={inputCls}
                  placeholder="bastion.example.com"
                />
              </label>
              <label className="w-24">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Port</span>
                <input value={jumpPort} onChange={(e) => setJumpPort(e.target.value)} disabled={sessionOpen} className={inputCls} />
              </label>
              <label className="min-w-[8rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Username</span>
                <input
                  value={jumpUser}
                  onChange={(e) => setJumpUser(e.target.value)}
                  disabled={sessionOpen}
                  autoComplete="off"
                  className={inputCls}
                />
              </label>
              <label className="min-w-[8rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Password</span>
                <input
                  type="password"
                  value={jumpPassword}
                  onChange={(e) => setJumpPassword(e.target.value)}
                  disabled={sessionOpen}
                  autoComplete="off"
                  className={inputCls}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Jump private key (OpenSSH PEM)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={jumpKeyInputRef} type="file" accept=".pem,.key,application/x-pem-file,text/plain,*/*" className="hidden" disabled={sessionOpen} onChange={(e) => { void (async () => { const f = e.target.files?.[0]; if (f) setJumpKeyPem(await f.text()); e.target.value = ""; })(); }} />
                  <button type="button" disabled={sessionOpen} onClick={() => jumpKeyInputRef.current?.click()} className="rounded-lg border border-bsl-border bg-bsl-panel/70 px-3 py-2 text-xs font-semibold text-bsl-muted hover:text-bsl-text disabled:opacity-45">
                    Choose key file…
                  </button>
                  {jumpKeyPem ? (
                    <span className="text-xs text-emerald-200/90">
                      Loaded ({jumpKeyPem.length} chars)
                      <button type="button" className="ml-2 text-rose-300/90 underline" onClick={() => setJumpKeyPem("")}>
                        Clear
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-bsl-muted">or use password only</span>
                  )}
                </div>
              </div>
              <label className="min-w-[8rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Key passphrase</span>
                <input
                  type="password"
                  value={jumpKeyPassphrase}
                  onChange={(e) => setJumpKeyPassphrase(e.target.value)}
                  disabled={sessionOpen}
                  className={inputCls}
                />
              </label>
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-bsl-border bg-bsl-panel/30 p-4">
        <h2 className="text-sm font-semibold text-bsl-text">Target host</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-bsl-muted">
          <input
            type="checkbox"
            checked={trustHost}
            disabled={sessionOpen}
            onChange={(e) => setTrustHost(e.target.checked)}
            className="rounded border-bsl-border"
          />
          Trust target host key
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[8rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Host</span>
            <input
              value={targetHost}
              onChange={(e) => setTargetHost(e.target.value)}
              disabled={sessionOpen}
              spellCheck={false}
              placeholder="10.0.0.5"
              className={inputCls}
            />
          </label>
          <label className="w-24">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Port</span>
            <input value={targetPort} onChange={(e) => setTargetPort(e.target.value)} disabled={sessionOpen} className={inputCls} />
          </label>
          <label className="min-w-[8rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Username</span>
            <input
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              disabled={sessionOpen}
              autoComplete="off"
              className={inputCls}
            />
          </label>
          <label className="min-w-[8rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Password</span>
            <input
              type="password"
              value={targetPassword}
              onChange={(e) => setTargetPassword(e.target.value)}
              disabled={sessionOpen}
              autoComplete="off"
              className={inputCls}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Target private key (OpenSSH PEM)</span>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={targetKeyInputRef} type="file" accept=".pem,.key,application/x-pem-file,text/plain,*/*" className="hidden" disabled={sessionOpen} onChange={(e) => { void (async () => { const f = e.target.files?.[0]; if (f) setTargetKeyPem(await f.text()); e.target.value = ""; })(); }} />
              <button type="button" disabled={sessionOpen} onClick={() => targetKeyInputRef.current?.click()} className="rounded-lg border border-bsl-border bg-bsl-panel/70 px-3 py-2 text-xs font-semibold text-bsl-muted hover:text-bsl-text disabled:opacity-45">
                Choose key file…
              </button>
              {targetKeyPem ? (
                <span className="text-xs text-emerald-200/90">
                  Loaded ({targetKeyPem.length} chars)
                  <button type="button" className="ml-2 text-rose-300/90 underline" onClick={() => setTargetKeyPem("")}>
                    Clear
                  </button>
                </span>
              ) : (
                <span className="text-xs text-bsl-muted">or use password only</span>
              )}
            </div>
          </div>
          <label className="min-w-[8rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Key passphrase</span>
            <input
              type="password"
              value={targetKeyPassphrase}
              onChange={(e) => setTargetKeyPassphrase(e.target.value)}
              disabled={sessionOpen}
              className={inputCls}
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={sessionOpen}
          onClick={connect}
          className="rounded-xl border border-emerald-500/45 bg-emerald-500/15 px-5 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:pointer-events-none disabled:opacity-45"
        >
          Connect
        </button>
        <button
          type="button"
          disabled={!sessionOpen}
          onClick={disconnect}
          className="rounded-xl border border-rose-500/45 bg-rose-500/10 px-5 py-2 text-xs font-semibold text-rose-100/95 transition hover:bg-rose-500/20 disabled:pointer-events-none disabled:opacity-40"
        >
          Disconnect
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/95">{error}</div>
      ) : null}
      {status && !error ? <div className="text-xs text-bsl-muted">{status}</div> : null}

      <div
        className="overflow-hidden rounded-2xl border border-bsl-border bg-[#0c0e12] p-2 shadow-inner"
        style={{ minHeight: "min(70vh, 520px)" }}
      >
        <div ref={containerRef} className="h-[min(70vh,520px)] w-full" />
      </div>
    </div>
  );
}
