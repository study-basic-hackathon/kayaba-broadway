// apps/frontend/src/app/services/partykit.service.ts
// PartyKit WebSocket による位置情報リアルタイム同期サービス

import angular from "angular";
import PartySocket from "partysocket";
import type {
  ClientMessage,
  ServerMessage,
  PlayerState,
} from "@gather/shared";

export interface RemotePlayer extends PlayerState {
  /** 描画用カラー (接続時にランダム割り当て) */
  color: string;
}

const PLAYER_COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
  "#1abc9c", "#3498db", "#9b59b6", "#e91e63",
];

export class PartyKitService {
  static $inject = ["$rootScope", "$timeout"];

  private socket:  PartySocket | null = null;
  private players: Map<string, RemotePlayer> = new Map();
  private colorIdx = 0;

  constructor(
    private $rootScope: angular.IRootScopeService,
    private $timeout:   angular.ITimeoutService,
  ) {}

  // ------------------------------------------------------------------
  // connect: PartyKit サーバーに接続して位置同期を開始する
  //
  // host:     "localhost:1999"  (ローカル)
  //           "<name>.<user>.partykit.dev"  (本番)
  // roomId:   ルーム名 = PartyKit の party ID
  // identity: プレイヤーの一意 ID
  // ------------------------------------------------------------------
  connect(
    host:        string,
    roomId:      string,
    identity:    string,
    displayName: string,
    startX:      number,
    startY:      number,
  ): void {
    this.disconnect();
    this.players.clear();
    this.colorIdx = 0;

    // PartySocket は自動で再接続してくれる
    this.socket = new PartySocket({
      host,
      room: roomId,
      id:   identity,
    });

    this.socket.addEventListener("open", () => {
      // 接続確立後に join メッセージを送る
      const msg: ClientMessage = {
        type: "join",
        identity,
        displayName,
        x: startX,
        y: startY,
      };
      this.socket!.send(JSON.stringify(msg));
      console.log(`[Party] connected to ${host} / ${roomId}`);
    });

    this.socket.addEventListener("message", (event: MessageEvent) => {
      this.handleMessage(event.data as string);
    });

    this.socket.addEventListener("close", () => {
      console.log("[Party] disconnected");
    });

    this.socket.addEventListener("error", (e) => {
      console.error("[Party] error", e);
    });
  }

  // 位置情報を送信する (毎フレーム or 移動時)
  sendPosition(x: number, y: number): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = { type: "position", x, y };
    this.socket.send(JSON.stringify(msg));
  }

  disconnect(): void {
    if (this.socket) {
      const leaveMsg: ClientMessage = { type: "leave" };
      try {
        if (this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify(leaveMsg));
        }
      } catch { /* ignore */ }
      this.socket.close();
      this.socket = null;
    }
    this.players.clear();
  }

  getPlayers(): RemotePlayer[] {
    return Array.from(this.players.values());
  }

  // ------------------------------------------------------------------
  // メッセージ処理
  // ------------------------------------------------------------------
  private handleMessage(raw: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw) as ServerMessage;
    } catch {
      console.warn("[Party] invalid JSON:", raw);
      return;
    }

    this.$timeout(() => {
      switch (msg.type) {
        case "room_state":
          this.players.clear();
          msg.players.forEach((p) => this.addOrUpdatePlayer(p));
          this.$rootScope.$broadcast("party:playersUpdated");
          break;

        case "player_joined":
          this.addOrUpdatePlayer(msg.player);
          this.$rootScope.$broadcast("party:playersUpdated");
          break;

        case "player_moved":
          this.updatePlayerPosition(msg.identity, msg.x, msg.y);
          // 位置更新は高頻度なので broadcast せず直接 Map を更新する
          // canvas のゲームループが getPlayers() で毎フレーム読む
          break;

        case "player_left":
          this.players.delete(msg.identity);
          this.$rootScope.$broadcast("party:playersUpdated");
          break;
      }
    });
  }

  private addOrUpdatePlayer(state: PlayerState): void {
    const existing = this.players.get(state.identity);
    const color = existing?.color ?? PLAYER_COLORS[this.colorIdx++ % PLAYER_COLORS.length];
    this.players.set(state.identity, { ...state, color });
  }

  private updatePlayerPosition(identity: string, x: number, y: number): void {
    const p = this.players.get(identity);
    if (p) {
      p.x = x;
      p.y = y;
      p.updatedAt = Date.now();
    }
  }
}

angular
  .module("gatherApp")
  .service("PartyKitService", PartyKitService);
