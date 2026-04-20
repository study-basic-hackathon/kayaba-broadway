import { defineConfig } from "vitest/config";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import path from "path";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(__dirname, "./drizzle"),
      );
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
  test: {
    setupFiles: ["./src/routes/__tests__/setup.ts"],
    exclude: ["frontend/**", "node_modules/**"],
  },
});
