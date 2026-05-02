import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import {
  Application,
  Graphics,
  Text as PixiText,
  Assets,
  Texture,
  Rectangle,
  Sprite,
} from 'pixi.js';
import PartySocket from 'partysocket';

interface OtherPlayer {
  id: string;
  graphics: Graphics;
  label: PixiText;
}

@Component({
  selector: 'app-game',
  standalone: true,
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements OnInit, OnDestroy {
  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;
  private app!: Application;
  private player!: Sprite;

  // 現在押されているキーを管理するオブジェクト
  private keys: Record<string, boolean> = {};

  // プレイヤーの移動速度（px/フレーム）
  private speed = 4;

  private socket!: PartySocket;
  private myId = '';
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

  async ngOnInit() {
    await this.initPixi();
    this.initSocket();
    this.initInput();
    // 毎フレームupdateを呼ぶ
    this.app.ticker.add(() => this.update());
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

    const playerSize = this.tileSize * this.scale;

    this.player = new Sprite(texture);
    this.player.x = this.x;
    this.player.y = this.y;
    this.player.width = playerSize;
    this.player.height = playerSize;
    this.app.stage.addChild(this.player);

    // 初期カメラ位置をプレイヤーが画面中央になるように設定
    this.app.stage.x = this.app.screen.width / 2 - this.x;
    this.app.stage.y = this.app.screen.height / 2 - this.y;
  }

  //キャラクタースプライトシートを区切って出力
  private getPlayerTexture(
    direction: 'down' | 'left' | 'right' | 'up',
    frameIndex: number
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
        this.playerFrameHeight
      )
    })
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
    });
  }

  private initInput() {
    // キーを押した時にtrueを記録
    window.addEventListener('keydown', (e) => (this.keys[e.key] = true));
    // キーを離した時にfalseを記録
    window.addEventListener('keyup', (e) => (this.keys[e.key] = false));
  }

  private initSocket() {
    this.socket = new PartySocket({
      host: '127.0.0.1:1999',
      room: 'room1',
    });

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        // 接続時：既存プレイヤーを全員表示
        case 'init':
          this.myId = data.id;
          for (const p of data.players) {
            this.addOtherPlayer(p.id, p.x, p.y);
          }
          break;

        // 誰かが入室：その人を表示
        case 'join':
          this.addOtherPlayer(data.id, data.x, data.y);
          break;

        // 誰かが移動：その人の位置を更新
        case 'move': {
          const p = this.otherPlayers.get(data.id);
          if (p) {
            p.graphics.x = data.x;
            p.graphics.y = data.y;
            p.label.x = data.x;
            p.label.y = data.y - 28;
          }
          break;
        }

        // 誰かが退室：その人を削除
        case 'leave': {
          const p = this.otherPlayers.get(data.id);
          if (p) {
            this.app.stage.removeChild(p.graphics);
            this.app.stage.removeChild(p.label);
            this.otherPlayers.delete(data.id);
          }
          break;
        }
      }
    };
  }

  // 他のプレイヤーをstageに追加する
  private addOtherPlayer(id: string, x: number, y: number) {
    // 他のプレイヤーを赤い●で表示
    const graphics = new Graphics();
    graphics.circle(0, 0, 16).fill(0xe11d48);
    graphics.x = x;
    graphics.y = y;

    // IDの先頭6文字をラベルとして表示
    const label = new PixiText({
      text: id.slice(0, 6),
      style: { fontSize: 12, fill: 0xffffff },
    });
    label.x = x;
    label.y = y - 28; // プレイヤーの上に表示
    label.anchor.set(0.5); // ラベルを中央揃え

    this.app.stage.addChild(graphics);
    this.app.stage.addChild(label);
    this.otherPlayers.set(id, { id, graphics, label });
  }

  // 移動先に当たり判定があるか確認
  private canMove(nextX: number, nextY: number): boolean {
    const tileScaled = this.tileSize * this.scale; // 64px
    const tileX = Math.floor(nextX / tileScaled);
    const tileY = Math.floor(nextY / tileScaled);
    // タイルのインデックスを計算（横方向のタイル数を掛けて行を特定）
    const index = tileY * this.mapCols + tileX;
    return !this.collisionTiles.has(index);
  }

  // 毎フレーム実行される処理
  private update() {
    let nextX = this.x;
    let nextY = this.y;
    let moved = false;

    // 押されているキーに応じて次の座標を計算
    if (this.keys['ArrowLeft']) {
      nextX -= this.speed;
      this.playerDirection = 'left';
    }
    if (this.keys['ArrowRight']) {
      nextX += this.speed;
      this.playerDirection = 'right';
    }
    if (this.keys['ArrowUp']) {
      nextY -= this.speed;
      this.playerDirection = 'up';
    }
    if (this.keys['ArrowDown']) {
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

    // カメラをプレイヤーに追従させる（プレイヤーが常に画面中央に表示される）
    this.app.stage.x = this.app.screen.width / 2 - this.x;
    this.app.stage.y = this.app.screen.height / 2 - this.y;

    // 移動した時だけサーバーに送信（毎フレーム送ると通信量が増えるため）
    if (moved) {
      this.animationCounter++;

      if (this.animationCounter >= this.animationSpeed){
        this.animationCounter = 0;
        this.playerFrame = (this.playerFrame + 1) % this.walkFrameCount;
      }

      this.player.texture = this.getPlayerTexture(
        this.playerDirection,
        this.playerFrame
      );

      this.socket.send(JSON.stringify({ type: 'move', x: this.x, y: this.y }));
    } else {
      this.playerFrame = 0;
      this.animationCounter = 0;

      this.player.texture = this.getPlayerTexture(
        this.playerDirection,
        this.playerFrame
      )
    }
  }

  ngOnDestroy() {
    // WebSocket接続を切断
    this.socket.close();
    // PixiJSのcanvasやメモリを解放
    this.app.destroy(true);
  }
}
