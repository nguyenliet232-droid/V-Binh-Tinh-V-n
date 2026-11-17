import { getTodayDateKey } from "./dailyChallenge";
import type {
  DailyLeaderboardEntry,
  DifficultyMode,
  LeaderboardEntry,
  ShipId,
} from "./types";

const LEADERBOARD_KEY = "vb_starforge_leaderboard";
const DAILY_LEADERBOARD_KEY = "vb_starforge_daily_leaderboard";
const LEGACY_HIGH_SCORE_KEY = "vb_starforge_highscore";
const MAX_LEADERBOARD_ENTRIES = 3;
const MAX_DAILY_ENTRIES = 5;

function sortAndTrim(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.wave !== a.wave) return b.wave - a.wave;
      return b.recordedAt - a.recordedAt;
    })
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

function saveLeaderboard(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
    if (entries.length > 0) {
      const legacy =
        parseInt(localStorage.getItem(LEGACY_HIGH_SCORE_KEY) || "0", 10) || 0;
      if (entries[0].score > legacy) {
        localStorage.setItem(LEGACY_HIGH_SCORE_KEY, String(entries[0].score));
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const normalized: LeaderboardEntry[] = parsed
          .filter(
            (item): item is LeaderboardEntry =>
              Boolean(item) &&
              typeof item.score === "number" &&
              item.score > 0 &&
              typeof item.wave === "number",
          )
          .map((item, idx) => ({
            id:
              typeof item.id === "string"
                ? item.id
                : `run-${idx}-${item.score}`,
            score: Math.round(item.score),
            wave: Math.max(1, Math.round(item.wave)),
            difficulty:
              item.difficulty === "ace"
                ? "ace"
                : item.difficulty === "boss_rush"
                  ? "boss_rush"
                  : item.difficulty === "daily"
                    ? "daily"
                    : "standard",
            recordedAt:
              typeof item.recordedAt === "number"
                ? item.recordedAt
                : Date.now(),
          }));
        const sorted = sortAndTrim(normalized);
        if (sorted.length > 0) {
          return sorted;
        }
      }
    }

    const legacyScore =
      parseInt(localStorage.getItem(LEGACY_HIGH_SCORE_KEY) || "0", 10) || 0;
    if (legacyScore > 0) {
      const seeded: LeaderboardEntry[] = [
        {
          id: "legacy-best",
          score: legacyScore,
          wave: 1,
          difficulty: "standard",
          recordedAt: Date.now(),
        },
      ];
      saveLeaderboard(seeded);
      return seeded;
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

export function recordRunToLeaderboard(input: {
  score: number;
  wave: number;
  difficulty: DifficultyMode;
}): LeaderboardEntry[] {
  const current = loadLeaderboard();
  const cleanScore = Math.round(input.score);
  if (cleanScore <= 0) {
    return current;
  }

  const nextEntry: LeaderboardEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    score: cleanScore,
    wave: Math.max(1, Math.round(input.wave)),
    difficulty: input.difficulty,
    recordedAt: Date.now(),
  };

  const updated = sortAndTrim([...current, nextEntry]);
  saveLeaderboard(updated);
  return updated;
}

function sortAndTrimDaily(
  entries: DailyLeaderboardEntry[],
): DailyLeaderboardEntry[] {
  return [...entries]
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.wave !== a.wave) return b.wave - a.wave;
      return b.recordedAt - a.recordedAt;
    })
    .slice(0, MAX_DAILY_ENTRIES);
}

function loadAllDailyEntries(): Record<string, DailyLeaderboardEntry[]> {
  try {
    const raw = localStorage.getItem(DAILY_LEADERBOARD_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};

    const result: Record<string, DailyLeaderboardEntry[]> = {};
    for (const [dateKey, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue;
      const valid = list
        .filter(
          (item): item is DailyLeaderboardEntry =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as DailyLeaderboardEntry).score === "number" &&
            (item as DailyLeaderboardEntry).score > 0 &&
            typeof (item as DailyLeaderboardEntry).wave === "number",
        )
        .map((item, idx): DailyLeaderboardEntry => {
          const shipId: ShipId =
            item.shipId === "striker" || item.shipId === "aegis"
              ? item.shipId
              : "interceptor";
          return {
            id:
              typeof item.id === "string" ? item.id : `daily-${dateKey}-${idx}`,
            dateKey,
            score: Math.round(item.score),
            wave: Math.max(1, Math.round(item.wave)),
            shipId,
            recordedAt:
              typeof item.recordedAt === "number"
                ? item.recordedAt
                : Date.now(),
          };
        });
      if (valid.length > 0) {
        result[dateKey] = sortAndTrimDaily(valid);
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function loadDailyLeaderboard(
  dateKey: string = getTodayDateKey(),
): DailyLeaderboardEntry[] {
  const map = loadAllDailyEntries();
  return map[dateKey] ?? [];
}

export function getDailyBestScore(dateKey: string = getTodayDateKey()): number {
  const entries = loadDailyLeaderboard(dateKey);
  return entries[0]?.score ?? 0;
}

export function recordDailyRunToLeaderboard(input: {
  dateKey: string;
  score: number;
  wave: number;
  shipId: ShipId;
}): DailyLeaderboardEntry[] {
  const cleanScore = Math.round(input.score);
  const all = loadAllDailyEntries();
  const current = all[input.dateKey] ?? [];
  if (cleanScore <= 0) {
    return current;
  }

  const nextEntry: DailyLeaderboardEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dateKey: input.dateKey,
    score: cleanScore,
    wave: Math.max(1, Math.round(input.wave)),
    shipId: input.shipId,
    recordedAt: Date.now(),
  };

  const updatedForDay = sortAndTrimDaily([...current, nextEntry]);

  // Keep only the most recent 14 days to prevent unbounded localStorage growth
  const prunedMap: Record<string, DailyLeaderboardEntry[]> = {
    ...all,
    [input.dateKey]: updatedForDay,
  };
  const sortedKeys = Object.keys(prunedMap).sort().slice(-14);
  const trimmedMap: Record<string, DailyLeaderboardEntry[]> = {};
  for (const k of sortedKeys) {
    trimmedMap[k] = prunedMap[k];
  }

  try {
    localStorage.setItem(DAILY_LEADERBOARD_KEY, JSON.stringify(trimmedMap));
  } catch {
    // ignore storage errors
  }

  return updatedForDay;
}
