import type * as Party from "partykit/server";

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

type UserState = {
  userId: string;
  x: number;
  y: number;
};

const FIELD_MIN_X = 0;
const FIELD_MAX_X = 5000;
const FIELD_MIN_Y = 0;
const FIELD_MAX_Y = 5000;

function isValidCoordinate(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

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

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = base64.length % 4;
  const padded = remainder === 0 ? base64 : base64 + "=".repeat(4 - remainder);
  return atob(padded);
}

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
    const signature = Uint8Array.from(decodeBase64Url(signatureB64), (c) =>
      c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(decodeBase64Url(payloadB64)) as Record<
      string,
      unknown
    >;

    // 有効期限チェック
    if (
      typeof payload.exp === "number" &&
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }

    return { sub: payload.sub };
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

  private findUserStateByUserId(userId: string): UserState | undefined {
    return [...this.users.values()].find((user) => user.userId === userId);
  }

  private hasUserConnection(userId: string): boolean {
    return this.findUserStateByUserId(userId) !== undefined;
  }

  private listUniqueUsers(excludeUserId?: string): UserState[] {
    const usersByUserId = new Map<string, UserState>();

    for (const user of this.users.values()) {
      if (user.userId === excludeUserId) {
        continue;
      }

      if (!usersByUserId.has(user.userId)) {
        usersByUserId.set(user.userId, user);
      }
    }

    return [...usersByUserId.values()];
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");

    // JWT 検証
    const secret = this.room.env.JWT_SECRET;
    if (typeof secret !== "string" || secret.length === 0) {
      conn.close(1011, "サーバー設定エラー: JWT_SECRET が未設定です");
      return;
    }

    const payload = token ? await verifyJwt(token, secret) : null;

    if (!payload) {
      conn.close(4001, "認証失敗: 無効なトークンです");
      return;
    }

    const userId = payload.sub;
    const existingUserState = this.findUserStateByUserId(userId);
    const hadExistingConnection = existingUserState !== undefined;

    // 同一 userId の複数接続では同じ UserState を共有し、座標の正本を 1 つに保つ
    const userState: UserState = existingUserState ?? { userId, x: 0, y: 0 };
    this.users.set(conn.id, userState);

    // 接続したユーザーに現在の全ユーザー位置を返す（同一 userId は重複除外し、自分自身は除く）
    const initMessage: InitMessage = {
      type: "init",
      users: this.listUniqueUsers(userId),
    };
    conn.send(JSON.stringify(initMessage));

    // その userId の最初の接続時のみ、他のユーザー全員に join を通知
    if (!hadExistingConnection) {
      const joinMessage: JoinMessage = { type: "join", userId, x: 0, y: 0 };
      this.room.broadcast(JSON.stringify(joinMessage), [conn.id]);
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message) as MoveMessage;

      if (data.type === "move") {
        const user = this.users.get(sender.id);
        if (user) {
          if (
            !isValidCoordinate(data.x, FIELD_MIN_X, FIELD_MAX_X) ||
            !isValidCoordinate(data.y, FIELD_MIN_Y, FIELD_MAX_Y)
          ) {
            return;
          }

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
      this.users.delete(conn.id);

      // 同一 userId の接続がすべて閉じたときだけ leave を通知
      if (!this.hasUserConnection(user.userId)) {
        const leaveMessage: LeaveMessage = { type: "leave", userId: user.userId };
        this.room.broadcast(JSON.stringify(leaveMessage));
      }
    }
  }
}
