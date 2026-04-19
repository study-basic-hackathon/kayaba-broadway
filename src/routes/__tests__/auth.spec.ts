import { decode } from "hono/jwt";
import { vi, afterEach, beforeEach, describe, expect, test } from "vitest";
import { users } from "../../db/schema";
import { hashPassword } from "../../utils/hash";
import { createAuthRouter } from "../auth";
import { createTestDb } from "./utils/db";
import { ENV } from "./constants";

function registerRequest(
  auth: ReturnType<typeof createAuthRouter>,
  body: object,
) {
  return auth.request(
    "/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    ENV,
  );
}

function loginRequest(auth: ReturnType<typeof createAuthRouter>, body: object) {
  return auth.request(
    "/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    ENV,
  );
}

function accessTokenRefreshRequest(
  auth: ReturnType<typeof createAuthRouter>,
  refreshToken: string,
) {
  return auth.request(
    "/refresh",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${refreshToken}`,
      },
    },
    ENV,
  );
}

describe("POST:/register", () => {
  let auth: ReturnType<typeof createAuthRouter>;

  beforeEach(() => {
    const testDb = createTestDb();
    auth = createAuthRouter(testDb);
  });

  test("正常系", async () => {
    const res = await registerRequest(auth, {
      display_name: "testUser",
      email: "test@example.com",
      password: "password",
      confirm_password: "password",
    });
    expect(res.status).toBe(200);
  });

  test("異常系:メールアドレスが登録済みの場合重複エラー", async () => {
    const registerBody = {
      display_name: "testUser",
      email: "test@example.com",
      password: "password",
      confirm_password: "password",
    };

    const firstRes = await registerRequest(auth, registerBody);
    expect(firstRes.status).toBe(200);
    const secondRes = await registerRequest(auth, registerBody);
    expect(secondRes.status).toBe(409);
  });
});

describe("POST:/login", () => {
  let auth: ReturnType<typeof createAuthRouter>;

  beforeEach(async () => {
    const testDb = createTestDb();
    auth = createAuthRouter(testDb);

    await testDb.insert(users).values({
      email: "test@example.com",
      password_hash: await hashPassword("password"),
      display_name: "testUser",
    });
  });

  test("正常系", async () => {
    const res = await loginRequest(auth, {
      email: "test@example.com",
      password: "password",
    });
    expect(res.status).toBe(200);
    const { accessToken } = (await res.json()) as {
      accessToken: string;
    };
    expect(accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  test("異常系:存在しないユーザの場合認証失敗", async () => {
    const res = await loginRequest(auth, {
      email: "nouser@example.com",
      password: "password",
    });
    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(401);
    expect(error).toBe("メールアドレスまたはパスワードが違います");
  });
});

describe("POST:/refresh", () => {
  let auth: ReturnType<typeof createAuthRouter>;
  beforeEach(async () => {
    const testDb = createTestDb();
    auth = createAuthRouter(testDb);
    await testDb.insert(users).values({
      email: "test@example.com",
      password_hash: await hashPassword("password"),
      display_name: "testUser",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("正常系", async () => {
    const loginRes = await loginRequest(auth, {
      email: "test@example.com",
      password: "password",
    });

    const { accessToken: prevAccessToken } = (await loginRes.json()) as {
      accessToken: string;
    };

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const setCookieHeader = loginRes.headers.get("Set-Cookie");
    const refreshToken = setCookieHeader?.match(/refreshToken=([^;]+)/)?.[1];
    expect(refreshToken).toBeDefined();

    const refreshRes = await accessTokenRefreshRequest(auth, refreshToken!);
    const { accessToken: newAccessToken } = (await refreshRes.json()) as {
      accessToken: string;
    };

    expect(refreshRes.status).toBe(200);

    const { payload: prevPayload } = decode(prevAccessToken);
    const { payload: newPayload } = decode(newAccessToken);

    expect(newPayload.exp!).toBeGreaterThan(prevPayload.exp!);
  });

  test("異常系:DBにリフレッシュトークンが存在しない場合トークン無効エラー", async () => {
    const refreshRes = await accessTokenRefreshRequest(auth, "noExistToken");
    expect(refreshRes.status).toBe(401);

    const json = (await refreshRes.json()) as {
      error: string;
    };
    expect(json.error).toBe("無効なトークンです");
  });

  test("異常系:リフレッシュトークンが有効期限切れの場合有効期限切れエラー", async () => {
    const loginRes = await loginRequest(auth, {
      email: "test@example.com",
      password: "password",
    });
    const setCookieHeader = loginRes.headers.get("Set-Cookie");
    const refreshToken = setCookieHeader?.match(/refreshToken=([^;]+)/)?.[1];
    expect(refreshToken).toBeDefined();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1000 * 60 * 60 * 24 * 8);

    const refreshRes = await accessTokenRefreshRequest(auth, refreshToken!);
    expect(refreshRes.status).toBe(401);

    const json = (await refreshRes.json()) as {
      error: string;
    };
    expect(json.error).toBe("トークンの有効期限が切れています");
  });
});
