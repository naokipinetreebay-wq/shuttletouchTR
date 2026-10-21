import { WebSocket } from "ws";
import { DEFAULT_CONFIG, Light, RoomConfig, RoomSnapshot, Winner } from "../lib/types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 90 * 60 * 1000;
const MAX_DISPLAYS = 12;
const TAP_LOCK_MS = 450;

function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pickId(ids: string[], exclude: Set<string>): string | null {
  const pool = ids.filter((id) => !exclude.has(id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export type ClientSocket = WebSocket & {
  role?: "controller" | "display";
  deviceId?: string;
  roomCode?: string;
};

interface DisplayClient {
  id: string;
  label: string;
  socket: ClientSocket | null;
}

export class Room {
  code: string;
  config: RoomConfig = { ...DEFAULT_CONFIG };
  displays = new Map<string, DisplayClient>();
  controllers = new Set<ClientSocket>();
  hits = 0;
  greenHits = 0;
  redHits = 0;
  greenId: string | null = null;
  redId: string | null = null;
  winner: Winner = null;
  startedAt: number | null = null;
  finishedAt: number | null = null;
  lastElapsedMs: number | null = null;
  lastActivity = Date.now();
  private lastTapAt = new Map<string, number>();

  constructor(code: string) {
    this.code = code;
  }

  touch() {
    this.lastActivity = Date.now();
  }

  isExpired(now = Date.now()) {
    if (this.config.running) return false;
    if (this.controllers.size > 0) return false;
    if ([...this.displays.values()].some((d) => d.socket)) return false;
    return now - this.lastActivity > ROOM_TTL_MS;
  }

  addController(socket: ClientSocket) {
    this.controllers.add(socket);
    this.touch();
    this.sendSnapshot(socket);
  }

  removeController(socket: ClientSocket) {
    this.controllers.delete(socket);
  }

  addDisplay(socket: ClientSocket, deviceId: string, label?: string) {
    this.touch();
    const existing = this.displays.get(deviceId);
    if (existing) {
      existing.socket = socket;
      if (label) existing.label = label;
      this.broadcast();
      return { ok: true as const };
    }
    if (this.displays.size >= MAX_DISPLAYS) {
      return { ok: false as const, error: "Display上限（12台）に達しています" };
    }
    this.displays.set(deviceId, {
      id: deviceId,
      label: label || `T${this.displays.size + 1}`,
      socket,
    });
    if (this.config.running && !this.winner && this.finishedAt == null) {
      this.ensureLights();
    }
    this.broadcast();
    return { ok: true as const };
  }

  removeDisplaySocket(socket: ClientSocket) {
    for (const d of this.displays.values()) {
      if (d.socket === socket) {
        d.socket = null;
        break;
      }
    }
    this.broadcast();
  }

  setLabel(deviceId: string, label: string) {
    const d = this.displays.get(deviceId);
    if (d) {
      d.label = label.slice(0, 24);
      this.touch();
      this.broadcast();
    }
  }

  updateConfig(partial: Partial<RoomConfig>) {
    const next = { ...this.config, ...partial, running: this.config.running };
    next.mode = next.mode === "battle" ? "battle" : "solo";
    next.targetCount = clamp(Math.round(next.targetCount), 5, 50);
    const modeChanged = next.mode !== this.config.mode;
    this.config = next;
    this.touch();
    if (modeChanged && this.config.running) this.stop();
    else this.broadcast();
  }

  start() {
    const ids = [...this.displays.keys()];
    if (ids.length === 0) {
      this.broadcast();
      return;
    }
    if (this.config.mode === "battle" && ids.length < 2) {
      this.broadcast();
      return;
    }
    this.hits = 0;
    this.greenHits = 0;
    this.redHits = 0;
    this.winner = null;
    this.finishedAt = null;
    this.lastElapsedMs = null;
    this.lastTapAt.clear();
    this.greenId = null;
    this.redId = null;
    this.config.running = true;
    this.ensureLights();
    this.startedAt = Date.now();
    this.touch();
    this.broadcast();
  }

  stop() {
    this.config.running = false;
    this.greenId = null;
    this.redId = null;
    this.touch();
    this.broadcast();
  }

  tap(deviceId: string) {
    if (!this.config.running || this.winner || this.finishedAt != null) return;
    const now = Date.now();
    const prev = this.lastTapAt.get(deviceId) ?? 0;
    if (now - prev < TAP_LOCK_MS) return;

    if (this.config.mode === "solo") {
      if (deviceId !== this.greenId) return;
      this.lastTapAt.set(deviceId, now);
      this.hits += 1;
      if (this.hits >= this.config.targetCount) {
        this.finishSolo(now);
        return;
      }
      this.greenId = pickId([...this.displays.keys()], new Set([deviceId])) ?? deviceId;
      this.touch();
      this.broadcast();
      return;
    }

    if (deviceId !== this.greenId && deviceId !== this.redId) return;
    this.lastTapAt.set(deviceId, now);
    if (deviceId === this.greenId) {
      this.greenHits += 1;
      if (this.greenHits >= this.config.targetCount) {
        this.finishBattle("green", now);
        return;
      }
      this.moveLight("green");
    } else {
      this.redHits += 1;
      if (this.redHits >= this.config.targetCount) {
        this.finishBattle("red", now);
        return;
      }
      this.moveLight("red");
    }
    this.touch();
    this.broadcast();
  }

  private finishSolo(now: number) {
    this.finishedAt = now;
    this.lastElapsedMs = now - (this.startedAt ?? now);
    this.config.running = false;
    this.greenId = null;
    this.touch();
    this.broadcast();
  }

  private finishBattle(winner: "green" | "red", now: number) {
    this.winner = winner;
    this.finishedAt = now;
    this.config.running = false;
    this.greenId = null;
    this.redId = null;
    this.touch();
    this.broadcast();
  }

  private ensureLights() {
    const ids = [...this.displays.keys()];
    if (this.config.mode === "solo") {
      if (!this.greenId || !this.displays.has(this.greenId)) {
        this.greenId = pickId(ids, new Set());
      }
      this.redId = null;
      return;
    }
    if (ids.length < 2) return;
    if (!this.greenId || !this.displays.has(this.greenId) || this.greenId === this.redId) {
      this.greenId = pickId(ids, new Set(this.redId ? [this.redId] : []));
    }
    if (!this.redId || !this.displays.has(this.redId) || this.redId === this.greenId) {
      this.redId = pickId(ids, new Set(this.greenId ? [this.greenId] : []));
    }
  }

  private moveLight(which: "green" | "red") {
    const ids = [...this.displays.keys()];
    const from = which === "green" ? this.greenId : this.redId;
    const other = which === "green" ? this.redId : this.greenId;
    const next = pickId(ids, new Set([from, other].filter((id): id is string => !!id)));
    if (next) {
      if (which === "green") this.greenId = next;
      else this.redId = next;
      return;
    }
    if (from && other) {
      if (which === "green") {
        this.greenId = other;
        this.redId = from;
      } else {
        this.redId = other;
        this.greenId = from;
      }
    }
  }

  private lightOf(id: string): Light {
    if (this.finishedAt != null || this.winner) return "off";
    if (id === this.greenId) return "green";
    if (id === this.redId) return "red";
    return "off";
  }

  snapshot(): RoomSnapshot {
    const displays = [...this.displays.values()].map((d) => ({
      id: d.id,
      label: d.label,
      light: this.lightOf(d.id),
      connected: !!d.socket && d.socket.readyState === WebSocket.OPEN,
    }));
    return {
      code: this.code,
      config: this.config,
      displays,
      hits: this.hits,
      greenHits: this.greenHits,
      redHits: this.redHits,
      winner: this.winner,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      lastElapsedMs: this.lastElapsedMs,
      serverNow: Date.now(),
    };
  }

  sendSnapshot(socket: ClientSocket) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "snapshot", snapshot: this.snapshot() }));
    }
  }

  broadcast() {
    const payload = JSON.stringify({ type: "snapshot", snapshot: this.snapshot() });
    for (const c of this.controllers) {
      if (c.readyState === WebSocket.OPEN) c.send(payload);
    }
    for (const d of this.displays.values()) {
      if (d.socket && d.socket.readyState === WebSocket.OPEN) d.socket.send(payload);
    }
  }

  destroy() {
    this.lastTapAt.clear();
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();

  createRoom(): Room {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    const room = new Room(code);
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    const room = this.rooms.get(code.toUpperCase());
    if (room?.isExpired()) {
      room.destroy();
      this.rooms.delete(room.code);
      return undefined;
    }
    return room;
  }

  sweep() {
    for (const [code, room] of this.rooms) {
      if (room.isExpired()) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }
}
