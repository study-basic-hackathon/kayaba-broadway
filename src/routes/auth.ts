import { createStripeCustomer, fetchUserPayment } from "@/services/payment";
import { zValidator } from "@hono/zod-validator";
import { and, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import { ALG } from "../constants";
import { refreshTokens, users } from "../db/schema";
import { type AppType } from "../types";
import { hashPassword, verifyPassword } from "../utils/hash";

const ACCESS_TOKEN_EXPIRES_IN = 60 * 15;
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7;

const router = new Hono<AppType>();

const registerSchema = z
  .object({
    display_name: z.string(),
    email: z.email(),
    password: z.string(),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    error: "パスワードが一致しません",
    path: ["confirm_password"],
  });

router.post("/register", zValidator("json", registerSchema), async (c) => {
  const { display_name, email, password } = c.req.valid("json");
  const db = drizzle(c.env.DB!);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (existing) {
    return c.json({ error: "このメールアドレスはすでに登録されています" }, 409);
  }

  if (!c.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set");
    return c.json({ error: "サーバーエラー" }, 500);
  }

  const password_hash = await hashPassword(password);
  const [result] = await db
    .insert(users)
    .values({ email, display_name, password_hash })
    .returning();

  const nowUnix = Math.floor(Date.now() / 1000);

  const accessToken = await sign(
    {
      id: result.id,
      email: result.email,
      exp: nowUnix + ACCESS_TOKEN_EXPIRES_IN,
    },
    c.env.JWT_SECRET,
    ALG,
  );

  const refreshTokenExpiresAt = nowUnix + REFRESH_TOKEN_EXPIRES_IN;
  const refreshToken = await sign(
    {
      id: result.id,
      email: result.email,
      type: "refresh",
      exp: refreshTokenExpiresAt,
    },
    c.env.JWT_SECRET,
    ALG,
  );

  await db.insert(refreshTokens).values({
    user_id: result.id,
    token: refreshToken,
    expires_at: refreshTokenExpiresAt,
  });

  setCookie(c, "refreshToken", refreshToken, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Strict",
    maxAge: REFRESH_TOKEN_EXPIRES_IN,
  });

  const stripe = c.get("stripe");
  const userPaymentRecord = await fetchUserPayment(db, result.id);
  if (!userPaymentRecord) {
    await createStripeCustomer(stripe, db, result.id, result.email);
  }

  const { password_hash: _, ...user } = result;

  return c.json({ accessToken, user });
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

router.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");

  const db = drizzle(c.env.DB!);
  const storedUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!storedUser) {
    return c.json({ error: "メールアドレスまたはパスワードが違います" }, 401);
  }

  const isValid = await verifyPassword(password, storedUser.password_hash);

  if (!isValid) {
    return c.json({ error: "メールアドレスまたはパスワードが違います" }, 401);
  }

  if (!c.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set");
    return c.json({ error: "サーバーエラー" }, 500);
  }

  const nowUnix = Math.floor(Date.now() / 1000);

  const accessToken = await sign(
    {
      id: storedUser.id,
      email: storedUser.email,
      exp: nowUnix + ACCESS_TOKEN_EXPIRES_IN,
    },
    c.env.JWT_SECRET,
    ALG,
  );

  const refreshTokenExpiresAt = nowUnix + REFRESH_TOKEN_EXPIRES_IN;
  const refreshToken = await sign(
    {
      id: storedUser.id,
      email: storedUser.email,
      type: "refresh",
      exp: refreshTokenExpiresAt,
    },
    c.env.JWT_SECRET,
    ALG,
  );

  // 期限切れトークンを削除してからinsert
  await db
    .delete(refreshTokens)
    .where(
      and(
        eq(refreshTokens.user_id, storedUser.id),
        lt(refreshTokens.expires_at, nowUnix),
      ),
    );

  await db.insert(refreshTokens).values({
    user_id: storedUser.id,
    token: refreshToken,
    expires_at: refreshTokenExpiresAt,
  });

  setCookie(c, "refreshToken", refreshToken, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Strict",
    maxAge: REFRESH_TOKEN_EXPIRES_IN,
  });

  const stripe = c.get("stripe");
  const userPaymentRecord = await fetchUserPayment(db, storedUser.id);
  if (!userPaymentRecord) {
    await createStripeCustomer(stripe, db, storedUser.id, storedUser.email);
  }

  const { password_hash: _, ...user } = storedUser;

  return c.json({ accessToken, user });
});

router.post("/refresh", async (c) => {
  const refreshToken = getCookie(c, "refreshToken");

  if (!refreshToken) {
    return c.json({ error: "リフレッシュトークンがありません" }, 401);
  }

  const db = drizzle(c.env.DB!);
  const stored = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, refreshToken))
    .get();

  if (!stored) {
    return c.json({ error: "無効なトークンです" }, 401);
  }

  const nowUnix = Math.floor(Date.now() / 1000);

  if (stored.expires_at < nowUnix) {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
    return c.json({ error: "トークンの有効期限が切れています" }, 401);
  }

  try {
    const payload = await verify(refreshToken, c.env.JWT_SECRET, ALG);
    const accessToken = await sign(
      {
        id: payload.id,
        email: payload.email,
        exp: nowUnix + ACCESS_TOKEN_EXPIRES_IN,
      },
      c.env.JWT_SECRET,
      ALG,
    );

    const storedUser = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.id as string))
      .get();

    const { password_hash: _, ...user } = storedUser!;

    return c.json({ accessToken, user });
  } catch (error) {
    console.log(error);
    return c.json({ error: "無効なトークン" }, 401);
  }
});

router.post("/logout", async (c) => {
  const db = drizzle(c.env.DB!);
  const refreshToken = getCookie(c, "refreshToken");

  if (refreshToken) {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
  }

  setCookie(c, "refreshToken", "", {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Strict",
    maxAge: 0,
  });

  return c.json({ success: true });
});

export default router;
