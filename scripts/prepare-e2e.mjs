import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import pg from "pg";
import { localClients } from "./test-helpers.mjs";
const { admin } = localClients();
const lines = [];
for (const id of ["adrian", "dave", "elias"]) {
  const code = randomBytes(24).toString("hex");
  const { error } = await admin.rpc("admin_editor", {
    p_player: id,
    p_action: "code",
    p_code: code,
  });
  if (error) throw new Error(error.message);
  lines.push(`E2E_${id.toUpperCase()}_CODE=${code}`);
}
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("delete from private.login_limits");
await db.end();
await writeFile(".env.test.local", lines.join("\n") + "\n");
console.log(
  "Slumpmässiga testkoder skapade i .env.test.local för den isolerade lokala ligan.",
);
