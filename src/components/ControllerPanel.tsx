"use client";

import { NumberSelect } from "@/components/NumberSelect";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { SessionExit } from "@/components/SessionExit";
import type { ClientMessage, PlayMode, RoomConfig, RoomSnapshot } from "@/lib/types";
import { displayJoinUrl } from "@/lib/roomCode";

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(2);
}

export function ControllerPanel({
  snapshot,
  connected,
  send,
  clearSessionKeys,
  onStart,
  onStop,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  send: (msg: ClientMessage) => void;
  clearSessionKeys?: string[];
  onStart?: () => void;
  onStop?: () => void;
}) {
  const cfg = snapshot.config;
  const battle = cfg.mode === "battle";
  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return displayJoinUrl(snapshot.code);
  }, [snapshot.code]);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (battle) return;
    const id = setInterval(() => setTick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [battle]);

  const skew = snapshot.serverNow - Date.now();
  const liveMs =
    !battle && cfg.running && snapshot.startedAt != null
      ? Math.max(0, Date.now() + skew - snapshot.startedAt)
      : snapshot.lastElapsedMs;

  const patch = (partial: Partial<RoomConfig>) => {
    send({ type: "updateConfig", config: partial });
  };

  const needAnother = battle && snapshot.displays.length < 2;
  const winnerText =
    snapshot.winner === "green" ? "緑の勝ち" : snapshot.winner === "red" ? "赤の勝ち" : null;

  return (
    <div className="controller">
      <header className="controller-header">
        <div>
          <p className="eyebrow">Shuttle Touch</p>
          <h1>ルーム {snapshot.code}</h1>
        </div>
        <div className={`pill ${connected ? "ok" : "bad"}`}>
          {connected ? "接続中" : "再接続中…"}
        </div>
      </header>

      <section className="panel">
        <h2>{battle ? "勝負" : "タイム"}</h2>
        {battle ? (
          <>
            <p className="score-line">
              <span className="score green">緑 {snapshot.greenHits}</span>
              <span className="score red">赤 {snapshot.redHits}</span>
            </p>
            <p className="muted">{winnerText ?? `先に ${cfg.targetCount} 回`}</p>
          </>
        ) : (
          <>
            <p className="time-read">{liveMs != null ? formatSeconds(liveMs) : "–"}</p>
            <p className="muted">
              {snapshot.finishedAt != null
                ? `${cfg.targetCount} 回達成`
                : `${snapshot.hits} / ${cfg.targetCount}`}
            </p>
          </>
        )}
      </section>

      <section className="grid-2">
        <div className="panel">
          <h2>タップ端末</h2>
          <p className="muted">台数: {snapshot.displays.length}</p>
          <div className="qr-wrap">
            {displayUrl ? <QRCodeSVG value={displayUrl} size={160} /> : null}
          </div>
          <p className="mono url">{displayUrl}</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => navigator.clipboard.writeText(displayUrl)}
          >
            URLをコピー
          </button>
        </div>
        <div className="panel">
          <h2>操作</h2>
          <div className="btn-row">
            <button
              type="button"
              className="btn primary"
              disabled={needAnother}
              onClick={() => (onStart ? onStart() : send({ type: "start", local: true }))}
            >
              {snapshot.finishedAt != null || snapshot.winner ? "もう一度" : "開始"}
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => (onStop ? onStop() : send({ type: "stop" }))}
            >
              一時停止
            </button>
          </div>
          <label className="field">
            <span>モード</span>
            <select
              value={cfg.mode}
              onChange={(e) => patch({ mode: e.target.value as PlayMode })}
            >
              <option value="solo">1人（秒数）</option>
              <option value="battle">バトル（勝ち負け）</option>
            </select>
          </label>
          <label className="field">
            <span>回数: {cfg.targetCount}</span>
            <NumberSelect
              min={5}
              max={50}
              step={1}
              value={cfg.targetCount}
              onChange={(n) => patch({ targetCount: n })}
            />
          </label>
          <p className="muted">
            {needAnother
              ? "バトルは端末が2台以上必要です。"
              : battle
                ? "緑と赤が別の端末で光ります。先に回数へ届いた色の勝ちです。"
                : "光った端末をタップすると、別の端末が光ります。"}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>参加端末</h2>
        {snapshot.displays.length === 0 ? (
          <p className="muted">まだ端末がありません。QRを読み取ってください。</p>
        ) : (
          <ul className="device-list">
            {snapshot.displays.map((d) => (
              <li key={d.id}>
                <span className={`light-badge ${d.light}`} />
                <input
                  className="label-input"
                  value={d.label}
                  onChange={(e) =>
                    send({ type: "setLabel", deviceId: d.id, label: e.target.value })
                  }
                  placeholder="名前"
                />
                <span className={`dot ${d.connected ? "ok" : "bad"}`} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <SessionExit
        onStop={() => (onStop ? onStop() : send({ type: "stop" }))}
        clearSessionKeys={clearSessionKeys}
      />
    </div>
  );
}
