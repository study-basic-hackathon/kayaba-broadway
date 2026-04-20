import { env } from "cloudflare:workers";
import { sign } from "hono/jwt";
import { ALG } from "../../../constants";

export async function getAccessToken(args: { userId: number; email: string }) {
  const nowUnix = Math.floor(Date.now() / 1000);
  return sign(
    {
      id: args.userId,
      email: args.email,
      exp: nowUnix + 60 * 15,
    },
    env.JWT_SECRET,
    ALG,
  );
}
