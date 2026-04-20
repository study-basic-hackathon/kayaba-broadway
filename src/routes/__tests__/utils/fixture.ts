import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { sign } from "hono/jwt";
import { ALG } from "../../../constants";
import {
  fields,
  refreshTokens,
  users,
  products,
  shops,
  purchases,
} from "../../../db/schema";
import { hashPassword } from "../../../utils/hash";

export async function setupTestFixtures() {
  const user = await insertTestUser();
  const field = await insertTestFields();
  const shop = await insertTestShops({ field_id: field.id });
  const product = await insertTestProducts({ shop_id: shop.id });

  const accessToken = await getAccessToken({
    userId: user.id,
    email: user.email,
  });
  return { user, field, shop, product, accessToken };
}

export async function cleanupTestFixtures() {
  const db = drizzle(env.DB!);
  await db.batch([
    db.delete(purchases),
    db.delete(products),
    db.delete(refreshTokens),
    db.delete(shops),
    db.delete(users),
    db.delete(fields),
  ]);
}

export async function getAccessToken(args: { userId: string; email: string }) {
  const nowUnix = Math.floor(Date.now() / 1000);
  return sign(
    {
      id: args.userId,
      email: args.email,
      exp: nowUnix + 60 * 15,
    },
    env.JWT_SECRET,
    ALG,
  );
}

export async function insertTestFields(args?: {
  name?: string;
  description?: string;
  background_url?: string;
  width?: number;
  height?: number;
}) {
  const name = args?.name ?? "test";
  const description = args?.description ?? "テスト説明";
  const background_url =
    args?.background_url ?? "/assets/fields/kayaba-broadway.png";
  const width = args?.width ?? 1280;
  const height = args?.height ?? 720;

  const db = drizzle(env.DB!);
  const [field] = await db
    .insert(fields)
    .values({
      name,
      description,
      background_url,
      width,
      height,
    })
    .returning();

  return field;
}

export async function insertTestShops(args: {
  field_id: string;
  name?: string;
  description?: string;
  position_x?: number;
  position_y?: number;
}) {
  const name = args?.name ?? "テスト店舗";
  const description = args?.description ?? "テスト説明";
  const position_x = args?.position_x ?? 100;
  const position_y = args?.position_y ?? 150;

  const db = drizzle(env.DB!);
  const [shop] = await db
    .insert(shops)
    .values({
      field_id: args.field_id,
      name,
      description,
      position_x,
      position_y,
    })
    .returning();

  return shop;
}

export async function insertTestProducts(args: {
  shop_id: string;
  name?: string;
  description?: string;
  price?: number;
  file_url?: string;
  thumbnail_url?: string;
}) {
  const name = args?.name ?? "テスト同人誌";
  const description = args?.description ?? "テスト説明";
  const price = args?.price ?? 500;
  const file_url = args?.file_url ?? "r2://products/sample-vol1.pdf";
  const thumbnail_url =
    args?.thumbnail_url ?? "r2://thumbnails/sample-vol1.jpg";

  const db = drizzle(env.DB!);
  const [product] = await db
    .insert(products)
    .values({
      shop_id: args.shop_id,
      name,
      description,
      price,
      file_url,
      thumbnail_url,
    })
    .returning();

  return product;
}

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

export async function deleteTestUser(userId: string) {
  const db = drizzle(env.DB!);
  await db.batch([
    db.delete(refreshTokens).where(eq(refreshTokens.user_id, userId)),
    db.delete(users).where(eq(users.id, userId)),
  ]);
}

export async function isExistTestRefreshToken(userId: string) {
  const db = drizzle(env.DB!);
  const existing = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.user_id, userId))
    .get();

  return !!existing;
}
