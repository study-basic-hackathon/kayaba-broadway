import { Hono } from "hono";
import { productList, shopList } from "../data/shops";
import { Bindings } from "../types";

const shops = new Hono<{ Bindings: Bindings }>();

shops.get("/", (c) => {
  return c.json({ shops: shopList });
});

shops.get("/:id", (c) => {
  const { id } = c.req.param();
  const shop = shopList.find((s) => s.id === id);

  if (!shop) {
    return c.json({ error: "店舗が見つかりません" }, 404);
  }

  return c.json({ shop });
});

shops.get("/:id/products", (c) => {
  const { id } = c.req.param();
  const shop = shopList.find((s) => s.id === id);

  if (!shop) {
    return c.json({ error: "店舗が見つかりません" }, 404);
  }

  const products = productList.filter((p) => p.shop_id === id);
  return c.json({ products });
});

export default shops;
