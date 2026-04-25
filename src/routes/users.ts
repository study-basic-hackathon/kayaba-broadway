import { Hono } from "hono";
import type { JwtVariables } from "hono/jwt";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../db/schema";

const app = new Hono<{ Variables: JwtVariables; Bindings: Env }>();

app.get("/me", async (c) => {
  const payload = c.get("jwtPayload");

  const db = drizzle(c.env.DB!);
  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.id))
    .get();

  if (!userRecord) {
    return c.json({ error: "ユーザーが見つかりません" }, 404);
  }

  const { password_hash, ...safeUser } = userRecord;
  return c.json({ user: safeUser });
});

export default app;
