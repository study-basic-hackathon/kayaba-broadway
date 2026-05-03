import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { users } from "../db/schema";
import { type AppType } from "../types";

const app = new Hono<AppType>();

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
