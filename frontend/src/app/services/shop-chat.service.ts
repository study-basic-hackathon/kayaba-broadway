import { Injectable, NgZone, inject, signal } from '@angular/core';
import PartySocket from 'partysocket';

export interface ChatMessage {
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
}

type ChatBroadcastMessage = {
  message_type: 'chat';
  data: ChatMessage;
};

type ChatHistoryMessage = {
  message_type: 'chat_history';
  data: { messages: ChatMessage[] };
};

type IncomingMessage = ChatBroadcastMessage | ChatHistoryMessage;

@Injectable({
  providedIn: 'root',
})
export class ShopChatService {
  private ngZone = inject(NgZone);

  private socket: PartySocket | null = null;

  private _messages = signal<ChatMessage[]>([]);
  messages = this._messages.asReadonly();

  private _connected = signal(false);
  connected = this._connected.asReadonly();

  connect(shopId: string, token: string | null): void {
    // 既存の接続があれば切断してから再接続
    this.disconnect();

    if (!token) return;

    this.socket = new PartySocket({
      host: 'localhost:1999',
      room: `shop-${shopId}`,
      query: { token },
    });

    this.socket.addEventListener('open', () => {
      this.ngZone.run(() => {
        this._connected.set(true);
        this._messages.set([]);
      });
    });

    this.socket.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as IncomingMessage;

        if (msg.message_type === 'chat_history') {
          this.ngZone.run(() => {
            this._messages.set(msg.data.messages);
          });
          return;
        }

        if (msg.message_type === 'chat') {
          this.ngZone.run(() => {
            this._messages.update((prev) => [...prev, msg.data]);
          });
        }
      } catch {
        // 不正なメッセージは無視
      }
    });

    this.socket.addEventListener('close', () => {
      this.ngZone.run(() => {
        this._connected.set(false);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this._connected.set(false);
    this._messages.set([]);
  }

  sendMessage(text: string): void {
    if (!this.socket || !this._connected()) return;

    this.socket.send(
      JSON.stringify({
        message_type: 'chat',
        data: { text },
      }),
    );
  }
}
