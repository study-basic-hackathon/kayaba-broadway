import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { products, purchases } from "../db/schema";
import { type AppType } from "../types";

const router = new Hono<AppType>();

const ItemSchema = z.object({
  product_id: z.string(),
});

router.post(
  "/create-payment-intent",
  zValidator("json", ItemSchema),
  async (c) => {
    const payload = c.get("jwtPayload");
    const db = drizzle(c.env.DB!);
    const stripe = c.get("stripe");

    const { product_id } = c.req.valid("json");

    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, product_id))
      .get();

    if (!product) return c.json({ error: "商品が見つかりません" }, 404);

    const customers = await stripe.customers.list({
      email: payload.email,
      limit: 1,
    });
    const customer =
      customers.data.length > 0
        ? customers.data[0]
        : await stripe.customers.create({ email: payload.email });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: product.price,
      currency: "jpy",
      customer: customer.id,
      setup_future_usage: "off_session",
    });

    const customerSession = await stripe.customerSessions.create({
      customer: customer.id,
      components: {
        payment_element: {
          enabled: true,
          features: {
            payment_method_save: "enabled",
            payment_method_redisplay: "enabled",
            payment_method_remove: "enabled",
          },
        },
      },
    });

    await db.insert(purchases).values({
      user_id: payload.id,
      product_id,
      payment_intent_id: paymentIntent.id,
      payment_status: "pending",
    });

    return c.json({
      clientSecret: paymentIntent.client_secret,
      customerSessionClientSecret: customerSession.client_secret,
    });
  },
);

export default router;
