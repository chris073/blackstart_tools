const STORAGE_KEY = "tools_terminal_ssh_profiles_v1";
const LEGACY_STORAGE_KEY = "blackstart_tools_terminal_profiles_v1";

export type TerminalProfile = {
  id: string;
  name: string;
  updatedAt: string;
  jumpEnabled: boolean;
  trustJumpHost: boolean;
  trustHost: boolean;
  jumpHost: string;
  jumpPort: string;
  jumpUser: string;
  jumpPassword: string;
  jumpKeyPem: string;
  jumpKeyPassphrase: string;
  targetHost: string;
  targetPort: string;
  targetUser: string;
  targetPassword: string;
  targetKeyPem: string;
  targetKeyPassphrase: string;
};

function parseProfileList(raw: string | null): TerminalProfile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is TerminalProfile => typeof p === "object" && p !== null && typeof (p as TerminalProfile).id === "string",
    );
  } catch {
    return [];
  }
}

export function listTerminalProfiles(): TerminalProfile[] {
  if (typeof window === "undefined") return [];
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      localStorage.setItem(STORAGE_KEY, raw);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }
  return parseProfileList(raw);
}

export function saveTerminalProfile(profile: TerminalProfile): void {
  if (typeof window === "undefined") return;
  const all = listTerminalProfiles().filter((p) => p.id !== profile.id);
  all.push({ ...profile, updatedAt: new Date().toISOString() });
  all.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteTerminalProfile(id: string): void {
  if (typeof window === "undefined") return;
  const all = listTerminalProfiles().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function newProfileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
