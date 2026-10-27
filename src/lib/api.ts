import { createClient } from "@supabase/supabase-js";
import type { Match } from "./domain";
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as
  string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  string | undefined;
export const configured = Boolean(SUPABASE_URL && publishableKey);
const supabase = configured
  ? createClient(SUPABASE_URL!, publishableKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 0,
  ) {
    super(errorMessage(code));
  }
}
function errorMessage(code: string) {
  const errors: Record<string, string> = {
    configuration:
      "Datakällan är inte ansluten. Konfigurera Supabase enligt README.",
    invalid_login: "Koden kunde inte verifieras. Kontrollera spelare och kod.",
    rate_limited: "För många inloggningsförsök. Försök igen om 15 minuter.",
    unauthorized: "Din redigerarsession har avslutats. Logga in igen.",
    match_changed:
      "Matchen har ändrats på en annan enhet. Hämta aktuell version innan du försöker igen.",
    not_found: "Matchen finns inte längre. Uppdatera matchhistoriken.",
    invalid_match: "Matchen kunde inte sparas. Kontrollera resultat och datum.",
    server_configuration:
      "Servern är inte färdigkonfigurerad. Kontrollera funktionens miljövariabler.",
    origin_denied: "Den här webbplatsens adress är inte tillåten av servern.",
  };
  return (
    errors[code] ||
    "Kunde inte nå ligan. Kontrollera anslutningen och försök igen."
  );
}
export async function loadMatches(): Promise<Match[]> {
  if (!supabase) throw new ApiError("configuration");
  const { data, error } = await supabase.rpc("league_snapshot");
  if (error) throw new ApiError("network");
  if (
    !data ||
    !Array.isArray(data.matches) ||
    data.matches.length !== data.count
  )
    throw new ApiError("incomplete_data");
  return data.matches;
}
export async function editorRequest<T>(
  body: Record<string, unknown>,
  token?: string | null,
): Promise<T> {
  if (!configured) throw new ApiError("configuration");
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/editor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey!,
        ...(token ? { "X-Editor-Token": token } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError("network");
  }
  const data = await response.json().catch(() => ({ error: "network" }));
  if (!response.ok)
    throw new ApiError(data.error || "network", response.status);
  return data as T;
}
