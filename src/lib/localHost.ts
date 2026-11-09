"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  applyTap,
  connectedIds,
  emptyLights,
  ensureLights,
  toOverlay,
  type LightState,
} from "./localEngine";
import type { ClientMessage, RoomSnapshot } from "./types";

export type ShuttleClientEvent = {
  type: "clientEvent";
  event: "tap";
  deviceId: string;
};

export function useShuttleLocalHost(
  snapshot: RoomSnapshot | null,
  send: (msg: ClientMessage) => void
) {
  const stateRef = useRef<LightState>(emptyLights());
  const runningRef = useRef(false);
  const idsRef = useRef<string[]>([]);

  const push = useCallback(
    (state: LightState) => {
      stateRef.current = state;
      send({ type: "hostPush", overlay: toOverlay(state) });
    },
    [send]
  );

  useEffect(() => {
    if (!snapshot) return;
    idsRef.current = connectedIds(snapshot);
  }, [snapshot]);

  const startLocal = useCallback(() => {
    if (!snapshot) return;
    const ids = connectedIds(snapshot);
    if (ids.length === 0) return;
    if (snapshot.config.mode === "battle" && ids.length < 2) return;
    idsRef.current = ids;
    runningRef.current = true;

    send({ type: "start", local: true });
    let state = emptyLights();
    state.startedAt = Date.now();
    state = ensureLights(state, ids, snapshot.config.mode);
    push(state);
  }, [snapshot, send, push]);

  const stopLocal = useCallback(() => {
    runningRef.current = false;
    stateRef.current = emptyLights();
    send({ type: "stop" });
  }, [send]);

  const onClientEvent = useCallback(
    (ev: ShuttleClientEvent) => {
      if (ev.event !== "tap" || !runningRef.current || !snapshot) return;
      const ids = connectedIds(snapshot);
      idsRef.current = ids;
      const next = applyTap(
        stateRef.current,
        ids,
        snapshot.config.mode,
        snapshot.config.targetCount,
        ev.deviceId
      );
      if (!next) return;
      push(next);
      if (next.finishedAt != null || next.winner) {
        runningRef.current = false;
        send({ type: "stop" });
      }
    },
    [snapshot, push, send]
  );

  return { startLocal, stopLocal, onClientEvent };
}
