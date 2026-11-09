export type Role = "controller" | "display";
export type PlayMode = "solo" | "battle";
export type Light = "off" | "green" | "red";
export type Winner = "green" | "red" | null;

export interface RoomConfig {
  mode: PlayMode;
  /** 5〜50 */
  targetCount: number;
  running: boolean;
}

export interface DisplayInfo {
  id: string;
  label: string;
  light: Light;
  connected: boolean;
}

export interface RoomSnapshot {
  code: string;
  config: RoomConfig;
  displays: DisplayInfo[];
  /** 1人モードの成功タップ数 */
  hits: number;
  greenHits: number;
  redHits: number;
  winner: Winner;
  startedAt: number | null;
  finishedAt: number | null;
  lastElapsedMs: number | null;
  serverNow: number;
}

export type HostPushOverlay = {
  hits?: number;
  greenHits?: number;
  redHits?: number;
  greenId?: string | null;
  redId?: string | null;
  winner?: Winner;
  startedAt?: number | null;
  finishedAt?: number | null;
  lastElapsedMs?: number | null;
  hostNow?: number;
};

export type ClientMessage =
  | { type: "hello"; role: Role; deviceId: string; label?: string }
  | { type: "updateConfig"; config: Partial<RoomConfig> }
  | { type: "setLabel"; deviceId: string; label: string }
  | { type: "start"; local?: boolean }
  | { type: "stop" }
  | { type: "hostPush"; overlay: HostPushOverlay }
  | { type: "tap"; deviceId: string }
  | {
      type: "signal";
      from: string;
      to: string;
      payload: unknown;
    }
  | { type: "ping" };

export type ClientEventMessage = {
  type: "clientEvent";
  event: "tap";
  deviceId: string;
};

export type ServerMessage =
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "error"; message: string }
  | { type: "pong" }
  | {
      type: "signal";
      from: string;
      to: string;
      payload: unknown;
    }
  | ClientEventMessage;

export const DEFAULT_CONFIG: RoomConfig = {
  mode: "solo",
  targetCount: 10,
  running: false,
};
