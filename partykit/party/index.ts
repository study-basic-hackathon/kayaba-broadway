import type * as Party from "partykit/server";

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

type UserState = {
  userId: string;
  x: number;
  y: number;
};

// フロントエンド → Partykit
type MoveMessage = {
  type: "move";
  userId: string;
  x: number;
  y: number;
};

// Partykit → フロントエンド
type JoinMessage = { type: "join"; userId: string; x: number; y: number };
type LeaveMessage = { type: "leave"; userId: string };
type InitMessage = { type: "init"; users: UserState[] };
type BroadcastMessage = MoveMessage | JoinMessage | LeaveMessage;

// ────────────────────────────────────────────
// JWT 検証（HS256）
// ────────────────────────────────────────────

async function verifyJwt(
  token: string,
  secret: string
): Promise<{ sub: string } | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = enc.encode(`${headerB64}.${payloadB64}`);
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
      c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));

    // 有効期限チェック
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────
// Partykit サーバー
// ────────────────────────────────────────────

export default class FieldRoom implements Party.Server {
  // connectionId → UserState
  private users = new Map<string, UserState>();

  constructor(readonly room: Party.Room) {}

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");

    // JWT 検証
    const secret = this.room.env.JWT_SECRET as string;
    const payload = token ? await verifyJwt(token, secret) : null;

    if (!payload) {
      conn.close(4001, "認証失敗: 無効なトークンです");
      return;
    }

    const userId = payload.sub;

    // ルームに追加（初期座標は入口 (0, 0) 固定）
    const userState: UserState = { userId, x: 0, y: 0 };
    this.users.set(conn.id, userState);

    // 接続したユーザーに現在の全ユーザー位置を返す（自分の接続は除く）
    const initMessage: InitMessage = {
      type: "init",
      users: [...this.users.entries()]
        .filter(([id]) => id !== conn.id)
        .map(([, u]) => u),
    };
    conn.send(JSON.stringify(initMessage));

    // 他のユーザー全員に join を通知
    const joinMessage: JoinMessage = { type: "join", userId, x: 0, y: 0 };
    this.room.broadcast(JSON.stringify(joinMessage), [conn.id]);
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message) as MoveMessage;

      if (data.type === "move") {
        const user = this.users.get(sender.id);
        if (user) {
          // 座標を更新
          user.x = data.x;
          user.y = data.y;

          // 送信者以外の全員にブロードキャスト
          const broadcastMsg: BroadcastMessage = {
            type: "move",
            userId: user.userId,
            x: data.x,
            y: data.y,
          };
          this.room.broadcast(JSON.stringify(broadcastMsg), [sender.id]);
        }
      }
    } catch {
      // 不正なメッセージは無視
    }
  }

  onClose(conn: Party.Connection) {
    const user = this.users.get(conn.id);
    if (user) {
      // 他のユーザー全員に leave を通知
      const leaveMessage: LeaveMessage = { type: "leave", userId: user.userId };
      this.room.broadcast(JSON.stringify(leaveMessage));
      this.users.delete(conn.id);
    }
  }
}
