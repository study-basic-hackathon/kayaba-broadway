import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { type AppType } from "../types";

const router = new Hono<AppType>();

const ItemSchema = z.object({
  amount: z.number().int().positive(),
});

router.post(
  "/create-payment-intent",
  zValidator("json", ItemSchema),
  async (c) => {
    const payload = c.get("jwtPayload");
    const stripe = c.get("stripe");

    const { amount } = c.req.valid("json");

    const customers = await stripe.customers.list({
      email: payload.email,
      limit: 1,
    });
    const customer =
      customers.data.length > 0
        ? customers.data[0]
        : await stripe.customers.create({ email: payload.email });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
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

    return c.json({
      clientSecret: paymentIntent.client_secret,
      customerSessionClientSecret: customerSession.client_secret,
    });
  },
);

export default router;
