import { Hono } from "hono";
import { fieldList } from "../data/fields";
import { shopList } from "../data/shops";
import { Bindings } from "../types";

const fields = new Hono<{ Bindings: Bindings }>();

fields.get("/", (c) => {
  return c.json({ fields: fieldList });
});

fields.get("/:id", (c) => {
  const { id } = c.req.param();
  const field = fieldList.find((f) => f.id === id);

  if (!field) {
    return c.json({ error: "フィールドが見つかりません" }, 404);
  }

  return c.json({ field });
});

fields.get("/:id/shops", (c) => {
  const { id } = c.req.param();
  const field = fieldList.find((f) => f.id === id);

  if (!field) {
    return c.json({ error: "フィールドが見つかりません" }, 404);
  }

  const shops = shopList.filter((s) => s.field_id === id);
  return c.json({ shops });
});

export default fields;
