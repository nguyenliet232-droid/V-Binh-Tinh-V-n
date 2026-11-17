import { useEffect, useState } from "react";
import { ACHIEVEMENTS } from "../game/achievements";
import { formatDailyDateLabel } from "../game/dailyChallenge";
import { getShipSpec, SHIP_SPECS } from "../game/ships";
import type {
  AchievementProgressState,
  DailyChallengeSpec,
  DailyLeaderboardEntry,
  LeaderboardEntry,
  ShipId,
} from "../game/types";
import { ShipPreviewSvg, SoundIcon, TitleLockupSvg } from "./SvgIcons";

const BACKDROP_SRC =
  "/src/assets/images/starforge_title_backdrop_1794841236512.jpg";

interface TitleScreenProps {
  highScore: number;
  leaderboard: LeaderboardEntry[];
  dailyChallenge: DailyChallengeSpec;
  dailyLeaderboard: DailyLeaderboardEntry[];
  dailyModalOpen: boolean;
  onOpenDailyChallenge: () => void;
  difficulty: "standard" | "ace";
  onChangeDifficulty: (mode: "standard" | "ace") => void;
  selectedShip: ShipId;
  onSelectShip: (shipId: ShipId) => void;
  achievementProgress: AchievementProgressState;
  achievementsOpen: boolean;
  onOpenAchievements: () => void;
  onStart: () => void;
  onStartBossRush: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function TitleScreen({
  highScore,
  leaderboard,
  dailyChallenge,
  dailyLeaderboard,
  dailyModalOpen,
  onOpenDailyChallenge,
  difficulty,
  onChangeDifficulty,
  selectedShip,
  onSelectShip,
  achievementProgress,
  achievementsOpen,
  onOpenAchievements,
  onStart,
  onStartBossRush,
  muted,
  onToggleMute,
}: TitleScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<"global" | "daily">(
    "global",
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (achievementsOpen || dailyModalOpen) return;
      if (e.target instanceof HTMLButtonElement) {
        return;
      }
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [achievementsOpen, dailyModalOpen, onStart]);

  const unlockedCount = achievementProgress.unlockedIds.length;
  const totalAchievements = ACHIEVEMENTS.length;

  const topThreeSlots: (LeaderboardEntry | null)[] = [
    leaderboard[0] ?? null,
    leaderboard[1] ?? null,
    leaderboard[2] ?? null,
  ];
  const dailyThreeSlots: (DailyLeaderboardEntry | null)[] = [
    dailyLeaderboard[0] ?? null,
    dailyLeaderboard[1] ?? null,
    dailyLeaderboard[2] ?? null,
  ];
  const bestScore = leaderboard[0]?.score ?? highScore;
  const dailyBestScore = dailyLeaderboard[0]?.score ?? 0;
  const dailyDateLabel = formatDailyDateLabel(dailyChallenge.dateKey);
  const dailyShip = getShipSpec(dailyChallenge.forcedShipId);

  return (
    <div className="relative w-full h-full overflow-y-auto lg:overflow-hidden bg-[#080E1A]">
      {/* Full-viewport atmospheric key-art backdrop */}
      {!imgFailed ? (
        <img
          src={BACKDROP_SRC}
          alt="Chiến cơ Vệ Binh Tinh Vân trước vòng quỹ đạo cổ đại"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="fixed inset-0 w-full h-full object-cover object-center animate-backdrop-pan"
        />
      ) : (
        <div
          className="fixed inset-0"
          style={{
            background:
              "radial-gradient(circle at 72% 58%, rgba(245,158,11,0.16), transparent 45%), radial-gradient(circle at 30% 40%, rgba(56,189,248,0.12), transparent 55%), #080E1A",
          }}
        />
      )}

      {/* Measured contrast scrim securing high legibility across both columns */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(8,14,26,0.95) 0%, rgba(8,14,26,0.82) 48%, rgba(8,14,26,0.72) 74%, rgba(8,14,26,0.88) 100%)",
        }}
      />

      {/* Top-right Achievements & Mute controls */}
      <div className="absolute top-5 right-6 z-20 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenAchievements}
          aria-label={`Xem thành tựu (${unlockedCount}/${totalAchievements})`}
          className="flex items-center gap-2 h-11 px-3.5 rounded-lg bg-[#0C1424]/85 border border-slate-700/70 text-slate-200 hover:text-amber-400 hover:border-amber-400/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-amber-400 shrink-0"
          >
            <path
              d="M7 4h10v5a5 5 0 0 1-10 0V4Zm-3 2h3v3H5a1 1 0 0 1-1-1V6Zm13 0h3v2a1 1 0 0 1-1 1h-2V6Zm-5 8v4m-4 2h8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs font-medium text-slate-200">Thành tựu</span>
          <span className="font-mono tabular-nums text-xs font-bold text-amber-300">
            {unlockedCount}/{totalAchievements}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
          className="flex items-center justify-center w-11 h-11 rounded-lg bg-[#0C1424]/85 border border-slate-700/70 text-slate-200 hover:text-amber-400 hover:border-amber-400/60 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <SoundIcon muted={muted} />
        </button>
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 min-h-full lg:h-full max-w-6xl mx-auto flex flex-col justify-between px-6 py-6 sm:px-10 sm:py-7 lg:px-12 lg:py-8 gap-5">
        <div className="hidden lg:block" />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] gap-7 lg:gap-10 items-center">
          {/* Left Column: Title Lockup, Difficulty, Primary CTAs & Mini Leaderboard */}
          <div className="flex flex-col items-start gap-4">
            <TitleLockupSvg />

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">
              Điều khiển chiến cơ xuyên qua các đợt tàu địch, né đường đạn cảnh
              báo và tích hợp nâng cấp hỏa lực sau mỗi vòng chiến đấu.
            </p>

            {/* Segmented difficulty selector */}
            <div
              role="group"
              aria-label="Chọn độ khó"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#0E172A] border border-slate-700/70"
            >
              <button
                type="button"
                onClick={() => onChangeDifficulty("standard")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  difficulty === "standard"
                    ? "bg-slate-800 text-slate-50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tiêu chuẩn
              </button>
              <button
                type="button"
                onClick={() => onChangeDifficulty("ace")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  difficulty === "ace"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Át chủ bài
              </button>
            </div>

            {/* Primary Start CTA + Boss Rush Mode + Daily Challenge CTA */}
            <div className="flex flex-col items-start gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onStart}
                  className="px-7 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-display font-bold text-base sm:text-lg tracking-wide transition-transform duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  Bắt đầu
                </button>

                <button
                  type="button"
                  onClick={onStartBossRush}
                  className="px-5 py-2.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 active:scale-[0.98] border border-rose-400/50 text-slate-50 font-display font-bold text-base sm:text-lg tracking-wide transition-transform duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                >
                  Boss Rush
                </button>

                <button
                  type="button"
                  onClick={onOpenDailyChallenge}
                  className="px-4 py-2.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 active:scale-[0.98] border border-sky-400/60 text-sky-200 font-display font-bold text-base sm:text-lg tracking-wide transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                >
                  Thử thách Ngày
                </button>
              </div>
              <p className="text-xs text-slate-400 tracking-wide">
                <span className="text-sky-300 font-medium">
                  {dailyChallenge.codeName}
                </span>
                {" · "}
                <span>{dailyShip.name}</span>
                {" · "}
                <span className="font-mono tabular-nums text-amber-300">
                  x{dailyChallenge.scoreMultiplier.toFixed(2)} điểm
                </span>
              </p>
            </div>

            {/* Mini Leaderboard: Global Top 3 & Dedicated Daily Top 3 */}
            <section
              aria-label="Bảng xếp hạng"
              className="w-full max-w-md rounded-lg bg-[#0B1322]/90 border border-slate-700/70 px-4 py-2.5"
            >
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className={
                      leaderboardTab === "daily"
                        ? "text-sky-300 shrink-0"
                        : "text-amber-400 shrink-0"
                    }
                  >
                    <path
                      d="M7 4h10v5a5 5 0 0 1-10 0V4Zm-3 2h3v3H5a1 1 0 0 1-1-1V6Zm13 0h3v2a1 1 0 0 1-1 1h-2V6Zm-5 8v4m-4 2h8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-xs font-semibold tracking-wider text-slate-200 truncate">
                    {leaderboardTab === "daily"
                      ? `Ngày ${dailyDateLabel}`
                      : "Bảng xếp hạng"}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 hidden sm:inline">
                    {leaderboardTab === "daily"
                      ? dailyBestScore > 0
                        ? `Top ${dailyBestScore.toLocaleString("vi-VN")}`
                        : "Top 3"
                      : bestScore > 0
                        ? `Kỷ lục ${bestScore.toLocaleString("vi-VN")}`
                        : "Top 3"}
                  </span>
                  <div
                    role="tablist"
                    aria-label="Chế độ bảng xếp hạng"
                    className="inline-flex items-center p-0.5 rounded bg-[#070C17] border border-slate-800"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={leaderboardTab === "global"}
                      onClick={() => setLeaderboardTab("global")}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded-sm transition-colors cursor-pointer ${
                        leaderboardTab === "global"
                          ? "bg-slate-800 text-amber-300"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Chung
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={leaderboardTab === "daily"}
                      onClick={() => setLeaderboardTab("daily")}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded-sm transition-colors cursor-pointer ${
                        leaderboardTab === "daily"
                          ? "bg-sky-500/20 text-sky-300"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Ngày
                    </button>
                  </div>
                </div>
              </div>

              {leaderboardTab === "global" ? (
                <ol className="divide-y divide-slate-800/80">
                  {topThreeSlots.map((entry, idx) => {
                    const rank = idx + 1;
                    const rankColor =
                      rank === 1
                        ? "text-amber-400"
                        : rank === 2
                          ? "text-sky-300"
                          : "text-slate-300";

                    return (
                      <li
                        key={entry ? entry.id : `empty-slot-${rank}`}
                        className="flex items-center justify-between gap-3 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`font-mono tabular-nums font-bold w-6 shrink-0 ${
                              entry ? rankColor : "text-slate-600"
                            }`}
                          >
                            #{rank}
                          </span>
                          {entry ? (
                            <span className="text-slate-300 truncate">
                              {entry.difficulty === "boss_rush"
                                ? "Trùm #"
                                : "Đợt "}
                              <span className="font-mono tabular-nums text-slate-200">
                                {String(entry.wave).padStart(2, "0")}
                              </span>
                              <span
                                aria-hidden="true"
                                className="mx-1.5 text-slate-600"
                              >
                                ·
                              </span>
                              <span
                                className={
                                  entry.difficulty === "boss_rush"
                                    ? "text-rose-300 font-medium"
                                    : entry.difficulty === "ace"
                                      ? "text-amber-300 font-medium"
                                      : "text-slate-400"
                                }
                              >
                                {entry.difficulty === "boss_rush"
                                  ? "Boss Rush"
                                  : entry.difficulty === "ace"
                                    ? "Át chủ bài"
                                    : "Tiêu chuẩn"}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              Chưa có thành tích
                            </span>
                          )}
                        </div>

                        <span
                          className={`font-mono tabular-nums font-bold shrink-0 ${
                            entry
                              ? rank === 1
                                ? "text-sm text-amber-400"
                                : "text-sm text-slate-100"
                              : "text-slate-600"
                          }`}
                        >
                          {entry ? entry.score.toLocaleString("vi-VN") : "---"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <ol className="divide-y divide-slate-800/80">
                  {dailyThreeSlots.map((entry, idx) => {
                    const rank = idx + 1;
                    const rankColor =
                      rank === 1
                        ? "text-amber-400"
                        : rank === 2
                          ? "text-sky-300"
                          : "text-slate-300";
                    const entryShip = entry ? getShipSpec(entry.shipId) : null;

                    return (
                      <li
                        key={entry ? entry.id : `empty-daily-${rank}`}
                        className="flex items-center justify-between gap-3 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`font-mono tabular-nums font-bold w-6 shrink-0 ${
                              entry ? rankColor : "text-slate-600"
                            }`}
                          >
                            #{rank}
                          </span>
                          {entry && entryShip ? (
                            <span className="text-slate-300 truncate">
                              Đợt{" "}
                              <span className="font-mono tabular-nums text-slate-200">
                                {String(entry.wave).padStart(2, "0")}
                              </span>
                              <span
                                aria-hidden="true"
                                className="mx-1.5 text-slate-600"
                              >
                                ·
                              </span>
                              <span className="text-sky-300 font-medium">
                                {entryShip.name}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              Chưa có điểm hôm nay
                            </span>
                          )}
                        </div>

                        <span
                          className={`font-mono tabular-nums font-bold shrink-0 ${
                            entry
                              ? rank === 1
                                ? "text-sm text-amber-400"
                                : "text-sm text-slate-100"
                              : "text-slate-600"
                          }`}
                        >
                          {entry ? entry.score.toLocaleString("vi-VN") : "---"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>

          {/* Right Column: Ship Hangar (3 selectable ship classes) */}
          <section
            aria-label="Xưởng Chiến Cơ"
            className="flex flex-col gap-3 w-full max-w-lg lg:ml-auto"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-100 tracking-tight">
                Xưởng Chiến Cơ
              </h2>
              <span className="text-xs text-slate-400">
                Chọn 1 trong 3 mẫu tàu xuất kích
              </span>
            </div>

            <div
              role="radiogroup"
              aria-label="Chọn chiến cơ"
              className="flex flex-col gap-2.5"
            >
              {SHIP_SPECS.map((ship) => {
                const active = ship.id === selectedShip;
                const borderStyle = active
                  ? ship.accentTone === "amber"
                    ? "border-amber-400/80 bg-[#131F35]/95"
                    : ship.accentTone === "sky"
                      ? "border-sky-400/80 bg-[#131F35]/95"
                      : "border-emerald-400/80 bg-[#131F35]/95"
                  : "border-slate-700/70 bg-[#0B1322]/90 hover:border-slate-500/80 hover:bg-[#101B30]/95";

                const barColor =
                  ship.accentTone === "amber"
                    ? "bg-amber-400"
                    : ship.accentTone === "sky"
                      ? "bg-sky-400"
                      : "bg-emerald-400";

                const activeLabelColor =
                  ship.accentTone === "amber"
                    ? "text-amber-300"
                    : ship.accentTone === "sky"
                      ? "text-sky-300"
                      : "text-emerald-300";

                return (
                  <button
                    key={ship.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSelectShip(ship.id)}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${borderStyle}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <ShipPreviewSvg shipId={ship.id} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-display text-sm sm:text-base font-bold text-slate-50 truncate">
                            {ship.name}
                          </span>
                          <span className="text-xs text-slate-400 truncate">
                            {ship.roleLabel} · {ship.statsDisplay.vitals}
                          </span>
                          <span className="flex items-center gap-1.5 text-[11px] text-slate-300 mt-0.5 truncate">
                            <span
                              aria-hidden="true"
                              className="inline-block w-4 h-1 rounded-sm shrink-0"
                              style={{
                                background: `linear-gradient(90deg, transparent 0%, ${ship.exhaust.primaryHex} 55%, ${ship.exhaust.secondaryHex} 100%)`,
                              }}
                            />
                            <span className="truncate">
                              {ship.exhaust.label}
                            </span>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                          active ? activeLabelColor : "text-slate-500"
                        }`}
                      >
                        {active ? "Đang chọn" : "Chọn"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-2.5 pt-2.5 border-t border-slate-800/80">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="text-slate-400">Tốc độ</span>
                          <span className="font-mono tabular-nums text-slate-200 font-medium">
                            {ship.statsDisplay.speed}
                          </span>
                        </div>
                        <div className="h-1 w-full rounded-sm bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full ${active ? barColor : "bg-slate-500"}`}
                            style={{ width: `${ship.statBars.speed}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="text-slate-400">Tản đạn</span>
                          <span className="font-mono tabular-nums text-slate-200 font-medium">
                            {ship.statsDisplay.spread}
                          </span>
                        </div>
                        <div className="h-1 w-full rounded-sm bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full ${active ? barColor : "bg-slate-500"}`}
                            style={{ width: `${ship.statBars.firepower}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="text-slate-400">Hồi khiên</span>
                          <span className="font-mono tabular-nums text-slate-200 font-medium">
                            {ship.statsDisplay.shieldRegen}
                          </span>
                        </div>
                        <div className="h-1 w-full rounded-sm bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full ${active ? barColor : "bg-slate-500"}`}
                            style={{ width: `${ship.statBars.shieldRegen}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Single flat control-hint line */}
        <p className="text-xs sm:text-sm text-slate-400 tracking-wide">
          WASD Di chuyển · Chuột Ngắm &amp; Bắn · Space Lướt · Q Giãn thời gian
          · E Xung lực · Esc Tạm dừng
        </p>
      </div>
    </div>
  );
}
