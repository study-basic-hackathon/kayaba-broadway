// apps/gather-frontend/src/app/services/livekit.service.ts
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  DisconnectReason,
  type RemoteTrack,
  type RemoteParticipant,
} from 'livekit-client';

// ============================================================
// イベントの型定義
// ============================================================
export interface TrackSubscribedEvent {
  track:       RemoteTrack;
  participant: RemoteParticipant;
}

// ============================================================
// LiveKitService
//
// @Injectable({ providedIn: 'root' }) により、
// アプリ全体でシングルトンとして使用可能。
// pages/ 以下の任意の component から constructor DI で受け取れる。
//
// 使い方:
//   constructor(private liveKit: LiveKitService) {}
//
//   // 接続
//   await this.liveKit.connect(serverUrl, token);
//
//   // イベント購読
//   this.liveKit.participantConnected$.subscribe(p => { ... });
// ============================================================
@Injectable({ providedIn: 'root' })
export class LiveKitService {

  // RxJS Subject でイベントをストリームとして公開
  // コンポーネントは subscribe() で受け取り、OnDestroy で unsubscribe する
  readonly participantConnected$    = new Subject<RemoteParticipant>();
  readonly participantDisconnected$ = new Subject<RemoteParticipant>();
  readonly trackSubscribed$         = new Subject<TrackSubscribedEvent>();
  readonly trackUnsubscribed$       = new Subject<RemoteTrack>();
  readonly disconnected$            = new Subject<DisconnectReason | undefined>();

  private room: Room | null = null;

  // ------------------------------------------------------------------
  // connect
  // serverUrl を切り替えるだけで Cloud / セルフホスト を変更できる:
  //   Cloud:      wss://your-app.livekit.cloud
  //   Oracle:     wss://your.oracle.ip:7880
  //   ローカル:   ws://localhost:7880
  // ------------------------------------------------------------------
  async connect(serverUrl: string, token: string): Promise<Room> {
    await this.disconnect();

    this.room = new Room({
      adaptiveStream: true,
      dynacast:       true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h360.resolution,
      },
    });

    this.room
      .on(RoomEvent.ParticipantConnected,    (p)           => this.participantConnected$.next(p))
      .on(RoomEvent.ParticipantDisconnected, (p)           => this.participantDisconnected$.next(p))
      .on(RoomEvent.TrackSubscribed,         (track, _, p) => this.trackSubscribed$.next({ track, participant: p }))
      .on(RoomEvent.TrackUnsubscribed,       (track)       => this.trackUnsubscribed$.next(track))
      .on(RoomEvent.Disconnected,            (reason)      => {
        this.room = null;
        this.disconnected$.next(reason);
      });

    await this.room.connect(serverUrl, token);
    await this.room.localParticipant.enableCameraAndMicrophone();
    return this.room;
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      try { await this.room.disconnect(); } catch { /* ignore */ }
      this.room = null;
    }
  }

  getRoom(): Room | null {
    return this.room;
  }

  getLocalVideoTrack() {
    if (!this.room) return null;
    const pub = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
    return pub?.track ?? null;
  }

  async setMicEnabled(enabled: boolean): Promise<void> {
    await this.room?.localParticipant.setMicrophoneEnabled(enabled);
  }

  async setCamEnabled(enabled: boolean): Promise<void> {
    await this.room?.localParticipant.setCameraEnabled(enabled);
  }
}
