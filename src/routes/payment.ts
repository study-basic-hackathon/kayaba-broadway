import { Hono } from "hono";
import { AppVariables } from "..";
import { HTTPException } from "hono/http-exception";
import Stripe from "stripe";

const router = new Hono<{
  Variables: AppVariables;
  Bindings: Env;
}>();

router.get("/setup", async (c) => {
  const stripe = c.get("stripe");
  try {
    const customer = await stripe.customers.retrieve("cus_UR3TcxmbYwv3eR");
    return c.json({ customer }, 200);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      const customer = await stripe.customers.create({
        name: "Jenny Rosen",
        email: "jennyrosen@example.com",
      });

      return c.json({ customer }, 200);
    }

    if (err instanceof Error) {
      return c.json({ error: err.message }, 500);
    }

    return c.json({ error: "サーバーエラー" }, 500);
  }
});

router.get("/checkout", async (c) => {
  const stripe = c.get("stripe");

  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: "price_1TRsxE1lp8GZIfDzFJCFOPUQ", quantity: 1 }],
    mode: "payment",
    success_url: `http://127.0.0.1:8787/payment/success`,
  });

  return c.json({ session });
});

export default router;

// router.get("/session-status", async (c) => {
//   const stripe = new Stripe(c.env.STRIPE_API_KEY);

//   const session = await stripe.checkout.sessions.retrieve(
//     c.req.query.session_id,
//     {
//       expand: ["payment_intent", "subscription"],
//     },
//   );

//   c.json({
//     status: session.status,
//     payment_status: session.payment_status,
//     payment_intent_id: session.payment_intent?.id,
//     payment_intent_status: session.payment_intent?.status,
//     subscription_id: session.payment_intent ? null : session.subscription?.id,
//     subscription_status: session.payment_intent
//       ? null
//       : session.subscription?.status,
//   });
// });

// router.get("/payment", async (c) => {
//   return c.json({ msg: "payment" });
// });
