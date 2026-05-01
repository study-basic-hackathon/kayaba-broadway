import { DrizzleD1Database } from "drizzle-orm/d1";
import type { JwtVariables } from "hono/jwt";
import Stripe from "stripe";

export type AppDatabase = DrizzleD1Database<Record<string, never>> & {
  $client: D1Database;
};

type AppVariables = JwtVariables & {
  stripe: Stripe;
};

export type AppType = {
  Variables: AppVariables;
  Bindings: Env;
};
