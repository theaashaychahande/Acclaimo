const STORAGE_KEY = "acclaimo.organizer";
const LIFETIME_MS = 8 * 60 * 60 * 1000;

export type OrganizerSession = {
  /** Only the SHA-256 hash of the edit key is kept, never the key itself. */
  editKeyHash: string;
  linkId: string;
  organizationName: string;
  departmentOrClub: string;
  expiresAt: number;
};

function isSession(value: unknown): value is OrganizerSession {
  if (!value || typeof value !== "object") return false;

  const session = value as Record<string, unknown>;

  return (
    typeof session.editKeyHash === "string" &&
    /^[0-9a-f]{64}$/.test(session.editKeyHash) &&
    typeof session.linkId === "string" &&
    typeof session.organizationName === "string" &&
    typeof session.departmentOrClub === "string" &&
    typeof session.expiresAt === "number"
  );
}

export function loadSession(): OrganizerSession | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed) || parsed.expiresAt <= Date.now()) {
      clearSession();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(
  session: Omit<OrganizerSession, "expiresAt">,
): OrganizerSession {
  const stored: OrganizerSession = {
    ...session,
    expiresAt: Date.now() + LIFETIME_MS,
  };

  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // A blocked storage API should not lock the organizer out for this tab.
  }

  return stored;
}

export function clearSession(): void {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up.
  }
}
