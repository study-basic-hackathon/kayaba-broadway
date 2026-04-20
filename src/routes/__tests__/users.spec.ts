import { env } from "cloudflare:workers";
import {
  vi,
  beforeAll,
  describe,
  expect,
  test,
  afterEach,
  afterAll,
} from "vitest";
import app from "../../index";
import { deleteTestUser, insertTestUser } from "./utils/db";
import { getAccessToken } from "./utils/token";

let userId: number;
let email: string;

beforeAll(async () => {
  const user = await insertTestUser();
  userId = user.id;
  email = user.email;
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await deleteTestUser(userId);
});

describe("GET:/users/me", () => {
  test("正常系", async () => {
    const accessToken = await getAccessToken({ userId, email });
    const res = await app.request(
      "/users/me",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      env,
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { email: string };
    expect(json.email).toBe(email);
  });

  test("異常系:アクセストークンの有効期限切れの場合401エラー", async () => {
    const accessToken = await getAccessToken({ userId, email });

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1000 * 60 * 15);

    const res = await app.request(
      "/users/me",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      env,
    );
    expect(res.status).toBe(401);
  });
});
