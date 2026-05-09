// apps/api/src/index.ts
// Cloudflare Workers + Hono による LiveKit トークン発行 API

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { AccessToken, VideoGrant } from "livekit-server-sdk";
import type { TokenResponse, ErrorResponse } from "@gather/shared";

// ============================================================
// 環境変数の型定義
// .dev.vars (ローカル) / wrangler secret (本番) で注入される
// ============================================================
type Env = {
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
};

const app = new Hono<{ Bindings: Env }>();

// ============================================================
// ミドルウェア
// ============================================================

app.use("*", logger());

// CORS: フロントエンドのオリジンを許可
// 本番では allowOrigins を絞ること
app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// ============================================================
// ヘルスチェック
// ============================================================
app.get("/", (c) => c.json({ status: "ok", service: "gather-api" }));

// ============================================================
// GET /api/token
//
// クエリパラメータ:
//   room     : ルーム名 (必須)
//   identity : プレイヤーの一意 ID (必須)
//
// レスポンス: { token: string }
//
// LiveKit Cloud → フロントの LIVEKIT_URL を変えるだけで切り替え可能。
// このエンドポイントは Cloud / セルフホスト 共通で使用する。
// ============================================================
app.get("/api/token", async (c) => {
  const room     = c.req.query("room");
  const identity = c.req.query("identity");

  if (!room || !identity) {
    return c.json<ErrorResponse>(
      { error: "room と identity は必須です" },
      400
    );
  }

  const apiKey    = c.env.LIVEKIT_API_KEY;
  const apiSecret = c.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("[API] LIVEKIT_API_KEY / LIVEKIT_API_SECRET が未設定です");
    return c.json<ErrorResponse>({ error: "サーバー設定エラー" }, 500);
  }

  try {
    const grant: VideoGrant = {
      roomJoin:       true,
      room,
      canPublish:     true,
      canSubscribe:   true,
      canPublishData: true,  // LiveKit データチャンネル (将来の位置同期用)
    };

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: "30m",
    });
    token.addGrant(grant);

    const jwt = await token.toJwt();
    return c.json<TokenResponse>({ token: jwt });

  } catch (err) {
    console.error("[API] Token 発行エラー:", err);
    return c.json<ErrorResponse>(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});

// ============================================================
// 404 フォールバック
// ============================================================
app.notFound((c) =>
  c.json<ErrorResponse>({ error: "Not Found" }, 404)
);

export default app;
