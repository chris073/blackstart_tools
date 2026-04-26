import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { isLocalHost } from "@/lib/local-dev";

export const metadata: Metadata = {
  title: "Blackstart Labs",
  description: "Internal tools",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const showPrivateLocal = isLocalHost(host);

  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: extensions may inject attributes before hydrate (see ClientOnly for form controls). */}
      <body suppressHydrationWarning>
        <AppShell showPrivateLocal={showPrivateLocal}>{children}</AppShell>
      </body>
    </html>
  );
}

