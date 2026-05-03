import { Hono } from "hono";
import { type AppType } from "../types";

const router = new Hono<AppType>();

router.get("/r2", async (c) => {
  if (c.env.ENVIRONMENT === "production") {
    return c.json({ error: "Not found" }, 404);
  }

  const list = await c.env.BUCKET?.list();
  if (!list) {
    return c.json({ error: "BUCKETバインディングが見つかりません" }, 404);
  }
  return c.json(list.objects.map((o) => o.key));
});

export default router;
