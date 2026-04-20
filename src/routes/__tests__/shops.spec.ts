import { env } from "cloudflare:workers";
import router from "../shops";
import { cleanupTestFixtures, setupTestFixtures } from "./utils/fixture";
import { shops } from "../../db/schema";
import { type InferSelectModel } from "drizzle-orm";

function getShopRequest(id: string) {
  return router.request(`/${id}`, { method: "GET" }, env);
}

function getShopProductsRequest(id: string) {
  return router.request(`/${id}/products`, { method: "GET" }, env);
}

let shopFixture: InferSelectModel<typeof shops>;
beforeAll(async () => {
  const result = await setupTestFixtures();
  shopFixture = result.shop;
});

afterAll(async () => {
  await cleanupTestFixtures();
});

describe("GET:/shops", () => {
  test("正常系", async () => {
    const res = await router.request("/", { method: "GET" }, env);
    expect(res.status).toBe(200);
    const { shops: shopList } = (await res.json()) as { shops: unknown[] };
    expect(Array.isArray(shopList)).toBe(true);
    expect(shopList.length).toBeGreaterThan(0);
  });
});

describe("GET:/shops/:id", () => {
  test("正常系", async () => {
    const res = await getShopRequest(shopFixture.id);
    expect(res.status).toBe(200);
    const { shop } = (await res.json()) as {
      shop: InferSelectModel<typeof shops>;
    };
    expect(shop.id).toBe(shopFixture.id);
    expect(shop.name).toBe(shopFixture.name);
  });

  test("異常系: 存在しない店舗の場合、404", async () => {
    const res = await getShopRequest("nonexistent");
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("店舗が見つかりません");
  });
});

describe("GET:/shops/:id/products", () => {
  test("正常系", async () => {
    const res = await getShopProductsRequest(shopFixture.id);
    expect(res.status).toBe(200);
    const { products } = (await res.json()) as { products: unknown[] };
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  test("異常系: 存在しない店舗の場合、404", async () => {
    const res = await getShopProductsRequest("nonexistent");
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("店舗が見つかりません");
  });
});
