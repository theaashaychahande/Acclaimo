import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./env";

let client: SupabaseClient | null = null;

/**
 * Acclaimo does not use Supabase Auth. Organizers are identified by an edit
 * key hash, students never sign in, and every data path is an RPC. Session
 * persistence is therefore switched off so the library does not create or
 * store an auth session that we never use.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const { url, anonKey } = getSupabaseConfig();

  client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
