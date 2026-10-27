import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chooseEditorCode } from "./admin-code.mjs";
const [action, player, ...extra] = process.argv.slice(2);
if (
  !["bootstrap", "code", "set-code", "revoke", "disable", "enable"].includes(
    action,
  ) ||
  (action !== "bootstrap" && !["adrian", "dave", "elias"].includes(player)) ||
  (action === "bootstrap" && player !== undefined) ||
  extra.length
)
  throw new Error(
    "Använd: npm run admin -- bootstrap | code|set-code|revoke|disable|enable adrian|dave|elias. Egen kod anges bara i terminalens dolda fråga.",
  );
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Sätt SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY i .env.local.",
  );
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
if (action === "bootstrap") {
  // Refuse a repeated bootstrap; it must never silently replace existing codes.
  const { data, error } = await db.rpc("admin_bootstrap");
  if (error) throw new Error(error.message);
  for (const item of data) console.log(`${item.player_id}: ${item.code}`);
} else {
  if (action === "set-code") {
    console.log(`Databas: ${new URL(process.env.SUPABASE_URL).host}`);
    console.log(
      `Spelare: ${player}. Befintliga sessioner återkallas vid kodbyte.`,
    );
  }
  const code =
    action === "set-code"
      ? await chooseEditorCode()
      : action === "code"
        ? randomBytes(24).toString("base64url")
        : null;
  const { error } = await db.rpc("admin_editor", {
    p_player: player,
    p_action: action === "set-code" ? "code" : action,
    p_code: code,
  });
  if (error) throw new Error(error.message);
  if (action === "set-code")
    console.log(
      `Koden för ${player} har ändrats. Befintliga sessioner är återkallade.`,
    );
  else if (code) console.log(`${player}: ${code}`);
  else console.log(`${action}: ${player} OK`);
}
