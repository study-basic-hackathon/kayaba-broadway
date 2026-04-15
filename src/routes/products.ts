import { Hono } from "hono";
import { productList } from "../data/shops";
import { Bindings } from "../types";

const products = new Hono<{ Bindings: Bindings }>();

products.get("/:id", (c) => {
  const { id } = c.req.param();
  const product = productList.find((p) => p.id === id);

  if (!product) {
    return c.json({ error: "商品が見つかりません" }, 404);
  }

  return c.json({ product });
});

export default products;
