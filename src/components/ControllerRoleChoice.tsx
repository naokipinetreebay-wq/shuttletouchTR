"use client";

export type ControllerRoleMode = "controlOnly" | "alsoDisplay";

export function ControllerRoleChoice({
  value,
  onChange,
}: {
  value: ControllerRoleMode | null;
  onChange: (mode: ControllerRoleMode) => void;
}) {
  return (
    <div className="role-choice">
      <button
        type="button"
        className={`role-card ${value === "controlOnly" ? "selected" : ""}`}
        onClick={() => onChange("controlOnly")}
      >
        <span className="role-title">操作専用のまま</span>
        <span className="role-desc">この端末はコントローラだけ。光る対象にはなりません。</span>
      </button>
      <button
        type="button"
        className={`role-card ${value === "alsoDisplay" ? "selected" : ""}`}
        onClick={() => onChange("alsoDisplay")}
      >
        <span className="role-title">この端末も光らせる</span>
        <span className="role-desc">
          コントローラに加え、この端末もタップ対象になります（台数が1つ足ります）。
        </span>
      </button>
    </div>
  );
}
