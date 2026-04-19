import { Hono } from "hono";
import type { JwtVariables } from "hono/jwt";
import { Bindings } from "../types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "../db/schema";
const app = new Hono<{ Variables: JwtVariables; Bindings: Bindings }>();

app.get("/me", async (c) => {
  const payload = c.get("jwtPayload");

  const db = drizzle(c.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, payload.id))
    .get();

  if (!user) {
    return c.json({ error: "ユーザーが見つかりません" }, 404);
  }

  const { password_hash, ...safeUser } = user;
  return c.json(safeUser);
});

export default app;
