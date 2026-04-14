import { Hono } from "hono";
import type { JwtVariables } from "hono/jwt";
import { userList } from "../data/users";
import { Bindings, User } from "../types";

const users = new Hono<{ Variables: JwtVariables; Bindings: Bindings }>();

function findUserById(id: string): User | undefined {
  return userList.find((x) => x.id === id);
}

users.get("/me", (c) => {
  const payload = c.get("jwtPayload");
  const user = findUserById(payload.sub);
  if (!user) {
    return c.json({ error: "ユーザーが見つかりません" }, 404);
  }

  const { password, ...safeUser } = user;
  return c.json({ user: safeUser });
});

export default users;
