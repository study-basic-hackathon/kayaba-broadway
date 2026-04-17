export type Bindings = {
  JWT_SECRET: string;
  DB: D1Database;
};

export type User = {
  id: string;
  email: string;
  password: string;
};

export type Field = {
  id: string;
  name: string;
  description: string;
  background_url: string;
  width: number;
  height: number;
  created_at: number;
};

export type Shop = {
  id: string;
  field_id: string;
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
