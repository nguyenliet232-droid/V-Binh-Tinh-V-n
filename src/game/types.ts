export type GameState =
  | "TITLE_MENU"
  | "PLAYING"
  | "PAUSED"
  | "ROUND_SUMMARY"
  | "GAME_OVER";

export type DifficultyMode = "standard" | "ace" | "boss_rush" | "daily";

export type ShipId = "interceptor" | "striker" | "aegis";

export type UpgradeId =
  | "twin_cannons"
  | "rapid_overclock"
  | "ricochet_bolts"
  | "phase_dash_blast"
  | "shield_capacitor"
  | "core_magnet"
  | "piercing_rounds"
  | "orbital_drone"
  | "hull_plating";

export interface UpgradeOption {
  id: UpgradeId;
  name: string;
  effectText: string;
  statDelta: string;
  maxStacks: number;
  accentColor: "amber" | "sky" | "emerald";
}

export type DailyModifierId =
  | "glass_cannon"
  | "hyper_thrusters"
  | "volatile_swarm"
  | "no_shield_regen"
  | "scarce_upgrades"
  | "overclocked_arsenal"
  | "emp_surge"
  | "vanguard_escort";

export interface DailyModifierSpec {
  id: DailyModifierId;
  name: string;
  description: string;
  tone: "amber" | "sky" | "emerald" | "rose";
  playerDamageMult?: number;
  playerSpeedMult?: number;
  fireRateMult?: number;
  maxHpDelta?: number;
  maxShieldDelta?: number;
  disableShieldRegen?: boolean;
  enemyCountMult?: number;
  enemySpeedMult?: number;
  maxUpgrades?: number;
  startingDrone?: boolean;
  startingEmp?: number;
  scoreMult?: number;
}

export interface DailyChallengeSpec {
  dateKey: string;
  seed: number;
  codeName: string;
  forcedShipId: ShipId;
  starterUpgradeId: UpgradeId | null;
  modifiers: DailyModifierSpec[];
  scoreMultiplier: number;
}

export interface DailyLeaderboardEntry {
  id: string;
  dateKey: string;
  score: number;
  wave: number;
  shipId: ShipId;
  recordedAt: number;
}

export interface HudSnapshot {
  mode: DifficultyMode;
  shipId: ShipId;
  bossRushUpgradesLeft: number;
  dailyDateKey?: string;
  dailyCodeName?: string;
  dailyScoreMultiplier?: number;
  dailyMaxUpgrades?: number | null;
  dailyUpgradesLeft?: number | null;
  dailyShieldRegenDisabled?: boolean;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shieldRechargeProgress: number; // 0..1 when recharging
  shieldRechargeRemaining: number; // seconds left until recharge
  shieldRechargeBlockedByBoss: boolean;
  empCharge: number; // 0..100
  dashActive: boolean;
  dashInvulnRemaining: number;
  dashCooldownRatio: number; // 0..1 (1 = ready)
  dashCooldownSeconds: number;
  timeDilationActive: boolean;
  timeDilationRemaining: number;
  timeDilationCooldownRatio: number; // 0..1 (1 = ready)
  timeDilationCooldownSeconds: number;
  score: number;
  highScore: number;
  wave: number;
  enemiesRemaining: number;
  combo: number;
  comboTimerRatio: number; // 0..1
  kills: number;
  coresCollected: number;
  overdriveTimer: number; // > 0 when temporary rapid-fire active
  bossActive: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossStage: 1 | 2;
  activeUpgrades: Partial<Record<UpgradeId, number>>;
}

export interface RunSummary {
  mode: DifficultyMode;
  score: number;
  highScore: number;
  isNewRecord: boolean;
  wave: number;
  kills: number;
  coresCollected: number;
  durationSeconds: number;
  dailyCodeName?: string;
  dailyDateKey?: string;
}

export interface LeaderboardEntry {
  id: string;
  score: number;
  wave: number;
  difficulty: DifficultyMode;
  recordedAt: number;
}

export type AchievementId =
  | "defeat_100_enemies"
  | "survive_5_waves_no_damage"
  | "collect_50_cores"
  | "first_boss_kill"
  | "combo_master_8"
  | "boss_rush_3";

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  target: number;
  accentTone: "amber" | "sky" | "emerald";
}

export interface AchievementProgressState {
  totalKills: number;
  totalCores: number;
  bossKills: number;
  maxNoDamageWaveStreak: number;
  maxComboReached: number;
  maxBossRushCleared: number;
  unlockedIds: AchievementId[];
}

export interface AchievementUnlockEvent {
  id: AchievementId;
  title: string;
  description: string;
  accentTone: "amber" | "sky" | "emerald";
  unlockedAt: number;
}
