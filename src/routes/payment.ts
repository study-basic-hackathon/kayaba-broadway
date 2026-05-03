import {
  createStripeCustomer,
  fetchUserPayment,
  fetchProducts,
} from "@/services/payment";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import Stripe from "stripe";
import { z } from "zod";
import { type AppType } from "../types";
import { purchases, products } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

const router = new Hono<AppType>();

const lineItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int().positive(),
});

const checkoutSchema = z.object({
  field_id: z.string(),
  items: z.array(lineItemSchema).min(1),
});

router.post("/checkout", zValidator("json", checkoutSchema), async (c) => {
  const { field_id, items } = c.req.valid("json");
  const payload = c.get("jwtPayload");
  const stripe = c.get("stripe");
  const db = drizzle(c.env.DB!);

  try {
    const userPaymentRecord = await fetchUserPayment(db, payload.id);
    let customerId = userPaymentRecord?.customer_id ?? "";
    if (!userPaymentRecord) {
      const customer = await createStripeCustomer(
        stripe,
        db,
        payload.id,
        payload.email,
      );
      customerId = customer.id;
    }

    const purchaseItems = await fetchProducts(db, items);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: purchaseItems.map(({ name, price, quantity }) => ({
        price_data: {
          currency: "jpy",
          product_data: { name },
          unit_amount: price,
        },
        quantity,
      })),
      saved_payment_method_options: {
        payment_method_save: "enabled",
      },
      mode: "payment",
      metadata: {
        field_id,
        user_id: payload.id,
        product_ids: JSON.stringify(purchaseItems.map((item) => item.id)),
      },
      success_url: `http://localhost:4200/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    });

    return c.json({ url: session.url });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: "サーバーエラー" }, 500);
  }
});

router.get("/success", async (c) => {
  const sessionId = c.req.query("session_id");
  const stripe = c.get("stripe");
  const db = drizzle(c.env.DB!);

  if (!sessionId) {
    return c.json({ error: "未決済です" }, 400);
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return c.json({ error: "未決済です" }, 400);
  }

  const userId = session.metadata?.user_id;
  const fieldId = session.metadata?.field_id;
  const productIds = JSON.parse(
    session.metadata?.product_ids ?? "[]",
  ) as string[];

  if (!userId || !fieldId || productIds.length === 0) {
    return c.json({ error: "メタデータが不正です" }, 400);
  }

  // 二重購入チェック
  const existing = await db
    .select()
    .from(purchases)
    .where(eq(purchases.session_id, sessionId))
    .get();

  if (!existing) {
    await Promise.all(
      productIds.map((productId) =>
        db.insert(purchases).values({
          user_id: userId,
          product_id: productId,
          session_id: sessionId,
          payment_status: "completed",
        }),
      ),
    );
  }

  const purchasedProducts = await db
    .select()
    .from(products)
    .where(inArray(products.id, productIds));

  return c.json({
    success: true,
    field_id: fieldId,
    products: purchasedProducts.map(({ id, name, price, file_url }) => ({
      id,
      name,
      price,
      file_url,
    })),
  });
});

export default router;
