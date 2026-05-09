// apps/frontend/src/app/controllers/world.controller.ts
// メインコントローラー
// ゲームループ / 近接チェック / LiveKit 接続管理 / PartyKit 位置同期 を統合する

import angular from "angular";
import type { LiveKitService }  from "../services/livekit.service";
import type { PartyKitService, RemotePlayer } from "../services/partykit.service";
import type { RemoteTrack, RemoteParticipant } from "livekit-client";
import { ENV } from "../app.module";
import { PROXIMITY } from "@gather/shared";

// ============================================================
// 型定義
// ============================================================

interface Config {
  displayName: string;
  roomName:    string;
  livekitUrl:  string;
  apiBase:     string;
  partyHost:   string;
}

interface ChatParticipant {
  identity: string;
}

interface MyPlayer {
  x: number;
  y: number;
  name: string;
}

// ============================================================
// コントローラー
// ============================================================

class WorldController {
  static $inject = ["$scope", "$timeout", "LiveKitService", "PartyKitService"];

  // --- テンプレートバインディング ---
  started     = false;
  starting    = false;
  connecting  = false;
  chat        = { connected: false, participants: [] as ChatParticipant[] };
  nearbyName: string | null = null;
  micMuted    = false;
  camOff      = false;
  errorMsg: string | null = null;
  playerCount = 1;

  cfg: Config = {
    displayName: "Player" + Math.floor(Math.random() * 100),
    roomName:    "world-1",
    livekitUrl:  ENV.LIVEKIT_URL,
    apiBase:     ENV.API_BASE_URL,
    partyHost:   ENV.PARTYKIT_HOST,
  };

  // --- 内部状態 ---
  private canvas!: HTMLCanvasElement;
  private ctx!:    CanvasRenderingContext2D;
  private raf:     number = 0;
  private keys:    Record<string, boolean> = {};

  private myPlayer: MyPlayer = { x: 500, y: 350, name: "" };

  // 近接管理
  private proxConnected = false;   // 近接トリガーによる接続状態
  private manualDisc    = false;   // 手動切断フラグ（再接続抑制）
  private lastNearbyId: string | null = null;

  // 位置送信の throttle
  private lastSentPos = { x: -1, y: -1 };
  private readonly POS_THRESHOLD = 2;  // px 以上動いたら送信

  // 描画定数
  private readonly GRID    = 48;
  private readonly SPEED   = 3.2;
  private readonly CAM_TOP = 164;  // ビデオバーが開いたときの上部マージン (px)

  constructor(
    private $scope:          angular.IScope,
    private $timeout:        angular.ITimeoutService,
    private LiveKitService:  LiveKitService,
    private PartyKitService: PartyKitService,
  ) {}

  // ============================================================
  // セットアップ
  // ============================================================

  start(): void {
    if (!this.cfg.displayName) this.cfg.displayName = "Player";
    this.myPlayer.name = this.cfg.displayName;
    this.started = true;
    this.$timeout(() => this.initWorld(), 60);
  }

  // ============================================================
  // コントロール
  // ============================================================

  manualDisconnect(): void {
    this.manualDisc    = true;
    this.proxConnected = false;
    this.doDisconnect();
  }

  toggleMic(): void {
    this.micMuted = !this.micMuted;
    this.LiveKitService.setMicEnabled(!this.micMuted);
  }

  toggleCam(): void {
    this.camOff = !this.camOff;
    this.LiveKitService.setCamEnabled(!this.camOff);
  }

  // ============================================================
  // ワールド初期化
  // ============================================================

  private initWorld(): void {
    this.canvas = document.getElementById("worldCanvas") as HTMLCanvasElement;
    this.ctx    = this.canvas.getContext("2d")!;

    this.resize();
    this.myPlayer.x = this.canvas.width  / 2;
    this.myPlayer.y = this.canvas.height / 2;

    // PartyKit 位置同期に接続
    this.PartyKitService.connect(
      this.cfg.partyHost,
      this.cfg.roomName,
      this.cfg.displayName + "-" + Date.now(),
      this.cfg.displayName,
      this.myPlayer.x,
      this.myPlayer.y,
    );

    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup",   this.onKey);
    window.addEventListener("resize",  this.resize);

    let prev = 0;
    const loop = (ts: number) => {
      const dt = Math.min((ts - prev) / 16.67, 3);
      prev = ts;
      this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private onKey = (e: KeyboardEvent) => {
    this.keys[e.key] = e.type === "keydown";
  };

  private resize = () => {
    if (!this.canvas) return;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  // ============================================================
  // ゲームループ
  // ============================================================

  private tick(dt: number): void {
    // 自分を移動
    if (this.keys["ArrowLeft"]  || this.keys["a"] || this.keys["A"]) this.myPlayer.x -= this.SPEED * dt;
    if (this.keys["ArrowRight"] || this.keys["d"] || this.keys["D"]) this.myPlayer.x += this.SPEED * dt;
    if (this.keys["ArrowUp"]    || this.keys["w"] || this.keys["W"]) this.myPlayer.y -= this.SPEED * dt;
    if (this.keys["ArrowDown"]  || this.keys["s"] || this.keys["S"]) this.myPlayer.y += this.SPEED * dt;

    this.myPlayer.x = Math.max(24, Math.min(this.canvas.width  - 24, this.myPlayer.x));
    this.myPlayer.y = Math.max(24, Math.min(this.canvas.height - 24, this.myPlayer.y));

    // 位置を PartyKit に送信 (移動量が閾値を超えた場合のみ)
    const dx = this.myPlayer.x - this.lastSentPos.x;
    const dy = this.myPlayer.y - this.lastSentPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > this.POS_THRESHOLD) {
      this.PartyKitService.sendPosition(this.myPlayer.x, this.myPlayer.y);
      this.lastSentPos = { ...this.myPlayer };
    }

    this.proximityCheck();
    this.draw();
  }

  // ============================================================
  // 近接チェック
  // ============================================================

  private proximityCheck(): void {
    const others = this.PartyKitService.getPlayers();
    this.playerCount = 1 + others.length;

    let nearest:     RemotePlayer | null = null;
    let nearestDist  = Infinity;

    for (const p of others) {
      const d = this.dist2d(this.myPlayer, p);
      if (d < nearestDist) { nearestDist = d; nearest = p; }
    }

    // トースト表示
    const newNearby = (nearest && nearestDist < PROXIMITY.TOAST_DIST && !this.proxConnected)
      ? nearest.displayName : null;

    if (newNearby !== this.lastNearbyId) {
      this.lastNearbyId = newNearby;
      this.$scope.$applyAsync(() => { this.nearbyName = newNearby; });
    }

    // 接続トリガー
    if (
      !this.proxConnected &&
      !this.connecting &&
      !this.manualDisc &&
      nearest &&
      nearestDist < PROXIMITY.CONNECT_DIST
    ) {
      this.proxConnected = true;
      this.doConnect();
      return;
    }

    // 切断トリガー (ヒステリシス)
    if (this.proxConnected && nearestDist > PROXIMITY.DISCONNECT_DIST) {
      this.proxConnected = false;
      this.manualDisc    = false;
      this.doDisconnect();
    }
  }

  private dist2d(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ============================================================
  // LiveKit 接続 / 切断
  // ============================================================

  private async doConnect(): Promise<void> {
    this.$scope.$applyAsync(() => {
      this.connecting = true;
      this.errorMsg   = null;
    });

    try {
      const token = await this.fetchToken();
      await this.LiveKitService.connect(this.cfg.livekitUrl, token);

      this.$scope.$applyAsync(() => {
        this.chat.connected = true;
        this.nearbyName     = null;
        this.connecting     = false;
      });

      // ng-if で DOM 生成が完了してからアタッチ
      this.$timeout(() => this.attachLocalVideo(), 400);

    } catch (err) {
      console.error("[World] Connect error:", err);
      this.proxConnected = false;
      this.$scope.$applyAsync(() => {
        this.connecting = false;
        this.nearbyName = null;
      });
      this.showError("接続に失敗しました: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  private async doDisconnect(): Promise<void> {
    await this.LiveKitService.disconnect();
    this.$scope.$applyAsync(() => {
      this.chat.connected    = false;
      this.chat.participants = [];
      this.connecting        = false;
      this.micMuted          = false;
      this.camOff            = false;
    });
  }

  // ============================================================
  // Token 取得 (Cloudflare Workers / Hono API)
  // ============================================================

  private async fetchToken(): Promise<string> {
    const url =
      `${this.cfg.apiBase}/api/token` +
      `?room=${encodeURIComponent(this.cfg.roomName)}` +
      `&identity=${encodeURIComponent(this.cfg.displayName)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { token: string };
    return data.token;
  }

  // ============================================================
  // ローカルビデオのアタッチ
  // ============================================================

  private attachLocalVideo(): void {
    const track = this.LiveKitService.getLocalVideoTrack();
    const el    = document.getElementById("local-video") as HTMLVideoElement | null;
    if (track && el) track.attach(el);
  }

  // ============================================================
  // LiveKit イベントハンドラ ($scope.$on)
  // ============================================================

  $onInit?(): void {}

  // AngularJS コントローラーでは $scope.$on をコンストラクタ外で登録できないため
  // $scope に直接リスナーを追加する
  // (WorldController は as vm でバインドするため $scope は DI で受け取る)

  // ---- ↓ app.module が初期化される前に呼ばれるため $scope.$on はここで登録 ----

  private _registerListeners(): void {
    this.$scope.$on(
      "lk:participantConnected",
      (_: angular.IAngularEvent, p: RemoteParticipant) => {
        if (!this.chat.participants.some((x) => x.identity === p.identity)) {
          this.chat.participants.push({ identity: p.identity });
        }
      }
    );

    this.$scope.$on(
      "lk:participantDisconnected",
      (_: angular.IAngularEvent, p: RemoteParticipant) => {
        this.chat.participants = this.chat.participants.filter(
          (x) => x.identity !== p.identity
        );
      }
    );

    this.$scope.$on(
      "lk:trackSubscribed",
      (_: angular.IAngularEvent, payload: { track: RemoteTrack; participant: RemoteParticipant }) => {
        const { track, participant } = payload;
        const id = participant.identity;

        if (!this.chat.participants.some((x) => x.identity === id)) {
          this.chat.participants.push({ identity: id });
        }

        // DOM 生成 (ng-repeat) を待ってからアタッチ
        this.$timeout(() => {
          const elId = track.kind === "video" ? `rv-${id}` : `ra-${id}`;
          const el   = document.getElementById(elId) as HTMLVideoElement | HTMLAudioElement | null;
          if (el) track.attach(el);
        }, 200);
      }
    );

    this.$scope.$on(
      "lk:trackUnsubscribed",
      (_: angular.IAngularEvent, payload: { track: RemoteTrack }) => {
        payload.track.detach();
      }
    );

    this.$scope.$on("lk:disconnected", () => {
      this.chat.connected    = false;
      this.chat.participants = [];
      this.proxConnected     = false;
    });

    this.$scope.$on("$destroy", () => {
      if (this.raf) cancelAnimationFrame(this.raf);
      window.removeEventListener("keydown", this.onKey);
      window.removeEventListener("keyup",   this.onKey);
      window.removeEventListener("resize",  this.resize);
      this.LiveKitService.disconnect();
      this.PartyKitService.disconnect();
    });
  }

  // ============================================================
  // エラー表示
  // ============================================================

  private showError(msg: string): void {
    this.$scope.$applyAsync(() => { this.errorMsg = msg; });
    this.$timeout(() => { this.errorMsg = null; }, 5000);
  }

  // ============================================================
  // Canvas 描画
  // ============================================================

  private draw(): void {
    const W = this.canvas.width, H = this.canvas.height;
    const topOffset = this.chat.connected ? this.CAM_TOP : 0;
    this.ctx.clearRect(0, 0, W, H);

    // 背景
    this.ctx.fillStyle = "#0f0f1a";
    this.ctx.fillRect(0, 0, W, H);

    // グリッド
    this.ctx.strokeStyle = "rgba(255,255,255,0.04)";
    this.ctx.lineWidth   = 1;
    for (let x = 0; x < W; x += this.GRID) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, H); this.ctx.stroke();
    }
    for (let y = topOffset; y < H; y += this.GRID) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(W, y); this.ctx.stroke();
    }

    this.drawDecorations(W, H);

    const others = this.PartyKitService.getPlayers();
    for (const p of others) {
      const d = this.dist2d(this.myPlayer, p);
      this.drawProximityRing(p, d);
      this.drawAvatar(p.x, p.y, p.displayName, p.color, false);
    }

    // 自プレイヤー (最前面)
    this.drawAvatar(this.myPlayer.x, this.myPlayer.y, this.myPlayer.name, "#4e54c8", true);

    // 接続インジケーター
    if (this.chat.connected) {
      this.ctx.fillStyle  = "#2ecc71";
      this.ctx.shadowColor = "#2ecc71";
      this.ctx.shadowBlur  = 8;
      this.ctx.beginPath();
      this.ctx.arc(this.myPlayer.x + 16, this.myPlayer.y - 16, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
  }

  private drawProximityRing(p: { x: number; y: number }, d: number): void {
    if (d > PROXIMITY.TOAST_DIST * 1.2) return;
    const connected = d < PROXIMITY.CONNECT_DIST;

    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, PROXIMITY.CONNECT_DIST, 0, Math.PI * 2);
    this.ctx.fillStyle = connected
      ? "rgba(78,84,200,0.10)" : "rgba(255,255,255,0.02)";
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, PROXIMITY.CONNECT_DIST, 0, Math.PI * 2);
    this.ctx.strokeStyle = connected
      ? "rgba(78,84,200,0.55)" : "rgba(255,255,255,0.12)";
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([6, 5]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 距離ラベル
    if (d < PROXIMITY.TOAST_DIST) {
      const mx = (this.myPlayer.x + p.x) / 2;
      const my = (this.myPlayer.y + p.y) / 2;
      this.ctx.fillStyle = d < PROXIMITY.CONNECT_DIST
        ? "rgba(120,130,255,0.9)" : "rgba(255,255,255,0.3)";
      this.ctx.font      = "11px monospace";
      this.ctx.textAlign = "center";
      this.ctx.fillText(`${Math.round(d)}px`, mx, my - 8);
      this.ctx.textAlign = "left";
    }
  }

  private drawAvatar(x: number, y: number, name: string, color: string, isMe: boolean): void {
    const r = isMe ? 22 : 18;
    this.ctx.save();
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur  = isMe ? 22 : 10;
    this.ctx.fillStyle   = color;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.strokeStyle = isMe ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)";
    this.ctx.lineWidth   = isMe ? 2.5 : 1.5;
    this.ctx.stroke();

    this.ctx.fillStyle    = "#fff";
    this.ctx.font         = `bold ${isMe ? 13 : 12}px sans-serif`;
    this.ctx.textAlign    = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(name.charAt(0).toUpperCase(), x, y);
    this.ctx.textBaseline = "alphabetic";

    this.ctx.font = `${isMe ? 12 : 11}px sans-serif`;
    const tagW = this.ctx.measureText(name).width + 16;
    this.ctx.fillStyle = "rgba(0,0,0,0.68)";
    this.roundRect(x - tagW / 2, y + r + 4, tagW, 18, 4);
    this.ctx.fill();
    this.ctx.fillStyle = "#fff";
    this.ctx.fillText(name, x, y + r + 17);
    this.ctx.textAlign = "left";
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.arcTo(x + w, y, x + w, y + r, r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.arcTo(x, y + h, x, y + h - r, r);
    this.ctx.lineTo(x, y + r);
    this.ctx.arcTo(x, y, x + r, y, r);
    this.ctx.closePath();
  }

  private drawDecorations(W: number, H: number): void {
    const tables = [
      { x: 160, y: 160 }, { x: W - 160, y: 160 },
      { x: 160, y: H - 160 }, { x: W - 160, y: H - 160 },
    ];
    for (const t of tables) {
      this.ctx.fillStyle   = "rgba(255,255,255,0.04)";
      this.ctx.strokeStyle = "rgba(255,255,255,0.07)";
      this.ctx.lineWidth   = 1;
      this.roundRect(t.x - 38, t.y - 26, 76, 52, 8);
      this.ctx.fill(); this.ctx.stroke();
    }
    const plants = [
      { x: 80, y: 80 }, { x: W - 80, y: 80 },
      { x: 80, y: H - 80 }, { x: W - 80, y: H - 80 },
    ];
    for (const p of plants) {
      this.ctx.fillStyle   = "rgba(46,204,113,0.12)";
      this.ctx.strokeStyle = "rgba(46,204,113,0.3)";
      this.ctx.lineWidth   = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
      this.ctx.fill(); this.ctx.stroke();
      this.ctx.font         = "20px sans-serif";
      this.ctx.textAlign    = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillStyle    = "#fff";
      this.ctx.fillText("🌿", p.x, p.y);
      this.ctx.textBaseline = "alphabetic";
      this.ctx.textAlign    = "left";
    }
  }
}

// AngularJS はコントローラーのコンストラクタ完了後にリスナーを登録する
// 仕組みとして $onInit を使う（component スタイル）
// ここでは Factory でラップして _registerListeners() を自動実行する
angular
  .module("gatherApp")
  .controller("WorldController", [
    "$scope", "$timeout", "LiveKitService", "PartyKitService",
    function (
      $scope:          angular.IScope,
      $timeout:        angular.ITimeoutService,
      LiveKitService:  LiveKitService,
      PartyKitService: PartyKitService,
    ) {
      const vm = new WorldController($scope, $timeout, LiveKitService, PartyKitService);
      // プライベートメソッドを呼ぶために型アサーション
      (vm as any)._registerListeners();
      return vm;
    }
  ]);
