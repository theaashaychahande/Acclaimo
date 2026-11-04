import { normalizeIdentifier, normalizeName } from "./normalize";

const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(value));

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash input is the organization salt followed by the normalized name, as
 * specified. The salt is public (students need it to hash locally).
 */
export function hashName(salt: string, name: string): Promise<string> {
  return sha256Hex(salt + normalizeName(name));
}

/**
 * Only used when two people in the same event share a name. The identifier
 * hash lets the lookup tell them apart.
 */
export function hashNameWithIdentifier(
  salt: string,
  name: string,
  identifier: string,
): Promise<string> {
  return sha256Hex(salt + normalizeName(name) + normalizeIdentifier(identifier));
}

/**
 * Edit keys are shown grouped with hyphens, but people paste them with stray
 * spaces or lowercase letters. Normalize the same way before hashing.
 */
export function normalizeEditKey(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function hashEditKey(editKey: string): Promise<string> {
  return sha256Hex(normalizeEditKey(editKey));
}
