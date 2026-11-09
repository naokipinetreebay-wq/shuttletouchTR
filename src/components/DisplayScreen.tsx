"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "@/lib/types";

export function DisplayScreen({
  snapshot,
  deviceId,
  sendGame,
}: {
  snapshot: RoomSnapshot;
  deviceId: string;
  /** DataChannel 優先、なければ WS tap */
  sendGame: (msg: unknown) => boolean;
}) {
  const mine = snapshot.displays.find((d) => d.id === deviceId);
  const light = mine?.light ?? "off";
  const battle = snapshot.config.mode === "battle";
  const done = snapshot.finishedAt != null;
  const [flash, setFlash] = useState(false);
  const lock = useRef(0);

  useEffect(() => {
    let wake: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        if ("wakeLock" in navigator) wake = await navigator.wakeLock.request("screen");
      } catch {
        /* ignore */
      }
    };
    request();
    const onVis = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wake?.release().catch(() => undefined);
    };
  }, []);

  const onTap = () => {
    if (done || light === "off") return;
    const now = Date.now();
    if (now - lock.current < 280) return;
    lock.current = now;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 120);
    sendGame({ type: "clientEvent", event: "tap", deviceId });
  };

  const seconds =
    snapshot.lastElapsedMs != null ? (snapshot.lastElapsedMs / 1000).toFixed(2) : null;
  const winnerLabel =
    snapshot.winner === "green" ? "緑の勝ち" : snapshot.winner === "red" ? "赤の勝ち" : null;

  const face = done
    ? winnerLabel
      ? `shuttle-root result ${snapshot.winner}`
      : "shuttle-root result solo"
    : `shuttle-root lit-${light}${flash ? " flash" : ""}`;

  return (
    <button type="button" className={face} onPointerDown={onTap}>
      {done ? (
        winnerLabel ? (
          <span className="shuttle-result">{winnerLabel}</span>
        ) : (
          <span className="shuttle-result">
            {seconds ?? "0"}
            <span className="shuttle-unit">秒</span>
          </span>
        )
      ) : (
        <span className="shuttle-count">
          {battle
            ? `緑 ${snapshot.greenHits}  ·  赤 ${snapshot.redHits}`
            : `${snapshot.hits} / ${snapshot.config.targetCount}`}
        </span>
      )}
    </button>
  );
}
