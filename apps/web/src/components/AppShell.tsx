import { AppFooter } from "@/components/AppFooter";
import { AppHeader } from "@/components/AppHeader";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <AppHeader />

        <main className="mt-6">{children}</main>

        <AppFooter />
      </div>
    </div>
  );
}
