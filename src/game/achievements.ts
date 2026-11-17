import type {
  AchievementDefinition,
  AchievementId,
  AchievementProgressState,
  AchievementUnlockEvent,
} from "./types";

const ACHIEVEMENTS_STORAGE_KEY = "vb_starforge_achievements";

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "defeat_100_enemies",
    title: "Bách Chiến Tinh Binh",
    description: "Tiêu diệt 100 kẻ địch",
    target: 100,
    accentTone: "amber",
  },
  {
    id: "survive_5_waves_no_damage",
    title: "Bóng Ma Bất Khả Xâm Phạm",
    description: "Sống sót 5 đợt liên tiếp không nhận sát thương",
    target: 5,
    accentTone: "sky",
  },
  {
    id: "collect_50_cores",
    title: "Nhà Sưu Tầm Tinh Thạch",
    description: "Thu thập 50 Tinh thạch năng lượng",
    target: 50,
    accentTone: "emerald",
  },
  {
    id: "first_boss_kill",
    title: "Kẻ Hạ Gục Thống Lĩnh",
    description: "Tiêu diệt Lõi Thống Lĩnh đầu tiên",
    target: 1,
    accentTone: "amber",
  },
  {
    id: "combo_master_8",
    title: "Chuỗi Hủy Diệt x8",
    description: "Đạt chuỗi Combo tối đa x8 trong trận",
    target: 8,
    accentTone: "sky",
  },
  {
    id: "boss_rush_3",
    title: "Chinh Phục Boss Rush",
    description: "Hạ gục 3 Trùm liên tiếp trong Boss Rush",
    target: 3,
    accentTone: "emerald",
  },
];

const VALID_IDS = new Set<AchievementId>(ACHIEVEMENTS.map((a) => a.id));

function createEmptyProgress(): AchievementProgressState {
  return {
    totalKills: 0,
    totalCores: 0,
    bossKills: 0,
    maxNoDamageWaveStreak: 0,
    maxComboReached: 0,
    maxBossRushCleared: 0,
    unlockedIds: [],
  };
}

export function loadAchievementProgress(): AchievementProgressState {
  const fallback = createEmptyProgress();
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AchievementProgressState>;
    if (!parsed || typeof parsed !== "object") return fallback;

    const unlockedIds = Array.isArray(parsed.unlockedIds)
      ? Array.from(
          new Set(
            parsed.unlockedIds.filter(
              (id): id is AchievementId =>
                typeof id === "string" && VALID_IDS.has(id as AchievementId),
            ),
          ),
        )
      : [];

    return {
      totalKills:
        typeof parsed.totalKills === "number" && parsed.totalKills >= 0
          ? Math.floor(parsed.totalKills)
          : 0,
      totalCores:
        typeof parsed.totalCores === "number" && parsed.totalCores >= 0
          ? Math.floor(parsed.totalCores)
          : 0,
      bossKills:
        typeof parsed.bossKills === "number" && parsed.bossKills >= 0
          ? Math.floor(parsed.bossKills)
          : 0,
      maxNoDamageWaveStreak:
        typeof parsed.maxNoDamageWaveStreak === "number" &&
        parsed.maxNoDamageWaveStreak >= 0
          ? Math.floor(parsed.maxNoDamageWaveStreak)
          : 0,
      maxComboReached:
        typeof parsed.maxComboReached === "number" &&
        parsed.maxComboReached >= 0
          ? Math.floor(parsed.maxComboReached)
          : 0,
      maxBossRushCleared:
        typeof parsed.maxBossRushCleared === "number" &&
        parsed.maxBossRushCleared >= 0
          ? Math.floor(parsed.maxBossRushCleared)
          : 0,
      unlockedIds,
    };
  } catch {
    return fallback;
  }
}

export function saveAchievementProgress(state: AchievementProgressState): void {
  try {
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function getAchievementMetricValue(
  id: AchievementId,
  state: AchievementProgressState,
): number {
  switch (id) {
    case "defeat_100_enemies":
      return state.totalKills;
    case "survive_5_waves_no_damage":
      return state.maxNoDamageWaveStreak;
    case "collect_50_cores":
      return state.totalCores;
    case "first_boss_kill":
      return state.bossKills;
    case "combo_master_8":
      return state.maxComboReached;
    case "boss_rush_3":
      return state.maxBossRushCleared;
  }
}

export function evaluateAchievements(state: AchievementProgressState): {
  nextState: AchievementProgressState;
  newlyUnlocked: AchievementUnlockEvent[];
} {
  const unlockedSet = new Set<AchievementId>(state.unlockedIds);
  const newlyUnlocked: AchievementUnlockEvent[] = [];
  const now = Date.now();

  for (const def of ACHIEVEMENTS) {
    if (unlockedSet.has(def.id)) continue;
    const val = getAchievementMetricValue(def.id, state);
    if (val >= def.target) {
      unlockedSet.add(def.id);
      newlyUnlocked.push({
        id: def.id,
        title: def.title,
        description: def.description,
        accentTone: def.accentTone,
        unlockedAt: now,
      });
    }
  }

  const nextState: AchievementProgressState = {
    ...state,
    unlockedIds: Array.from(unlockedSet),
  };
  saveAchievementProgress(nextState);
  return { nextState, newlyUnlocked };
}
