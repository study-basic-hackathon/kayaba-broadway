import { InferSelectModel } from "drizzle-orm";
import { shops } from "../db/schema";

export const shopList: InferSelectModel<typeof shops>[] = [
  {
    id: "shop-1",
    field_id: "field-1",
    name: "茅場書房",
    description: "同人誌・デジタルコンテンツを幅広く取り扱うお店です。",
    position_x: 100,
    position_y: 150,
    zone_col: 10,
    zone_row: 7,
    zone_width: 7,
    zone_height: 7,
    created_at: 1744000000,
  },
];
