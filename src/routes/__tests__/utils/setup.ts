import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

type TestEnv = Cloudflare.Env & {
  TEST_MIGRATIONS: import("@cloudflare/vitest-pool-workers").D1Migration[];
};
const testEnv = env as TestEnv;
await applyD1Migrations(testEnv.DB!, testEnv.TEST_MIGRATIONS);
