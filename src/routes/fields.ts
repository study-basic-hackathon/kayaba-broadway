import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { fields, shops } from "../db/schema";

const router = new Hono<{ Bindings: Env }>();

async function fetchField(c: Context<{ Bindings: Env }>, id: string) {
  const db = drizzle(c.env.DB!);
  return await db.select().from(fields).where(eq(fields.id, id)).get();
}

router.get("/", async (c) => {
  const db = drizzle(c.env.DB!);
  const fieldsRecord = await db.select().from(fields).all();
  return c.json({ fields: fieldsRecord });
});

router.get("/:id", async (c) => {
  const { id } = c.req.param();
  const fieldRecord = await fetchField(c, id);
  if (!fieldRecord) {
    return c.json({ error: "フィールドが見つかりません" }, 404);
  }
  return c.json({ field: fieldRecord });
});

router.get("/:id/shops", async (c) => {
  const { id: fieldId } = c.req.param();
  const fieldRecord = await fetchField(c, fieldId);
  if (!fieldRecord) {
    return c.json({ error: "フィールドが見つかりません" }, 404);
  }

  const db = drizzle(c.env.DB!);
  const shopsRecord = await db
    .select()
    .from(shops)
    .where(eq(shops.field_id, fieldId));
  return c.json({ shops: shopsRecord });
});

export default router;
