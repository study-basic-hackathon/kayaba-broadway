import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { user_payment_providers } from "../db/schema";
import { AppDatabase } from "../types";
type UserPaymentProvider = typeof user_payment_providers.$inferSelect;
export async function fetchUserPayment(db: AppDatabase, user_id: string) {
  return (await db
    .select()
    .from(user_payment_providers)
    .where(eq(user_payment_providers.user_id, user_id))
    .get()) as UserPaymentProvider | undefined;
}

export async function createStripeCustomer(
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
