import { Hono } from "hono";
import { cors } from "hono/cors";
import { createFactory } from "hono/factory";
import type { JwtVariables } from "hono/jwt";
import { jwt } from "hono/jwt";
import { ALG } from "./constants";
import auth from "./routes/auth";
import users from "./routes/users";
import shops from "./routes/shops";
import products from "./routes/products";
import fields from "./routes/fields";
import payment from "./routes/payment";
import Stripe from "stripe";

export type AppVariables = JwtVariables & {
  stripe: Stripe;
};

const app = new Hono<{
  Variables: AppVariables;
  Bindings: Env;
}>();

app.use(
  "/*",
  cors({
    origin: "http://localhost:4200",
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 600,
  }),
);

app.use("/*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
});

app.use(async (c, next) => {
  const stripe = new Stripe(c.env.STRIPE_API_KEY, {
    maxNetworkRetries: 3,
    timeout: 30 * 1000,
  });
  c.set("stripe", stripe);
  await next();
});

const factory = createFactory<{ Bindings: Env }>();
app.use(
  "/*",
  factory.createMiddleware(async (c, next) => {
    if (c.req.path.startsWith("/auth/")) {
      return next();
    }

    const jwtMiddleware = jwt({
      secret: c.env.JWT_SECRET,
      alg: ALG,
    });
    return jwtMiddleware(c, next);
  }),
);

app.route("/auth", auth);
app.route("/users", users);
app.route("/shops", shops);
app.route("/products", products);
app.route("/fields", fields);
app.route("/payment", payment);

export default app;
