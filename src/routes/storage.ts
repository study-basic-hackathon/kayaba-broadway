import { Hono } from "hono";
import { type AppType } from "../types";

const router = new Hono<AppType>();

router.get("/download/:key", async (c) => {
  const key = c.req.param("key");

  const object = await c.env.BUCKET?.get(`products/${key}`);

  if (!object) {
    return c.json({ error: "ファイルが見つかりません" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Content-Disposition", `attachment; filename="${key}"`);

  return new Response(object.body, { headers });
});

export default router;
