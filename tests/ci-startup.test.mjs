import { test } from "node:test";
import assert from "node:assert/strict";
import { startCiSupabase } from "../scripts/start-ci-supabase.mjs";

test("registry rate limiting retries through a different mirror", async () => {
  const seen = [],
    waits = [];
  await startCiSupabase({
    run: async (registry) => {
      seen.push(registry);
      return seen.length === 1
        ? { code: 1, log: "toomanyrequests: rate exceeded" }
        : { code: 0, log: "" };
    },
    pause: async (ms) => {
      waits.push(ms);
    },
    report: () => {},
  });
  assert.deepEqual(seen, ["public.ecr.aws", "ghcr.io"]);
  assert.deepEqual(waits, [20000]);
});
test("database or migration failures stop without hiding the failure", async () => {
  let attempts = 0;
  await assert.rejects(
    startCiSupabase({
      run: async () => {
        attempts++;
        return {
          code: 1,
          log: "Applying migration: ERROR syntax error at or near select",
        };
      },
      pause: async () => assert.fail("Must not retry SQL errors"),
      report: () => {},
    }),
    /have not been skipped/,
  );
  assert.equal(attempts, 1);
});
test("an outage on all mirrors fails after bounded retries", async () => {
  const seen = [];
  await assert.rejects(
    startCiSupabase({
      run: async (registry) => {
        seen.push(registry);
        return { code: 1, log: "failed to pull image: 429" };
      },
      pause: async () => {},
      report: () => {},
    }),
  );
  assert.deepEqual(seen, ["public.ecr.aws", "ghcr.io", "docker.io"]);
});
