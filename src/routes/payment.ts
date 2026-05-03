import { createStripeCustomer, fetchUserPayment } from "@/services/payment";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import Stripe from "stripe";
import { z } from "zod";
import { type AppType } from "../types";

const router = new Hono<AppType>();

const lineItemSchema = z.object({
  product_name: z.string(),
  unit_amount: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

const checkoutSchema = z.object({
  items: z.array(lineItemSchema).min(1),
});

router.post("/checkout", zValidator("json", checkoutSchema), async (c) => {
  const { items } = c.req.valid("json");
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: items.map(({ product_name, unit_amount, quantity }) => ({
        price_data: {
          currency: "jpy",
          product_data: { name: product_name },
          unit_amount,
        },
        quantity,
      })),
      saved_payment_method_options: {
        payment_method_save: "enabled",
      },
      mode: "payment",
      success_url: `http://127.0.0.1:8787/payment/success`,
    });

    return c.json({ url: session.url });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeError) {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: "サーバーエラー" }, 500);
  }
});

export default router;
