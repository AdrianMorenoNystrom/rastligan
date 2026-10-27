import { createClient } from "@supabase/supabase-js";
import type { BreakSession } from "./domain";
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
    configuration: "Ligan är inte ansluten.",
    invalid_login: "Fel spelare eller kod.",
    rate_limited: "För många inloggningsförsök. Försök igen om 15 minuter.",
    unauthorized: "Sessionen har avslutats. Logga in igen.",
    match_changed: "Rasten har ändrats. Hämta aktuell version.",
    not_found: "Rasten finns inte längre. Uppdatera rasthistoriken.",
    invalid_match: "Rasten kunde inte sparas. Kontrollera resultat och datum.",
    server_configuration: "Ligan är inte konfigurerad.",
    origin_denied: "Åtkomst är inte tillåten från den här adressen.",
  };
  return errors[code] || "Kunde inte nå ligan. Kontrollera anslutningen.";
}
export async function loadBreaks(): Promise<BreakSession[]> {
  if (!supabase) throw new ApiError("configuration");
  const { data, error } = await supabase.rpc("break_snapshot");
  if (error) throw new ApiError("network");
  if (!data || !Array.isArray(data.breaks) || data.breaks.length !== data.count)
    throw new ApiError("incomplete_data");
  return data.breaks;
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
