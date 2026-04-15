import { describe, expect, test } from "vitest";
import shops from "../shops";

const ENV = { JWT_SECRET: "test-secret" };

function getShopsRequest() {
  return shops.request("/", { method: "GET" }, ENV);
}

function getShopRequest(id: string) {
  return shops.request(`/${id}`, { method: "GET" }, ENV);
}

function getShopProductsRequest(id: string) {
  return shops.request(`/${id}/products`, { method: "GET" }, ENV);
}

describe("GET:/shops", () => {
  test("正常系", async () => {
    const res = await getShopsRequest();
    expect(res.status).toBe(200);
    const { shops: shopList } = (await res.json()) as { shops: unknown[] };
    expect(Array.isArray(shopList)).toBe(true);
    expect(shopList.length).toBeGreaterThan(0);
  });
});

describe("GET:/shops/:id", () => {
  test("正常系", async () => {
    const res = await getShopRequest("shop-1");
    expect(res.status).toBe(200);
    const { shop } = (await res.json()) as {
      shop: { id: string; name: string };
    };
    expect(shop.id).toBe("shop-1");
    expect(shop.name).toBe("茅場書房");
  });

  test("存在しない店舗の場合、404", async () => {
    const res = await getShopRequest("nonexistent");
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("店舗が見つかりません");
  });
});

describe("GET:/shops/:id/products", () => {
  test("正常系", async () => {
    const res = await getShopProductsRequest("shop-1");
    expect(res.status).toBe(200);
    const { products } = (await res.json()) as { products: unknown[] };
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  test("存在しない店舗の場合、404", async () => {
    const res = await getShopProductsRequest("nonexistent");
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("店舗が見つかりません");
  });
});
