import router from "../fields";
import { env } from "cloudflare:workers";
import { setupTestFixtures, cleanupTestFixtures } from "./utils/fixture";
import { type InferSelectModel } from "drizzle-orm";
import { fields } from "../../db/schema";

let field: InferSelectModel<typeof fields>;

beforeAll(async () => {
  const result = await setupTestFixtures();
  field = result.field;
});

afterAll(async () => {
  await cleanupTestFixtures();
});

describe("GET:/fields", () => {
  test("正常系: フィールド一覧を返す", async () => {
    const res = await router.request("/", { method: "GET" }, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { fields: unknown[] };
    expect(Array.isArray(data.fields)).toBe(true);
    expect(data.fields.length).toBeGreaterThan(0);
  });
});

describe("GET:/fields/:id", () => {
  test("正常系: 指定IDのフィールドを返す", async () => {
    const res = await router.request(`/${field.id}`, { method: "GET" }, env);

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      field: { id: number; name: string; background_url: string };
    };

    expect(data.field.id).toBe(field.id);
    expect(data.field.name).toBe(field.name);
    expect(typeof data.field.background_url).toBe("string");
  });

  test("異常系: 存在しないIDは404", async () => {
    const res = await router.request("/nonexistent", { method: "GET" }, env);
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("フィールドが見つかりません");
  });
});

describe("GET:/fields/:id/shops", () => {
  test("正常系: フィールドに所属する店舗一覧を返す", async () => {
    const res = await router.request(
      `/${field.id}/shops`,
      { method: "GET" },
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      shops: { id: string; field_id: string }[];
    };
    expect(Array.isArray(data.shops)).toBe(true);
    expect(data.shops.every((s) => s.field_id === field.id)).toBe(true);
  });

  test("異常系: 存在しないフィールドIDは404", async () => {
    const res = await router.request(
      "/nonexistent/shops",
      { method: "GET" },
      env,
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("フィールドが見つかりません");
  });
});
