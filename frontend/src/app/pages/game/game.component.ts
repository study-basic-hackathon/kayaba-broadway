import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Application, Graphics } from 'pixi.js';

@Component({
  selector: 'app-game',
  standalone: true,
  template: '<div #gameContainer></div>',
})
export class GameComponent implements OnInit, OnDestroy {
  @ViewChild('gameContainer', { static: true }) gameContainer!: ElementRef;
  private app!: Application;
  private player!: Graphics;
  private keys: Record<string, boolean> = {};
  private speed = 4;
  private ticker!: () => void;

  async ngOnInit() {
    this.app = new Application();

    await this.app.init({
      width: 1000,
      height: 600,
      background: '#1a1a2e',
    });

    this.gameContainer.nativeElement.appendChild(this.app.canvas);

    // プレイヤーを表現
    this.player = new Graphics();
    this.player.circle(0, 0, 16).fill(0x6366f1);
    this.player.x = 400;
    this.player.y = 300;
    this.app.stage.addChild(this.player);

    window.addEventListener('keydown', (e) => (this.keys[e.key] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.key] = false));

    this.ticker = () => this.update();
    this.app.ticker.add(this.ticker);
  }

  private update() {
    if (this.keys['ArrowLeft']) this.player.x -= this.speed;
    if (this.keys['ArrowRight']) this.player.x += this.speed;
    if (this.keys['ArrowUp']) this.player.y -= this.speed;
    if (this.keys['ArrowDown']) this.player.y += this.speed;
  }

  ngOnDestroy() {
    window.removeEventListener('keydown', (e) => (this.keys[e.key] = true));
    window.removeEventListener('keyup', (e) => (this.keys[e.key] = false));
    this.app.destroy(true);
  }
}
