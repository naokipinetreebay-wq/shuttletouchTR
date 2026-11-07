"use client";

import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import {
  ControllerRoleChoice,
  type ControllerRoleMode,
} from "@/components/ControllerRoleChoice";
import { SessionExit } from "@/components/SessionExit";
import type { ClientMessage, PlayMode, RoomConfig, RoomSnapshot } from "@/lib/types";

const STEPS = ["説明", "役割", "設定", "端末", "確認"] as const;

export function SetupWizard({
  snapshot,
  connected,
  send,
  roleMode,
  onRoleModeChange,
  onDone,
}: {
  snapshot: RoomSnapshot;
  connected: boolean;
  send: (msg: ClientMessage) => void;
  roleMode: ControllerRoleMode | null;
  onRoleModeChange: (mode: ControllerRoleMode) => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const cfg = snapshot.config;
  const battle = cfg.mode === "battle";
  const displayUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/d/?code=${snapshot.code}`;
  }, [snapshot.code]);

  const patch = (partial: Partial<RoomConfig>) => {
    send({ type: "updateConfig", config: partial });
  };

  const joined = snapshot.displays.length;
  const canLeaveRole = roleMode !== null;
  const canLeaveDevices = battle ? joined >= 2 : joined >= 1;

  return (
    <div className="wizard">
      <header className="wizard-top">
        <div>
          <p className="eyebrow">Shuttle Touch · セットアップ</p>
          <h1>ルーム {snapshot.code}</h1>
        </div>
        <div className="wizard-top-actions">
          <SessionExit compact />
          <div className={`pill ${connected ? "ok" : "bad"}`}>
            {connected ? "接続中" : "再接続中…"}
          </div>
        </div>
      </header>

      <ol className="wizard-steps" aria-label="手順">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? "active" : i < step ? "done" : ""}>
            <span className="n">{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <section className="panel wizard-panel">
        {step === 0 ? (
          <div className="wizard-body">
            <h2>シャトルタッチ</h2>
            <ul className="explain-list">
              <li>光っている端末をタップすると消え、別の端末が光ります。</li>
              <li>消えている端末を押しても進みません。</li>
              <li>1人モードは、設定回数までの秒数を計ります。</li>
              <li>バトルは緑と赤が同時に光ります。先に回数へ届いた色の勝ちです。</li>
            </ul>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="wizard-body">
            <h2>この端末の役割</h2>
            <ControllerRoleChoice value={roleMode} onChange={onRoleModeChange} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-body">
            <h2>モードと回数</h2>
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
              <input
                type="range"
                min={5}
                max={50}
                step={1}
                value={cfg.targetCount}
                onChange={(e) => patch({ targetCount: Number(e.target.value) })}
              />
            </label>
            <p className="muted">5回から50回までです。バトルは端末が2台以上必要です。</p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wizard-body">
            <h2>端末を参加させる</h2>
            <p className="join-meter">
              参加 {joined} 台{battle ? "（2台以上）" : ""}
            </p>
            <div className="qr-wrap">
              {displayUrl ? <QRCodeSVG value={displayUrl} size={180} /> : null}
            </div>
            <p className="mono url">{displayUrl}</p>
            {joined > 0 ? (
              <ul className="device-list">
                {snapshot.displays.map((d) => (
                  <li key={d.id}>
                    <input
                      className="label-input"
                      value={d.label}
                      onChange={(e) =>
                        send({ type: "setLabel", deviceId: d.id, label: e.target.value })
                      }
                    />
                    <span className={`dot ${d.connected ? "ok" : "bad"}`} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="wizard-body">
            <h2>準備完了</h2>
            <ul className="summary-list">
              <li>役割: {roleMode === "alsoDisplay" ? "この端末も光る" : "操作専用"}</li>
              <li>端末 {joined} 台</li>
              <li>
                {battle ? `バトル ${cfg.targetCount} 回先取` : `1人 ${cfg.targetCount} 回の秒数`}
              </li>
            </ul>
            <p className="muted">「はじめる」で最初の端末が光ります。</p>
          </div>
        ) : null}
      </section>

      <footer className="wizard-nav">
        <button
          type="button"
          className="btn"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          戻る
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn primary"
            disabled={(step === 1 && !canLeaveRole) || (step === 3 && !canLeaveDevices)}
            onClick={() => setStep((s) => s + 1)}
          >
            {step === 1 && !canLeaveRole
              ? "役割を選ぶ"
              : step === 3 && !canLeaveDevices
                ? battle
                  ? "端末を2台以上登録"
                  : "端末を1台以上登録"
                : "次へ"}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={onDone}>
            はじめる
          </button>
        )}
      </footer>
      <SessionExit onStop={() => send({ type: "stop" })} />
    </div>
  );
}
