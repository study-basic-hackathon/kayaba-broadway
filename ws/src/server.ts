import type * as Party from "partykit/server";

interface Player {
  id: string;
  x: number;
  y: number;
}

export default class Server implements Party.Server {
  private players = new Map<string, Player>();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // 新規プレイヤーを登録
    this.players.set(conn.id, { id: conn.id, x: 400, y: 300 });

    const existingPlayers = [...this.players.values()].filter(
      (x) => x.id !== conn.id,
    );

    conn.send(
      JSON.stringify({
        type: "init",
        id: conn.id,
        players: existingPlayers,
      }),
    );

    this.room.broadcast(
      JSON.stringify({ type: "join", id: conn.id, x: 400, y: 300 }),
      [conn.id],
    );
  }

  onMessage(message: string, sender: Party.Connection) {
    const data = JSON.parse(message);

    if (data.type !== "move") return;

    const player = this.players.get(sender.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
    }
    this.room.broadcast(
      JSON.stringify({
        type: "move",
        id: sender.id,
        x: data.x,
        y: data.y,
      }),
      [sender.id],
    );
  }

  onClose(conn: Party.Connection): void | Promise<void> {
    this.players.delete(conn.id);
    this.room.broadcast(
      JSON.stringify({
        type: "leave",
        id: conn.id,
      }),
    );
  }
}

Server satisfies Party.Worker;
