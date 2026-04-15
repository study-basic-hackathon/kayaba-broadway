export type Bindings = {
  JWT_SECRET: string;
  DB: D1Database;
};

export type User = {
  id: string;
  email: string;
  password: string;
};

export type Shop = {
  id: string;
  name: string;
  description: string;
  position_x: number;
  position_y: number;
};

export type Product = {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  price: number;
  file_url: string;
  thumbnail_url: string;
  created_at: number;
};
