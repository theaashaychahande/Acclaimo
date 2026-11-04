const EDIT_KEY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LINK_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const HEX_ALPHABET = "0123456789abcdef";

function randomString(length: number, alphabet: string): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);

  let result = "";
  for (const byte of bytes) {
    result += alphabet[byte % alphabet.length];
  }
  return result;
}

/** 120 random bits, grouped for readability: XXXX-XXXX-... */
export function generateEditKey(): string {
  const raw = randomString(32, EDIT_KEY_ALPHABET);
  return raw.match(/.{4}/g)!.join("-");
}

/** 128 random bits, hex encoded. */
export function generateSalt(): string {
  return randomString(32, HEX_ALPHABET);
}

/** 10 characters from an unambiguous lowercase alphabet. */
export function generateLinkId(): string {
  return randomString(10, LINK_ALPHABET);
}
