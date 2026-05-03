import { Hono } from "hono";
import { cors } from "hono/cors";
import { createFactory } from "hono/factory";
import { jwt } from "hono/jwt";
import Stripe from "stripe";
import { ALG } from "./constants";
import auth from "./routes/auth";
import fields from "./routes/fields";
import payment from "./routes/payment";
import products from "./routes/products";
import shops from "./routes/shops";
import users from "./routes/users";
import purchase from "./routes/purchase";
import debug from "./routes/debug";
import { type AppType } from "./types";

const app = new Hono<AppType>();

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
    if (c.req.path.startsWith("/auth/") || c.req.path.startsWith("/debug/")) {
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
app.route("/purchase", purchase);
app.route("/debug", debug);
export default app;
