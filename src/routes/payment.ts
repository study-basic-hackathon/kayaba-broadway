import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import Stripe from "stripe";
import { user_payment_providers } from "../db/schema";
import { type AppType, AppDatabase } from "../types";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

type UserPaymentProvider = typeof user_payment_providers.$inferSelect;
const router = new Hono<AppType>();

router.get("/setup", async (c) => {
  const payload = c.get("jwtPayload");
  const stripe = c.get("stripe");
  const db = drizzle(c.env.DB!);

  try {
    const userPaymentRecord = await fetchUserPayment(db, payload.id);
    if (userPaymentRecord) {
      return c.json({ message: "ok" }, 200);
    }

    await createStripeCustomer(stripe, db, payload.id, payload.email);
    return c.json({ message: "ok" }, 200);
  } catch (err: any) {
    if (err instanceof Error) {
      return c.json({ error: err.message }, 500);
    }
    return c.json({ error: "サーバーエラー" }, 500);
  }
});

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

    if (!userPaymentRecord) {
      return c.json({ error: "不正なユーザです" }, 404);
    }

    const session = await stripe.checkout.sessions.create({
      customer: userPaymentRecord.customer_id,
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

async function fetchUserPayment(db: AppDatabase, user_id: string) {
  return (await db
    .select()
    .from(user_payment_providers)
    .where(eq(user_payment_providers.user_id, user_id))
    .get()) as UserPaymentProvider | undefined;
}

async function createStripeCustomer(
  stripe: Stripe,
  db: AppDatabase,
  user_id: string,
  email: string,
): Promise<Stripe.Customer> {
  const customer = await stripe.customers.create({ email });
  await db.insert(user_payment_providers).values({
    user_id,
    provider: "stripe",
    customer_id: customer.id,
  });
  return customer;
}

export default router;
