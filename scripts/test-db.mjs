import pg from "pg";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { assertLocal } from "./test-helpers.mjs";
assertLocal();
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw new Error("Fel lokal databasport.");
const db = new pg.Client({ connectionString: url.href });
await db.connect();
test("PostgreSQL: dataintegritet, RLS, sessioner och transaktioner", async (t) => {
  await db.query("begin");
  const query = (sql, args = []) => db.query(sql, args);
  const rpc = async (name, args) => {
    const r = await query(
      `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as result`,
      args.map((a) => (Array.isArray(a) ? JSON.stringify(a) : a)),
    );
    return r.rows[0].result;
  };
  const denied = async (sql, args = []) => {
    await query("savepoint denial");
    let failure;
    try {
      await query(sql, args);
    } catch (e) {
      failure = e;
    }
    await query("rollback to savepoint denial");
    assert.ok(failure, "Operationen skulle nekas");
    return failure;
  };
  const code = randomBytes(24).toString("hex"),
    hash = createHash("sha256").update(randomBytes(32)).digest("hex"),
    ip = "a".repeat(64);
  const input = {
    player1_id: "adrian",
    player2_id: "dave",
    score1: 3,
    score2: 1,
    played_on: "2026-10-22",
  };
  let created;
  try {
    await query("delete from private.login_limits");
    await rpc("admin_editor", ["adrian", "code", code]);
    await t.test(
      "kod är individuellt saltad och aldrig lagrad rå",
      async () => {
        const r = await query(
          "select code_hash from private.editor_credentials where player_id='adrian'",
        );
        assert.notEqual(r.rows[0].code_hash, code);
        assert.match(r.rows[0].code_hash, /^\$2[aby]\$12\$/);
      },
    );
    await t.test("publik läsning fungerar", async () => {
      await query("set local role anon");
      assert.equal(
        (await query("select count(*)::int as n from public.players")).rows[0]
          .n,
        3,
      );
      await query("reset role");
    });
    for (const [name, sql] of [
      [
        "INSERT",
        "insert into public.matches(player1_id,player2_id,score1,score2,played_on) values('adrian','dave',1,0,'2026-10-22')",
      ],
      ["UPDATE", "update public.matches set score1=9"],
      ["DELETE", "delete from public.matches"],
    ])
      await t.test("anonym " + name + " nekas", async () => {
        await query("set local role anon");
        const e = await denied(sql);
        assert.equal(e.code, "42501");
        await query("reset role");
      });
    await t.test(
      "privata tabeller och privilegierade funktioner är otillgängliga",
      async () => {
        await query("set local role anon");
        await denied("select * from private.editor_credentials");
        await denied("select public.admin_editor('adrian','disable')");
        await denied("select public.editor_mutate($1,'create',$2,$3)", [
          hash,
          input,
          randomUUID(),
        ]);
        await query("reset role");
      },
    );
    await t.test("fel kod nekas och rätt kod fungerar", async () => {
      assert.equal(
        (await rpc("editor_login", ["adrian", "wrong", ip, "b".repeat(64)]))
          .error,
        "invalid_login",
      );
      assert.equal(
        (await rpc("editor_login", ["adrian", code, ip, hash])).player_id,
        "adrian",
      );
    });
    await t.test("ogiltig token nekas på servern", async () => {
      assert.equal(
        (await denied("select public.editor_session($1)", ["c".repeat(64)]))
          .code,
        "28000",
      );
    });
    const idem = randomUUID();
    await t.test("skapande och audit är atomiskt", async () => {
      created = await rpc("editor_mutate", [hash, "create", input, idem]);
      const audit = await query(
        "select editor_id,action from private.match_audit_log where match_id=$1",
        [created.id],
      );
      assert.deepEqual(audit.rows, [{ editor_id: "adrian", action: "create" }]);
    });
    await t.test(
      "idempotens tillåter inte dubbelsparning eller ändrad payload",
      async () => {
        assert.equal(
          (await rpc("editor_mutate", [hash, "create", input, idem])).id,
          created.id,
        );
        await denied("select public.editor_mutate($1,$2,$3,$4)", [
          hash,
          "create",
          { ...input, score1: 4 },
          idem,
        ]);
      },
    );
    for (const [score1, score2] of [
      [0, 0],
      [-1, 1],
      [1.5, 2],
    ])
      await t.test(`backend nekar ${score1}–${score2}`, async () => {
        const key = randomUUID();
        await denied("select public.editor_mutate($1,$2,$3,$4)", [
          hash,
          "create",
          { ...input, score1, score2 },
          key,
        ]);
        const r = await query(
          "select count(*)::int n from private.write_receipts where key=$1",
          [key],
        );
        assert.equal(r.rows[0].n, 0);
      });
    await t.test("en annan spelare kan redigera matchen", async () => {
      await rpc("admin_editor", ["dave", "code", code]);
      const token = "d".repeat(64);
      assert.equal(
        (await rpc("editor_login", ["dave", code, ip, token])).player_id,
        "dave",
      );
      created = await rpc("editor_mutate", [
        token,
        "update",
        { ...created, score1: 2, score2: 2 },
        null,
      ]);
      assert.equal(created.score1, 2);
      assert.equal(created.score2, 2);
    });
    await t.test("konkurrerande ändring upptäcks", async () => {
      const e = await denied("select public.editor_mutate($1,$2,$3,$4)", [
        hash,
        "update",
        { ...created, updated_at: "2000-01-01T00:00:00Z" },
        null,
      ]);
      assert.equal(e.code, "40001");
    });
    await t.test("utloggning återkallar sessionsbehörigheten", async () => {
      await rpc("editor_session", [hash, true]);
      assert.equal(
        (await denied("select public.editor_session($1)", [hash])).code,
        "28000",
      );
    });
    await t.test("kodbyte återkallar tidigare sessioner", async () => {
      await rpc("admin_editor", [
        "dave",
        "code",
        randomBytes(24).toString("hex"),
      ]);
      await denied("select public.editor_session($1)", ["d".repeat(64)]);
    });
    await t.test(
      "återkallad och inaktiverad session nekas; återaktivering återupplivar inte sessioner",
      async () => {
        await query("delete from private.login_limits");
        let h = "e".repeat(64);
        await rpc("editor_login", ["adrian", code, ip, h]);
        await rpc("admin_editor", ["adrian", "revoke", null]);
        await denied("select public.editor_session($1)", [h]);
        h = "f".repeat(64);
        await rpc("editor_login", ["adrian", code, ip, h]);
        await rpc("admin_editor", ["adrian", "disable", null]);
        await denied("select public.editor_session($1)", [h]);
        await rpc("admin_editor", ["adrian", "enable", null]);
        await denied("select public.editor_session($1)", [h]);
      },
    );
    await t.test(
      "session förnyas aldrig förbi absolut maxlivslängd",
      async () => {
        await query("delete from private.login_limits");
        const h = "1".repeat(64);
        await rpc("editor_login", ["adrian", code, ip, h]);
        await query(
          "update private.editor_sessions set expires_at=now()+interval '1 day',absolute_expires_at=now()+interval '2 days' where token_hash=$1",
          [h],
        );
        const result = await rpc("editor_session", [h, false]);
        assert.equal(result.expires_at, result.absolute_expires_at);
        await query(
          "update private.editor_sessions set expires_at=now()-interval '1 second' where token_hash=$1",
          [h],
        );
        await denied("select public.editor_session($1)", [h]);
      },
    );
    await t.test("nullkod kan inte kringgå verifiering", async () => {
      assert.equal(
        (await rpc("editor_login", ["adrian", null, ip, "2".repeat(64)])).error,
        "invalid_login",
      );
    });
    await t.test(
      "rate limiting: högst fem försök per identitet och 15 minuter",
      async () => {
        await query("delete from private.login_limits");
        for (let i = 0; i < 5; i++)
          assert.equal(
            (
              await rpc("editor_login", [
                "adrian",
                "wrong",
                ip,
                randomBytes(32).toString("hex"),
              ])
            ).error,
            "invalid_login",
          );
        assert.equal(
          (
            await rpc("editor_login", [
              "adrian",
              code,
              ip,
              randomBytes(32).toString("hex"),
            ])
          ).error,
          "rate_limited",
        );
      },
    );
    await t.test(
      "import bevarar likadana matcher och är idempotent",
      async () => {
        const rows = [
          { source_row: "row:2", match: { ...input, score1: 2, score2: 2 } },
          { source_row: "row:3", match: { ...input, score1: 2, score2: 2 } },
        ];
        const a = await rpc("import_matches", ["isolated-db-test", rows]);
        assert.deepEqual(
          a.map((r) => r.status),
          ["imported", "imported"],
        );
        assert.notEqual(a[0].match_id, a[1].match_id);
        const b = await rpc("import_matches", ["isolated-db-test", rows]);
        assert.deepEqual(
          b.map((r) => r.status),
          ["already_imported", "already_imported"],
        );
      },
    );
    await t.test(
      "snapshot omfattar mer än API-gränsens 1 000 matcher",
      async () => {
        await query(
          "insert into public.matches(player1_id,player2_id,score1,score2,played_on) select 'adrian','dave',1,0,date '2026-10-22' from generate_series(1,1005)",
        );
        await query("set local role anon");
        const result = await rpc("league_snapshot", []);
        assert.equal(result.matches.length, result.count);
        assert.ok(result.count > 1000);
        await query("reset role");
      },
    );
  } finally {
    await query("rollback");
    await db.end();
  }
});
