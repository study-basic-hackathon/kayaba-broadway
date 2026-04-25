import { InferSelectModel } from "drizzle-orm";
import { fields } from "../db/schema";

// background_url は R2 が整備されるまでローカルの仮パスを使用する
// 本番環境では R2 のパス（例: r2://fields/kayaba-broadway.png）に差し替える
export const fieldList: InferSelectModel<typeof fields>[] = [
  {
    id: "field-1",
    name: "茅場ブロードウェイ",
    description: "同人誌やホビーグッズが集まる仮想商店街です。",
    background_url: "/assets/fields/kayaba-broadway.png",
    width: 1280,
    height: 720,
    created_at: 1744000000,
  },
];
