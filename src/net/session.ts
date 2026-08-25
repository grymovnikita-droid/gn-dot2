// Сетевая сессия на PeerJS (WebRTC). Сигнализация — бесплатный публичный сервер PeerJS,
// поэтому играть можно прямо со статического хостинга (GitHub Pages).
import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type { NetMode } from "../game/types";

export type NetRole = "host" | "guest";

const PREFIX = "drevniy-razlom-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genCode(len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export interface GuestInfo {
  hero: string | null;
}

export interface NetEvents {
  onOpen?: (code: string) => void;
  onGuestJoin?: () => void;
  onHello?: (hero: string) => void;
  onLobby?: (info: { code: string; hostHero: string; taken: string[] }) => void;
  onMode?: (mode: NetMode) => void;
  onStart?: (msg: { radiant: string[]; dire: string[]; guestHero: string; hostHero: string; mode: NetMode }) => void;
  onCmd?: (cmd: unknown) => void;
  onSnap?: (snap: unknown) => void;
  onClose?: (reason: string) => void;
  onError?: (msg: string) => void;
}

export class NetSession {
  peer: Peer;
  conn: DataConnection | null = null;
  role: NetRole;
  code = "";
  ev: NetEvents;
  private closed = false;

  private constructor(role: NetRole, ev: NetEvents) {
    this.role = role;
    this.ev = ev;
    this.peer = new Peer(role === "host" ? PREFIX + genCode() : undefined as unknown as string, {
      debug: 0,
    });
    this.setupPeer();
  }

  static host(ev: NetEvents): NetSession {
    return new NetSession("host", ev);
  }

  static join(code: string, ev: NetEvents): NetSession {
    const s = new NetSession("guest", ev);
    s.code = code.trim().toUpperCase();
    // дождёмся open и подключимся
    s.peer.on("open", () => {
      const conn = s.peer.connect(PREFIX + s.code, { reliable: true });
      s.bindConn(conn);
    });
    return s;
  }

  private setupPeer() {
    this.peer.on("open", (id) => {
      if (this.role === "host") {
        this.code = id.replace(PREFIX, "");
        this.ev.onOpen?.(this.code);
      }
    });
    this.peer.on("connection", (conn) => {
      if (this.role !== "host" || this.conn) return;
      this.bindConn(conn);
    });
    this.peer.on("error", (err: Error & { type?: string }) => {
      const t = err?.type;
      if (t === "peer-unavailable") this.ev.onError?.("Комната не найдена. Проверь код.");
      else if (t === "unavailable-id") this.ev.onError?.("Не удалось создать комнату. Попробуй ещё раз.");
      else if (t === "network" || t === "server-error") this.ev.onError?.("Нет связи с сервером знакомств PeerJS. Проверь интернет.");
      else this.ev.onError?.("Сетевая ошибка: " + (t ?? "неизвестно"));
    });
    this.peer.on("disconnected", () => {
      if (!this.closed) {
        try {
          this.peer.reconnect();
        } catch {
          /* noop */
        }
      }
    });
  }

  private bindConn(conn: DataConnection) {
    this.conn = conn;
    conn.on("open", () => {
      if (this.role === "host") this.ev.onGuestJoin?.();
    });
    conn.on("data", (data) => {
      const d = data as { t?: string } & Record<string, unknown>;
      switch (d.t) {
        case "hello":
          this.ev.onHello?.(d.hero as string);
          break;
        case "lobby":
          this.ev.onLobby?.(d as unknown as { code: string; hostHero: string; taken: string[] });
          break;
        case "mode":
          this.ev.onMode?.(d.mode as NetMode);
          break;
        case "start":
          this.ev.onStart?.(d as unknown as { radiant: string[]; dire: string[]; guestHero: string; hostHero: string; mode: NetMode });
          break;
        case "cmd":
          this.ev.onCmd?.(d.cmd);
          break;
        case "snap":
          this.ev.onSnap?.(d.snap);
          break;
        case "bye":
          this.close("Соперник покинул бой");
          break;
      }
    });
    conn.on("close", () => {
      if (!this.closed) this.close("Соединение разорвано");
    });
    conn.on("error", () => {
      if (!this.closed) this.close("Ошибка соединения");
    });
  }

  send(obj: Record<string, unknown>) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(obj);
      } catch {
        /* канал мог закрыться */
      }
    }
  }

  close(reason?: string) {
    if (this.closed) return;
    this.closed = true;
    try {
      this.send({ t: "bye" });
      this.conn?.close();
      this.peer.destroy();
    } catch {
      /* noop */
    }
    this.ev.onClose?.(reason ?? "Сессия завершена");
  }
}
