export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

let cached: SupabaseConfig | null = null;

/**
 * Reads the public Supabase settings from the Vite build environment.
 *
 * These two values are safe to ship to the browser: the project URL is a
 * public endpoint and the publishable key is designed to be embedded in a
 * client bundle. The secret key is never read here and must never be given a
 * VITE_ prefix, because anything VITE_ is inlined into the bundle.
 */
export function getSupabaseConfig(): SupabaseConfig {
  if (cached) return cached;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
    );
  }

  cached = {
    url: url.replace(/\/+$/, ""),
    anonKey,
  };

  return cached;
}

export function hasSupabaseConfig(): boolean {
  try {
    getSupabaseConfig();
    return true;
  } catch {
    return false;
  }
}
