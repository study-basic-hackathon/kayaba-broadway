import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  display_name: text("display_name").notNull(),
  icon_url: text("icon_url"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").notNull().unique(),
  expires_at: integer("expires_at").notNull(),
  created_at: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const fields = sqliteTable("fields", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  background_url: text("background_url"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  created_at: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const shops = sqliteTable("shops", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  field_id: text("field_id")
    .notNull()
    .references(() => fields.id),
  name: text("name").notNull(),
  description: text("description"),
  zone_col: integer("zone_col"),
  zone_row: integer("zone_row"),
  zone_width: integer("zone_width"),
  zone_height: integer("zone_height"),
  created_at: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const products = sqliteTable("products", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  shop_id: text("shop_id")
    .notNull()
    .references(() => shops.id),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  file_url: text("file_url").notNull(),
  thumbnail_url: text("thumbnail_url").notNull(),
  created_at: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});

export const purchases = sqliteTable("purchases", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  product_id: text("product_id")
    .notNull()
    .references(() => products.id),
  payment_intent_id: text("payment_intent_id").notNull(),
  purchased_at: integer("purchased_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  payment_status: text("payment_status", {
    enum: ["mock", "completed", "failed", "pending"],
  })
    .notNull()
    .default("mock"),
});

export const user_payment_providers = sqliteTable("user_payment_providers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id),
  provider: text("provider", {
    enum: ["stripe"],
  }).notNull(),
  customer_id: text("customer_id").notNull(),
  created_at: integer("created_at")
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
});
