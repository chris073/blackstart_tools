/** Host header is local (dev machine only). Used for private routes and nav. */

export function isLocalHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false;
  let host = hostHeader.toLowerCase();
  const portIdx = host.lastIndexOf(":");
  if (host.startsWith("[") && host.includes("]")) {
    const end = host.indexOf("]");
    host = host.slice(1, end);
  } else if (portIdx > 0 && !host.startsWith("[")) {
    const maybePort = host.slice(portIdx + 1);
    if (/^\d+$/.test(maybePort)) {
      host = host.slice(0, portIdx);
    }
  }
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}
