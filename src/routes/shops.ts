import { Context, Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { shops, products } from '../db/schema';
import { type AppType } from '../types';
import { AccessToken } from 'livekit-server-sdk';

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

router.get("/:id/livekit/token", async (c) => {
  const { id: shopId } = c.req.param();

  const identity = "userId";

  const apiKey    = c.env.LIVEKIT_API_KEY;
  const apiSecret = c.env.LIVEKIT_API_SECRET;

  // ApiKey/Secretは wrangler.toml の [vars] や Secrets から取得
  const at = new AccessToken(apiKey, apiSecret, {identity: identity});

  at.addGrant({ roomJoin: true, room: `shop-${shopId}`, canPublish: true, canSubscribe: true });

  return c.json({
    token: await at.toJwt(),
    url: c.env.LIVEKIT_WS_URL // ここでURLも返すとフロントの管理が楽です
  });
});

export default router;
