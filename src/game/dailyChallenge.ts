import type {
  DailyChallengeSpec,
  DailyModifierSpec,
  ShipId,
  UpgradeId,
} from "./types";

export const DAILY_MODIFIER_POOL: DailyModifierSpec[] = [
  {
    id: "glass_cannon",
    name: "Pháo Thủy Tinh",
    description: "+45% sát thương vũ khí, nhưng giảm 1 Giáp tối đa",
    tone: "amber",
    playerDamageMult: 1.45,
    maxHpDelta: -1,
    scoreMult: 1.15,
  },
  {
    id: "hyper_thrusters",
    name: "Động Cơ Siêu Thanh",
    description: "+22% tốc độ bay chiến cơ, +18% tốc độ kẻ địch",
    tone: "sky",
    playerSpeedMult: 1.22,
    enemySpeedMult: 1.18,
    scoreMult: 1.1,
  },
  {
    id: "volatile_swarm",
    name: "Bầy Đàn Áp Đảo",
    description: "+30% số lượng kẻ địch mỗi đợt, +20% điểm thưởng",
    tone: "rose",
    enemyCountMult: 1.3,
    scoreMult: 1.2,
  },
  {
    id: "no_shield_regen",
    name: "Ngắt Mạch Khiên",
    description: "Khiên không tự hồi trong đợt, +1 Khiên tối đa khởi đầu",
    tone: "rose",
    disableShieldRegen: true,
    maxShieldDelta: 1,
    scoreMult: 1.2,
  },
  {
    id: "scarce_upgrades",
    name: "Tiếp Tế Hạn Chế",
    description: "Chỉ chọn tối đa 3 nâng cấp toàn trận, +15% điểm",
    tone: "amber",
    maxUpgrades: 3,
    scoreMult: 1.15,
  },
  {
    id: "overclocked_arsenal",
    name: "Hỏa Lực Quá Tải",
    description: "+25% tốc độ bắn, nhưng +15% tốc độ kẻ địch",
    tone: "sky",
    fireRateMult: 0.8,
    enemySpeedMult: 1.15,
    scoreMult: 1.1,
  },
  {
    id: "emp_surge",
    name: "Tụ Xung Lực Đầy",
    description: "Khởi đầu 100% Xung lực [E], +10% điểm thưởng",
    tone: "emerald",
    startingEmp: 100,
    scoreMult: 1.1,
  },
  {
    id: "vanguard_escort",
    name: "Vệ Tinh Tiền Phong",
    description: "Xuất kích kèm 1 Vệ tinh hộ tống, +20% quân số địch",
    tone: "emerald",
    startingDrone: true,
    enemyCountMult: 1.2,
    scoreMult: 1.15,
  },
];

const OPERATION_PREFIXES = [
  "Nhật Thực",
  "Tinh Vân Bão",
  "Hố Đen Kép",
  "Bụi Sao Vàng",
  "Vành Đai Lửa",
  "Mặt Trời Lạnh",
  "Hải Đăng Cổ",
  "Sao Chổi Đỏ",
];

const DAILY_STARTER_UPGRADES: (UpgradeId | null)[] = [
  "ricochet_bolts",
  "piercing_rounds",
  "twin_cannons",
  "rapid_overclock",
  "phase_dash_blast",
  null,
];

export function getTodayDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDailyDateLabel(dateKey: string): string {
  const parts = dateKey.split("-");
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function hashDateKey(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

export function createDailySeededRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDailyChallenge(
  dateKey: string = getTodayDateKey(),
): DailyChallengeSpec {
  const seed = hashDateKey(dateKey);
  const rng = createDailySeededRng(seed);

  const ships: ShipId[] = ["interceptor", "striker", "aegis"];
  const forcedShipId = ships[Math.floor(rng() * ships.length)];

  const starterUpgradeId =
    DAILY_STARTER_UPGRADES[Math.floor(rng() * DAILY_STARTER_UPGRADES.length)];

  // Pick 2 distinct modifiers from the pool deterministically
  const pool = [...DAILY_MODIFIER_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const modifiers = pool.slice(0, 2);

  // Combine multipliers and round to 2 decimals cleanly
  let combinedScoreMult = 1.0;
  for (const mod of modifiers) {
    combinedScoreMult *= mod.scoreMult ?? 1.0;
  }
  const scoreMultiplier = Math.round(combinedScoreMult * 100) / 100;

  const prefix =
    OPERATION_PREFIXES[Math.floor(rng() * OPERATION_PREFIXES.length)];
  const opNumber = 10 + (seed % 90);

  return {
    dateKey,
    seed,
    codeName: `Chiến dịch ${prefix} #${opNumber}`,
    forcedShipId,
    starterUpgradeId,
    modifiers,
    scoreMultiplier,
  };
}

export function aggregateDailyModifiers(spec: DailyChallengeSpec) {
  let playerDamageMult = 1;
  let playerSpeedMult = 1;
  let fireRateMult = 1;
  let maxHpDelta = 0;
  let maxShieldDelta = 0;
  let disableShieldRegen = false;
  let enemyCountMult = 1;
  let enemySpeedMult = 1;
  let maxUpgrades: number | null = null;
  let startingDrone = false;
  let startingEmp = 50;

  for (const mod of spec.modifiers) {
    if (mod.playerDamageMult) playerDamageMult *= mod.playerDamageMult;
    if (mod.playerSpeedMult) playerSpeedMult *= mod.playerSpeedMult;
    if (mod.fireRateMult) fireRateMult *= mod.fireRateMult;
    if (mod.maxHpDelta) maxHpDelta += mod.maxHpDelta;
    if (mod.maxShieldDelta) maxShieldDelta += mod.maxShieldDelta;
    if (mod.disableShieldRegen) disableShieldRegen = true;
    if (mod.enemyCountMult) enemyCountMult *= mod.enemyCountMult;
    if (mod.enemySpeedMult) enemySpeedMult *= mod.enemySpeedMult;
    if (typeof mod.maxUpgrades === "number") {
      maxUpgrades =
        maxUpgrades === null
          ? mod.maxUpgrades
          : Math.min(maxUpgrades, mod.maxUpgrades);
    }
    if (mod.startingDrone) startingDrone = true;
    if (typeof mod.startingEmp === "number") {
      startingEmp = Math.max(startingEmp, mod.startingEmp);
    }
  }

  return {
    playerDamageMult,
    playerSpeedMult,
    fireRateMult,
    maxHpDelta,
    maxShieldDelta,
    disableShieldRegen,
    enemyCountMult,
    enemySpeedMult,
    maxUpgrades,
    startingDrone,
    startingEmp,
  };
}
