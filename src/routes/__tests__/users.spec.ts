import { env } from "cloudflare:workers";
import app from "../../index";
import { setupTestFixtures, cleanupTestFixtures } from "./utils/fixture";
import { users } from "../../db/schema";
import { InferSelectModel } from "drizzle-orm";

let userFixture: InferSelectModel<typeof users>;
let accessTokenFixture: string;

beforeAll(async () => {
  const result = await setupTestFixtures();
  userFixture = result.user;
  accessTokenFixture = result.accessToken;
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await cleanupTestFixtures();
});

describe("GET:/users/me", () => {
  test("正常系", async () => {
    const res = await app.request(
      "users/me",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessTokenFixture}`,
        },
      },
      env,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { email: string } };
    expect(data.user.email).toBe(userFixture.email);
  });

  test("異常系:アクセストークン未指定の場合401エラー", async () => {
    const res = await app.request("/users/me", { method: "GET" }, env);
    expect(res.status).toBe(401);
  });

  test("異常系:アクセストークンの有効期限切れの場合401エラー", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1000 * 60 * 15);

    const res = await app.request(
      "/users/me",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessTokenFixture}`,
        },
      },
      env,
    );
    expect(res.status).toBe(401);
  });
});
