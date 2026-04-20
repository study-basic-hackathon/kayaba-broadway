import router from "../products";
import { env } from "cloudflare:workers";
import { setupTestFixtures, cleanupTestFixtures } from "./utils/fixture";
import { products } from "../../db/schema";
import { type InferSelectModel } from "drizzle-orm";

function getProductRequest(id: string) {
  return router.request(`/${id}`, { method: "GET" }, env);
}

let productFixture: InferSelectModel<typeof products>;
beforeAll(async () => {
  const result = await setupTestFixtures();
  productFixture = result.product;
});

afterAll(async () => {
  await cleanupTestFixtures();
});

describe("GET:/products/:id", () => {
  test("正常系", async () => {
    const res = await getProductRequest(productFixture.id);
    expect(res.status).toBe(200);
    const { product } = (await res.json()) as {
      product: InferSelectModel<typeof products>;
    };
    expect(product.id).toBe(productFixture.id);
    expect(product.shop_id).toBe(productFixture.shop_id);
  });

  test("異常系: 存在しない商品の場合、404", async () => {
    const res = await getProductRequest("nonexistent");
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("商品が見つかりません");
  });
});
