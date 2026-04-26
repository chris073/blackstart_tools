import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "PING Check · Tools",
  description: "Subnet or tag/IP list: ICMP plus TCP fallback.",
};

export default function PingToolLayout({ children }: { children: ReactNode }) {
  return children;
}
