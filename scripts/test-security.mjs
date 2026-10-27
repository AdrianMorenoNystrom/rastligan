import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { localClients, edge } from "./test-helpers.mjs";
const { admin, anon } = localClients();
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const code = process.env.E2E_ADRIAN_CODE;
if (!code)
  throw new Error("Kör prepare-e2e och läs .env.test.local före detta test.");
test("Supabase HTTP och Edge Functions: verklig behörighetskontroll", async (t) => {
  let token, created;
  const input = {
    player1_id: "adrian",
    player2_id: "elias",
    score1: 2,
    score2: 2,
    played_on: "2000-01-01",
  };
  try {
    await db.query("delete from private.login_limits");
    await t.test("anonym läsning fungerar", async () => {
      const { data, error } = await anon.rpc("league_snapshot");
      assert.ifError(error);
      assert.equal(data.count, data.matches.length);
    });
    for (const method of ["insert", "update", "delete"])
      await t.test("anonym " + method + " via REST nekas", async () => {
        let query = anon.from("matches");
        if (method === "insert") query = query.insert(input);
        else if (method === "update")
          query = query.update({ score1: 9 }).eq("id", randomUUID());
        else query = query.delete().eq("id", randomUUID());
        const { error } = await query;
        assert.ok(error);
        assert.equal(error.code, "42501");
      });
    await t.test("anonym kan inte anropa privilegierad RPC", async () => {
      const { error } = await anon.rpc("admin_editor", {
        p_player: "adrian",
        p_action: "disable",
      });
      assert.ok(error);
    });
    await t.test("fel kod ger generiskt fel och ingen session", async () => {
      const r = await edge({
        action: "login",
        player_id: "adrian",
        code: "invalid",
      });
      assert.equal(r.status, 401);
      assert.deepEqual(await r.json(), { error: "invalid_login" });
    });
    await t.test("rätt kod skapar serververifierad session", async () => {
      const r = await edge({ action: "login", player_id: "adrian", code });
      assert.equal(r.status, 200);
      const data = await r.json();
      token = data.token;
      assert.match(token, /^[a-f0-9]{64}$/);
      assert.equal(data.player_id, "adrian");
    });
    await t.test("begäran större än 8 KiB når sessionskontrollen", async () => {
      const r = await edge({ action: "session", padding: "x".repeat(20000) });
      assert.equal(r.status, 401);
      assert.deepEqual(await r.json(), { error: "unauthorized" });
    });
    await t.test("förfalskad token ger 401", async () =>
      assert.equal(
        (
          await edge(
            { action: "create", match: input, idempotency_key: randomUUID() },
            "e".repeat(64),
          )
        ).status,
        401,
      ),
    );
    await t.test("backend nekar 0–0 trots kringgång av frontend", async () =>
      assert.equal(
        (
          await edge(
            {
              action: "create",
              match: { ...input, score1: 0, score2: 0 },
              idempotency_key: randomUUID(),
            },
            token,
          )
        ).status,
        400,
      ),
    );
    await t.test(
      "parallella sparförsök med samma ID ger en enda match",
      async () => {
        const key = randomUUID();
        const responses = await Promise.all([
          edge({ action: "create", match: input, idempotency_key: key }, token),
          edge({ action: "create", match: input, idempotency_key: key }, token),
        ]);
        assert.ok(responses.every((r) => r.status === 200));
        const rows = await Promise.all(responses.map((r) => r.json()));
        assert.equal(rows[0].id, rows[1].id);
        created = rows[0];
      },
    );
    await t.test(
      "utloggning återkallar token även vid direkt skrivförsök",
      async () => {
        assert.equal((await edge({ action: "logout" }, token)).status, 200);
        assert.equal(
          (
            await edge(
              { action: "create", match: input, idempotency_key: randomUUID() },
              token,
            )
          ).status,
          401,
        );
      },
    );
    await t.test(
      "serverbaserad rate limiting svarar 429 efter fem försök",
      async () => {
        await db.query("delete from private.login_limits");
        for (let i = 0; i < 5; i++)
          assert.equal(
            (
              await edge({
                action: "login",
                player_id: "adrian",
                code: "wrong",
              })
            ).status,
            401,
          );
        const r = await edge({ action: "login", player_id: "adrian", code });
        assert.equal(r.status, 429);
        assert.equal(r.headers.get("retry-after"), "900");
      },
    );
    await t.test(
      "otillåtet ursprung nekas av servern även genom gatewayens CORS",
      async () => {
        const r = await fetch(
          process.env.SUPABASE_URL + "/functions/v1/editor",
          {
            method: "POST",
            headers: {
              Origin: "https://untrusted.example",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "session" }),
          },
        );
        assert.equal(r.status, 403);
        assert.deepEqual(await r.json(), { error: "origin_denied" });
      },
    );
  } finally {
    if (created) await admin.from("matches").delete().eq("id", created.id);
    await db.query("delete from private.login_limits");
    await db.end();
  }
});
