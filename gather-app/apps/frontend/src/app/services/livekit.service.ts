// apps/frontend/src/app/services/livekit.service.ts
// LiveKit SDK のラッパーサービス
// 接続・切断・トラック操作を担当する

import angular from "angular";
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type RemoteTrack,
  type RemoteParticipant,
  type TrackPublication,
} from "livekit-client";

export interface LiveKitEventMap {
  "lk:participantConnected":    (p: RemoteParticipant) => void;
  "lk:participantDisconnected": (p: RemoteParticipant) => void;
  "lk:trackSubscribed":         (track: RemoteTrack, participant: RemoteParticipant) => void;
  "lk:trackUnsubscribed":       (track: RemoteTrack) => void;
  "lk:disconnected":            (reason?: string) => void;
}

export class LiveKitService {
  static $inject = ["$rootScope", "$timeout"];

  private room: Room | null = null;

  constructor(
    private $rootScope: angular.IRootScopeService,
    private $timeout:   angular.ITimeoutService,
  ) {}

  // ------------------------------------------------------------------
  // connect
  // serverUrl を変えるだけで Cloud / セルフホスト を切り替え可能
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

    // AngularJS の digest サイクル外で発火するイベントを
    // $timeout でラップして安全にブロードキャストする
    const broadcast = <T>(event: string, payload?: T) => {
      this.$timeout(() => this.$rootScope.$broadcast(event, payload));
    };

    this.room
      .on(RoomEvent.ParticipantConnected,    (p)            => broadcast("lk:participantConnected",    p))
      .on(RoomEvent.ParticipantDisconnected, (p)            => broadcast("lk:participantDisconnected", p))
      .on(RoomEvent.TrackSubscribed,         (track, _, p)  => broadcast("lk:trackSubscribed",  { track, participant: p }))
      .on(RoomEvent.TrackUnsubscribed,       (track)        => broadcast("lk:trackUnsubscribed", { track }))
      .on(RoomEvent.Disconnected,            (reason)       => {
        this.room = null;
        broadcast("lk:disconnected", reason);
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

  getRoom(): Room | null { return this.room; }

  getLocalVideoTrack() {
    if (!this.room) return null;
    const pub = this.room.localParticipant.getTrackPublication(Track.Source.Camera);
    return (pub && pub.track) ? pub.track : null;
  }

  async setMicEnabled(enabled: boolean) {
    if (this.room) await this.room.localParticipant.setMicrophoneEnabled(enabled);
  }

  async setCamEnabled(enabled: boolean) {
    if (this.room) await this.room.localParticipant.setCameraEnabled(enabled);
  }
}

angular
  .module("gatherApp")
  .service("LiveKitService", LiveKitService);
