import { beforeAll, describe, expect, test } from "vitest";
import app from "../../index";
import { getAccessToken } from "./utils/token";
import { ENV } from "./constants";

function getShopsRequest(accessToken?: string) {
  return app.request(
    "/shops",
    {
      method: "GET",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    ENV,
  );
}

function getShopRequest(id: string, accessToken: string) {
  return app.request(
    `/shops/${id}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    ENV,
  );
}

function getShopProductsRequest(id: string, accessToken: string) {
  return app.request(
    `/shops/${id}/products`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    ENV,
  );
}

let accessToken = "";

beforeAll(async () => {
  accessToken = await getAccessToken();
});

describe("GET:/shops", () => {
  test("正常系", async () => {
    const res = await getShopsRequest(accessToken);
    expect(res.status).toBe(200);
    const { shops: shopList } = (await res.json()) as { shops: unknown[] };
    expect(Array.isArray(shopList)).toBe(true);
    expect(shopList.length).toBeGreaterThan(0);
  });

  test("異常系: Authorizationヘッダーなしの場合、401", async () => {
    const res = await getShopsRequest();
    expect(res.status).toBe(401);
  });
});

describe("GET:/shops/:id", () => {
  test("正常系", async () => {
    const res = await getShopRequest("shop-1", accessToken);
    expect(res.status).toBe(200);
    const { shop } = (await res.json()) as {
      shop: { id: string; name: string };
    };
    expect(shop.id).toBe("shop-1");
    expect(shop.name).toBe("茅場書房");
  });

  test("異常系: 存在しない店舗の場合、404", async () => {
    const res = await getShopRequest("nonexistent", accessToken);
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("店舗が見つかりません");
  });
});

describe("GET:/shops/:id/products", () => {
  test("正常系", async () => {
    const res = await getShopProductsRequest("shop-1", accessToken);
    expect(res.status).toBe(200);
    const { products } = (await res.json()) as { products: unknown[] };
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });

  test("異常系: 存在しない店舗の場合、404", async () => {
    const res = await getShopProductsRequest("nonexistent", accessToken);
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(404);
    expect(error).toBe("店舗が見つかりません");
  });
});
