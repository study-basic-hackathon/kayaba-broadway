import { defineConfig } from "vitest/config";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import path from "path";

export default defineConfig({
  esbuild: {
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(__dirname, "./drizzle"),
      );
      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-for-vitest",
            STRIPE_API_KEY: process.env.STRIPE_API_KEY ?? "sk_test_dummy",
            STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_dummy",
            CORS_ORIGIN: "http://localhost:4200",
            ENVIRONMENT: "test",
          },
        },
      };
    }),
  ],
  test: {
    globals: true,
    setupFiles: ["./src/routes/__tests__/utils/setup.ts"],
    exclude: ["frontend/**", "node_modules/**", "partykit/**"],
  },
});
