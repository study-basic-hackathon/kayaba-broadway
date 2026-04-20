import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { users, refreshTokens } from "../../../db/schema";
import { hashPassword } from "../../../utils/hash";
import { eq } from "drizzle-orm";

export async function insertTestUser(args?: {
  email?: string;
  password?: string;
  display_name?: string;
}) {
  const email = args?.email ?? "test@example.com";
  const password = args?.password ?? "password";
  const display_name = args?.display_name ?? "testUser";

  const db = drizzle(env.DB!);
  const [user] = await db
    .insert(users)
    .values({
      email,
      password_hash: await hashPassword(password),
      display_name,
    })
    .returning();

  return user;
}

export async function deleteTestUser(userId: number) {
  const db = drizzle(env.DB!);
  await db.batch([
    db.delete(refreshTokens).where(eq(refreshTokens.user_id, userId)),
    db.delete(users).where(eq(users.id, userId)),
  ]);
}

export async function isExistTestRefreshToken(userId: number) {
  const db = drizzle(env.DB!);
  const existing = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.user_id, userId))
    .get();

  return !!existing;
}
