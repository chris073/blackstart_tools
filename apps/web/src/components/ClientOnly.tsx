"use client";

import { useEffect, useState } from "react";

/**
 * Renders children only after mount so SSR HTML is not hydrated against
 * DOM mutated by browser extensions (form fillers that add fdprocessedid, etc.).
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <>{fallback}</>;
  return <>{children}</>;
}
