import type { PlayMode, RoomSnapshot, Winner } from "./types";

export const TAP_LOCK_MS = 450;

export type LightState = {
  hits: number;
  greenHits: number;
  redHits: number;
  greenId: string | null;
  redId: string | null;
  winner: Winner;
  startedAt: number | null;
  finishedAt: number | null;
  lastElapsedMs: number | null;
  lastTapAt: Record<string, number>;
};

export type HostOverlay = Omit<LightState, "lastTapAt"> & { hostNow?: number };

function pickId(ids: string[], exclude: Set<string>): string | null {
  const pool = ids.filter((id) => !exclude.has(id));
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(Math.random() * pool.length))];
}

export function connectedIds(snapshot: RoomSnapshot): string[] {
  return snapshot.displays.filter((d) => d.connected).map((d) => d.id);
}

export function emptyLights(): LightState {
  return {
    hits: 0,
    greenHits: 0,
    redHits: 0,
    greenId: null,
    redId: null,
    winner: null,
    startedAt: null,
    finishedAt: null,
    lastElapsedMs: null,
    lastTapAt: {},
  };
}

export function ensureLights(
  state: LightState,
  ids: string[],
  mode: PlayMode
): LightState {
  const next = { ...state, lastTapAt: { ...state.lastTapAt } };
  const live = new Set(ids);
  if (next.greenId && !live.has(next.greenId)) next.greenId = null;
  if (next.redId && !live.has(next.redId)) next.redId = null;

  if (mode === "solo") {
    if (!next.greenId) next.greenId = pickId(ids, new Set());
    next.redId = null;
    return next;
  }
  if (ids.length < 2) return next;
  if (next.greenId && next.greenId === next.redId) next.greenId = null;
  if (!next.greenId) next.greenId = pickId(ids, new Set(next.redId ? [next.redId] : []));
  if (!next.redId) next.redId = pickId(ids, new Set(next.greenId ? [next.greenId] : []));
  return next;
}

function moveLight(
  state: LightState,
  ids: string[],
  which: "green" | "red"
): LightState {
  const next = { ...state, lastTapAt: { ...state.lastTapAt } };
  const from = which === "green" ? next.greenId : next.redId;
  const other = which === "green" ? next.redId : next.greenId;
  const picked = pickId(ids, new Set([from, other].filter(Boolean) as string[]));
  if (picked) {
    if (which === "green") next.greenId = picked;
    else next.redId = picked;
    return next;
  }
  if (from && other) {
    if (which === "green") {
      next.greenId = other;
      next.redId = from;
    } else {
      next.redId = other;
      next.greenId = from;
    }
  }
  return next;
}

export function applyTap(
  state: LightState,
  ids: string[],
  mode: PlayMode,
  targetCount: number,
  deviceId: string,
  now = Date.now()
): LightState | null {
  if (state.finishedAt != null || state.winner) return null;
  const prev = state.lastTapAt[deviceId] ?? 0;
  if (now - prev < TAP_LOCK_MS) return null;

  if (mode === "solo") {
    if (deviceId !== state.greenId) return null;
    let next: LightState = {
      ...state,
      lastTapAt: { ...state.lastTapAt, [deviceId]: now },
      hits: state.hits + 1,
    };
    if (next.hits >= targetCount) {
      next.finishedAt = now;
      next.lastElapsedMs = now - (next.startedAt ?? now);
      next.greenId = null;
      return next;
    }
    next.greenId = pickId(ids, new Set([deviceId])) ?? deviceId;
    return next;
  }

  if (deviceId !== state.greenId && deviceId !== state.redId) return null;
  let next: LightState = {
    ...state,
    lastTapAt: { ...state.lastTapAt, [deviceId]: now },
  };
  if (deviceId === next.greenId) {
    next.greenHits += 1;
    if (next.greenHits >= targetCount) {
      next.winner = "green";
      next.finishedAt = now;
      next.greenId = null;
      next.redId = null;
      return next;
    }
    next = moveLight(next, ids, "green");
  } else {
    next.redHits += 1;
    if (next.redHits >= targetCount) {
      next.winner = "red";
      next.finishedAt = now;
      next.greenId = null;
      next.redId = null;
      return next;
    }
    next = moveLight(next, ids, "red");
  }
  return next;
}

export function toOverlay(state: LightState, hostNow = Date.now()): HostOverlay {
  return {
    hits: state.hits,
    greenHits: state.greenHits,
    redHits: state.redHits,
    greenId: state.greenId,
    redId: state.redId,
    winner: state.winner,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    lastElapsedMs: state.lastElapsedMs,
    hostNow,
  };
}
