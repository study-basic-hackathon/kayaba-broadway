import { afterAll, beforeAll, describe, expect, test } from "vitest";
import app from "../../index";
import { Product } from "../../types";
import { getAccessToken } from "./utils/token";
import { env } from "cloudflare:workers";
import { deleteTestUser, insertTestUser } from "./utils/db";

function getProductRequest(id: string, accessToken?: string) {
  return app.request(
    `/products/${id}`,
    {
      method: "GET",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    env,
  );
}

let userId: number;
let email: string;
beforeAll(async () => {
  const user = await insertTestUser();
  userId = user.id;
  email = user.email;
});

afterAll(async () => {
  await deleteTestUser(userId);
});

describe("GET:/products/:id", () => {
  test("正常系", async () => {
    const accessToken = await getAccessToken({ userId, email });
    const res = await getProductRequest("product-1", accessToken);
    expect(res.status).toBe(200);
    const { product } = (await res.json()) as { product: Product };
    expect(product.id).toBe("product-1");
    expect(product.shop_id).toBe("shop-1");
  });

  test("異常系: Authorizationヘッダーなしの場合、401", async () => {
    const res = await getProductRequest("product-1");
    expect(res.status).toBe(401);
  });

  test("異常系: 存在しない商品の場合、404", async () => {
    const accessToken = await getAccessToken({ userId, email });
    const res = await getProductRequest("nonexistent", accessToken);
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("商品が見つかりません");
  });
});
