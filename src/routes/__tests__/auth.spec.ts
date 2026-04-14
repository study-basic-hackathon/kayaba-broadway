import { describe, expect, test } from "vitest";
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

describe("POST login", () => {
  test("正常系", async () => {
    const res = await loginRequest({
      email: "shun@example.com",
      password: "1234",
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    expect(json.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(json.refreshToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });
});
