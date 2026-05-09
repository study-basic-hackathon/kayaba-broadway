import { Context, Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { shops, products } from '../db/schema';
import { type AppType } from '../types';
import { SignJWT } from 'jose';

const router = new Hono<AppType>();

async function fetchShop(c: Context<AppType>, id: string) {
  const db = drizzle(c.env.DB!);
  return await db.select().from(shops).where(eq(shops.id, id)).get();
}

router.get('/', async (c) => {
  const db = drizzle(c.env.DB!);
  const shopsRecord = await db.select().from(shops).all();
  return c.json({ shops: shopsRecord });
});

router.get('/:id', async (c) => {
  const { id } = c.req.param();
  const shopRecord = await fetchShop(c, id);
  if (!shopRecord) {
    return c.json({ error: '店舗が見つかりません' }, 404);
  }
  return c.json({ shop: shopRecord });
});

router.get('/:id/products', async (c) => {
  const { id: shop_id } = c.req.param();
  const shopRecord = await fetchShop(c, shop_id);
  if (!shopRecord) {
    return c.json({ error: '店舗が見つかりません' }, 404);
  }

  const db = drizzle(c.env.DB!);
  const productsRecord = await db.select().from(products).where(eq(products.shop_id, shop_id));

  return c.json({ products: productsRecord });
});

router.get('/:id/livekit/token', async (c) => {
  const { id: shopId } = c.req.param();

  const identity = 'userId';
  const roomName = `shop-${shopId}`;

  const apiKey = c.env.LIVEKIT_API_KEY;
  const apiSecret = c.env.LIVEKIT_API_SECRET;

  const secretBytes = new TextEncoder().encode(apiSecret);
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    // LiveKit 固有の claims
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(apiKey)
    .setSubject(identity)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 30) // 30分
    .sign(key);

  return c.json({
    token: jwt,
    livekit_ws_url: c.env.LIVEKIT_WS_URL,
  });
});

export default router;
