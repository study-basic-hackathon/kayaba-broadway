import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { products } from "../db/schema";
import { type AppType } from "../types";

const router = new Hono<AppType>();

router.get("/:id", async (c) => {
  const { id } = c.req.param();

  const db = drizzle(c.env.DB!);

  const productRecord = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .get();

  if (!productRecord) {
    return c.json({ error: "商品が見つかりません" }, 404);
  }

  return c.json({ product: productRecord });
});

export default router;
