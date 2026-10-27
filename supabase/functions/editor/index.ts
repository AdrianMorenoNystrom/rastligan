import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const pepper = Deno.env.get("RATE_LIMIT_PEPPER");
const origins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const hash = async (text: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
const randomToken = () =>
  [...crypto.getRandomValues(new Uint8Array(32))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  // Explicit fallback prevents the local API gateway from adding wildcard CORS.
  headers["Access-Control-Allow-Origin"] =
    origin && origins.includes(origin) ? origin : origins[0] || "null";
  headers["Access-Control-Allow-Headers"] =
    "content-type,apikey,authorization,x-editor-token";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.includes(origin))
    return reply({ error: "origin_denied" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!pepper || pepper.length < 32 || !origins.length)
    return reply({ error: "server_configuration" }, 503);
  try {
    const body = await req.json();
    if (body.action === "login") {
      if (
        !["adrian", "dave", "elias"].includes(body.player_id) ||
        typeof body.code !== "string" ||
        !body.code.length
      )
        return reply({ error: "invalid_login" }, 401);
      const token = randomToken();
      // The platform appends the network peer. Use the last hop, never the first caller-supplied address.
      const ip =
        req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
        "unknown";
      const { data, error } = await db.rpc("editor_login", {
        p_player: body.player_id,
        p_code: body.code,
        p_ip_hash: await hash(pepper + ":" + ip),
        p_token_hash: await hash(token),
      });
      if (error) return reply({ error: "server_error" }, 500);
      if (data.error) {
        if (data.error === "rate_limited") headers["Retry-After"] = "900";
        return reply(data, data.error === "rate_limited" ? 429 : 401);
      }
      return reply({ ...data, token });
    }
    const token = req.headers.get("x-editor-token") || "";
    if (!/^[a-f0-9]{64}$/.test(token))
      return reply({ error: "unauthorized" }, 401);
    const tokenHash = await hash(token);
    if (body.action === "session" || body.action === "logout") {
      const { data, error } = await db.rpc("editor_session", {
        p_token_hash: tokenHash,
        p_logout: body.action === "logout",
      });
      if (error)
        return reply(
          { error: error.code === "28000" ? "unauthorized" : "server_error" },
          error.code === "28000" ? 401 : 500,
        );
      return reply(data);
    }
    if (!["create", "update", "delete"].includes(body.action))
      return reply({ error: "invalid_action" }, 400);
    const m = body.match;
    if (!m || typeof m !== "object")
      return reply({ error: "invalid_match" }, 400);
    if (body.action !== "delete") {
      if (
        !["adrian", "dave", "elias"].includes(m.player1_id) ||
        !["adrian", "dave", "elias"].includes(m.player2_id) ||
        m.player1_id === m.player2_id ||
        ![m.score1, m.score2].every((n) => Number.isSafeInteger(n) && n >= 0) ||
        m.score1 + m.score2 === 0 ||
        typeof m.played_on !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(m.played_on) ||
        isNaN(Date.parse(m.played_on)) ||
        new Date(m.played_on + "T12:00:00Z").toISOString().slice(0, 10) !==
          m.played_on
      )
        return reply({ error: "invalid_match" }, 400);
    }
    const { data, error } = await db.rpc("editor_mutate", {
      p_token_hash: tokenHash,
      p_action: body.action,
      p_match: m,
      p_key: body.idempotency_key || null,
    });
    if (error) {
      if (error.code === "28000") return reply({ error: "unauthorized" }, 401);
      if (error.code === "40001") return reply({ error: "match_changed" }, 409);
      if (error.code === "P0002") return reply({ error: "not_found" }, 404);
      return reply({ error: "invalid_match" }, 400);
    }
    return reply(data);
  } catch {
    return reply({ error: "invalid_request" }, 400);
  }
});
