"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type TopicSeen = {
  count: number;
  lastSeen: string;
  lastPreview: string;
  retainLast: boolean;
};
import { apiBaseUrl } from "@/lib/config";

function httpToWsBase(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return `wss://${httpUrl.slice("https://".length)}`;
  if (httpUrl.startsWith("http://")) return `ws://${httpUrl.slice("http://".length)}`;
  return httpUrl;
}

function stamp(): string {
  return new Date().toLocaleTimeString(undefined, { hour12: false });
}

function formatPayloadB64(b64: string): string {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const t = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (/^[\x20-\x7E\n\r\t]*$/.test(t)) return t;
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
  } catch {
    return b64;
  }
}

export default function MqttExplorerPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const [mode, setMode] = useState<"direct" | "ssh">("direct");
  const [brokerHost, setBrokerHost] = useState("");
  const [brokerPort, setBrokerPort] = useState("1883");

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
  const [forwardHost, setForwardHost] = useState("127.0.0.1");
  const [forwardPort, setForwardPort] = useState("1883");

  const [mqttUser, setMqttUser] = useState("");
  const [mqttPassword, setMqttPassword] = useState("");
  const [mqttClientId, setMqttClientId] = useState("");

  const [subTopic, setSubTopic] = useState("#");
  const [subQos, setSubQos] = useState("0");
  const [pubTopic, setPubTopic] = useState("");
  const [pubPayload, setPubPayload] = useState("");
  const [pubQos, setPubQos] = useState("0");
  const [pubRetain, setPubRetain] = useState(false);

  const [log, setLog] = useState("");
  const [sessionOpen, setSessionOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Topics observed from inbound messages (MQTT has no "list topics" API). */
  const [topicStats, setTopicStats] = useState<Record<string, TopicSeen>>({});
  const [topicFilter, setTopicFilter] = useState("");

  const jumpKeyInputRef = useRef<HTMLInputElement | null>(null);
  const targetKeyInputRef = useRef<HTMLInputElement | null>(null);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => (prev ? `${prev}\n${line}` : line));
    requestAnimationFrame(() => {
      const el = logRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const disconnect = useCallback(() => {
    const w = wsRef.current;
    if (w) {
      wsRef.current = null;
      w.close();
    }
    setSessionOpen(false);
    setTopicStats({});
  }, []);

  const connect = useCallback(() => {
    setError(null);
    setTopicStats({});
    const mqttAuth = {
      username: mqttUser.trim(),
      password: mqttPassword,
      client_id: mqttClientId.trim(),
    };

    let payload: Record<string, unknown>;

    if (mode === "direct") {
      const h = brokerHost.trim();
      if (!h) {
        setError("Broker host is required.");
        return;
      }
      const p = parseInt(brokerPort, 10);
      if (!Number.isInteger(p) || p < 1 || p > 65535) {
        setError("Broker port must be 1–65535.");
        return;
      }
      payload = {
        type: "connect",
        mode: "direct",
        broker: { host: h, port: p },
        mqtt_auth: mqttAuth,
      };
    } else {
      const th = targetHost.trim();
      const tu = targetUser.trim();
      const tp = parseInt(targetPort, 10);
      if (!th || !tu) {
        setError("SSH target host and username are required.");
        return;
      }
      if (!Number.isInteger(tp) || tp < 1 || tp > 65535) {
        setError("SSH target port must be 1–65535.");
        return;
      }
      const hasTargetAuth =
        (targetPassword && targetPassword.length > 0) || (targetKeyPem && targetKeyPem.trim().length > 0);
      if (!hasTargetAuth) {
        setError("SSH target needs a password or a private key file.");
        return;
      }

      const target = {
        host: th,
        port: tp,
        username: tu,
        password: targetPassword,
        private_key_pem: targetKeyPem,
        private_key_passphrase: targetKeyPassphrase,
      };

      let jump: Record<string, unknown> | undefined;
      if (jumpEnabled) {
        const jh = jumpHost.trim();
        const ju = jumpUser.trim();
        const jp = parseInt(jumpPort, 10);
        if (!jh || !ju) {
          setError("Jump host and username are required when jump is enabled.");
          return;
        }
        if (!Number.isInteger(jp) || jp < 1 || jp > 65535) {
          setError("Jump port must be 1–65535.");
          return;
        }
        const hasJumpAuth =
          (jumpPassword && jumpPassword.length > 0) || (jumpKeyPem && jumpKeyPem.trim().length > 0);
        if (!hasJumpAuth) {
          setError("Jump host needs a password or a private key file.");
          return;
        }
        jump = {
          host: jh,
          port: jp,
          username: ju,
          password: jumpPassword,
          private_key_pem: jumpKeyPem,
          private_key_passphrase: jumpKeyPassphrase,
        };
      }

      const fh = forwardHost.trim() || "127.0.0.1";
      const fpn = parseInt(forwardPort, 10);
      if (!Number.isInteger(fpn) || fpn < 1 || fpn > 65535) {
        setError("Forward port (MQTT on remote side) must be 1–65535.");
        return;
      }

      payload = {
        type: "connect",
        mode: "ssh",
        trust_host: trustHost,
        trust_jump_host: trustJumpHost,
        forward: { host: fh, port: fpn },
        target,
        mqtt_auth: mqttAuth,
      };
      if (jump) payload.jump = jump;
    }

    disconnect();

    const wsBase = httpToWsBase(apiBaseUrl.replace(/\/$/, ""));
    const ws = new WebSocket(`${wsBase}/mqtt/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      appendLog(`[${stamp()}] WebSocket open, sending connect…`);
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      try {
        const msg = JSON.parse(ev.data) as {
          type?: string;
          message?: string;
          topic?: string;
          payload_b64?: string;
          qos?: number;
          retain?: boolean;
          mqtt_host?: string;
          mqtt_port?: number;
          mode?: string;
        };
        if (msg.type === "error") {
          setError(msg.message ?? "Error");
          appendLog(`[${stamp()}] ERROR: ${msg.message ?? "unknown"}`);
          setSessionOpen(false);
          ws.close();
          return;
        }
        if (msg.type === "connected") {
          setError(null);
          setSessionOpen(true);
          appendLog(
            `[${stamp()}] MQTT connected (${msg.mode ?? "?"}) via API at ${msg.mqtt_host ?? "?"}:${msg.mqtt_port ?? "?"}`,
          );
          return;
        }
        if (msg.type === "message" && msg.topic && msg.payload_b64 != null) {
          const body = formatPayloadB64(msg.payload_b64);
          const preview = body.length > 160 ? `${body.slice(0, 157)}…` : body;
          setTopicStats((prev) => {
            const cur = prev[msg.topic!];
            return {
              ...prev,
              [msg.topic!]: {
                count: (cur?.count ?? 0) + 1,
                lastSeen: stamp(),
                lastPreview: preview,
                retainLast: Boolean(msg.retain),
              },
            };
          });
          appendLog(
            `[${stamp()}] ${msg.topic} qos=${msg.qos ?? 0} retain=${msg.retain ? "y" : "n"} → ${body}`,
          );
          return;
        }
        if (msg.type === "subscribed" || msg.type === "unsubscribed" || msg.type === "published") {
          appendLog(`[${stamp()}] ${msg.type}${msg.topic ? `: ${msg.topic}` : ""}`);
          return;
        }
        appendLog(`[${stamp()}] ${ev.data}`);
      } catch {
        appendLog(`[${stamp()}] ${ev.data}`);
      }
    };

    ws.onerror = () => {
      setError("WebSocket error (is the API running and reachable?)");
      setSessionOpen(false);
    };

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
      setSessionOpen(false);
      appendLog(`[${stamp()}] WebSocket closed.`);
    };
  }, [
    mode,
    brokerHost,
    brokerPort,
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
    forwardHost,
    forwardPort,
    mqttUser,
    mqttPassword,
    mqttClientId,
    appendLog,
    disconnect,
  ]);

  const sendWs = useCallback((obj: Record<string, unknown>) => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) {
      setError("Not connected.");
      return;
    }
    w.send(JSON.stringify(obj));
  }, []);

  const topicRows = useMemo(() => {
    const q = topicFilter.trim().toLowerCase();
    const entries = Object.entries(topicStats);
    const filtered = q ? entries.filter(([t]) => t.toLowerCase().includes(q)) : entries;
    return filtered.sort(([a], [b]) => a.localeCompare(b));
  }, [topicStats, topicFilter]);

  const onSubscribeWildcard = useCallback(
    (topic: string, label: string) => {
      setError(null);
      sendWs({ type: "subscribe", topic, qos: 0 });
      appendLog(`[${stamp()}] Discovery: subscribed to ${label} — topics fill in as messages arrive (retained msgs may show immediately).`);
    },
    [sendWs, appendLog],
  );

  const onSubscribe = useCallback(() => {
    const topic = subTopic.trim();
    if (!topic) {
      setError("Enter a topic filter.");
      return;
    }
    const q = parseInt(subQos, 10);
    const qos = Number.isInteger(q) && q >= 0 && q <= 2 ? q : 0;
    setError(null);
    sendWs({ type: "subscribe", topic, qos });
  }, [subTopic, subQos, sendWs]);

  const onPublish = useCallback(() => {
    const topic = pubTopic.trim();
    if (!topic) {
      setError("Publish topic is required.");
      return;
    }
    const q = parseInt(pubQos, 10);
    const qos = Number.isInteger(q) && q >= 0 && q <= 2 ? q : 0;
    setError(null);
    sendWs({
      type: "publish",
      topic,
      payload: pubPayload,
      payload_encoding: "utf8",
      qos,
      retain: pubRetain,
    });
  }, [pubTopic, pubPayload, pubQos, pubRetain, sendWs]);

  const onClearLog = useCallback(() => setLog(""), []);

  const onClearTopicList = useCallback(() => setTopicStats({}), []);

  const inputCls =
    "w-full rounded-xl border border-bsl-border bg-bsl-panel px-3 py-2 font-mono text-sm text-bsl-text outline-none focus:border-emerald-500/40 disabled:opacity-50";

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-bsl-muted">Tool</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">MQTT explorer</h1>
        <p className="mt-2 max-w-2xl text-sm text-bsl-muted">
          MQTT runs in <span className="text-bsl-text/85">Python (paho-mqtt)</span> on the FastAPI host. Use{" "}
          <strong className="font-medium text-bsl-text/90">SSH tunnel</strong> to reach a broker on a remote network:
          upload an OpenSSH PEM private key (same as Terminal). Forwarding maps to{" "}
          <span className="font-mono text-bsl-text/85">forward host:port</span> from the SSH <em>target</em> (often{" "}
          <span className="font-mono">127.0.0.1:1883</span>). Brokers do not expose a full topic catalog: use{" "}
          <span className="font-mono text-bsl-text/85">#</span> or <span className="font-mono text-bsl-text/85">$SYS/#</span>{" "}
          below to discover topic names from live or retained traffic.
        </p>
      </div>

      <section className="rounded-2xl border border-bsl-border bg-bsl-panel/35 p-4">
        <h2 className="text-xs font-semibold tracking-wide text-bsl-muted">Connection mode</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-bsl-muted">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="mqtt-mode"
              checked={mode === "direct"}
              disabled={sessionOpen}
              onChange={() => setMode("direct")}
              className="border-bsl-border"
            />
            Direct TCP (API reaches broker)
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="mqtt-mode"
              checked={mode === "ssh"}
              disabled={sessionOpen}
              onChange={() => setMode("ssh")}
              className="border-bsl-border"
            />
            SSH tunnel + PEM key
          </label>
        </div>
      </section>

      {mode === "direct" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Broker host</span>
            <input
              type="text"
              value={brokerHost}
              onChange={(e) => setBrokerHost(e.target.value)}
              disabled={sessionOpen}
              spellCheck={false}
              placeholder="192.168.1.10 or mqtt.local"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Broker port</span>
            <input
              type="text"
              inputMode="numeric"
              value={brokerPort}
              onChange={(e) => setBrokerPort(e.target.value)}
              disabled={sessionOpen}
              className={inputCls}
            />
          </label>
        </div>
      ) : (
        <>
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
                      className={inputCls}
                      spellCheck={false}
                    />
                  </label>
                  <label className="w-24">
                    <span className="mb-1 block text-xs font-medium text-bsl-muted">Port</span>
                    <input value={jumpPort} onChange={(e) => setJumpPort(e.target.value)} disabled={sessionOpen} className={inputCls} />
                  </label>
                  <label className="min-w-[8rem] flex-1">
                    <span className="mb-1 block text-xs font-medium text-bsl-muted">Username</span>
                    <input value={jumpUser} onChange={(e) => setJumpUser(e.target.value)} disabled={sessionOpen} className={inputCls} />
                  </label>
                  <label className="min-w-[8rem] flex-1">
                    <span className="mb-1 block text-xs font-medium text-bsl-muted">Password</span>
                    <input
                      type="password"
                      value={jumpPassword}
                      onChange={(e) => setJumpPassword(e.target.value)}
                      disabled={sessionOpen}
                      className={inputCls}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[12rem] flex-1">
                    <span className="mb-1 block text-xs font-medium text-bsl-muted">Jump private key (PEM)</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={jumpKeyInputRef}
                        type="file"
                        accept=".pem,.key,application/x-pem-file,text/plain,*/*"
                        className="hidden"
                        disabled={sessionOpen}
                        onChange={(e) => {
                          void (async () => {
                            const f = e.target.files?.[0];
                            if (f) setJumpKeyPem(await f.text());
                            e.target.value = "";
                          })();
                        }}
                      />
                      <button
                        type="button"
                        disabled={sessionOpen}
                        onClick={() => jumpKeyInputRef.current?.click()}
                        className="rounded-lg border border-bsl-border bg-bsl-panel/70 px-3 py-2 text-xs font-semibold text-bsl-muted hover:text-bsl-text disabled:opacity-45"
                      >
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
                        <span className="text-xs text-bsl-muted">or password only</span>
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
            <h2 className="text-sm font-semibold text-bsl-text">SSH target (tunnel endpoint)</h2>
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
                <input value={targetHost} onChange={(e) => setTargetHost(e.target.value)} disabled={sessionOpen} className={inputCls} spellCheck={false} />
              </label>
              <label className="w-24">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">SSH port</span>
                <input value={targetPort} onChange={(e) => setTargetPort(e.target.value)} disabled={sessionOpen} className={inputCls} />
              </label>
              <label className="min-w-[8rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Username</span>
                <input value={targetUser} onChange={(e) => setTargetUser(e.target.value)} disabled={sessionOpen} className={inputCls} />
              </label>
              <label className="min-w-[8rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Password</span>
                <input
                  type="password"
                  value={targetPassword}
                  onChange={(e) => setTargetPassword(e.target.value)}
                  disabled={sessionOpen}
                  className={inputCls}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Target private key (PEM)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={targetKeyInputRef}
                    type="file"
                    accept=".pem,.key,application/x-pem-file,text/plain,*/*"
                    className="hidden"
                    disabled={sessionOpen}
                    onChange={(e) => {
                      void (async () => {
                        const f = e.target.files?.[0];
                        if (f) setTargetKeyPem(await f.text());
                        e.target.value = "";
                      })();
                    }}
                  />
                  <button
                    type="button"
                    disabled={sessionOpen}
                    onClick={() => targetKeyInputRef.current?.click()}
                    className="rounded-lg border border-bsl-border bg-bsl-panel/70 px-3 py-2 text-xs font-semibold text-bsl-muted hover:text-bsl-text disabled:opacity-45"
                  >
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
                    <span className="text-xs text-bsl-muted">or password only</span>
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
            <div className="grid gap-4 border-t border-bsl-border pt-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Forward to host (on remote)</span>
                <input
                  value={forwardHost}
                  onChange={(e) => setForwardHost(e.target.value)}
                  disabled={sessionOpen}
                  placeholder="127.0.0.1"
                  className={inputCls}
                  spellCheck={false}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-bsl-muted">Forward to port (MQTT)</span>
                <input value={forwardPort} onChange={(e) => setForwardPort(e.target.value)} disabled={sessionOpen} className={inputCls} />
              </label>
            </div>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-bsl-border bg-bsl-panel/30 p-4">
        <h2 className="text-sm font-semibold text-bsl-text">MQTT authentication (optional)</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Username</span>
            <input value={mqttUser} onChange={(e) => setMqttUser(e.target.value)} disabled={sessionOpen} className={inputCls} autoComplete="off" />
          </label>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Password</span>
            <input
              type="password"
              value={mqttPassword}
              onChange={(e) => setMqttPassword(e.target.value)}
              disabled={sessionOpen}
              className={inputCls}
              autoComplete="off"
            />
          </label>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Client ID (optional)</span>
            <input value={mqttClientId} onChange={(e) => setMqttClientId(e.target.value)} disabled={sessionOpen} className={inputCls} spellCheck={false} />
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

      <section className="space-y-3 rounded-2xl border border-bsl-border bg-bsl-panel/25 p-4">
        <h2 className="text-sm font-semibold text-bsl-text">Subscribe</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Topic filter</span>
            <input value={subTopic} onChange={(e) => setSubTopic(e.target.value)} disabled={!sessionOpen} className={inputCls} spellCheck={false} />
          </label>
          <label className="w-20">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">QoS</span>
            <select value={subQos} onChange={(e) => setSubQos(e.target.value)} disabled={!sessionOpen} className={inputCls}>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!sessionOpen}
            onClick={onSubscribe}
            className="rounded-xl border border-sky-500/45 bg-sky-500/15 px-5 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-45"
          >
            Subscribe
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-bsl-border border-violet-500/20 bg-bsl-panel/25 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-bsl-text">Topics seen on this broker</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-bsl-muted">
              There is no MQTT command to list every topic. This table fills from <strong className="font-medium text-bsl-text/88">messages
              you receive</strong> on active subscriptions. Subscribe to <span className="font-mono text-bsl-text/85">#</span> to watch all
              topics your ACL allows (can be heavy on busy brokers). <span className="font-mono text-bsl-text/85">$SYS/#</span> is used by
              Mosquitto and others for broker metrics, not your application tree.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!sessionOpen}
            onClick={() => onSubscribeWildcard("#", "# (all allowed topics)")}
            className="rounded-xl border border-violet-500/40 bg-violet-500/12 px-4 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/22 disabled:opacity-45"
          >
            Subscribe to # (discover)
          </button>
          <button
            type="button"
            disabled={!sessionOpen}
            onClick={() => onSubscribeWildcard("$SYS/#", "$SYS/# (broker stats)")}
            className="rounded-xl border border-violet-500/40 bg-violet-500/12 px-4 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/22 disabled:opacity-45"
          >
            Subscribe to $SYS/#
          </button>
          <button
            type="button"
            disabled={!sessionOpen || !Object.keys(topicStats).length}
            onClick={onClearTopicList}
            className="rounded-xl border border-bsl-border bg-bsl-panel/50 px-4 py-2 text-xs font-semibold text-bsl-muted transition hover:text-bsl-text disabled:opacity-40"
          >
            Clear table
          </button>
        </div>
        <label className="block max-w-md">
          <span className="mb-1 block text-xs font-medium text-bsl-muted">Filter topics</span>
          <input
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            disabled={!sessionOpen}
            placeholder="Substring match…"
            className={inputCls}
            spellCheck={false}
          />
        </label>
        <div className="overflow-auto rounded-xl border border-bsl-border">
          <table className="w-full min-w-[36rem] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-bsl-border bg-bsl-panel/80 text-[10px] font-semibold uppercase tracking-wider text-bsl-muted">
                <th className="px-3 py-2">Topic</th>
                <th className="px-3 py-2">Msgs</th>
                <th className="px-3 py-2">Last</th>
                <th className="px-3 py-2">Latest payload</th>
                <th className="px-3 py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {topicRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-bsl-muted">
                    No topics yet. Connect, then subscribe to <span className="font-mono text-bsl-text/75">#</span> or a specific filter.
                  </td>
                </tr>
              ) : (
                topicRows.map(([topic, row]) => (
                  <tr key={topic} className="border-b border-bsl-border/80 last:border-0">
                    <td className="max-w-[14rem] px-3 py-2 font-mono text-emerald-200/90 break-all">{topic}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-bsl-muted">{row.count}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-bsl-muted">{row.lastSeen}</td>
                    <td className="max-w-[20rem] px-3 py-2 font-mono text-bsl-muted break-all">
                      {row.lastPreview}
                      {row.retainLast ? (
                        <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-200/90">retain</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-sky-300/95 underline-offset-2 hover:underline"
                        onClick={() => {
                          setPubTopic(topic);
                          setError(null);
                        }}
                      >
                        Use in publish
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-bsl-border bg-bsl-panel/25 p-4">
        <h2 className="text-sm font-semibold text-bsl-text">Publish</h2>
        <div className="grid gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Topic</span>
            <input value={pubTopic} onChange={(e) => setPubTopic(e.target.value)} disabled={!sessionOpen} className={inputCls} spellCheck={false} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-bsl-muted">Payload (UTF-8)</span>
            <textarea
              value={pubPayload}
              onChange={(e) => setPubPayload(e.target.value)}
              disabled={!sessionOpen}
              rows={3}
              className={`${inputCls} resize-y font-sans`}
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="w-20">
              <span className="mb-1 block text-xs font-medium text-bsl-muted">QoS</span>
              <select value={pubQos} onChange={(e) => setPubQos(e.target.value)} disabled={!sessionOpen} className={inputCls}>
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-bsl-muted">
              <input
                type="checkbox"
                checked={pubRetain}
                disabled={!sessionOpen}
                onChange={(e) => setPubRetain(e.target.checked)}
                className="rounded border-bsl-border"
              />
              Retain
            </label>
            <button
              type="button"
              disabled={!sessionOpen}
              onClick={onPublish}
              className="rounded-xl border border-amber-500/45 bg-amber-500/12 px-5 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/22 disabled:opacity-45"
            >
              Publish
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-bsl-text">Traffic log</h2>
          <button
            type="button"
            disabled={!log.length}
            onClick={onClearLog}
            className="rounded-lg border border-bsl-border bg-bsl-panel/50 px-3 py-1.5 text-xs font-semibold text-bsl-muted hover:text-bsl-text disabled:opacity-40"
          >
            Clear
          </button>
        </div>
        <pre
          ref={logRef}
          className="max-h-[min(28rem,50dvh)] min-h-[12rem] overflow-auto rounded-xl border border-bsl-border bg-[#0c0d10] px-3 py-2 font-mono text-[11px] leading-relaxed text-emerald-200/95 [scrollbar-gutter:stable]"
        >
          {log || <span className="text-bsl-muted/60">Connect to see status and messages.</span>}
        </pre>
      </section>
    </div>
  );
}
