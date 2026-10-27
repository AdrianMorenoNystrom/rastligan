import { spawnSync } from "node:child_process";
if (!process.env.SUPABASE_PROJECT_REF)
  throw new Error("Sätt SUPABASE_PROJECT_REF.");
const ref = process.env.SUPABASE_PROJECT_REF;
if (!/^[a-z0-9]{20}$/.test(ref))
  throw new Error("Ogiltig projektidentifierare.");
for (const args of [
  ["link", "--project-ref", ref],
  ["db", "push"],
  ["functions", "deploy", "editor", "--project-ref", ref],
]) {
  const result = spawnSync(
    process.platform === "win32" ? "supabase.cmd" : "supabase",
    args,
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
