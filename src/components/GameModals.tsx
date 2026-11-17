import { useEffect } from "react";
import { ACHIEVEMENTS, getAchievementMetricValue } from "../game/achievements";
import { formatDailyDateLabel } from "../game/dailyChallenge";
import { getShipSpec } from "../game/ships";
import type {
  AchievementProgressState,
  DailyChallengeSpec,
  DailyLeaderboardEntry,
  DifficultyMode,
  RunSummary,
  UpgradeId,
  UpgradeOption,
} from "../game/types";
import { UPGRADE_CATALOG } from "../game/upgrades";
import { ShipPreviewSvg, UpgradeIcon } from "./SvgIcons";

interface PausedModalProps {
  mode: DifficultyMode;
  wave: number;
  score: number;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function PausedModal({
  mode,
  wave,
  score,
  onResume,
  onRestart,
  onQuitToTitle,
}: PausedModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#060B14]/80 p-4"
    >
      <div className="w-full max-w-sm rounded-xl bg-[#0F182A] border border-slate-700/70 p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2
            id="pause-title"
            className="font-display text-2xl font-bold text-slate-50"
          >
            Tạm dừng
          </h2>
          <p className="text-sm text-slate-400 font-mono tabular-nums">
            {mode === "boss_rush"
              ? `Boss Rush · Trùm #${String(wave).padStart(2, "0")}`
              : mode === "daily"
                ? `Thử thách Ngày · Đợt ${String(wave).padStart(2, "0")}`
                : `Đợt ${String(wave).padStart(2, "0")}`}{" "}
            · {score.toLocaleString("vi-VN")} điểm
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tiếp tục
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Chơi lại
          </button>
          <button
            type="button"
            onClick={onQuitToTitle}
            className="w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-slate-800/70 text-slate-300 font-medium text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Về màn hình chính
          </button>
        </div>
      </div>
    </div>
  );
}

interface RoundSummaryModalProps {
  mode: DifficultyMode;
  upgradesLeft?: number;
  waveCleared: number;
  choices: UpgradeOption[];
  currentStacks: Partial<Record<UpgradeId, number>>;
  onSelectUpgrade: (id: UpgradeId) => void;
}

export function RoundSummaryModal({
  mode,
  upgradesLeft = 0,
  waveCleared,
  choices,
  currentStacks,
  onSelectUpgrade,
}: RoundSummaryModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1" && choices[0]) {
        onSelectUpgrade(choices[0].id);
      } else if (e.key === "2" && choices[1]) {
        onSelectUpgrade(choices[1].id);
      } else if (e.key === "3" && choices[2]) {
        onSelectUpgrade(choices[2].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choices, onSelectUpgrade]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="round-clear-title"
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#060B14]/82 p-4 sm:p-8"
    >
      <div className="w-full max-w-3xl rounded-xl bg-[#0F182A] border border-slate-700/70 p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <p
            className={`text-xs font-semibold tracking-wide ${
              mode === "boss_rush"
                ? "text-rose-300"
                : mode === "daily"
                  ? "text-sky-300"
                  : "text-emerald-400"
            }`}
          >
            {mode === "boss_rush"
              ? `Hạ gục Trùm #${String(waveCleared).padStart(2, "0")} · Boss Rush`
              : mode === "daily"
                ? `Hoàn thành Đợt ${String(waveCleared).padStart(2, "0")} · Thử thách Ngày`
                : `Hoàn thành Đợt ${String(waveCleared).padStart(2, "0")}`}
          </p>
          <h2
            id="round-clear-title"
            className="font-display text-2xl sm:text-3xl font-bold text-slate-50"
          >
            {mode === "boss_rush"
              ? "Chọn nâng cấp cho Trùm tiếp theo"
              : "Chọn nâng cấp cho đợt tiếp theo"}
          </h2>
          <p className="text-sm text-slate-400">
            {mode === "boss_rush" || (mode === "daily" && upgradesLeft > 0)
              ? `Tài nguyên giới hạn · còn ${upgradesLeft} lượt nâng cấp. Nhấn chọn mô-đun hoặc bấm 1, 2, 3.`
              : "Nhấn chọn một mô-đun bên dưới hoặc bấm phím 1, 2, 3 trên bàn phím."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {choices.map((opt, idx) => {
            const stack = currentStacks[opt.id] ?? 0;
            const accentRing =
              opt.accentColor === "amber"
                ? "text-amber-400 border-amber-500/30 group-hover:border-amber-400"
                : opt.accentColor === "sky"
                  ? "text-sky-400 border-sky-500/30 group-hover:border-sky-400"
                  : "text-emerald-400 border-emerald-500/30 group-hover:border-emerald-400";

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectUpgrade(opt.id)}
                className="group text-left rounded-lg bg-[#131F35] hover:bg-[#192844] border border-slate-700/80 hover:border-amber-400/70 p-5 flex flex-col justify-between gap-4 transition-all duration-150 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 rounded-lg bg-[#0C1424] border flex items-center justify-center ${accentRing}`}
                    >
                      <UpgradeIcon id={opt.id} />
                    </div>
                    <span className="font-mono tabular-nums text-xs text-slate-400">
                      [{idx + 1}] · Cấp {stack + 1}/{opt.maxStacks}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-slate-50">
                    {opt.name}
                  </h3>

                  <p className="text-sm text-slate-300 leading-relaxed">
                    {opt.effectText}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-700/60 text-xs font-semibold text-amber-300">
                  {opt.statDelta}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  summary: RunSummary;
  onPlayAgain: () => void;
  onQuitToTitle: () => void;
}

export function GameOverModal({
  summary,
  onPlayAgain,
  onQuitToTitle,
}: GameOverModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter") {
        e.preventDefault();
        onPlayAgain();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPlayAgain]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#060B14]/84 p-4"
    >
      <div className="w-full max-w-md rounded-xl bg-[#0F182A] border border-slate-700/70 p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          {summary.isNewRecord && (
            <p className="text-xs font-semibold text-amber-400 tracking-wide">
              {summary.mode === "daily"
                ? "Kỷ lục Thử thách Ngày mới được thiết lập"
                : "Kỷ lục mới được thiết lập"}
            </p>
          )}
          <h2
            id="gameover-title"
            className="font-display text-3xl font-bold text-slate-50"
          >
            Chiến cơ bị hạ
          </h2>
          <p className="text-sm text-slate-400">
            {summary.mode === "boss_rush"
              ? `Boss Rush · Dừng bước tại Trùm #${String(summary.wave).padStart(2, "0")}`
              : summary.mode === "daily"
                ? `${summary.dailyCodeName ?? "Thử thách Ngày"} · Đợt ${String(summary.wave).padStart(2, "0")}`
                : `Nhiệm vụ kết thúc tại Đợt ${String(summary.wave).padStart(2, "0")}`}
          </p>
        </div>

        {/* Clean tabular statistics grid */}
        <div className="grid grid-cols-2 gap-y-4 gap-x-6 py-4 border-y border-slate-800">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400">Tổng điểm</span>
            <span className="font-mono tabular-nums text-2xl font-bold text-amber-400">
              {summary.score.toLocaleString("vi-VN")}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400">
              {summary.mode === "daily" ? "Kỷ lục hôm nay" : "Kỷ lục"}
            </span>
            <span className="font-mono tabular-nums text-2xl font-bold text-slate-100">
              {summary.highScore.toLocaleString("vi-VN")}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400">Địch đã hạ</span>
            <span className="font-mono tabular-nums text-lg font-semibold text-slate-200">
              {summary.kills}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-400">Tinh thạch thu thập</span>
            <span className="font-mono tabular-nums text-lg font-semibold text-slate-200">
              {summary.coresCollected}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 py-3 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Chơi lại
          </button>
          <button
            type="button"
            onClick={onQuitToTitle}
            className="py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Màn hình chính
          </button>
        </div>
      </div>
    </div>
  );
}

interface AchievementsModalProps {
  progress: AchievementProgressState;
  onClose: () => void;
}

export function AchievementsModal({
  progress,
  onClose,
}: AchievementsModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const unlockedSet = new Set(progress.unlockedIds);
  const unlockedCount = progress.unlockedIds.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievements-title"
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#060B14]/84 p-4 sm:p-6"
    >
      <div className="w-full max-w-2xl rounded-xl bg-[#0F182A] border border-slate-700/70 p-6 sm:p-7 flex flex-col gap-5 max-h-[88vh]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2
              id="achievements-title"
              className="font-display text-2xl font-bold text-slate-50"
            >
              Thành tựu chiến dịch
            </h2>
            <p className="text-sm text-slate-400 font-mono tabular-nums">
              Đã mở khóa {unlockedCount} / {ACHIEVEMENTS.length} cột mốc
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng thành tựu"
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Đóng [Esc]
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pr-1">
          {ACHIEVEMENTS.map((def) => {
            const unlocked = unlockedSet.has(def.id);
            const currentVal = Math.min(
              def.target,
              getAchievementMetricValue(def.id, progress),
            );
            const pct = Math.min(
              100,
              Math.round((currentVal / def.target) * 100),
            );

            const borderClass = unlocked
              ? def.accentTone === "sky"
                ? "border-sky-400/70 bg-[#131F35]"
                : def.accentTone === "emerald"
                  ? "border-emerald-400/70 bg-[#131F35]"
                  : "border-amber-400/70 bg-[#131F35]"
              : "border-slate-800 bg-[#0B1322]";

            const accentText = unlocked
              ? def.accentTone === "sky"
                ? "text-sky-300"
                : def.accentTone === "emerald"
                  ? "text-emerald-300"
                  : "text-amber-300"
              : "text-slate-500";

            const barFill = unlocked
              ? def.accentTone === "sky"
                ? "bg-sky-400"
                : def.accentTone === "emerald"
                  ? "bg-emerald-400"
                  : "bg-amber-400"
              : "bg-slate-500";

            return (
              <div
                key={def.id}
                className={`rounded-lg border p-4 flex flex-col justify-between gap-3 ${borderClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className={`${accentText} shrink-0 mt-0.5`}
                    >
                      <path
                        d="M7 4h10v5a5 5 0 0 1-10 0V4Zm-3 2h3v3H5a1 1 0 0 1-1-1V6Zm13 0h3v2a1 1 0 0 1-1 1h-2V6Zm-5 8v4m-4 2h8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <h3 className="font-display text-sm font-bold text-slate-50 truncate">
                        {def.title}
                      </h3>
                      <p className="text-xs text-slate-300 leading-snug">
                        {def.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${accentText}`}
                  >
                    {unlocked ? "Đã mở khóa" : "Đang tiến hành"}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                    <span className="text-slate-400">Tiến độ</span>
                    <span
                      className={
                        unlocked
                          ? "text-slate-100 font-semibold"
                          : "text-slate-300"
                      }
                    >
                      {currentVal} / {def.target}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${barFill}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface DailyChallengeModalProps {
  challenge: DailyChallengeSpec;
  dailyLeaderboard: DailyLeaderboardEntry[];
  onStartDaily: () => void;
  onClose: () => void;
}

export function DailyChallengeModal({
  challenge,
  dailyLeaderboard,
  onStartDaily,
  onClose,
}: DailyChallengeModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.code === "Enter") {
        e.preventDefault();
        onStartDaily();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStartDaily]);

  const ship = getShipSpec(challenge.forcedShipId);
  const starterUpgrade = challenge.starterUpgradeId
    ? (UPGRADE_CATALOG.find((u) => u.id === challenge.starterUpgradeId) ?? null)
    : null;
  const dateLabel = formatDailyDateLabel(challenge.dateKey);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-challenge-title"
      className="absolute inset-0 z-30 flex items-center justify-center bg-[#060B14]/84 p-4 sm:p-6"
    >
      <div className="w-full max-w-3xl rounded-xl bg-[#0F182A] border border-slate-700/70 p-6 sm:p-7 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-wider text-sky-300 font-mono tabular-nums">
              THỬ THÁCH HẰNG NGÀY · {dateLabel}
            </span>
            <h2
              id="daily-challenge-title"
              className="font-display text-2xl sm:text-3xl font-bold text-slate-50"
            >
              {challenge.codeName}
            </h2>
            <p className="text-sm text-slate-300">
              Trang bị cố định &amp; quy tắc đặc biệt đồng bộ theo ngày · Hệ số
              điểm{" "}
              <span className="font-mono tabular-nums font-bold text-amber-300">
                x{challenge.scoreMultiplier.toFixed(2)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng Thử thách Ngày"
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Đóng [Esc]
          </button>
        </div>

        {/* Content Grid: Loadout + Modifiers on left, Daily Leaderboard on right */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] gap-4">
          <div className="flex flex-col gap-3">
            {/* Forced Loadout Constraint */}
            <div className="rounded-lg bg-[#0B1322] border border-slate-700/70 p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold tracking-wider text-slate-400">
                  Trang bị bắt buộc hôm nay
                </span>
                <span className="text-[11px] font-medium text-sky-300">
                  Đã khóa đội hình
                </span>
              </div>
              <div className="flex items-center gap-3">
                <ShipPreviewSvg shipId={ship.id} />
                <div className="flex flex-col min-w-0">
                  <span className="font-display text-sm font-bold text-slate-50 truncate">
                    {ship.name}
                  </span>
                  <span className="text-xs text-slate-400 truncate">
                    {ship.roleLabel} · {ship.statsDisplay.vitals}
                  </span>
                  <span className="text-xs text-amber-300 mt-0.5 truncate">
                    {starterUpgrade
                      ? `Mô-đun khởi đầu: ${starterUpgrade.name} (${starterUpgrade.statDelta})`
                      : "Trang bị tiêu chuẩn (chưa kèm mô-đun)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Active Daily Modifiers */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wider text-slate-400">
                Biến số chiến trường ({challenge.modifiers.length})
              </span>
              {challenge.modifiers.map((mod) => {
                const borderColor =
                  mod.tone === "rose"
                    ? "border-rose-500/45 bg-[#161527]"
                    : mod.tone === "amber"
                      ? "border-amber-500/45 bg-[#171A29]"
                      : mod.tone === "emerald"
                        ? "border-emerald-500/45 bg-[#101E2B]"
                        : "border-sky-500/45 bg-[#101A2E]";
                const titleColor =
                  mod.tone === "rose"
                    ? "text-rose-300"
                    : mod.tone === "amber"
                      ? "text-amber-300"
                      : mod.tone === "emerald"
                        ? "text-emerald-300"
                        : "text-sky-300";

                return (
                  <div
                    key={mod.id}
                    className={`rounded-lg border px-4 py-3 flex flex-col gap-1 ${borderColor}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-display text-sm font-bold ${titleColor}`}
                      >
                        {mod.name}
                      </span>
                      {mod.scoreMult && (
                        <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-300">
                          x{mod.scoreMult.toFixed(2)} điểm
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dedicated Daily Leaderboard */}
          <div className="rounded-lg bg-[#0B1322] border border-slate-700/70 p-4 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <span className="text-xs font-semibold tracking-wider text-slate-200">
                  Bảng xếp hạng Ngày {dateLabel}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-sky-300">
                  Top 5
                </span>
              </div>

              {dailyLeaderboard.length > 0 ? (
                <ol className="divide-y divide-slate-800/80">
                  {dailyLeaderboard.map((entry, idx) => {
                    const rank = idx + 1;
                    const entryShip = getShipSpec(entry.shipId);
                    const rankColor =
                      rank === 1
                        ? "text-amber-400"
                        : rank === 2
                          ? "text-sky-300"
                          : "text-slate-300";

                    return (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between gap-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`font-mono tabular-nums font-bold w-6 shrink-0 ${rankColor}`}
                          >
                            #{rank}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-slate-200 font-medium truncate">
                              Đợt{" "}
                              <span className="font-mono tabular-nums">
                                {String(entry.wave).padStart(2, "0")}
                              </span>{" "}
                              · {entryShip.name}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`font-mono tabular-nums font-bold shrink-0 ${
                            rank === 1
                              ? "text-sm text-amber-400"
                              : "text-sm text-slate-100"
                          }`}
                        >
                          {entry.score.toLocaleString("vi-VN")}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="py-8 text-center flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-300">
                    Chưa có thành tích hôm nay
                  </span>
                  <span className="text-xs text-slate-500">
                    Hãy là phi công đầu tiên ghi danh bảng điểm ngày {dateLabel}
                    .
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onStartDaily}
              className="w-full py-3 px-5 rounded-lg bg-sky-500 hover:bg-sky-400 active:scale-[0.98] text-slate-950 font-display font-bold text-base tracking-wide transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-300"
            >
              Xuất kích Thử thách Ngày
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
