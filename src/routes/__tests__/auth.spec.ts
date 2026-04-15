import { describe, expect, test } from "vitest";
import { decode } from "hono/jwt";
import auth from "../auth";

const ENV = { JWT_SECRET: "test-secret" };

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
    ENV,
  );
}

function accessTokenRefreshRequest(refreshToken: string) {
  return auth.request(
    "/refresh",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    },
    ENV,
  );
}

describe("POST:login", () => {
  test("正常系", async () => {
    const res = await loginRequest({
      email: "shun@example.com",
      password: "1234",
    });
    expect(res.status).toBe(200);
    const { accessToken, refreshToken } = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    expect(accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(refreshToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  test("存在しないユーザの場合、認証失敗", async () => {
    const res = await loginRequest({
      email: "nouser@example.com",
      password: "1234",
    });

    const { error } = (await res.json()) as { error: string };
    expect(res.status).toBe(401);
    expect(error).toBe("認証失敗");
  });
});

describe("POST:refresh", () => {
  test("正常系", async () => {
    const loginRes = await loginRequest({
      email: "shun@example.com",
      password: "1234",
    });

    const { refreshToken, accessToken: prevAccessToken } =
      (await loginRes.json()) as {
        refreshToken: string;
        accessToken: string;
      };

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const refreshRes = await accessTokenRefreshRequest(refreshToken);
    const { accessToken: newAccessToken } = (await refreshRes.json()) as {
      accessToken: string;
    };

    expect(refreshRes.status).toBe(200);

    const { payload: prevPayload } = decode(prevAccessToken);
    const { payload: newPayload } = decode(newAccessToken);

    expect(newPayload.exp!).toBeGreaterThan(prevPayload.exp!);
  });
});
