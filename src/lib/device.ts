const STORAGE_KEY = "acclaimo.device";

let cached: string | null = null;

/**
 * A random, non-personal value used only so the backend can apply per-device
 * rate limits. It is not a login, it is not tied to a person, and losing it is
 * harmless: the function falls back to hashing the request IP instead.
 */
export function getDeviceId(): string {
  if (cached) return cached;

  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored && /^[0-9a-f]{32}$/.test(stored)) {
      cached = stored;
      return cached;
    }
  } catch {
    // Storage can be blocked in private modes. Fall through to a fresh id.
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, id);
  } catch {
    // Keep the value in memory only.
  }

  cached = id;
  return id;
}
