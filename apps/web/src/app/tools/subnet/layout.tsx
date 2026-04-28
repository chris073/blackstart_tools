import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Subnet Calculator · Tools",
  description: "IPv4 subnet calculator (CIDR, mask, wildcard, host range).",
};

export default function SubnetToolLayout({ children }: { children: ReactNode }) {
  return children;
}

