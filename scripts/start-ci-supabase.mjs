import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const exclusions =
  "studio,imgproxy,realtime,storage-api,gotrue,mailpit,postgres-meta,logflare,vector,supavisor";
const registries = ["public.ecr.aws", "ghcr.io", "docker.io"];
const transientPullFailure =
  /toomanyrequests|rate.?limit|rate exceeded|429|failed to (?:pull|display json stream)|TLS handshake timeout|connection reset|i\/o timeout|network is unreachable/i;

function runStart(registry) {
  return new Promise((resolve, reject) => {
    const child = spawn("supabase", ["start", "-x", exclusions], {
      env: { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: registry },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    const forward = (stream, chunk) => {
      stream.write(chunk);
      log = (log + chunk.toString()).slice(-65536);
    };
    child.stdout.on("data", (chunk) => forward(process.stdout, chunk));
    child.stderr.on("data", (chunk) => forward(process.stderr, chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, log }));
  });
}

export async function startCiSupabase({
  run = runStart,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  report = console.log,
} = {}) {
  for (let attempt = 0; attempt < registries.length; attempt++) {
    const registry = registries[attempt];
    report(
      `Starting isolated Supabase using ${registry} (attempt ${attempt + 1}/${registries.length})`,
    );
    const result = await run(registry);
    if (result.code === 0) return;
    if (
      !transientPullFailure.test(result.log) ||
      attempt === registries.length - 1
    ) {
      throw new Error(
        "Supabase startup failed. The integration checks have not been skipped.",
      );
    }
    report(
      "Container download failed temporarily; retrying through another registry.",
    );
    await pause(20000 * (attempt + 1));
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.env.CI !== "true")
    throw new Error(
      "This startup helper is only for the isolated CI environment.",
    );
  await startCiSupabase();
}
