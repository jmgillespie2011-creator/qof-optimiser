import { createClient } from "@supabase/supabase-js";

// Server-only client using the service-role key. Bypasses RLS — never import
// this into client components or expose the key to the browser. Used by the AI
// layer to read/write ai_artifact and ai_job.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
