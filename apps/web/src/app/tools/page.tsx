import { privateToolsVisible } from "@/lib/config";

import { ToolsIndexClient } from "./ToolsIndexClient";

export const metadata = {
  title: "Tools",
  description: "Engineering utilities: core tools plus optional private companion app.",
};

function privateToolsBase(): string {
  return (process.env.NEXT_PUBLIC_PRIVATE_TOOLS_WEB_ORIGIN ?? "http://127.0.0.1:3002").replace(/\/$/, "");
}

export default function ToolsPage() {
  const showPrivate = privateToolsVisible();
  const privateBase = privateToolsBase();
  const privateToolsIndexHref = `${privateBase}/tools`;

  return (
    <ToolsIndexClient showPrivate={showPrivate} privateToolsIndexHref={privateToolsIndexHref} />
  );
}
