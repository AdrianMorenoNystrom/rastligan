import { readdir, readFile } from "node:fs/promises";
const secrets = Object.entries(process.env).filter(
  ([name, value]) =>
    /SERVICE_ROLE_KEY|E2E_.*_CODE|RATE_LIMIT_PEPPER|SUPABASE_ACCESS_TOKEN/.test(
      name,
    ) && value?.length >= 16,
);
async function inspect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (entry.isDirectory()) await inspect(path);
    else if (/\.(js|css|html)$/.test(path)) {
      const text = await readFile(path, "utf8");
      for (const [name, value] of secrets)
        if (text.includes(value))
          throw new Error(`Hemlighet ${name} finns i frontendbygget.`);
      if (/sb_secret_[a-zA-Z0-9_-]{20,}/.test(text))
        throw new Error("Secret key i frontendbygget.");
    }
  }
}
await inspect("dist");
console.log(
  "Frontendbygget innehåller inga av miljöns servernycklar, testkoder eller sessionshemligheter.",
);
