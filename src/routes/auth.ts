import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import { ALG } from "../constants";
import { Bindings, User } from "../types";

const users: User[] = [
  { id: "1", email: "shun@example.com", password: "1234" },
];

const auth = new Hono<{ Bindings: Bindings }>();

const ACCESS_TOKEN_EXPIRES_IN = 60 * 15;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7;

function findUser(email: string, password: string): User | undefined {
  return users.find((x) => x.email === email && x.password === password);
}

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = await c.req.valid("json");

  const user = findUser(email, password);

  if (!user) {
    return c.json({ error: "認証失敗" }, 401);
  }

  const accessToken = await sign(
    {
      sub: user.id,
      role: "user",
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRES_IN,
    },
    c.env.JWT_SECRET,
    ALG,
  );

  const refreshToken = await sign(
    {
      sub: user.id,
      type: "refresh",
      exp: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRES_IN,
    },
    c.env.JWT_SECRET,
    ALG,
  );

  return c.json({ accessToken, refreshToken });
});

auth.post("/refresh", async (c) => {
  const { refreshToken } = await c.req.json<{ refreshToken: string }>();

  try {
    const payload = await verify(refreshToken, c.env.JWT_SECRET, ALG);

    if (payload.type !== "refresh") {
      return c.json({ error: "無効なトークン" }, 401);
    }

    const accessToken = await sign(
      {
        sub: payload.sub,
        role: "user",
        exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRES_IN,
      },
      c.env.JWT_SECRET,
      ALG,
    );

    return c.json({ accessToken });
  } catch {
    return c.json({ error: "無効なトークン" }, 401);
  }
});

export default auth;
