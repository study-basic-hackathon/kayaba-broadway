import { decode } from "hono/jwt";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import auth from "../auth";
import {
  insertTestUser,
  deleteTestUser,
  isExistTestRefreshToken,
} from "./utils/fixture";
import { env } from "cloudflare:workers";

function registerRequest(body: object) {
  return auth.request(
    "/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    env,
  );
}

function loginRequest(body: object) {
  return auth.request(
    "/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    env,
  );
}

function accessTokenRefreshRequest(refreshToken: string) {
  return auth.request(
    "/refresh",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${refreshToken}`,
      },
    },
    env,
  );
}

describe("POST:/register", () => {
  test("正常系", async () => {
    const res = await registerRequest({
      display_name: "testUser",
      email: "test@example.com",
      password: "password",
      confirm_password: "password",
    });
    expect(res.status).toBe(200);
    const { user } = (await res.json()) as { user: { id: string } };
    await deleteTestUser(user.id);
  });

  test("異常系:メールアドレスが登録済みの場合重複エラー", async () => {
    const registerBody = {
      display_name: "dupUser",
      email: "dup@example.com",
      password: "password",
      confirm_password: "password",
    };

    const firstRes = await registerRequest(registerBody);
    expect(firstRes.status).toBe(200);
    const secondRes = await registerRequest(registerBody);
    expect(secondRes.status).toBe(409);

    const { user } = (await firstRes.json()) as { user: { id: string } };
    await deleteTestUser(user.id);
  });
});

describe("POST:/login", () => {
  test("正常系", async () => {
    const email = "test@example.com";
    const password = "password";
    const user = await insertTestUser({ email, password });
    const res = await loginRequest({
      email,
      password,
    });
    expect(res.status).toBe(200);
    const { accessToken } = (await res.json()) as {
      accessToken: string;
    };
    expect(accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    await deleteTestUser(user.id);
  });

  test("異常系:存在しないユーザの場合認証失敗", async () => {
    const res = await loginRequest({
      email: "nouser@example.com",
      password: "password",
    });

    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(401);
    expect(error).toBe("メールアドレスまたはパスワードが違います");
  });
});

describe("POST:/refresh", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("正常系", async () => {
    const email = "test@example.com";
    const password = "password";
    const user = await insertTestUser({ email, password });
    const loginRes = await loginRequest({
      email,
      password,
    });

    const { accessToken: prevAccessToken } = (await loginRes.json()) as {
      accessToken: string;
    };

    vi.useFakeTimers();

    // 初回取得と再取得のaccessTokenのexpの差を1秒以上にするため1000m秒進める
    vi.advanceTimersByTime(1000);

    const setCookieHeader = loginRes.headers.get("Set-Cookie");
    const refreshToken = setCookieHeader?.match(/refreshToken=([^;]+)/)?.[1];
    expect(refreshToken).toBeDefined();

    const refreshRes = await accessTokenRefreshRequest(refreshToken!);
    const { accessToken: newAccessToken } = (await refreshRes.json()) as {
      accessToken: string;
    };

    expect(refreshRes.status).toBe(200);

    const { payload: prevPayload } = decode(prevAccessToken);
    const { payload: newPayload } = decode(newAccessToken);

    expect(newPayload.exp!).toBeGreaterThan(prevPayload.exp!);
    await deleteTestUser(user.id);
  });

  test("異常系:DBにリフレッシュトークンが存在しない場合トークン無効エラー", async () => {
    const refreshRes = await accessTokenRefreshRequest("noExistToken");
    expect(refreshRes.status).toBe(401);

    const json = (await refreshRes.json()) as {
      error: string;
    };
    expect(json.error).toBe("無効なトークンです");
  });

  test("異常系:リフレッシュトークンが有効期限切れの場合有効期限切れエラー", async () => {
    const user = await insertTestUser();
    const loginRes = await loginRequest({
      email: "test@example.com",
      password: "password",
    });
    const setCookieHeader = loginRes.headers.get("Set-Cookie");
    const refreshToken = setCookieHeader?.match(/refreshToken=([^;]+)/)?.[1];
    expect(refreshToken).toBeDefined();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1000 * 60 * 60 * 24 * 8);

    const refreshRes = await accessTokenRefreshRequest(refreshToken!);
    expect(refreshRes.status).toBe(401);

    const json = (await refreshRes.json()) as {
      error: string;
    };
    expect(json.error).toBe("トークンの有効期限が切れています");

    const isExistToken = await isExistTestRefreshToken(user.id);
    expect(isExistToken).toBe(false);

    await deleteTestUser(user.id);
  });
});
