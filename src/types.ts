export type Bindings = {
  JWT_SECRET: string;
  DB: D1Database;
};

export type User = {
  id: string;
  email: string;
  password: string;
};
