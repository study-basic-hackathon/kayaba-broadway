import { InferSelectModel } from "drizzle-orm";
import { products } from "../db/schema";
export const productList: InferSelectModel<typeof products>[] = [
  {
    id: "product-1",
    shop_id: "shop-1",
    name: "サンプル同人誌 Vol.1",
    description: "サンプルの同人誌です。",
    price: 500,
    file_url: "r2://products/sample-vol1.pdf",
    thumbnail_url: "r2://thumbnails/sample-vol1.jpg",
    created_at: 1744000000,
  },
  {
    id: "product-2",
    shop_id: "shop-1",
    name: "サンプル同人誌 Vol.2",
    description: "サンプルの同人誌の第2巻です。",
    price: 600,
    file_url: "r2://products/sample-vol2.pdf",
    thumbnail_url: "r2://thumbnails/sample-vol2.jpg",
    created_at: 1744100000,
  },
];
