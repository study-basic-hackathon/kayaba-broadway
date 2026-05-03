import { eq, inArray } from "drizzle-orm";
import Stripe from "stripe";
import { user_payment_providers, products } from "../db/schema";
import { AppDatabase } from "../types";

type UserPaymentProvider = typeof user_payment_providers.$inferSelect;
type Products = typeof products.$inferSelect;
export async function fetchUserPayment(db: AppDatabase, user_id: string) {
  return (await db
    .select()
    .from(user_payment_providers)
    .where(eq(user_payment_providers.user_id, user_id))
    .get()) as UserPaymentProvider | undefined;
}

export async function fetchProducts(
  db: AppDatabase,
  items: { id: string; quantity: number }[],
) {
  const productsRecord = (await db
    .select()
    .from(products)
    .where(
      inArray(
        products.id,
        items.map((x) => x.id),
      ),
    )) as Products[];

  return productsRecord.flatMap(({ id, name, price, file_url }) => {
    const quantity = items.find((x) => x.id === id)?.quantity;
    if (!quantity) return [];
    return [
      {
        id,
        name,
        price,
        file_url,
        quantity,
      },
    ];
  });
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
