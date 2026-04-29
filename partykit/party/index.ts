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
  message_type: "move";
  data: { x: number; y: number };
};

// Partykit → フロントエンド
type MoveBroadcastMessage = {
  message_type: "move";
  data: { userId: string; x: number; y: number };
};
type JoinMessage = { message_type: "join"; data: { userId: string; x: number; y: number } };
type LeaveMessage = { message_type: "leave"; data: { userId: string } };
type InitMessage = { message_type: "init"; data: { users: UserState[] } };
type BroadcastMessage = MoveBroadcastMessage | JoinMessage | LeaveMessage;

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
): Promise<{ id: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
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

    if (typeof payload.id !== "string" || payload.id.length === 0) {
      return null;
    }

    return { id: payload.id };
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
    for (const user of this.users.values()) {
      if (user.userId === userId) {
        return user;
      }
    }

    return undefined;
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

  private getTokenFromConnectionRequest(request: Request): string | null {
    const url = new URL(request.url);
    return url.searchParams.get("token");
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const token = this.getTokenFromConnectionRequest(ctx.request);

    // JWT 検証
    const secret = this.room.env.JWT_SECRET;
    if (typeof secret !== "string" || secret.length === 0) {
      conn.close(1011, "サーバー設定エラー: JWT_SECRET が未設定です");
      return;
    }

    const payload = token ? await verifyJwt(token, secret) : null;

    if (!payload) {
      conn.close(4001, "Unauthorized");
      return;
    }

    const userId = payload.id;
    const existingUserState = this.findUserStateByUserId(userId);
    const hadExistingConnection = existingUserState !== undefined;

    // 同一 userId の複数接続では同じ UserState を共有し、座標の正本を 1 つに保つ
    const userState: UserState = existingUserState ?? { userId, x: 0, y: 0 };
    this.users.set(conn.id, userState);

    // 接続したユーザーに現在の全ユーザー位置を返す（同一 userId は重複除外し、自分自身は除く）
    const initMessage: InitMessage = {
      message_type: "init",
      data: { users: this.listUniqueUsers(userId) },
    };
    conn.send(JSON.stringify(initMessage));

    // その userId の最初の接続時のみ、他のユーザー全員に join を通知
    if (!hadExistingConnection) {
      const joinMessage: JoinMessage = { message_type: "join", data: { userId, x: 0, y: 0 } };
      this.room.broadcast(JSON.stringify(joinMessage), [conn.id]);
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const msg = JSON.parse(message) as MoveMessage;

      if (msg.message_type === "move") {
        const user = this.users.get(sender.id);
        if (user) {
          if (
            !isValidCoordinate(msg.data.x, FIELD_MIN_X, FIELD_MAX_X) ||
            !isValidCoordinate(msg.data.y, FIELD_MIN_Y, FIELD_MAX_Y)
          ) {
            return;
          }

          // 座標を更新
          user.x = msg.data.x;
          user.y = msg.data.y;

          // 送信者以外の全員にブロードキャスト
          const broadcastMsg: BroadcastMessage = {
            message_type: "move",
            data: { userId: user.userId, x: msg.data.x, y: msg.data.y },
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
        const leaveMessage: LeaveMessage = { message_type: "leave", data: { userId: user.userId } };
        this.room.broadcast(JSON.stringify(leaveMessage));
      }
    }
  }
}
