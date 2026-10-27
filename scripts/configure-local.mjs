import { execFileSync } from "node:child_process";
import { writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
try {
  await access(".env.local");
  throw new Error(
    ".env.local finns redan. Behåll den eller flytta den manuellt innan lokal konfiguration.",
  );
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const status = JSON.parse(
  execFileSync(
    process.platform === "win32" ? "supabase.cmd" : "supabase",
    ["status", "-o", "json"],
    {
      encoding: "utf8",
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ),
);
const url = status.API_URL;
let anon = status.ANON_KEY,
  service = status.SERVICE_ROLE_KEY;
// CLI omits keys from status when GoTrue is excluded; the Edge runtime still
// carries the actual project-local keys. Inspect only this project's container.
if (!anon || !service) {
  const containers = JSON.parse(
    execFileSync("docker", ["inspect", "supabase_edge_runtime_rastligan"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  const env = Object.fromEntries(
    containers[0].Config.Env.map((s) => {
      const i = s.indexOf("=");
      return [s.slice(0, i), s.slice(i + 1)];
    }),
  );
  anon = env.SUPABASE_ANON_KEY;
  service = env.SUPABASE_SERVICE_ROLE_KEY;
}
if (!url?.includes("127.0.0.1:55431") || !anon || !service)
  throw new Error("Starta projektets lokala Supabase på port 55431 först.");
await writeFile(
  ".env.local",
  `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${anon}\nSUPABASE_URL=${url}\nSUPABASE_SERVICE_ROLE_KEY=${service}\nDATABASE_URL=${status.DB_URL}\n`,
);
await writeFile(
  "supabase/.env.local",
  `ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173\nRATE_LIMIT_PEPPER=${randomBytes(32).toString("hex")}\n`,
);
console.log(
  "Lokal frontend- och serverkonfiguration sparad i ignorerade miljöfiler. Inga produktionsresurser har ändrats.",
);
