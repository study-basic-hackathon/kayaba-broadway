import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import Stripe from "stripe";
import { user_payment_providers } from "../db/schema";
import { type AppType, AppDatabase } from "../types";

type UserPaymentProvider = typeof user_payment_providers.$inferSelect;
const router = new Hono<AppType>();

router.get("/setup", async (c) => {
  const payload = c.get("jwtPayload");
  const stripe = c.get("stripe");
  const db = drizzle(c.env.DB!);

  const userPaymentRecord = (await db
    .select()
    .from(user_payment_providers)
    .where(eq(user_payment_providers.user_id, payload.id))
    .get()) as UserPaymentProvider | undefined;

  if (!userPaymentRecord) {
    const customer = await createStripeCustomer(
      stripe,
      db,
      payload.id,
      payload.email,
    );

    return c.json({ customer }, 200);
  }

  try {
    const customer = await stripe.customers.retrieve(
      userPaymentRecord.customer_id,
    );
    return c.json({ customer }, 200);
  } catch (err) {
    if (
      err instanceof Stripe.errors.StripeInvalidRequestError &&
      err.code === "resource_missing"
    ) {
      const customer = await createStripeCustomer(
        stripe,
        db,
        payload.id,
        payload.email,
      );

      return c.json({ customer }, 200);
    }

    if (err instanceof Error) {
      return c.json({ error: err.message }, 500);
    }

    return c.json({ error: "サーバーエラー" }, 500);
  }
});

// router.get("/checkout", async (c) => {
//   const stripe = c.get("stripe");

//   const session = await stripe.checkout.sessions.create({
//     line_items: [{ price: "price_1TRsxE1lp8GZIfDzFJCFOPUQ", quantity: 1 }],
//     mode: "payment",
//     success_url: `http://127.0.0.1:8787/payment/success`,
//   });

//   return c.json({ session });
// });

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
