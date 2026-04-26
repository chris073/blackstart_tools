import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terminal · Tools",
  description: "Browser SSH with optional jump host, PEM keys, and saved profiles (localStorage).",
};

export default function TerminalToolLayout({ children }: { children: ReactNode }) {
  return children;
}
