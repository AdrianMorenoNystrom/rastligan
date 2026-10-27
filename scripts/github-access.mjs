import { execFileSync } from "node:child_process";
try {
  const raw = execFileSync(
    "git",
    ["-c", "credential.interactive=never", "credential", "fill"],
    {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "Never",
      },
    },
  );
  const fields = Object.fromEntries(
    raw
      .trim()
      .split("\n")
      .map((s) => {
        const i = s.indexOf("=");
        return [s.slice(0, i), s.slice(i + 1)];
      }),
  );
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: "Bearer " + fields.password,
      "User-Agent": "Rastligan",
    },
  });
  const user = await response.json();
  console.log(
    JSON.stringify({
      github_cli_access: response.ok,
      login: user.login,
      plan: user.plan?.name,
    }),
  );
} catch {
  console.log(JSON.stringify({ github_cli_access: false }));
}
