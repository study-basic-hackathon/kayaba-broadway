import { hashPassword } from "../utils/hash";

const users = [
  { email: "tanaka.shun@example.com", displayName: "田中俊" },
  { email: "yamamoto.hana@example.com", displayName: "山本花" },
  { email: "sato.kenji@example.com", displayName: "佐藤健二" },
  { email: "inoue.mika@example.com", displayName: "井上美香" },
  { email: "kobayashi.ryo@example.com", displayName: "小林涼" },
];

for (const user of users) {
  const passwordHash = await hashPassword("password");
  console.log(
    `INSERT INTO users (email, password_hash, display_name, created_at) VALUES ('${user.email}', '${passwordHash}', '${user.displayName}', unixepoch());`,
  );
}
