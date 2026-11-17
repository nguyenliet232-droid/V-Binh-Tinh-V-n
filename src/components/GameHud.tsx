import type { AchievementUnlockEvent, HudSnapshot } from "../game/types";
import { HullIcon, PauseIcon, ShieldIcon, SoundIcon } from "./SvgIcons";

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  achievementToasts: AchievementUnlockEvent[];
  onToggleMute: () => void;
  onPause: () => void;
}

export function GameHud({
  hud,
  muted,
  achievementToasts,
  onToggleMute,
  onPause,
}: GameHudProps) {
  const empReady = hud.empCharge >= 100;
  const dashReady = hud.dashCooldownRatio >= 0.99;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Perimeter Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Hull, Shield, EMP & Dash cluster */}
        <div className="flex flex-col gap-2 bg-[#0B1322]/90 border border-slate-700/60 rounded-lg px-3.5 py-2.5 min-w-[210px]">
          {/* Hull HP */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-300">Giáp</span>
            <div
              className="flex items-center gap-1"
              aria-label={`Giáp ${hud.hp} trên ${hud.maxHp}`}
            >
              {Array.from({ length: hud.maxHp }).map((_, idx) => (
                <HullIcon key={idx} filled={idx < hud.hp} />
              ))}
              <span className="ml-1.5 font-mono tabular-nums text-xs font-bold text-emerald-300">
                {hud.hp}/{hud.maxHp}
              </span>
            </div>
          </div>

          {/* Energy Shield */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-300">Khiên</span>
              <div
                className="flex items-center gap-1"
                aria-label={`Khiên ${hud.shield} trên ${hud.maxShield}`}
              >
                {Array.from({ length: hud.maxShield }).map((_, idx) => (
                  <ShieldIcon key={idx} filled={idx < hud.shield} />
                ))}
                <span className="ml-1.5 font-mono tabular-nums text-xs font-bold text-sky-300">
                  {hud.shield}/{hud.maxShield}
                </span>
              </div>
            </div>

            {hud.shield < hud.maxShield && (
              <div className="flex flex-col gap-1 pt-0.5">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={
                      hud.shieldRechargeBlockedByBoss
                        ? "text-rose-300/90 font-medium"
                        : "text-sky-300/90 font-medium"
                    }
                  >
                    {hud.shieldRechargeBlockedByBoss
                      ? hud.dailyShieldRegenDisabled
                        ? "Mạch khiên bị ngắt"
                        : "Khóa nạp khi đấu Trùm"
                      : "Nạp khiên"}
                  </span>
                  {!hud.shieldRechargeBlockedByBoss && (
                    <span className="font-mono tabular-nums text-sky-200">
                      {hud.shieldRechargeRemaining.toFixed(1)}s
                    </span>
                  )}
                </div>
                {!hud.shieldRechargeBlockedByBoss && (
                  <div className="h-1 w-full rounded-sm bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-400 transition-[width] duration-75"
                      style={{
                        width: `${Math.round(hud.shieldRechargeProgress * 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EMP, Dash & Time Dilation meters */}
          <div className="grid grid-cols-3 gap-2.5 pt-1 border-t border-slate-800">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] gap-1">
                <span
                  className={
                    empReady
                      ? "text-amber-300 font-semibold whitespace-nowrap"
                      : "text-slate-400 whitespace-nowrap"
                  }
                >
                  Xung [E]
                </span>
                <span className="font-mono tabular-nums text-slate-200">
                  {hud.empCharge}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-150 ${
                    empReady ? "bg-amber-400" : "bg-amber-500/75"
                  }`}
                  style={{ width: `${Math.min(100, hud.empCharge)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] gap-1">
                <span
                  className={
                    hud.dashActive
                      ? "text-emerald-300 font-semibold whitespace-nowrap"
                      : dashReady
                        ? "text-sky-300 font-semibold whitespace-nowrap"
                        : "text-slate-400 whitespace-nowrap"
                  }
                >
                  Lướt [Space]
                </span>
                <span
                  className={`font-mono tabular-nums ${
                    hud.dashActive
                      ? "text-emerald-300 font-semibold"
                      : dashReady
                        ? "text-sky-200 font-semibold"
                        : "text-slate-200"
                  }`}
                >
                  {hud.dashActive
                    ? "Miễn nhiễm"
                    : dashReady
                      ? "Sẵn"
                      : `${hud.dashCooldownSeconds.toFixed(1)}s`}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    hud.dashActive
                      ? "bg-emerald-400"
                      : dashReady
                        ? "bg-sky-400"
                        : "bg-sky-500/60"
                  }`}
                  style={{
                    width: `${
                      hud.dashActive
                        ? Math.max(
                            15,
                            Math.min(
                              100,
                              Math.round(
                                (hud.dashInvulnRemaining / 0.34) * 100,
                              ),
                            ),
                          )
                        : Math.round(hud.dashCooldownRatio * 100)
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] gap-1">
                <span
                  className={
                    hud.timeDilationActive
                      ? "text-indigo-300 font-semibold whitespace-nowrap"
                      : hud.timeDilationCooldownRatio >= 0.99
                        ? "text-indigo-300 font-semibold whitespace-nowrap"
                        : "text-slate-400 whitespace-nowrap"
                  }
                >
                  Chậm [Q]
                </span>
                <span className="font-mono tabular-nums text-slate-200">
                  {hud.timeDilationActive
                    ? `${hud.timeDilationRemaining.toFixed(1)}s`
                    : hud.timeDilationCooldownRatio >= 0.99
                      ? "Sẵn"
                      : `${Math.ceil(hud.timeDilationCooldownSeconds)}s`}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
                <div
                  className={`h-full ${
                    hud.timeDilationActive
                      ? "bg-indigo-400"
                      : hud.timeDilationCooldownRatio >= 0.99
                        ? "bg-indigo-400"
                        : "bg-indigo-500/55"
                  }`}
                  style={{
                    width: `${
                      hud.timeDilationActive
                        ? Math.round((hud.timeDilationRemaining / 2.6) * 100)
                        : Math.round(hud.timeDilationCooldownRatio * 100)
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top-Center: Boss HP Bar (only active on Boss wave) */}
        {hud.bossActive && (
          <div
            className={`hidden sm:flex flex-col gap-1.5 bg-[#0B1322]/90 rounded-lg px-4 py-2.5 w-72 md:w-96 border ${
              hud.bossStage === 2 ? "border-amber-400/70" : "border-rose-500/50"
            }`}
          >
            <div className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display font-bold text-rose-300 tracking-wide truncate">
                  {hud.bossName}
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span
                  className={`font-semibold whitespace-nowrap ${
                    hud.bossStage === 2 ? "text-amber-400" : "text-slate-400"
                  }`}
                >
                  {hud.bossStage === 2 ? "GĐ 2 · Cuồng nộ" : "GĐ 1"}
                </span>
              </div>
              <span className="font-mono tabular-nums text-rose-200 shrink-0">
                {Math.ceil(hud.bossHp)} / {hud.bossMaxHp}
              </span>
            </div>
            <div className="relative h-2 w-full rounded-sm bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-[width] duration-100 ${
                  hud.bossStage === 2 ? "bg-amber-500" : "bg-rose-500"
                }`}
                style={{
                  width: `${Math.max(0, Math.min(100, (hud.bossHp / hud.bossMaxHp) * 100))}%`,
                }}
              />
              {/* 50% Phase transition threshold marker */}
              <div
                aria-hidden="true"
                className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-950/80"
              />
            </div>
          </div>
        )}

        {/* Top-Right: Wave, Score, Combo & Action Controls */}
        <div className="flex items-start gap-2.5">
          <div className="bg-[#0B1322]/90 border border-slate-700/60 rounded-lg px-4 py-2.5 flex flex-col items-end gap-1">
            {hud.mode === "boss_rush" && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                BOSS RUSH
              </span>
            )}
            {hud.mode === "daily" && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 font-mono tabular-nums">
                THỬ THÁCH NGÀY
                {hud.dailyScoreMultiplier
                  ? ` · x${hud.dailyScoreMultiplier.toFixed(2)}`
                  : ""}
              </span>
            )}
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <span className="font-semibold text-slate-100">
                {hud.mode === "boss_rush" ? "Trùm #" : "Đợt "}
                <span className="font-mono tabular-nums">
                  {String(hud.wave).padStart(2, "0")}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Địch{" "}
                <span className="font-mono tabular-nums text-rose-300">
                  {hud.enemiesRemaining}
                </span>
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              {hud.combo > 1 && (
                <span className="font-mono tabular-nums text-sm font-bold text-amber-400">
                  x{hud.combo}
                </span>
              )}
              <span className="font-mono tabular-nums text-xl font-bold text-slate-50 tracking-tight">
                {hud.score.toLocaleString("vi-VN")}
              </span>
            </div>

            {hud.mode === "boss_rush" && (
              <span
                className={`text-[11px] font-medium font-mono tabular-nums ${
                  hud.bossRushUpgradesLeft > 0
                    ? "text-rose-300/90"
                    : "text-slate-400"
                }`}
              >
                {hud.bossRushUpgradesLeft > 0
                  ? `Nâng cấp còn ${hud.bossRushUpgradesLeft}/3`
                  : "Hết nâng cấp"}
              </span>
            )}

            {hud.mode === "daily" &&
              hud.dailyMaxUpgrades !== null &&
              hud.dailyMaxUpgrades !== undefined &&
              hud.dailyUpgradesLeft !== null &&
              hud.dailyUpgradesLeft !== undefined && (
                <span
                  className={`text-[11px] font-medium font-mono tabular-nums ${
                    hud.dailyUpgradesLeft > 0
                      ? "text-amber-300/90"
                      : "text-slate-400"
                  }`}
                >
                  {hud.dailyUpgradesLeft > 0
                    ? `Nâng cấp còn ${hud.dailyUpgradesLeft}/${hud.dailyMaxUpgrades}`
                    : "Hết nâng cấp"}
                </span>
              )}

            {hud.overdriveTimer > 0 && (
              <span className="text-[11px] font-semibold text-sky-300 font-mono tabular-nums">
                Quá tải {hud.overdriveTimer.toFixed(1)}s
              </span>
            )}
          </div>

          {/* Interactive Mute & Pause Controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
              className="flex items-center justify-center w-11 h-11 rounded-lg bg-[#0B1322]/90 border border-slate-700/60 text-slate-200 hover:text-amber-400 hover:border-amber-400/60 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <SoundIcon muted={muted} />
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Tạm dừng"
              className="flex items-center justify-center w-11 h-11 rounded-lg bg-[#0B1322]/90 border border-slate-700/60 text-slate-200 hover:text-amber-400 hover:border-amber-400/60 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <PauseIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Perimeter Row: Mobile Boss Bar & Achievement Unlock Toasts */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
        {hud.bossActive ? (
          <div
            className={`sm:hidden self-center bg-[#0B1322]/90 rounded-lg px-3.5 py-2 w-full max-w-xs border ${
              hud.bossStage === 2 ? "border-amber-400/70" : "border-rose-500/50"
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1 gap-2">
              <span className="font-display font-bold text-rose-300 truncate">
                {hud.bossName} · {hud.bossStage === 2 ? "GĐ 2" : "GĐ 1"}
              </span>
              <span className="font-mono tabular-nums text-rose-200 shrink-0">
                {Math.ceil(hud.bossHp)}
              </span>
            </div>
            <div className="relative h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${hud.bossStage === 2 ? "bg-amber-500" : "bg-rose-500"}`}
                style={{
                  width: `${Math.max(0, Math.min(100, (hud.bossHp / hud.bossMaxHp) * 100))}%`,
                }}
              />
              <div
                aria-hidden="true"
                className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-950/80"
              />
            </div>
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}

        {achievementToasts.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col gap-2 items-center sm:items-end w-full sm:w-auto sm:ml-auto"
          >
            {achievementToasts.map((toast) => {
              const borderClass =
                toast.accentTone === "sky"
                  ? "border-sky-400/80"
                  : toast.accentTone === "emerald"
                    ? "border-emerald-400/80"
                    : "border-amber-400/80";
              const iconClass =
                toast.accentTone === "sky"
                  ? "text-sky-300"
                  : toast.accentTone === "emerald"
                    ? "text-emerald-300"
                    : "text-amber-400";

              return (
                <div
                  key={`${toast.id}-${toast.unlockedAt}`}
                  className={`flex items-center gap-3 rounded-lg bg-[#0B1322]/95 border ${borderClass} px-4 py-2.5 max-w-xs sm:max-w-sm shadow-lg transition-all duration-200`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className={`${iconClass} shrink-0`}
                  >
                    <path
                      d="M7 4h10v5a5 5 0 0 1-10 0V4Zm-3 2h3v3H5a1 1 0 0 1-1-1V6Zm13 0h3v2a1 1 0 0 1-1 1h-2V6Zm-5 8v4m-4 2h8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-[11px] font-semibold tracking-wide ${iconClass}`}
                    >
                      Mở khóa thành tựu
                    </span>
                    <span className="font-display text-sm font-bold text-slate-50 truncate">
                      {toast.title}
                    </span>
                    <span className="text-xs text-slate-300 truncate">
                      {toast.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
