import { ToolApiBar } from "@/components/ToolApiBar";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <ToolApiBar />
      {children}
    </div>
  );
}
