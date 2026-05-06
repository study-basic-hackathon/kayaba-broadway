import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  effect,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import PartySocket from 'partysocket';
import { Application, Assets, Text as PixiText, Rectangle, Sprite, Texture } from 'pixi.js';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ShopChatService } from '../../services/shop-chat.service';
import { OshinagakiModalComponent } from '../oshinagaki-modal/oshinagaki-modal.component';

interface Shop {
  id: string;
  name: string;
  zone_col: number | null;
  zone_row: number | null;
  zone_width: number | null;
  zone_height: number | null;
}

interface OtherPlayer {
  id: string;
  displayName: string;
  graphics: Sprite;
  label: PixiText;
  direction: 'down' | 'left' | 'right' | 'up';
  frame: number;
  animationCounter: number;
}

interface Product {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price: number;
  file_url: string;
  thumbnail_url: string;
  created_at: number;
}

interface ProductsResponse {
  products: Product[];
}

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [FormsModule, DatePipe, OshinagakiModalComponent],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements OnInit, OnDestroy {
  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;
  @ViewChild('chatMessages') chatMessagesEl?: ElementRef<HTMLDivElement>;
  @ViewChild('paymentElement') paymentElementRef!: ElementRef;

  private app!: Application;
  private player!: Sprite;
  private playerLabel!: PixiText;

  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private ngZone = inject(NgZone);
  private http = inject(HttpClient);
  shopChatService = inject(ShopChatService);

  chatInputText = '';

  // 店舗ゾーン判定用
  private shops: Shop[] = [];
  currentShop = signal<Shop | null>(null);

  isOshinagakiModalOpen = false;

  menuItems: Product[] = [
    {
      id: 'c3d4e5f6-0001-0000-0000-000000000001',
      shop_id: '',
      file_url: './assets/items/01.png',
      name: 'コーヒー選曲',
      description: '苦々しい雰囲気の大人なBGMを詰め込んでいます。',
      price: 300,
      thumbnail_url: '',
      created_at: 0,
    },
    {
      id: 'c3d4e5f6-0001-0000-0000-000000000002',
      shop_id: '',
      file_url: './assets/items/02.png',
      name: 'ショートケーキ選曲',
      description: '甘い雰囲気のポップなBGMを詰め込んでいます。',
      price: 500,
      thumbnail_url: '',
      created_at: 0,
    },
  ];

  constructor(private cdr: ChangeDetectorRef) {
    // currentShop が変化したら shop チャットの接続・切断を制御する
    effect(() => {
      const shop = this.currentShop();
      if (shop) {
        const token = this.auth.getAccessToken();
        this.shopChatService.connect(shop.id, token);
      } else {
        this.shopChatService.disconnect();
      }
    });

    // メッセージが増えたら、DOM更新後に確実に一番下までスクロール
    effect(() => {
      this.shopChatService.messages();
      setTimeout(() => {
        if (this.chatMessagesEl) {
          const el = this.chatMessagesEl.nativeElement;
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }

  products = signal<Product[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  sendChatMessage() {
    const text = this.chatInputText.trim();
    if (!text) return;
    const sent = this.shopChatService.sendMessage(text);
    if (sent) {
      this.chatInputText = '';
    }
  }

  get currentUserId(): string | undefined {
    // auth.user() が null の場合（Safari ITP によるリフレッシュ失敗時など）は
    // localStorage のアクセストークンから userId を取り出してフォールバック
    return this.auth.user()?.id ?? this.auth.getUserIdFromToken();
  }

  // 現在押されているキーを管理するオブジェクト
  private keys: Record<string, boolean> = {};

  // プレイヤーの移動速度（px/フレーム）
  private speed = 4;

  private socket!: PartySocket;
  private otherPlayers = new Map<string, OtherPlayer>();

  // プレイヤーの初期位置（移動範囲の中央付近）
  private x = 896;
  private y = 736;

  // タイル1枚のサイズ（roguelikeSheet_transparent.tsxの tilewidth/tileheight から取得）
  private tileSize = 16;

  // タイルの拡大倍率（16px → 64pxに拡大）
  private scale = 4;

  // マップのタイル数（Tiledで設定した値）
  private mapCols = 28; // 横方向のタイル数
  private mapRows = 23; // 縦方向のタイル数

  // 移動範囲のピクセルサイズ（タイルサイズ × 拡大倍率 × タイル数）
  private width = this.tileSize * this.scale * this.mapCols; // 16 * 4 * 28 = 1792px
  private height = this.tileSize * this.scale * this.mapRows; // 16 * 4 * 23 = 1472px

  // 当たり判定があるタイルのインデックスを管理するSet
  private collisionTiles = new Set<number>();

  //プレイヤー関係の関数
  private playerBaseTexture!: Texture;
  private playerFrameWidth = 32;
  private playerFrameHeight = 32;
  private playerDirection: 'down' | 'left' | 'right' | 'up' = 'down';
  private playerFrame = 0;
  private animationCounter = 0;
  private animationSpeed = 16; // 数値が大きいほどプレイヤーアニメーションがゆっくりになる
  private walkFrameCount = 3;

  private tileScaled = this.tileSize * this.scale;
  private hitCharacter = (this.tileSize * this.scale) / 2;

  // タッチ操作用：スワイプ開始位置
  private touchStartX = 0;
  private touchStartY = 0;
  // タッチ中の仮想キー入力
  private touchKeys: Record<string, boolean> = {};

  async ngOnInit() {
    await this.initPixi();
    const fieldId = this.route.snapshot.paramMap.get('fieldId') ?? 'field-1';
    this.initSocket(fieldId);
    this.initInput();
    // 毎フレームupdateを呼ぶ（loadShopsより先に起動して移動を妨げないようにする）
    this.app.ticker.add(() => this.update());
    // 店舗情報は非同期で取得（失敗しても移動には影響しない）
    this.loadShops(fieldId);
    const shopId = 'a1b2c3d4-0001-0000-0000-000000000001';
    this.http.get<ProductsResponse>(`${environment.apiBaseUrl}/shops/${shopId}/products`).subscribe({
      next: (data) => {
        this.products.set([data.products[0]]);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('商品の取得に失敗しました');
        this.isLoading.set(false);
      },
    });
  }

  private async loadShops(fieldId: string) {
    const token = this.auth.getAccessToken();
    try {
      const res = await fetch(`${environment.apiBaseUrl}/fields/${fieldId}/shops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { shops: Shop[] };
      this.shops = data.shops;
    } catch (e) {
      console.error('店舗情報の取得に失敗しました', e);
    }
  }

  private async initPixi() {
    this.app = new Application();
    await this.app.init({
      width: window.innerWidth,
      height: window.innerHeight,
    });
    this.gameContainer.nativeElement.appendChild(this.app.canvas);

    // タイルマップを描画
    await this.loadMap();

    // 自分のプレイヤー表示
    this.playerBaseTexture = await Assets.load('/assets/character/ghost.png');

    const texture = this.getPlayerTexture('down', 0);

    this.player = new Sprite(texture);
    this.player.anchor.set(0.5);
    this.player.x = this.x;
    this.player.y = this.y;
    this.player.width = this.tileScaled;
    this.player.height = this.tileScaled;
    this.app.stage.addChild(this.player);

    // 自分の名前ラベルを表示
    const displayName = this.auth.user()?.display_name ?? '';
    this.playerLabel = new PixiText({
      text: displayName,
      style: { fontSize: 12, fill: 0xffffff },
    });
    this.playerLabel.x = this.x;
    this.playerLabel.y = this.y - 28;
    this.playerLabel.anchor.set(0.5);
    this.app.stage.addChild(this.playerLabel);

    // 初期カメラ位置をプレイヤーが画面中央になるように設定
    this.app.stage.x = this.app.screen.width / 2 - this.x;
    this.app.stage.y = this.app.screen.height / 2 - this.y;
  }

  //キャラクタースプライトシートを区切って出力
  private getPlayerTexture(
    direction: 'down' | 'left' | 'right' | 'up',
    frameIndex: number,
  ): Texture {
    const directionRows = {
      down: 0,
      left: 1,
      right: 2,
      up: 3,
    } as const;

    const row = directionRows[direction];

    return new Texture({
      source: this.playerBaseTexture.source,
      frame: new Rectangle(
        frameIndex * this.playerFrameWidth,
        row * this.playerFrameHeight,
        this.playerFrameWidth,
        this.playerFrameHeight,
      ),
    });
  }

  private async loadMap() {
    // ピクセルアートをぼやけなく拡大するためにニアレストネイバー補間を設定
    // Assets.loadより前に呼ぶ必要がある
    Assets.setPreferences({ preferWorkers: false });

    await Assets.load([
      { alias: 'tileset', src: './assets/map/roguelikeSheet_transparent.png' },
      { alias: 'mapData', src: './assets/map/map.json' },
    ]);

    const mapData = Assets.get('mapData');
    const tileTexture = Assets.get('tileset');

    // ピクセルアートをくっきり表示するためにニアレストネイバー補間を設定
    tileTexture.source.scaleMode = 'nearest';
    tileTexture.source.update();

    // タイル間のスペーシング（roguelikeSheet_transparent.tsxの spacing="1" から取得）
    const spacing = 1;

    // タイルセット画像の列数（roguelikeSheet_transparent.tsxの columns="57" から取得）
    const columns = 57;

    // タイル1枚のサイズ（map.jsonの tilewidth/tileheight から取得）
    const tileWidth: number = mapData.tilewidth; // 16px
    const tileHeight: number = mapData.tileheight; // 16px

    mapData.layers.forEach((layer: any) => {
      // collisionレイヤーは描画せず当たり判定として使う
      if (layer.name === 'collision') {
        layer.data.forEach((tileId: number, index: number) => {
          if (tileId !== 0) {
            this.collisionTiles.add(index);
          }
        });
        return;
      }

      // 描画レイヤー
      layer.data.forEach((tileId: number, index: number) => {
        // tileId=0 は空タイルなのでスキップ
        if (tileId === 0) return;

        // TiledのtileIdは1始まりなので0始まりに変換
        const tileIndex = tileId - 1;

        // タイルセット画像上の切り出し位置を計算
        // spacing分ずらして隣のタイルが混入しないようにする
        const srcX = (tileIndex % columns) * (tileWidth + spacing);
        const srcY = Math.floor(tileIndex / columns) * (tileHeight + spacing);

        // タイルセット画像から該当タイルを切り出してテクスチャを作成
        const texture = new Texture({
          source: tileTexture.source,
          frame: new Rectangle(srcX, srcY, tileWidth, tileHeight),
        });

        const sprite = new Sprite(texture);

        // マップ上の配置位置を計算（拡大倍率を掛けてピクセル座標に変換）
        sprite.x = (index % layer.width) * tileWidth * this.scale;
        sprite.y = Math.floor(index / layer.width) * tileHeight * this.scale;

        // タイルを拡大（16px → 64px）
        sprite.scale.set(this.scale);

        this.app.stage.addChild(sprite);
      });

      if (layer.name === 'object') {
        layer.data.forEach((tileId: number, index: number) => {
          if (tileId === 0) return;
          const tileScaled = this.tileSize * this.scale;
          const tileX = index % layer.width;
          const tileY = Math.floor(index / layer.width);
          const x = tileX * tileScaled;
          const y = tileY * tileScaled;
          this.createBookIcon(x, y, tileTexture, tileWidth, tileHeight);
        });
      }
    });
  }

  private createBookIcon(
    x: number,
    y: number,
    tileTexture: Texture,
    tileWidth: number,
    tileHeight: number,
  ) {
    const spacing = 1;
    const columns = 57;

    // 本アイコンのtileIdを指定する
    const bookTileId = 906;
    const tileIndex = bookTileId - 1;

    const srcX = (tileIndex % columns) * (tileWidth + spacing);
    const srcY = Math.floor(tileIndex / columns) * (tileHeight + spacing);

    const texture = new Texture({
      source: tileTexture.source,
      frame: new Rectangle(srcX, srcY, tileWidth, tileHeight),
    });

    const book = new Sprite(texture);

    // 机の中心に本を乗せる
    const tileScaled = this.tileSize * this.scale;

    book.x = x + tileScaled / 2;
    book.y = y + tileScaled / 2;

    book.anchor.set(0.5);
    book.scale.set(this.scale);

    book.eventMode = 'static';
    book.cursor = 'pointer';

    book.on('pointertap', () => {
      if (!this.currentShop()) return;
      this.isOshinagakiModalOpen = true;
      this.cdr.detectChanges();
    });

    this.app.stage.addChild(book);
  }

  private readonly handleKeydown = (e: KeyboardEvent) => {
    this.keys[e.key] = true;
  };

  private readonly handleKeyup = (e: KeyboardEvent) => {
    this.keys[e.key] = false;
  };

  private readonly handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchKeys = {};
  };

  private readonly handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    const threshold = 10; // px 以上動いたら方向を確定

    this.touchKeys = {};
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > threshold) this.touchKeys['ArrowRight'] = true;
      else if (dx < -threshold) this.touchKeys['ArrowLeft'] = true;
    } else {
      if (dy > threshold) this.touchKeys['ArrowDown'] = true;
      else if (dy < -threshold) this.touchKeys['ArrowUp'] = true;
    }
  };

  private readonly handleTouchEnd = () => {
    this.touchKeys = {};
  };

  private initInput() {
    // キーを押した時にtrueを記録
    window.addEventListener('keydown', this.handleKeydown);
    // キーを離した時にfalseを記録
    window.addEventListener('keyup', this.handleKeyup);
    // タッチ操作（スマホ対応）
    const canvas = this.gameContainer.nativeElement as HTMLElement;
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  private initSocket(fieldId: string) {
    const token = this.auth.getAccessToken();

    this.socket = new PartySocket({
      host: environment.partykitHost,
      room: fieldId,
      ...(token ? { query: { token } } : {}),
    });

    // 接続確立直後に現在位置を送信して他のユーザーに自分の存在を知らせる
    this.socket.addEventListener('open', () => {
      this.socket.send(JSON.stringify({ message_type: 'move', data: { x: this.x, y: this.y } }));
    });

    this.socket.onmessage = (event) => {
      const msg = JSON.parse(event.data) as { message_type: string; data: any };

      switch (msg.message_type) {
        // 接続時：既存プレイヤーを全員表示
        case 'init':
          for (const u of msg.data.users) {
            this.addOtherPlayer(u.userId, u.displayName, u.x, u.y);
          }
          break;

        // 誰かが入室：その人を表示
        case 'join':
          this.addOtherPlayer(msg.data.userId, msg.data.displayName, msg.data.x, msg.data.y);
          break;

        // 誰かが移動：その人の位置を更新
        case 'move': {
          const p = this.otherPlayers.get(msg.data.userId);
          if (p) {
            const dx = msg.data.x - p.graphics.x;
            const dy = msg.data.y - p.graphics.y;

            // 実際に移動があった時だけ方向・アニメーションを更新
            if (dx !== 0 || dy !== 0) {
              if (Math.abs(dx) >= Math.abs(dy)) {
                p.direction = dx > 0 ? 'right' : 'left';
              } else {
                p.direction = dy > 0 ? 'down' : 'up';
              }

              p.animationCounter++;
              if (p.animationCounter >= this.animationSpeed) {
                p.animationCounter = 0;
                p.frame = (p.frame + 1) % this.walkFrameCount;
              }
              p.graphics.texture = this.getPlayerTexture(p.direction, p.frame);
            }

            p.graphics.x = msg.data.x;
            p.graphics.y = msg.data.y;
            p.label.x = msg.data.x;
            p.label.y = msg.data.y - 28;
          }
          break;
        }

        // 誰かが退室：その人を削除
        case 'leave': {
          const p = this.otherPlayers.get(msg.data.userId);
          if (p) {
            this.app.stage.removeChild(p.graphics);
            this.app.stage.removeChild(p.label);
            this.otherPlayers.delete(msg.data.userId);
          }
          break;
        }
      }
    };
  }

  // 他のプレイヤーをstageに追加する
  private addOtherPlayer(id: string, displayName: string, x: number, y: number) {
    // 他のプレイヤーを幽霊スプライトで表示
    const texture = this.getPlayerTexture('down', 0);
    const graphics = new Sprite(texture);
    graphics.anchor.set(0.5);
    graphics.width = this.tileScaled;
    graphics.height = this.tileScaled;
    graphics.x = x;
    graphics.y = y;

    // display_nameをラベルとして表示
    const label = new PixiText({
      text: displayName,
      style: { fontSize: 12, fill: 0xffffff },
    });
    label.x = x;
    label.y = y - 28; // プレイヤーの上に表示
    label.anchor.set(0.5); // ラベルを中央揃え

    this.app.stage.addChild(graphics);
    this.app.stage.addChild(label);
    this.otherPlayers.set(id, {
      id,
      displayName,
      graphics,
      label,
      direction: 'down',
      frame: 0,
      animationCounter: 0,
    });
  }

  // 移動先に当たり判定があるか確認
  private canMove(nextX: number, nextY: number): boolean {
    const points = [
      [nextX - this.hitCharacter, nextY - this.hitCharacter],
      [nextX + this.hitCharacter, nextY - this.hitCharacter],
      [nextX - this.hitCharacter, nextY + this.hitCharacter],
      [nextX + this.hitCharacter, nextY + this.hitCharacter],
    ];

    return points.every(([px, py]) => {
      const tileX = Math.floor(px / this.tileScaled);
      const tileY = Math.floor(py / this.tileScaled);
      const index = tileY * this.mapCols + tileX;
      return !this.collisionTiles.has(index);
    });
  }

  // 毎フレーム実行される処理
  private update() {
    let nextX = this.x;
    let nextY = this.y;
    let moved = false;

    // 押されているキーに応じて次の座標を計算（キーボード or タッチ）
    const activeKeys = { ...this.keys, ...this.touchKeys };
    if (activeKeys['ArrowLeft']) {
      nextX -= this.speed;
      this.playerDirection = 'left';
    }
    if (activeKeys['ArrowRight']) {
      nextX += this.speed;
      this.playerDirection = 'right';
    }
    if (activeKeys['ArrowUp']) {
      nextY -= this.speed;
      this.playerDirection = 'up';
    }
    if (activeKeys['ArrowDown']) {
      nextY += this.speed;
      this.playerDirection = 'down';
    }

    // 移動範囲の境界チェック（タイル1枚分の余白を持たせる）
    const tileScaled = this.tileSize * this.scale; // 16 * 4 = 64px
    nextX = Math.max(tileScaled, Math.min(nextX, this.width - tileScaled));
    nextY = Math.max(tileScaled, Math.min(nextY, this.height - tileScaled));

    // 当たり判定チェック（通れる場合のみ移動）
    if (this.canMove(nextX, nextY)) {
      this.x = nextX;
      this.y = nextY;
      moved = true;
    }

    // 自分のプレイヤーの位置を更新
    this.player.x = this.x;
    this.player.y = this.y;
    this.playerLabel.x = this.x;
    this.playerLabel.y = this.y - 28;

    // カメラをプレイヤーに追従させる（プレイヤーが常に画面中央に表示される）
    this.app.stage.x = this.app.screen.width / 2 - this.x;
    this.app.stage.y = this.app.screen.height / 2 - this.y;

    // 移動した時だけサーバーに送信（毎フレーム送ると通信量が増えるため）
    if (moved) {
      this.animationCounter++;

      if (this.animationCounter >= this.animationSpeed) {
        this.animationCounter = 0;
        this.playerFrame = (this.playerFrame + 1) % this.walkFrameCount;
      }

      this.player.texture = this.getPlayerTexture(this.playerDirection, this.playerFrame);

      this.socket.send(JSON.stringify({ message_type: 'move', data: { x: this.x, y: this.y } }));
    } else {
      this.playerFrame = 0;
      this.animationCounter = 0;

      this.player.texture = this.getPlayerTexture(this.playerDirection, this.playerFrame);
    }

    // 店舗ゾーン判定
    const tileScaledSize = this.tileSize * this.scale;
    const tileX = Math.floor(this.x / tileScaledSize);
    const tileY = Math.floor(this.y / tileScaledSize);
    const shop =
      this.shops.find(
        (s) =>
          s.zone_col !== null &&
          s.zone_row !== null &&
          s.zone_width !== null &&
          s.zone_height !== null &&
          tileX >= s.zone_col &&
          tileX < s.zone_col + s.zone_width &&
          tileY >= s.zone_row &&
          tileY < s.zone_row + s.zone_height,
      ) ?? null;

    // 現在いる店舗が変化したときのみ更新（Angularの変更検知をトリガーするためNgZone内で実行）
    if (shop?.id !== this.currentShop()?.id) {
      this.ngZone.run(() => this.currentShop.set(shop));
    }
  }

  private cleanupResources() {
    // キーイベントリスナーを解除
    window.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('keyup', this.handleKeyup);
    // タッチイベントリスナーを解除
    const canvas = this.gameContainer.nativeElement as HTMLElement;
    canvas.removeEventListener('touchstart', this.handleTouchStart);
    canvas.removeEventListener('touchmove', this.handleTouchMove);
    canvas.removeEventListener('touchend', this.handleTouchEnd);

    // WebSocket接続を安全に切断
    this.socket?.close();
    this.shopChatService.disconnect();

    // PixiJSのtickerを停止・解除してからcanvasやメモリを解放
    this.app?.ticker.remove(this.update, this);
    this.app?.ticker.stop();
    this.app?.destroy(true);
  }

  ngOnDestroy() {
    this.cleanupResources();
  }
}
