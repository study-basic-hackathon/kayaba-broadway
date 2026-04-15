import { describe, expect, test } from "vitest";
import products from "../products";
import { Product } from "../../types";

const ENV = { JWT_SECRET: "test-secret" };

function getProductRequest(id: string) {
  return products.request(`/${id}`, { method: "GET" }, ENV);
}

describe("GET:/products/:id", () => {
  test("正常系", async () => {
    const res = await getProductRequest("product-1");
    expect(res.status).toBe(200);
    const { product } = (await res.json()) as { product: Product };
    expect(product.id).toBe("product-1");
    expect(product.shop_id).toBe("shop-1");
  });

  test("異常系: 存在しない商品の場合、404", async () => {
    const res = await getProductRequest("nonexistent");
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("商品が見つかりません");
  });
});
