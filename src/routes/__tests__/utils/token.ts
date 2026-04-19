import { createAuthRouter } from "../../auth";
import { createTestDb } from "./db";
import { users } from "../../../db/schema";
import { hashPassword } from "../../../utils/hash";
import { ENV } from "../constants";

export async function getAccessToken() {
  const testDb = createTestDb();
  const auth = createAuthRouter(testDb);

  const sampleUser = {
    email: "test@example.com",
    password: "password",
    display_name: "testUser",
  };

  await testDb.insert(users).values({
    ...sampleUser,
    password_hash: await hashPassword(sampleUser.password),
  });

  const loginRes = await auth.request(
    "/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleUser),
    },
    ENV,
  );
  const { accessToken } = (await loginRes.json()) as { accessToken: string };
  return accessToken;
}
