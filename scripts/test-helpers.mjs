import { createClient } from "@supabase/supabase-js";
export function assertLocal() {
  const url = process.env.SUPABASE_URL;
  if (
    !url ||
    new URL(url).hostname !== "127.0.0.1" ||
    new URL(url).port !== "55431"
  )
    throw new Error(
      "Testerna kräver isolerad lokal Supabase på http://127.0.0.1:55431. Produktionsadresser nekas.",
    );
}
export function localClients() {
  assertLocal();
  return {
    admin: createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    ),
    anon: createClient(
      process.env.SUPABASE_URL,
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } },
    ),
  };
}
export async function edge(body, token) {
  return fetch(process.env.SUPABASE_URL + "/functions/v1/editor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...(token ? { "X-Editor-Token": token } : {}),
    },
    body: JSON.stringify(body),
  });
}
