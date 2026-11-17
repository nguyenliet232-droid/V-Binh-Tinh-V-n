import { evaluateAchievements, loadAchievementProgress } from "./achievements";
import { soundEngine } from "./audio";
import {
  aggregateDailyModifiers,
  createDailySeededRng,
  generateDailyChallenge,
} from "./dailyChallenge";
import {
  getDailyBestScore,
  loadLeaderboard,
  recordDailyRunToLeaderboard,
  recordRunToLeaderboard,
} from "./leaderboard";
import {
  createParallaxSpaceState,
  renderParallaxSpaceState,
  updateParallaxSpaceState,
  type ParallaxSpaceState,
} from "./parallax";
import { getShipSpec } from "./ships";
import type {
  AchievementProgressState,
  AchievementUnlockEvent,
  DailyChallengeSpec,
  DifficultyMode,
  GameState,
  HudSnapshot,
  LeaderboardEntry,
  RunSummary,
  ShipId,
  UpgradeId,
} from "./types";

const HIGH_SCORE_KEY = "vb_starforge_highscore";
const MAX_PARTICLES = 760;
const MAX_FLOATING_TEXTS = 72;
const EMP_DOME_RADIUS = 112;
const BOSS_RUSH_MAX_UPGRADES = 3;

type EnemyKind =
  | "scout"
  | "rusher"
  | "weaver"
  | "kamikaze"
  | "seeker"
  | "shielder"
  | "repair_drone"
  | "sniper"
  | "juggernaut"
  | "shard"
  | "bomber"
  | "boss";

type MovementBehavior =
  | "direct_charge"
  | "sine_weave"
  | "kamikaze_lock"
  | "homing_artillery"
  | "shield_projector"
  | "medic_support"
  | "kite_strafe"
  | "spiral_approach"
  | "heavy_march"
  | "orbital_boss";

interface EnemyArchetypeConfig {
  label: string;
  behavior: MovementBehavior;
  radius: number;
  baseHp: number;
  baseSpeed: number;
  score: number;
  accentColor: string;
}

const ENEMY_ARCHETYPES: Record<EnemyKind, EnemyArchetypeConfig> = {
  scout: {
    label: "Trinh sát",
    behavior: "direct_charge",
    radius: 14,
    baseHp: 28,
    baseSpeed: 155,
    score: 100,
    accentColor: "#FB7185",
  },
  rusher: {
    label: "Xung phong lao thẳng",
    behavior: "direct_charge",
    radius: 15,
    baseHp: 24,
    baseSpeed: 135,
    score: 130,
    accentColor: "#F97316",
  },
  weaver: {
    label: "Chiến cơ lượn sóng",
    behavior: "sine_weave",
    radius: 15,
    baseHp: 32,
    baseSpeed: 175,
    score: 145,
    accentColor: "#C084FC",
  },
  kamikaze: {
    label: "Drone Cảm Tử",
    behavior: "kamikaze_lock",
    radius: 13,
    baseHp: 22,
    baseSpeed: 125,
    score: 155,
    accentColor: "#EF4444",
  },
  seeker: {
    label: "Phóng Lôi Truy Kích",
    behavior: "homing_artillery",
    radius: 16,
    baseHp: 38,
    baseSpeed: 105,
    score: 165,
    accentColor: "#2DD4BF",
  },
  shielder: {
    label: "Tàu Khiên Điện Từ",
    behavior: "shield_projector",
    radius: 18,
    baseHp: 58,
    baseSpeed: 88,
    score: 195,
    accentColor: "#60A5FA",
  },
  repair_drone: {
    label: "Drone Sửa Chữa",
    behavior: "medic_support",
    radius: 14,
    baseHp: 34,
    baseSpeed: 165,
    score: 180,
    accentColor: "#4ADE80",
  },
  sniper: {
    label: "Xạ thủ giữ tầm",
    behavior: "kite_strafe",
    radius: 16,
    baseHp: 36,
    baseSpeed: 115,
    score: 150,
    accentColor: "#E11D48",
  },
  bomber: {
    label: "Cảm tử xoắn ốc",
    behavior: "spiral_approach",
    radius: 15,
    baseHp: 32,
    baseSpeed: 150,
    score: 140,
    accentColor: "#F43F5E",
  },
  juggernaut: {
    label: "Thiết giáp nặng",
    behavior: "heavy_march",
    radius: 24,
    baseHp: 92,
    baseSpeed: 78,
    score: 260,
    accentColor: "#FB7185",
  },
  shard: {
    label: "Mảnh vỡ truy kích",
    behavior: "direct_charge",
    radius: 10,
    baseHp: 16,
    baseSpeed: 215,
    score: 60,
    accentColor: "#FB7185",
  },
  boss: {
    label: "Lõi Thống Lĩnh",
    behavior: "orbital_boss",
    radius: 42,
    baseHp: 480,
    baseSpeed: 140,
    score: 1500,
    accentColor: "#FB7185",
  },
};

interface Particle {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  endSize: number;
  color: string;
  strokeColor?: string;
  kind: "spark" | "ring" | "shard" | "glow" | "trail" | "flash" | "ember";
  rotation: number;
  vRot: number;
  drag: number;
  sides: number;
  aspect: number;
  additive: boolean;
}

interface PlayerTrailNode {
  x: number;
  y: number;
  wingLX: number;
  wingLY: number;
  wingRX: number;
  wingRY: number;
  speedRatio: number;
  life: number;
  maxLife: number;
  dashing: boolean;
  overdrive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isEnemy: boolean;
  life: number;
  bouncesLeft: number;
  pierceLeft: number;
  hitIds: Set<number>;
  color: string;
  trailX: number;
  trailY: number;
  source?: "player" | "overdrive" | "drone";
  homingTurnRate?: number;
  homingSpeed?: number;
  homingDelay?: number;
  homingTimeLeft?: number;
  bypassShieldIds?: Set<number>;
  reflectedByShield?: boolean;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  behavior: MovementBehavior;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  angle: number;
  spinAngle: number;
  state: "chase" | "windup" | "action" | "cooldown";
  stateTimer: number;
  aimAngle: number;
  behaviorPhase: number;
  weaveSign: number;
  hitFlash: number;
  squash: number;
  spawnDelay: number; // > 0 means portal warning before active
  bossPhase: number;
  bossPatternIdx: number;
  bossStage: 1 | 2;
  bossSubShot: number;
  healTargetId?: number;
  healPulseTimer?: number;
}

interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: "core" | "repair" | "overdrive";
  life: number;
  value: number;
  bobPhase: number;
}

type FloatingTextKind = "damage" | "score" | "callout";

type DamageSource = "player" | "overdrive" | "drone" | "ability" | "emp";

interface FloatingText {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  text: string;
  subtext?: string;
  color: string;
  subColor?: string;
  fontSize: number;
  scale: number;
  life: number;
  maxLife: number;
  kind: FloatingTextKind;
  enemyId?: number;
  numericValue?: number;
}

type ShakePreset =
  | "kill_tiny"
  | "kill_light"
  | "kill_medium"
  | "kill_heavy"
  | "kill_boss"
  | "boss_hit"
  | "boss_phase"
  | "bomber_blast"
  | "emp_pulse"
  | "dash_blast"
  | "player_shield_hit"
  | "player_hull_hit"
  | "game_over";

interface ShakeImpulse {
  amplitude: number;
  frequency: number;
  rotScale: number;
  life: number;
  maxLife: number;
  elapsed: number;
  phaseX: number;
  phaseY: number;
  dirX: number;
  dirY: number;
  kick: number;
}

type ShockwavePreset =
  | "boss_kill"
  | "boss_phase"
  | "emp"
  | "time_dilation"
  | "dash"
  | "dash_blast";

interface Shockwave {
  x: number;
  y: number;
  startRadius: number;
  maxRadius: number;
  bandWidth: number;
  life: number;
  maxLife: number;
  primaryRgb: string;
  secondaryRgb: string;
  coreRgb: string;
  intensity: number;
  chromaticShift: boolean;
  flashAlpha: number;
  radialRays: number;
  seed: number;
}

interface NebulaDustMote {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  vx: number; // normalized/sec
  vy: number; // normalized/sec
  radius: number;
  alpha: number;
  depth: number;
  phase: number;
  swayFreq: number;
  warm: boolean;
  isSpeck: boolean;
}

interface AsteroidFragment {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  vx: number; // normalized/sec
  vy: number; // normalized/sec
  radius: number;
  depth: number;
  alpha: number;
  rotation: number;
  vRot: number;
  vertices: { cos: number; sin: number; scale: number }[];
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onWaveCleared: (wave: number) => void;
  onGameOver: (summary: RunSummary) => void;
  onPauseToggle: () => void;
  onAchievementUnlocked?: (achievement: AchievementUnlockEvent) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;

  private width = 1280;
  private height = 720;
  private dpr = 1;
  private arenaMargin = 20;

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private running = false;
  private gameState: GameState = "TITLE_MENU";
  private difficulty: DifficultyMode = "standard";
  private selectedShipId: ShipId = "interceptor";

  // Input state
  private heldKeys = new Set<string>();
  private mouseX = 640;
  private mouseY = 360;
  private mouseDown = false;
  private dashBufferTimer = 0;
  private empBufferTimer = 0;
  private timeDilationBufferTimer = 0;
  private hasMouseMoved = false;

  // Player state
  private player = {
    x: 640,
    y: 360,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 16,
    hp: 4,
    maxHp: 4,
    shield: 2,
    maxShield: 2,
    shieldRegenTimer: 0,
    shieldRegenDelay: 5.0,
    empCharge: 40,
    invulnTimer: 0,
    hitFlash: 0,
    fireTimer: 0,
    dashTimer: 0,
    dashInvulnTimer: 0,
    dashBoostTimer: 0,
    dashCooldown: 0,
    dashCooldownMax: 1.55,
    dashDirX: 0,
    dashDirY: -1,
    squashX: 1,
    squashY: 1,
    overdriveTimer: 0,
    trailTimer: 0,
    timeDilationTimer: 0,
    timeDilationDuration: 2.6,
    timeDilationCooldown: 0,
    timeDilationCooldownMax: 12.0,
  };

  // Upgrades & Stats
  private upgrades: Partial<Record<UpgradeId, number>> = {};
  private bossRushUpgradesUsed = 0;
  private dailyUpgradesUsed = 0;
  private activeDailyChallenge: DailyChallengeSpec | null = null;
  private dailyMods = {
    playerDamageMult: 1,
    playerSpeedMult: 1,
    fireRateMult: 1,
    enemyCountMult: 1,
    enemySpeedMult: 1,
    disableShieldRegen: false,
    maxUpgrades: null as number | null,
  };
  private droneOrbitAngle = 0;
  private droneFireTimers: number[] = [0, 0, 0];

  // Progression & Wave state
  private score = 0;
  private highScore = 0;
  private runStartHighScore = 0;
  private runRecorded = false;
  private wave = 1;
  private kills = 0;
  private coresCollected = 0;
  private runDuration = 0;
  private combo = 1;
  private comboTimer = 0;
  private comboMaxTime = 4.2;

  private waveSpawnQueue: {
    kind: EnemyKind;
    delay: number;
    x?: number;
    y?: number;
  }[] = [];
  private waveSpawnClock = 0;
  private waveClearDelay = 0;
  private nextEnemyId = 1;
  private tookDamageThisWave = false;
  private noDamageWaveStreak = 0;
  private achievementState: AchievementProgressState =
    loadAchievementProgress();

  // Juice: Hitstop & Multi-Tiered Camera Shake
  private hitstopTimer = 0;
  private shakeImpulses: ShakeImpulse[] = [];
  private shakeKickX = 0;
  private shakeKickY = 0;
  private reducedMotion = false;
  private hudSyncTimer = 0;
  private shieldDeflectSoundCooldown = 0;
  private repairSoundCooldown = 0;

  // Entity lists & Object Pool
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private floatingTexts: FloatingText[] = [];
  private shockwaves: Shockwave[] = [];
  private playerTrail: PlayerTrailNode[] = [];
  private particles: Particle[] = [];
  private parallaxSpace: ParallaxSpaceState;
  private bgParallaxX = 0;
  private bgParallaxY = 0;
  private nebulaDust: NebulaDustMote[] = [];
  private asteroidFragments: AsteroidFragment[] = [];
  private coolDustSprite: HTMLCanvasElement | null = null;
  private warmDustSprite: HTMLCanvasElement | null = null;

  // Bound event listeners
  private handleResizeBound: () => void;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;
  private handleMouseMoveBound: (e: MouseEvent) => void;
  private handleMouseDownBound: (e: MouseEvent) => void;
  private handleMouseUpBound: (e: MouseEvent) => void;
  private handleContextMenuBound: (e: MouseEvent) => void;
  private handleBlurBound: () => void;
  private handleVisibilityBound: () => void;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Could not acquire 2D rendering context");
    }
    this.ctx = context;
    this.callbacks = callbacks;

    try {
      const saved = localStorage.getItem(HIGH_SCORE_KEY);
      this.highScore = saved ? Math.max(0, parseInt(saved, 10) || 0) : 0;
    } catch {
      this.highScore = 0;
    }

    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
    ) {
      this.reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
    }

    // Pre-allocate particle pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        endSize: 0,
        color: "#F59E0B",
        kind: "spark",
        rotation: 0,
        vRot: 0,
        drag: 0.25,
        sides: 4,
        aspect: 1,
        additive: false,
      });
    }

    // Generate layered procedural nebulae, distant star clusters, and multi-tier parallax starfield
    this.parallaxSpace = createParallaxSpaceState();

    // Initialize particle-based background weather (nebula dust + distant asteroid fragments)
    this.initBackgroundWeather();

    this.handleResizeBound = () => this.resize();
    this.handleKeyDownBound = (e) => this.onKeyDown(e);
    this.handleKeyUpBound = (e) => this.onKeyUp(e);
    this.handleMouseMoveBound = (e) => this.onMouseMove(e);
    this.handleMouseDownBound = (e) => this.onMouseDown(e);
    this.handleMouseUpBound = (e) => this.onMouseUp(e);
    this.handleContextMenuBound = (e) => {
      if (this.gameState === "PLAYING") e.preventDefault();
    };
    this.handleBlurBound = () => this.clearInputsOnBlur();
    this.handleVisibilityBound = () => {
      if (document.hidden) {
        this.clearInputsOnBlur();
      }
    };

    this.attachEvents();
    this.resize();
    this.startLoop();
  }

  public destroy(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("resize", this.handleResizeBound);
    window.removeEventListener("keydown", this.handleKeyDownBound);
    window.removeEventListener("keyup", this.handleKeyUpBound);
    window.removeEventListener("mousemove", this.handleMouseMoveBound);
    window.removeEventListener("mousedown", this.handleMouseDownBound);
    window.removeEventListener("mouseup", this.handleMouseUpBound);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenuBound);
    window.removeEventListener("blur", this.handleBlurBound);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityBound,
    );
  }

  private attachEvents(): void {
    window.addEventListener("resize", this.handleResizeBound);
    window.addEventListener("keydown", this.handleKeyDownBound);
    window.addEventListener("keyup", this.handleKeyUpBound);
    window.addEventListener("mousemove", this.handleMouseMoveBound);
    window.addEventListener("mousedown", this.handleMouseDownBound);
    window.addEventListener("mouseup", this.handleMouseUpBound);
    this.canvas.addEventListener("contextmenu", this.handleContextMenuBound);
    window.addEventListener("blur", this.handleBlurBound);
    document.addEventListener("visibilitychange", this.handleVisibilityBound);
  }

  public resize(): void {
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(320, w);
    this.height = Math.max(320, h);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (!this.hasMouseMoved) {
      this.mouseX = this.width * 0.5;
      this.mouseY = this.height * 0.3;
    }
  }

  public setGameState(state: GameState): void {
    this.gameState = state;
    if (state !== "PLAYING") {
      this.clearInputs();
    }
  }

  public startNewGame(
    difficulty: DifficultyMode,
    shipId: ShipId = this.selectedShipId,
  ): void {
    soundEngine.unlock();
    this.difficulty = difficulty;
    this.upgrades = {};
    this.bossRushUpgradesUsed = 0;
    this.dailyUpgradesUsed = 0;

    if (difficulty === "daily") {
      const daily = generateDailyChallenge();
      const agg = aggregateDailyModifiers(daily);
      this.activeDailyChallenge = daily;
      this.dailyMods = {
        playerDamageMult: agg.playerDamageMult,
        playerSpeedMult: agg.playerSpeedMult,
        fireRateMult: agg.fireRateMult,
        enemyCountMult: agg.enemyCountMult,
        enemySpeedMult: agg.enemySpeedMult,
        disableShieldRegen: agg.disableShieldRegen,
        maxUpgrades: agg.maxUpgrades,
      };
      this.selectedShipId = daily.forcedShipId;
      if (daily.starterUpgradeId) {
        this.upgrades[daily.starterUpgradeId] = 1;
      }
      if (agg.startingDrone) {
        this.upgrades.orbital_drone = (this.upgrades.orbital_drone ?? 0) + 1;
      }
      this.runStartHighScore = getDailyBestScore(daily.dateKey);
    } else {
      this.activeDailyChallenge = null;
      this.dailyMods = {
        playerDamageMult: 1,
        playerSpeedMult: 1,
        fireRateMult: 1,
        enemyCountMult: 1,
        enemySpeedMult: 1,
        disableShieldRegen: false,
        maxUpgrades: null,
      };
      this.selectedShipId = shipId;
      this.runStartHighScore = this.highScore;
    }

    const ship = getShipSpec(this.selectedShipId);
    this.score = 0;
    this.runRecorded = false;
    this.wave = 1;
    this.kills = 0;
    this.coresCollected = 0;
    this.runDuration = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.tookDamageThisWave = false;
    this.noDamageWaveStreak = 0;
    this.hitstopTimer = 0;
    this.shieldDeflectSoundCooldown = 0;
    this.repairSoundCooldown = 0;
    this.shakeImpulses = [];
    this.shakeKickX = 0;
    this.shakeKickY = 0;
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.floatingTexts = [];
    this.shockwaves = [];
    this.playerTrail = [];
    for (const p of this.particles) p.active = false;

    const isAce = difficulty === "ace";
    const isBossRush = difficulty === "boss_rush";
    const tightVitals = isAce || isBossRush;
    const dailyAgg = this.activeDailyChallenge
      ? aggregateDailyModifiers(this.activeDailyChallenge)
      : null;
    const starterHullBonus = this.upgrades.hull_plating ?? 0;
    const starterShieldBonus = this.upgrades.shield_capacitor ?? 0;
    const starterDashLvl = this.upgrades.phase_dash_blast ?? 0;

    const baseHp = Math.max(
      1,
      (tightVitals ? 3 : 4) +
        ship.hpDelta +
        (dailyAgg?.maxHpDelta ?? 0) +
        starterHullBonus,
    );
    const baseShield = Math.max(
      1,
      (tightVitals ? 1 : 2) +
        ship.shieldDelta +
        (dailyAgg?.maxShieldDelta ?? 0) +
        starterShieldBonus,
    );
    this.player = {
      x: this.width * 0.5,
      y: this.height * 0.55,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: this.selectedShipId === "aegis" ? 16 : 15,
      hp: baseHp,
      maxHp: baseHp,
      shield: baseShield,
      maxShield: baseShield,
      shieldRegenTimer: 0,
      shieldRegenDelay: Math.max(
        1.5,
        ship.shieldRegenDelay - starterShieldBonus * 0.55,
      ),
      empCharge: isBossRush ? 25 : dailyAgg ? dailyAgg.startingEmp : 50,
      invulnTimer: 1.0,
      hitFlash: 0,
      fireTimer: 0,
      dashTimer: 0,
      dashInvulnTimer: 0,
      dashBoostTimer: 0,
      dashCooldown: 0,
      dashCooldownMax: Math.max(
        0.65,
        ship.dashCooldownMax * Math.pow(0.82, starterDashLvl),
      ),
      dashDirX: 0,
      dashDirY: -1,
      squashX: 1,
      squashY: 1,
      overdriveTimer: 0,
      trailTimer: 0,
      timeDilationTimer: 0,
      timeDilationDuration: 2.6,
      timeDilationCooldown: 0,
      timeDilationCooldownMax: 12.0,
    };

    this.gameState = "PLAYING";
    this.beginWave(1);
    this.emitHudSnapshot();
  }

  public canOfferUpgradeInCurrentMode(): boolean {
    if (this.difficulty === "boss_rush") {
      return this.bossRushUpgradesUsed < BOSS_RUSH_MAX_UPGRADES;
    }
    if (this.difficulty === "daily" && this.dailyMods.maxUpgrades !== null) {
      return this.dailyUpgradesUsed < this.dailyMods.maxUpgrades;
    }
    return true;
  }

  public advanceWithoutUpgrade(): void {
    if (this.difficulty === "boss_rush") {
      // Limited resource recovery in Boss Rush: at most +1 shield every 2nd boss wave
      if (this.wave % 2 === 0 && this.player.shield < this.player.maxShield) {
        this.player.shield += 1;
      }
    } else if (
      !this.dailyMods.disableShieldRegen &&
      this.player.shield < this.player.maxShield
    ) {
      this.player.shield = this.player.maxShield;
    }

    this.wave += 1;
    this.gameState = "PLAYING";
    this.beginWave(this.wave);
    this.emitHudSnapshot();
  }

  public applyUpgradeAndContinue(upgradeId: UpgradeId): void {
    const prev = this.upgrades[upgradeId] ?? 0;
    this.upgrades[upgradeId] = prev + 1;
    const isBossRush = this.difficulty === "boss_rush";
    if (isBossRush) {
      this.bossRushUpgradesUsed += 1;
    } else if (
      this.difficulty === "daily" &&
      this.dailyMods.maxUpgrades !== null
    ) {
      this.dailyUpgradesUsed += 1;
    }

    if (upgradeId === "hull_plating") {
      this.player.maxHp += 1;
      this.player.hp = isBossRush
        ? Math.min(this.player.maxHp, this.player.hp + 1)
        : this.player.maxHp;
    } else if (upgradeId === "shield_capacitor") {
      const ship = getShipSpec(this.selectedShipId);
      this.player.maxShield += 1;
      this.player.shield = isBossRush
        ? Math.min(this.player.maxShield, this.player.shield + 1)
        : this.player.maxShield;
      this.player.shieldRegenDelay = Math.max(
        1.5,
        ship.shieldRegenDelay - (prev + 1) * 0.55,
      );
    } else if (upgradeId === "phase_dash_blast") {
      const ship = getShipSpec(this.selectedShipId);
      this.player.dashCooldownMax = Math.max(
        0.65,
        ship.dashCooldownMax * Math.pow(0.82, prev + 1),
      );
    }

    // Small recovery on wave clear (limited to +1 shield in Boss Rush, suppressed if shield regen disabled)
    if (
      !this.dailyMods.disableShieldRegen &&
      this.player.shield < this.player.maxShield
    ) {
      this.player.shield = isBossRush
        ? this.player.shield + 1
        : this.player.maxShield;
    }

    this.wave += 1;
    this.gameState = "PLAYING";
    this.beginWave(this.wave);
    this.emitHudSnapshot();
  }

  public getHighScore(): number {
    return this.highScore;
  }

  public commitCurrentRunToLeaderboard(): LeaderboardEntry[] {
    if (!this.runRecorded && this.score > 0) {
      this.runRecorded = true;
      if (this.difficulty === "daily" && this.activeDailyChallenge) {
        recordDailyRunToLeaderboard({
          dateKey: this.activeDailyChallenge.dateKey,
          score: this.score,
          wave: this.wave,
          shipId: this.selectedShipId,
        });
        return loadLeaderboard();
      }
      return recordRunToLeaderboard({
        score: this.score,
        wave: this.wave,
        difficulty: this.difficulty,
      });
    }
    return loadLeaderboard();
  }

  public getActiveUpgrades(): Partial<Record<UpgradeId, number>> {
    return { ...this.upgrades };
  }

  private beginWave(waveNum: number): void {
    this.waveSpawnQueue = [];
    this.waveSpawnClock = 0;
    this.waveClearDelay = 0;
    this.tookDamageThisWave = false;

    if (this.difficulty === "boss_rush") {
      const isTwinBoss = waveNum % 5 === 0;
      if (isTwinBoss) {
        this.waveSpawnQueue.push({
          kind: "boss",
          delay: 0.35,
          x: this.width * 0.34,
          y: this.arenaMargin + 115,
        });
        this.waveSpawnQueue.push({
          kind: "boss",
          delay: 0.75,
          x: this.width * 0.66,
          y: this.arenaMargin + 115,
        });
      } else {
        this.waveSpawnQueue.push({
          kind: "boss",
          delay: 0.35,
          x: this.width * 0.5,
          y: this.arenaMargin + 110,
        });
      }

      this.addFloatingText(
        this.player.x,
        this.player.y - 44,
        isTwinBoss
          ? `SONG TRÙM #${waveNum} · CỰC HẠN!`
          : `TRÙM #${waveNum} · BOSS RUSH`,
        "#FB7185",
      );
      return;
    }

    const isAce = this.difficulty === "ace";
    const isDaily =
      this.difficulty === "daily" && this.activeDailyChallenge !== null;
    const diffScale = isAce
      ? 1.25
      : isDaily
        ? 1.1 * this.dailyMods.enemyCountMult
        : 1.0;
    const waveRng = isDaily
      ? createDailySeededRng(this.activeDailyChallenge!.seed + waveNum * 7919)
      : Math.random;

    if (waveNum % 4 === 0) {
      // Boss wave with mixed vanguard escorts
      this.waveSpawnQueue.push({ kind: "boss", delay: 0.4 });
      const supportCount = Math.min(7, Math.floor(waveNum * 0.85));
      const supportPool: EnemyKind[] = [
        "scout",
        "rusher",
        "weaver",
        "kamikaze",
        "seeker",
        "sniper",
      ];
      if (waveNum >= 8) {
        supportPool.push("shielder");
        supportPool.push("repair_drone");
      }
      for (let i = 0; i < supportCount; i++) {
        this.waveSpawnQueue.push({
          kind: supportPool[i % supportPool.length],
          delay: 3.4 + i * 2.2,
        });
      }
    } else {
      const totalEnemies = Math.round((5 + waveNum * 2.7) * diffScale);
      const maxRepairDrones = waveNum >= 6 ? 3 : waveNum >= 3 ? 2 : 1;
      let repairDroneCount = 0;
      for (let i = 0; i < totalEnemies; i++) {
        const roll = waveRng();
        let kind: EnemyKind = "scout";
        if (waveNum === 1) {
          kind = roll > 0.68 ? "rusher" : "scout";
        } else if (waveNum === 2) {
          if (roll > 0.87) kind = "sniper";
          else if (roll > 0.77 && repairDroneCount < maxRepairDrones) {
            kind = "repair_drone";
            repairDroneCount++;
          } else if (roll > 0.68) kind = "seeker";
          else if (roll > 0.56) kind = "kamikaze";
          else if (roll > 0.4) kind = "weaver";
          else if (roll > 0.27) kind = "rusher";
          else if (roll > 0.2) kind = "bomber";
        } else {
          if (roll > 0.91) kind = "juggernaut";
          else if (roll > 0.82) kind = "bomber";
          else if (roll > 0.72) kind = "shielder";
          else if (roll > 0.63 && repairDroneCount < maxRepairDrones) {
            kind = "repair_drone";
            repairDroneCount++;
          } else if (roll > 0.54) kind = "sniper";
          else if (roll > 0.44) kind = "seeker";
          else if (roll > 0.34) kind = "kamikaze";
          else if (roll > 0.22) kind = "weaver";
          else if (roll > 0.12) kind = "rusher";
        }
        // Group spawns slightly for tactical pacing
        const groupDelay =
          Math.floor(i / 3) * Math.max(1.25, 2.5 - waveNum * 0.1) +
          (i % 3) * 0.28;
        this.waveSpawnQueue.push({ kind, delay: 0.35 + groupDelay });
      }
    }

    const waveBanner = isDaily
      ? waveNum % 4 === 0
        ? `THỬ THÁCH NGÀY · ĐỢT ${waveNum} · TRÙM`
        : `THỬ THÁCH NGÀY · ĐỢT ${waveNum}`
      : waveNum % 4 === 0
        ? `ĐỢT ${waveNum} · TRÙM CUỐI`
        : `ĐỢT ${waveNum}`;
    this.addFloatingText(
      this.player.x,
      this.player.y - 44,
      waveBanner,
      waveNum % 4 === 0 ? "#FB7185" : isDaily ? "#38BDF8" : "#F59E0B",
    );
  }

  private clearInputs(): void {
    this.heldKeys.clear();
    this.mouseDown = false;
    this.dashBufferTimer = 0;
    this.empBufferTimer = 0;
    this.timeDilationBufferTimer = 0;
  }

  private clearInputsOnBlur(): void {
    this.clearInputs();
    if (this.gameState === "PLAYING") {
      this.callbacks.onPauseToggle();
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.code === "Escape" || e.code === "KeyP") {
      if (this.gameState === "PLAYING" || this.gameState === "PAUSED") {
        e.preventDefault();
        this.callbacks.onPauseToggle();
        return;
      }
    }

    if (this.gameState !== "PLAYING") return;

    this.heldKeys.add(e.code);

    if (
      e.code === "Space" ||
      e.code === "ShiftLeft" ||
      e.code === "ShiftRight"
    ) {
      e.preventDefault();
      if (!e.repeat) {
        this.dashBufferTimer = 0.15;
      }
    }
    if (e.code === "KeyE") {
      e.preventDefault();
      if (!e.repeat) {
        this.empBufferTimer = 0.15;
      }
    }
    if (e.code === "KeyQ") {
      e.preventDefault();
      if (!e.repeat) {
        this.timeDilationBufferTimer = 0.15;
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.heldKeys.delete(e.code);
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
    this.hasMouseMoved = true;
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.gameState !== "PLAYING") return;
    soundEngine.unlock();
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
    this.hasMouseMoved = true;

    if (e.button === 0) {
      this.mouseDown = true;
    } else if (e.button === 2) {
      this.empBufferTimer = 0.15;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDown = false;
    }
  }

  private startLoop(): void {
    this.running = true;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      if (this.gameState === "PLAYING") {
        this.updatePlaying(dt);
      } else {
        // Gentle starfield drift in background when paused/title
        this.updateAmbientParticles(dt);
      }

      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private updateAmbientParticles(dt: number): void {
    this.decayScreenshake(dt);
    this.updateShockwaves(dt);
    this.updateCameraParallax(dt);
    updateParallaxSpaceState(this.parallaxSpace, dt * 0.45, this.reducedMotion);
    this.updateBackgroundWeather(dt * 0.45);
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
    }
  }

  private updatePlaying(dt: number): void {
    // Camera shake & shockwave pulses always advance smoothly even during hitstop
    this.decayScreenshake(dt);
    this.updateShockwaves(dt);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Time Dilation & audio throttle timers run in real time
    this.shieldDeflectSoundCooldown = Math.max(
      0,
      this.shieldDeflectSoundCooldown - dt,
    );
    this.repairSoundCooldown = Math.max(0, this.repairSoundCooldown - dt);
    this.timeDilationBufferTimer = Math.max(
      0,
      this.timeDilationBufferTimer - dt,
    );
    this.player.timeDilationTimer = Math.max(
      0,
      this.player.timeDilationTimer - dt,
    );
    this.player.timeDilationCooldown = Math.max(
      0,
      this.player.timeDilationCooldown - dt,
    );

    if (
      this.timeDilationBufferTimer > 0 &&
      this.player.timeDilationCooldown <= 0 &&
      this.player.timeDilationTimer <= 0
    ) {
      this.timeDilationBufferTimer = 0;
      this.player.timeDilationTimer = this.player.timeDilationDuration;
      this.player.timeDilationCooldown = this.player.timeDilationCooldownMax;
      soundEngine.playTimeDilation();
      this.spawnRing(this.player.x, this.player.y, 260, "#818CF8", 0.45);
      this.spawnRing(this.player.x, this.player.y, 140, "#38BDF8", 0.35);
      this.spawnScreenShockwave(this.player.x, this.player.y, "time_dilation");
      this.addFloatingText(
        this.player.x,
        this.player.y - 32,
        "GIÃN THỜI GIAN!",
        "#A5B4FC",
      );
      this.emitHudSnapshot();
    }

    const isTimeDilated = this.player.timeDilationTimer > 0;
    const worldDt = isTimeDilated ? dt * 0.28 : dt;
    const playerDt = isTimeDilated ? dt * 0.94 : dt;

    this.updateCameraParallax(dt);
    updateParallaxSpaceState(this.parallaxSpace, worldDt, this.reducedMotion);
    this.updateBackgroundWeather(worldDt);

    this.runDuration += dt;
    this.waveSpawnClock += worldDt;

    // Spawn enemies from wave queue
    while (
      this.waveSpawnQueue.length > 0 &&
      this.waveSpawnQueue[0].delay <= this.waveSpawnClock
    ) {
      const next = this.waveSpawnQueue.shift()!;
      this.spawnEnemy(next.kind, next.x, next.y);
    }

    // Combo decay slows alongside enemies
    if (this.combo > 1) {
      this.comboTimer -= worldDt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboTimer = 0;
      }
    }

    // Player updates remain responsive while enemies & enemy projectiles slow down
    this.updatePlayer(playerDt);
    this.updateDrones(playerDt);
    this.updateBullets(playerDt, worldDt);
    this.updateEnemies(worldDt * this.dailyMods.enemySpeedMult);
    this.updatePickups(playerDt);
    this.updateParticles(playerDt);
    this.updateFloatingTexts(dt);

    // Check wave clear
    if (this.waveSpawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveClearDelay += dt;
      if (this.waveClearDelay >= 0.9) {
        soundEngine.playWaveClear();
        if (!this.tookDamageThisWave) {
          this.noDamageWaveStreak += 1;
          this.achievementState.maxNoDamageWaveStreak = Math.max(
            this.achievementState.maxNoDamageWaveStreak,
            this.noDamageWaveStreak,
          );
        }
        if (this.difficulty === "boss_rush") {
          this.achievementState.maxBossRushCleared = Math.max(
            this.achievementState.maxBossRushCleared,
            this.wave,
          );
        }
        this.evaluateAndEmitAchievements();

        if (!this.canOfferUpgradeInCurrentMode()) {
          this.advanceWithoutUpgrade();
          this.addFloatingText(
            this.player.x,
            this.player.y - 72,
            "HẾT LƯỢT NÂNG CẤP · TIẾN ĐỢT MỚI!",
            "#FB7185",
          );
          return;
        }
        this.gameState = "ROUND_SUMMARY";
        this.clearInputs();
        this.emitHudSnapshot();
        this.callbacks.onWaveCleared(this.wave);
        return;
      }
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.065) {
      this.hudSyncTimer = 0;
      this.emitHudSnapshot();
    }
  }

  private isBossPhaseActive(): boolean {
    return (
      this.enemies.some((e) => e.kind === "boss") ||
      this.waveSpawnQueue.some((q) => q.kind === "boss")
    );
  }

  private updatePlayer(dt: number): void {
    const p = this.player;

    // Timers
    p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.fireTimer = Math.max(0, p.fireTimer - dt);
    p.dashInvulnTimer = Math.max(0, p.dashInvulnTimer - dt);
    p.dashBoostTimer = Math.max(0, p.dashBoostTimer - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.overdriveTimer = Math.max(0, p.overdriveTimer - dt);
    this.dashBufferTimer = Math.max(0, this.dashBufferTimer - dt);
    this.empBufferTimer = Math.max(0, this.empBufferTimer - dt);

    // Shield Recharge: regenerates after 5s without taking damage, disabled during Boss phase or daily constraint
    if (p.shield < p.maxShield) {
      if (this.isBossPhaseActive() || this.dailyMods.disableShieldRegen) {
        p.shieldRegenTimer = 0;
      } else {
        p.shieldRegenTimer += dt;
        if (p.shieldRegenTimer >= p.shieldRegenDelay) {
          p.shield += 1;
          // Rapidly refill any remaining shield points if player keeps avoiding damage
          p.shieldRegenTimer =
            p.shield < p.maxShield ? Math.max(0, p.shieldRegenDelay - 0.55) : 0;
          soundEngine.playShieldRecharge();
          this.spawnRing(p.x, p.y, 42, "#38BDF8", 0.36);
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI * 2) / 6;
            this.spawnParticle(
              p.x + Math.cos(a) * 14,
              p.y + Math.sin(a) * 14,
              Math.cos(a) * 65,
              Math.sin(a) * 65,
              0.24,
              3,
              0.4,
              "#38BDF8",
              "spark",
              a,
              { drag: 0.15, additive: true },
            );
          }
          this.addFloatingText(p.x, p.y - 26, "+1 KHIÊN", "#38BDF8");
          this.emitHudSnapshot();
        }
      }
    } else {
      p.shieldRegenTimer = 0;
    }

    // Smooth squash/stretch recovery
    p.squashX += (1 - p.squashX) * Math.min(1, dt * 14);
    p.squashY += (1 - p.squashY) * Math.min(1, dt * 14);

    // Movement vector from held keys
    let moveX = 0;
    let moveY = 0;
    if (this.heldKeys.has("KeyW") || this.heldKeys.has("ArrowUp")) moveY -= 1;
    if (this.heldKeys.has("KeyS") || this.heldKeys.has("ArrowDown")) moveY += 1;
    if (this.heldKeys.has("KeyA") || this.heldKeys.has("ArrowLeft")) moveX -= 1;
    if (this.heldKeys.has("KeyD") || this.heldKeys.has("ArrowRight"))
      moveX += 1;

    const moveLen = Math.hypot(moveX, moveY);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveY /= moveLen;
    }

    // Aim angle toward mouse
    const aimDx = this.mouseX - p.x;
    const aimDy = this.mouseY - p.y;
    if (Math.hypot(aimDx, aimDy) > 4) {
      p.angle = Math.atan2(aimDy, aimDx);
    }

    // Buffered Dash trigger (temporary i-frames + burst & exit speed boost)
    if (this.dashBufferTimer > 0 && p.dashCooldown <= 0 && p.dashTimer <= 0) {
      this.dashBufferTimer = 0;
      p.dashTimer = 0.18;
      p.dashInvulnTimer = 0.34;
      p.dashBoostTimer = 0.48;
      p.dashCooldown = p.dashCooldownMax;
      p.invulnTimer = Math.max(p.invulnTimer, 0.34);
      if (moveLen > 0) {
        p.dashDirX = moveX;
        p.dashDirY = moveY;
      } else {
        p.dashDirX = Math.cos(p.angle);
        p.dashDirY = Math.sin(p.angle);
      }
      p.squashX = 1.44;
      p.squashY = 0.7;
      soundEngine.playDash();
      this.spawnRing(p.x, p.y, 44, "#34D399", 0.28);
      this.spawnScreenShockwave(p.x, p.y, "dash");
      for (let i = 0; i < 12; i++) {
        this.spawnParticle(
          p.x,
          p.y,
          -p.dashDirX * (120 + Math.random() * 140) +
            (Math.random() - 0.5) * 90,
          -p.dashDirY * (120 + Math.random() * 140) +
            (Math.random() - 0.5) * 90,
          0.25 + Math.random() * 0.18,
          4,
          0,
          i % 3 === 0 ? "#6EE7B7" : "#38BDF8",
          "spark",
        );
      }
      this.emitHudSnapshot();
    }

    // Buffered EMP Shockwave trigger
    if (this.empBufferTimer > 0 && p.empCharge >= 100) {
      this.empBufferTimer = 0;
      this.triggerEmpShockwave();
    }

    // Apply velocity (Dash vs Normal Flight)
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      const dashSpeed = 940;
      p.vx = p.dashDirX * dashSpeed;
      p.vy = p.dashDirY * dashSpeed;

      // Dash exhaust trail tinted with ship exhaust signature
      const dashShip = getShipSpec(this.selectedShipId);
      this.spawnParticle(
        p.x - p.dashDirX * 10,
        p.y - p.dashDirY * 10,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        0.2,
        7,
        1,
        Math.random() < 0.45 ? dashShip.exhaust.primaryHex : "#38BDF8",
        "glow",
      );

      if (p.dashTimer <= 0) {
        // Check Phase Dash Blast upgrade!
        const blastLvl = this.upgrades.phase_dash_blast ?? 0;
        if (blastLvl > 0) {
          const radius = 115 + blastLvl * 28;
          const dmg = 26 + blastLvl * 14;
          this.spawnRing(p.x, p.y, radius, "#38BDF8", 0.32);
          this.spawnScreenShockwave(p.x, p.y, "dash_blast");
          this.triggerShakePreset("dash_blast", p.dashDirX, p.dashDirY);
          for (const e of this.enemies) {
            if (e.spawnDelay > 0) continue;
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d <= radius + e.radius) {
              this.damageEnemy(
                e,
                dmg,
                Math.atan2(e.y - p.y, e.x - p.x),
                95,
                "ability",
              );
            }
          }
        }
      }
    } else {
      const ship = getShipSpec(this.selectedShipId);
      const boostMult = p.dashBoostTimer > 0 ? 1.38 : 1;
      const maxSpeed =
        ship.maxSpeed * this.dailyMods.playerSpeedMult * boostMult;
      const accel = ship.accel * this.dailyMods.playerSpeedMult * boostMult;
      const drag = 7.8;

      if (moveLen > 0) {
        p.vx += moveX * accel * dt;
        p.vy += moveY * accel * dt;
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > maxSpeed) {
          p.vx = (p.vx / spd) * maxSpeed;
          p.vy = (p.vy / spd) * maxSpeed;
        }
      } else {
        p.vx -= p.vx * Math.min(1, drag * dt);
        p.vy -= p.vy * Math.min(1, drag * dt);
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Velocity-reactive continuous ribbon trail & exhaust wake
    for (let i = this.playerTrail.length - 1; i >= 0; i--) {
      this.playerTrail[i].life -= dt;
      if (this.playerTrail[i].life <= 0) {
        this.playerTrail.splice(i, 1);
      }
    }

    const shipSpec = getShipSpec(this.selectedShipId);
    const currentSpeed = Math.hypot(p.vx, p.vy);
    const isDashing = p.dashTimer > 0;
    const speedRatio = Math.min(1.45, currentSpeed / shipSpec.maxSpeed);

    if (currentSpeed > 28) {
      const cosA = Math.cos(p.angle);
      const sinA = Math.sin(p.angle);
      const perpX = -sinA;
      const perpY = cosA;
      const sternX = p.x - cosA * 13;
      const sternY = p.y - sinA * 13;
      const wingBackX = p.x - cosA * 9.5;
      const wingBackY = p.y - sinA * 9.5;
      const wingSpan = this.selectedShipId === "aegis" ? 14.5 : 13.5;
      const wingLX = wingBackX - perpX * wingSpan;
      const wingLY = wingBackY - perpY * wingSpan;
      const wingRX = wingBackX + perpX * wingSpan;
      const wingRY = wingBackY + perpY * wingSpan;

      const lastNode = this.playerTrail[0];
      const movedDist = lastNode
        ? Math.hypot(sternX - lastNode.x, sternY - lastNode.y)
        : 999;
      if (movedDist >= 4.5) {
        const nodeMaxLife = isDashing
          ? 0.34
          : 0.14 + Math.min(1, speedRatio) * 0.22;
        this.playerTrail.unshift({
          x: sternX,
          y: sternY,
          wingLX,
          wingLY,
          wingRX,
          wingRY,
          speedRatio,
          life: nodeMaxLife,
          maxLife: nodeMaxLife,
          dashing: isDashing,
          overdrive: p.overdriveTimer > 0,
        });
        if (this.playerTrail.length > 36) {
          this.playerTrail.length = 36;
        }
      }

      // Ship-specific colored engine particle exhaust trail
      const emitInterval = isDashing
        ? 0.014
        : 0.032 - Math.min(1, speedRatio) * 0.013;
      p.trailTimer += dt;
      if (p.trailTimer >= emitInterval && (isDashing || speedRatio > 0.28)) {
        p.trailTimer = 0;
        const velAngle = Math.atan2(p.vy, p.vx);
        const dirX = p.vx / currentSpeed;
        const dirY = p.vy / currentSpeed;
        const exhaust = shipSpec.exhaust;
        const primaryColor = isDashing
          ? "#38BDF8"
          : p.overdriveTimer > 0
            ? "#FBBF24"
            : exhaust.primaryHex;
        const secondaryColor = isDashing
          ? "#E0F2FE"
          : p.overdriveTimer > 0
            ? "#FEF3C7"
            : exhaust.secondaryHex;

        if (exhaust.style === "twin_ion") {
          // Striker: Twin-nozzle electric cyan plasma jets + fast ion sparks
          for (const side of [-1, 1]) {
            const nozX = sternX + perpX * 5.2 * side;
            const nozY = sternY + perpY * 5.2 * side;
            this.spawnParticle(
              nozX + (Math.random() - 0.5) * 2,
              nozY + (Math.random() - 0.5) * 2,
              -dirX * (55 + Math.min(1, speedRatio) * 75) + perpX * side * 14,
              -dirY * (55 + Math.min(1, speedRatio) * 75) + perpY * side * 14,
              isDashing ? 0.2 : 0.14 + Math.min(1, speedRatio) * 0.06,
              isDashing ? 3.8 : 2.1 + Math.min(1, speedRatio) * 1.1,
              0.25,
              primaryColor,
              "trail",
              velAngle,
            );
          }
          if (Math.random() < 0.65) {
            this.spawnParticle(
              sternX + (Math.random() - 0.5) * 8,
              sternY + (Math.random() - 0.5) * 8,
              -dirX * (80 + Math.random() * 50) + (Math.random() - 0.5) * 35,
              -dirY * (80 + Math.random() * 50) + (Math.random() - 0.5) * 35,
              0.16,
              2.2,
              0.3,
              secondaryColor,
              "spark",
              velAngle,
              { drag: 0.12, additive: true },
            );
          }
        } else if (exhaust.style === "bastion_plume") {
          // Aegis: Broad emerald ion exhaust wake + buoyant plasma glow orbs
          this.spawnParticle(
            sternX + (Math.random() - 0.5) * 7,
            sternY + (Math.random() - 0.5) * 7,
            -dirX * (34 + Math.min(1, speedRatio) * 50) +
              (Math.random() - 0.5) * 22,
            -dirY * (34 + Math.min(1, speedRatio) * 50) +
              (Math.random() - 0.5) * 22,
            isDashing ? 0.24 : 0.18 + Math.min(1, speedRatio) * 0.08,
            isDashing ? 5.6 : 3.2 + Math.min(1, speedRatio) * 1.6,
            0.5,
            primaryColor,
            "trail",
            velAngle,
          );
          this.spawnParticle(
            sternX + (Math.random() - 0.5) * 8,
            sternY + (Math.random() - 0.5) * 8,
            -dirX * (22 + Math.random() * 24) + (Math.random() - 0.5) * 20,
            -dirY * (22 + Math.random() * 24) + (Math.random() - 0.5) * 20,
            0.22,
            4.8 + Math.min(1, speedRatio) * 2.2,
            0.6,
            secondaryColor,
            "glow",
            0,
            { drag: 0.2, additive: true },
          );
        } else {
          // Interceptor: Focused amber thruster jet + warm golden embers
          this.spawnParticle(
            sternX + (Math.random() - 0.5) * 4,
            sternY + (Math.random() - 0.5) * 4,
            -dirX * (42 + Math.min(1, speedRatio) * 68) +
              (Math.random() - 0.5) * 26,
            -dirY * (42 + Math.min(1, speedRatio) * 68) +
              (Math.random() - 0.5) * 26,
            isDashing ? 0.2 : 0.14 + Math.min(1, speedRatio) * 0.06,
            isDashing ? 4.4 : 2.3 + Math.min(1, speedRatio) * 1.2,
            0.3,
            primaryColor,
            "trail",
            velAngle,
          );
          if (Math.random() < 0.55) {
            this.spawnParticle(
              sternX + (Math.random() - 0.5) * 6,
              sternY + (Math.random() - 0.5) * 6,
              -dirX * (52 + Math.random() * 40) + (Math.random() - 0.5) * 34,
              -dirY * (52 + Math.random() * 40) + (Math.random() - 0.5) * 34,
              0.2,
              2.6,
              0.2,
              secondaryColor,
              "ember",
              0,
              { drag: 0.15, additive: true },
            );
          }
        }
      }
    } else {
      p.trailTimer = 0;
    }

    // Clamp inside arena walls
    const minX = this.arenaMargin + p.radius;
    const maxX = this.width - this.arenaMargin - p.radius;
    const minY = this.arenaMargin + p.radius;
    const maxY = this.height - this.arenaMargin - p.radius;

    if (p.x < minX) {
      p.x = minX;
      p.vx = Math.max(0, p.vx);
    } else if (p.x > maxX) {
      p.x = maxX;
      p.vx = Math.min(0, p.vx);
    }
    if (p.y < minY) {
      p.y = minY;
      p.vy = Math.max(0, p.vy);
    } else if (p.y > maxY) {
      p.y = maxY;
      p.vy = Math.min(0, p.vy);
    }

    // Firing
    const wantsFire =
      this.mouseDown || this.heldKeys.has("KeyF") || this.heldKeys.has("KeyJ");
    if (wantsFire && p.fireTimer <= 0 && p.dashTimer <= 0) {
      this.firePlayerWeapons();
    }
  }

  private firePlayerWeapons(): void {
    const p = this.player;
    const ship = getShipSpec(this.selectedShipId);
    const overclock = this.upgrades.rapid_overclock ?? 0;
    const twin = this.upgrades.twin_cannons ?? 0;
    const ricochet = this.upgrades.ricochet_bolts ?? 0;
    const pierce = this.upgrades.piercing_rounds ?? 0;

    let fireInterval =
      ship.fireInterval *
      Math.pow(0.82, overclock) *
      this.dailyMods.fireRateMult;
    if (p.overdriveTimer > 0) {
      fireInterval *= 0.58;
    }
    p.fireTimer = Math.max(0.055, fireInterval);

    const barrelCount = ship.baseBarrels + twin;
    const spreadStep = ship.spreadStep;
    const bulletSpeed = ship.bulletSpeed + overclock * 55;
    const damage =
      (ship.baseDamage + pierce * 5) *
      (p.overdriveTimer > 0 ? 1.15 : 1) *
      this.dailyMods.playerDamageMult;

    for (let i = 0; i < barrelCount; i++) {
      const offsetIndex = i - (barrelCount - 1) / 2;
      const fireAngle = p.angle + offsetIndex * spreadStep;
      const muzzleX = p.x + Math.cos(fireAngle) * 18;
      const muzzleY = p.y + Math.sin(fireAngle) * 18;
      const bypassShieldIds = this.computeBypassShieldIds(
        muzzleX,
        muzzleY,
        p.x,
        p.y,
      );

      this.bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(fireAngle) * bulletSpeed,
        vy: Math.sin(fireAngle) * bulletSpeed,
        radius: pierce > 0 ? 5.5 : 4.5,
        damage,
        isEnemy: false,
        life: 1.8,
        bouncesLeft: ricochet,
        pierceLeft: pierce,
        hitIds: new Set<number>(),
        color: p.overdriveTimer > 0 ? "#FBBF24" : "#38BDF8",
        trailX: muzzleX,
        trailY: muzzleY,
        source: p.overdriveTimer > 0 ? "overdrive" : "player",
        bypassShieldIds,
      });
    }

    p.squashX = 0.88;
    p.squashY = 1.1;
    soundEngine.playShoot(barrelCount);

    // Muzzle spark
    this.spawnParticle(
      p.x + Math.cos(p.angle) * 20,
      p.y + Math.sin(p.angle) * 20,
      Math.cos(p.angle) * 90,
      Math.sin(p.angle) * 90,
      0.08,
      7,
      1,
      "#F59E0B",
      "glow",
    );
  }

  private triggerEmpShockwave(): void {
    const p = this.player;
    p.empCharge = 0;
    p.invulnTimer = Math.max(p.invulnTimer, 0.55);
    p.squashX = 1.35;
    p.squashY = 1.35;

    const blastRadius = 290;
    this.spawnRing(p.x, p.y, blastRadius, "#F59E0B", 0.45);
    this.spawnRing(p.x, p.y, blastRadius * 0.68, "#38BDF8", 0.35);
    this.spawnScreenShockwave(p.x, p.y, "emp");
    this.triggerShakePreset("emp_pulse");
    this.hitstopTimer = 0.055;
    soundEngine.playPulse();

    // Clear nearby enemy projectiles!
    this.bullets = this.bullets.filter((b) => {
      if (!b.isEnemy) return true;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d <= blastRadius) {
        this.spawnParticle(b.x, b.y, 0, 0, 0.18, 5, 0, "#F59E0B", "spark");
        return false;
      }
      return true;
    });

    // Damage & knockback enemies
    for (const e of [...this.enemies]) {
      if (e.spawnDelay > 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d <= blastRadius + e.radius) {
        const pushAngle = Math.atan2(e.y - p.y, e.x - p.x);
        this.damageEnemy(e, 75, pushAngle, 340, "emp");
      }
    }
  }

  private updateDrones(dt: number): void {
    const droneCount = this.upgrades.orbital_drone ?? 0;
    if (droneCount <= 0) return;

    this.droneOrbitAngle += dt * 2.4;
    const orbitRadius = 44;

    for (let i = 0; i < droneCount; i++) {
      this.droneFireTimers[i] = Math.max(
        0,
        (this.droneFireTimers[i] ?? 0) - dt,
      );
      if (this.droneFireTimers[i] > 0) continue;

      const angle = this.droneOrbitAngle + (i * Math.PI * 2) / droneCount;
      const dx = this.player.x + Math.cos(angle) * orbitRadius;
      const dy = this.player.y + Math.sin(angle) * orbitRadius;

      // Find nearest active enemy within 360px
      let nearest: Enemy | null = null;
      let bestDist = 360;
      for (const e of this.enemies) {
        if (e.spawnDelay > 0) continue;
        const d = Math.hypot(e.x - dx, e.y - dy);
        if (d < bestDist) {
          bestDist = d;
          nearest = e;
        }
      }

      if (nearest) {
        this.droneFireTimers[i] = 0.42;
        const shotAngle = Math.atan2(nearest.y - dy, nearest.x - dx);
        const bypassShieldIds = this.computeBypassShieldIds(dx, dy);
        this.bullets.push({
          x: dx,
          y: dy,
          vx: Math.cos(shotAngle) * 640,
          vy: Math.sin(shotAngle) * 640,
          radius: 3.5,
          damage: 11,
          isEnemy: false,
          life: 1.1,
          bouncesLeft: 0,
          pierceLeft: 0,
          hitIds: new Set<number>(),
          color: "#34D399",
          trailX: dx,
          trailY: dy,
          source: "drone",
          bypassShieldIds,
        });
      }
    }
  }

  private computeBypassShieldIds(
    originX: number,
    originY: number,
    altX?: number,
    altY?: number,
  ): Set<number> | undefined {
    let ids: Set<number> | undefined;
    for (const e of this.enemies) {
      if (e.kind !== "shielder" || e.spawnDelay > 0) continue;
      const insidePrimary =
        Math.hypot(originX - e.x, originY - e.y) <= EMP_DOME_RADIUS - 2;
      const insideAlt =
        altX !== undefined &&
        altY !== undefined &&
        Math.hypot(altX - e.x, altY - e.y) <= EMP_DOME_RADIUS - 2;
      if (insidePrimary || insideAlt) {
        if (!ids) ids = new Set<number>();
        ids.add(e.id);
      }
    }
    return ids;
  }

  private spawnEnemy(
    kind: EnemyKind,
    forcedX?: number,
    forcedY?: number,
  ): void {
    let x = forcedX ?? 0;
    let y = forcedY ?? 0;

    if (forcedX === undefined || forcedY === undefined) {
      const pad = this.arenaMargin + 48;
      for (let attempt = 0; attempt < 16; attempt++) {
        if (kind === "boss") {
          x = this.width * 0.5;
          y = this.arenaMargin + 110;
        } else {
          x = pad + Math.random() * (this.width - pad * 2);
          y = pad + Math.random() * (this.height - pad * 2);
        }
        const distToPlayer = Math.hypot(x - this.player.x, y - this.player.y);
        if (distToPlayer >= 200) break;
      }
    }

    const isBossRush = this.difficulty === "boss_rush";
    const waveHpMult =
      isBossRush && kind === "boss"
        ? (1 + (this.wave - 1) * 0.22) * (this.wave % 5 === 0 ? 0.72 : 1.0)
        : 1 + (this.wave - 1) * 0.14;
    const aceMult = this.difficulty === "ace" ? 1.2 : 1.0;
    const m = waveHpMult * aceMult;

    const archetype = ENEMY_ARCHETYPES[kind];
    const scaledHp = Math.round(archetype.baseHp * m);
    this.enemies.push({
      id: this.nextEnemyId++,
      kind,
      behavior: archetype.behavior,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: archetype.radius,
      hp: scaledHp,
      maxHp: scaledHp,
      angle: Math.atan2(this.player.y - y, this.player.x - x),
      spinAngle: 0,
      state: "chase",
      stateTimer:
        kind === "sniper"
          ? 1.1
          : kind === "shielder"
            ? 1.35 + Math.random() * 0.45
            : kind === "seeker"
              ? 1.15 + Math.random() * 0.45
              : kind === "rusher"
                ? 0.55 + Math.random() * 0.35
                : kind === "kamikaze"
                  ? 0.55 + Math.random() * 0.35
                  : kind === "weaver"
                    ? 1.6 + Math.random() * 0.7
                    : 0.7 + Math.random() * 0.6,
      aimAngle: 0,
      behaviorPhase: Math.random() * Math.PI * 2,
      weaveSign: Math.random() < 0.5 ? -1 : 1,
      hitFlash: 0,
      squash: 1.3,
      spawnDelay: kind === "shard" ? 0 : 0.85,
      bossPhase: 0,
      bossPatternIdx: 0,
      bossStage: 1,
      bossSubShot: 0,
    });
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const minX = this.arenaMargin + 14;
    const maxX = this.width - this.arenaMargin - 14;
    const minY = this.arenaMargin + 14;
    const maxY = this.height - this.arenaMargin - 14;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.spawnDelay > 0) {
        e.spawnDelay -= dt;
        continue;
      }

      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.squash += (1 - e.squash) * Math.min(1, dt * 10);
      e.spinAngle +=
        dt *
        (e.kind === "boss"
          ? e.bossStage === 2
            ? 2.6
            : 1.1
          : e.kind === "juggernaut"
            ? 1.8
            : 1.1);
      e.behaviorPhase += dt;

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const dirToPlayer = Math.atan2(dy, dx);
      const archetype = ENEMY_ARCHETYPES[e.kind];

      if (e.behavior === "direct_charge") {
        // Straight-line pursuers: Scout (short lunge), Rusher (long supersonic lane charge), Shard (fast pursuit)
        if (e.kind === "rusher") {
          if (e.state === "chase") {
            e.angle = dirToPlayer;
            e.vx +=
              (Math.cos(dirToPlayer) * archetype.baseSpeed - e.vx) *
              Math.min(1, dt * 4);
            e.vy +=
              (Math.sin(dirToPlayer) * archetype.baseSpeed - e.vy) *
              Math.min(1, dt * 4);
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              e.state = "windup";
              e.stateTimer = 0.52;
              e.aimAngle = dirToPlayer;
              soundEngine.playTelegraph();
            }
          } else if (e.state === "windup") {
            e.vx *= Math.pow(0.03, dt);
            e.vy *= Math.pow(0.03, dt);
            if (e.stateTimer > 0.16) {
              e.aimAngle = dirToPlayer;
            }
            e.angle = e.aimAngle;
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              e.state = "action";
              e.stateTimer = 0.52;
              const chargeSpeed = this.difficulty === "ace" ? 670 : 610;
              e.vx = Math.cos(e.aimAngle) * chargeSpeed;
              e.vy = Math.sin(e.aimAngle) * chargeSpeed;
              e.squash = 1.45;
            }
          } else if (e.state === "action") {
            e.angle = Math.atan2(e.vy, e.vx);
            e.stateTimer -= dt;
            // Subtle orange thruster sparks behind charging rusher
            if (Math.random() < 0.65) {
              this.spawnParticle(
                e.x - Math.cos(e.angle) * 12,
                e.y - Math.sin(e.angle) * 12,
                -Math.cos(e.angle) * 70,
                -Math.sin(e.angle) * 70,
                0.15,
                3.5,
                0.4,
                "#F97316",
                "spark",
              );
            }
            if (e.stateTimer <= 0) {
              e.state = "cooldown";
              e.stateTimer = 0.48;
            }
          } else {
            e.vx *= Math.pow(0.08, dt);
            e.vy *= Math.pow(0.08, dt);
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              e.state = "chase";
              e.stateTimer = 0.75 + Math.random() * 0.4;
            }
          }
        } else {
          const speed =
            e.kind === "shard"
              ? archetype.baseSpeed
              : archetype.baseSpeed + this.wave * 3;
          if (e.state === "chase") {
            e.angle = dirToPlayer;
            e.vx +=
              (Math.cos(dirToPlayer) * speed - e.vx) * Math.min(1, dt * 5);
            e.vy +=
              (Math.sin(dirToPlayer) * speed - e.vy) * Math.min(1, dt * 5);
            e.stateTimer -= dt;
            if (e.kind === "scout" && dist < 240 && e.stateTimer <= 0) {
              e.state = "windup";
              e.stateTimer = 0.42;
              e.aimAngle = dirToPlayer;
            }
          } else if (e.state === "windup") {
            e.vx *= Math.pow(0.05, dt);
            e.vy *= Math.pow(0.05, dt);
            e.angle = e.aimAngle;
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              e.state = "action";
              e.stateTimer = 0.28;
              e.vx = Math.cos(e.aimAngle) * 470;
              e.vy = Math.sin(e.aimAngle) * 470;
              e.squash = 1.35;
            }
          } else if (e.state === "action") {
            e.stateTimer -= dt;
            if (e.stateTimer <= 0) {
              e.state = "chase";
              e.stateTimer = 1.2 + Math.random() * 0.6;
            }
          }
        }
      } else if (e.behavior === "sine_weave") {
        // Sinusoidal lateral weaving interceptor that dodges straight shots and fires plasma bolts
        const waveAmp = 185;
        const waveFreq = 4.6;
        const waveOffset =
          Math.sin(e.behaviorPhase * waveFreq) * waveAmp * e.weaveSign;
        const perpAngle = dirToPlayer + Math.PI / 2;
        const forwardPull =
          dist > 150 ? archetype.baseSpeed : dist < 95 ? -85 : 35;

        const targetVx =
          Math.cos(dirToPlayer) * forwardPull +
          Math.cos(perpAngle) * waveOffset;
        const targetVy =
          Math.sin(dirToPlayer) * forwardPull +
          Math.sin(perpAngle) * waveOffset;
        e.vx += (targetVx - e.vx) * Math.min(1, dt * 6);
        e.vy += (targetVy - e.vy) * Math.min(1, dt * 6);
        e.angle = Math.atan2(e.vy, e.vx);

        if (e.state === "chase") {
          e.stateTimer -= dt;
          if (e.stateTimer <= 0 && dist < 480) {
            e.state = "windup";
            e.stateTimer = 0.35;
            e.aimAngle = dirToPlayer;
          }
        } else if (e.state === "windup") {
          e.aimAngle = dirToPlayer;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            for (const spread of [-0.14, 0.14]) {
              const shotAng = e.aimAngle + spread;
              this.bullets.push({
                x: e.x + Math.cos(shotAng) * 14,
                y: e.y + Math.sin(shotAng) * 14,
                vx: Math.cos(shotAng) * 290,
                vy: Math.sin(shotAng) * 290,
                radius: 4.5,
                damage: 1,
                isEnemy: true,
                life: 2.3,
                bouncesLeft: 0,
                pierceLeft: 0,
                hitIds: new Set<number>(),
                color: "#C084FC",
                trailX: e.x,
                trailY: e.y,
              });
            }
            e.squash = 1.24;
            e.state = "chase";
            e.stateTimer = 1.85 + Math.random() * 0.6;
          }
        }
      } else if (e.behavior === "kite_strafe") {
        const preferredDist = 310;
        if (e.state === "chase") {
          e.angle = dirToPlayer;
          const moveSign =
            dist > preferredDist + 40 ? 1 : dist < preferredDist - 40 ? -1 : 0;
          const strafeAngle = dirToPlayer + (Math.PI / 2) * e.weaveSign;
          const targetVx =
            Math.cos(dirToPlayer) * archetype.baseSpeed * moveSign +
            Math.cos(strafeAngle) * 80;
          const targetVy =
            Math.sin(dirToPlayer) * archetype.baseSpeed * moveSign +
            Math.sin(strafeAngle) * 80;
          e.vx += (targetVx - e.vx) * Math.min(1, dt * 4);
          e.vy += (targetVy - e.vy) * Math.min(1, dt * 4);
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = "windup";
            e.stateTimer = 0.95;
            e.aimAngle = dirToPlayer;
            soundEngine.playTelegraph();
          }
        } else if (e.state === "windup") {
          e.vx *= Math.pow(0.04, dt);
          e.vy *= Math.pow(0.04, dt);
          // Track player for first 0.68s, lock aim for last 0.27s so player can dodge!
          if (e.stateTimer > 0.27) {
            e.aimAngle = dirToPlayer;
          }
          e.angle = e.aimAngle;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            this.bullets.push({
              x: e.x + Math.cos(e.aimAngle) * 18,
              y: e.y + Math.sin(e.aimAngle) * 18,
              vx: Math.cos(e.aimAngle) * 520,
              vy: Math.sin(e.aimAngle) * 520,
              radius: 5,
              damage: 1.25,
              isEnemy: true,
              life: 2.2,
              bouncesLeft: 0,
              pierceLeft: 0,
              hitIds: new Set<number>(),
              color: "#FB7185",
              trailX: e.x,
              trailY: e.y,
            });
            e.squash = 0.78;
            e.state = "cooldown";
            e.stateTimer = 1.4;
          }
        } else {
          e.vx *= Math.pow(0.15, dt);
          e.vy *= Math.pow(0.15, dt);
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = "chase";
            e.stateTimer = 0.9 + Math.random() * 0.6;
          }
        }
      } else if (e.behavior === "heavy_march") {
        if (e.state === "chase") {
          e.angle = dirToPlayer;
          e.vx +=
            (Math.cos(dirToPlayer) * archetype.baseSpeed - e.vx) *
            Math.min(1, dt * 3);
          e.vy +=
            (Math.sin(dirToPlayer) * archetype.baseSpeed - e.vy) *
            Math.min(1, dt * 3);
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = "windup";
            e.stateTimer = 0.8;
          }
        } else if (e.state === "windup") {
          e.vx *= Math.pow(0.08, dt);
          e.vy *= Math.pow(0.08, dt);
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            const count = this.difficulty === "ace" ? 8 : 6;
            for (let k = 0; k < count; k++) {
              const a = e.spinAngle + (k * Math.PI * 2) / count;
              this.bullets.push({
                x: e.x + Math.cos(a) * 20,
                y: e.y + Math.sin(a) * 20,
                vx: Math.cos(a) * 245,
                vy: Math.sin(a) * 245,
                radius: 6,
                damage: 1.2,
                isEnemy: true,
                life: 3.0,
                bouncesLeft: 0,
                pierceLeft: 0,
                hitIds: new Set<number>(),
                color: "#FB7185",
                trailX: e.x,
                trailY: e.y,
              });
            }
            e.squash = 1.3;
            e.state = "chase";
            e.stateTimer = 2.0;
          }
        }
      } else if (e.behavior === "spiral_approach") {
        if (e.state === "chase") {
          // Spiral inward along an angled arc rather than a straight line
          const spiralAngle = dirToPlayer + 0.54 * e.weaveSign;
          e.angle = spiralAngle;
          e.vx +=
            (Math.cos(spiralAngle) * archetype.baseSpeed - e.vx) *
            Math.min(1, dt * 4.5);
          e.vy +=
            (Math.sin(spiralAngle) * archetype.baseSpeed - e.vy) *
            Math.min(1, dt * 4.5);
          if (dist < 88) {
            e.state = "windup";
            e.stateTimer = 0.72;
            soundEngine.playTelegraph();
          }
        } else if (e.state === "windup") {
          e.vx *= Math.pow(0.06, dt);
          e.vy *= Math.pow(0.06, dt);
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            this.detonateBomber(e);
            this.enemies.splice(i, 1);
            continue;
          }
        }
      } else if (e.behavior === "kamikaze_lock") {
        if (e.state === "chase") {
          const stalkSpeed = archetype.baseSpeed + this.wave * 2;
          e.angle = dirToPlayer;
          e.vx +=
            (Math.cos(dirToPlayer) * stalkSpeed - e.vx) * Math.min(1, dt * 5);
          e.vy +=
            (Math.sin(dirToPlayer) * stalkSpeed - e.vy) * Math.min(1, dt * 5);
          e.stateTimer -= dt;
          if (e.stateTimer <= 0 && dist < 460) {
            e.state = "windup";
            e.stateTimer = 0.62;
            e.aimAngle = dirToPlayer;
            soundEngine.playTelegraph();
          }
        } else if (e.state === "windup") {
          e.vx *= Math.pow(0.02, dt);
          e.vy *= Math.pow(0.02, dt);
          // Track player during initial lock-on, then freeze aim for final 0.22s so player can dodge
          if (e.stateTimer > 0.22) {
            e.aimAngle = dirToPlayer;
          }
          e.angle = e.aimAngle;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = "action";
            e.stateTimer = 0.95;
            const ramSpeed =
              (this.difficulty === "ace" ? 660 : 590) +
              Math.min(120, this.wave * 10);
            e.vx = Math.cos(e.aimAngle) * ramSpeed;
            e.vy = Math.sin(e.aimAngle) * ramSpeed;
            e.squash = 1.48;
          }
        } else {
          e.angle = Math.atan2(e.vy, e.vx);
          e.stateTimer -= dt;
          if (Math.random() < 0.85) {
            this.spawnParticle(
              e.x - Math.cos(e.angle) * 11,
              e.y - Math.sin(e.angle) * 11,
              -Math.cos(e.angle) * 95 + (Math.random() - 0.5) * 35,
              -Math.sin(e.angle) * 95 + (Math.random() - 0.5) * 35,
              0.18,
              3.4,
              0.3,
              Math.random() < 0.5 ? "#EF4444" : "#FBBF24",
              "spark",
              e.angle,
              { drag: 0.08, additive: true },
            );
          }
          if (e.stateTimer <= 0) {
            e.state = "chase";
            e.stateTimer = 0.65 + Math.random() * 0.35;
          }
        }
      } else if (e.behavior === "homing_artillery") {
        const preferredDist = 335;
        if (e.state === "chase") {
          e.angle = dirToPlayer;
          const radialSign =
            dist > preferredDist + 45 ? 1 : dist < preferredDist - 45 ? -1 : 0;
          const strafeAng = dirToPlayer + (Math.PI / 2) * e.weaveSign;
          const targetVx =
            Math.cos(dirToPlayer) * archetype.baseSpeed * radialSign +
            Math.cos(strafeAng) * 75;
          const targetVy =
            Math.sin(dirToPlayer) * archetype.baseSpeed * radialSign +
            Math.sin(strafeAng) * 75;
          e.vx += (targetVx - e.vx) * Math.min(1, dt * 4);
          e.vy += (targetVy - e.vy) * Math.min(1, dt * 4);
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = "windup";
            e.stateTimer = 0.58;
            e.aimAngle = dirToPlayer;
            soundEngine.playTelegraph();
          }
        } else if (e.state === "windup") {
          e.vx *= Math.pow(0.05, dt);
          e.vy *= Math.pow(0.05, dt);
          e.aimAngle = dirToPlayer;
          e.angle = dirToPlayer;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            const missileSpeed = this.difficulty === "ace" ? 280 : 250;
            const turnRate = this.difficulty === "ace" ? 2.4 : 2.15;
            for (const side of [-1, 1]) {
              const launchAng = e.aimAngle + side * 0.62;
              const podAng = e.aimAngle + (side * Math.PI) / 2;
              const ox = e.x + Math.cos(podAng) * 10;
              const oy = e.y + Math.sin(podAng) * 10;
              this.bullets.push({
                x: ox,
                y: oy,
                vx: Math.cos(launchAng) * missileSpeed,
                vy: Math.sin(launchAng) * missileSpeed,
                radius: 5.5,
                damage: 1.15,
                isEnemy: true,
                life: 3.4,
                bouncesLeft: 0,
                pierceLeft: 0,
                hitIds: new Set<number>(),
                color: "#2DD4BF",
                trailX: ox,
                trailY: oy,
                homingTurnRate: turnRate,
                homingSpeed: missileSpeed,
                homingDelay: 0.14,
                homingTimeLeft: 2.25,
              });
            }
            e.squash = 1.28;
            e.state = "cooldown";
            e.stateTimer = 1.9 + Math.random() * 0.5;
          }
        } else {
          e.vx *= Math.pow(0.14, dt);
          e.vy *= Math.pow(0.14, dt);
          e.angle = dirToPlayer;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = "chase";
            e.stateTimer = 1.3 + Math.random() * 0.5;
          }
        }
      } else if (e.behavior === "shield_projector") {
        const preferredDist = 245;
        if (e.state === "chase") {
          e.angle = dirToPlayer;
          const radialSign =
            dist > preferredDist + 45 ? 1 : dist < preferredDist - 45 ? -1 : 0;
          const strafeAng = dirToPlayer + (Math.PI / 2) * e.weaveSign;

          // Subtle escort pull toward nearest non-shielder ally so its EMP dome covers teammates
          let escortPullX = 0;
          let escortPullY = 0;
          let nearestAllyDist = 340;
          for (const ally of this.enemies) {
            if (
              ally.id === e.id ||
              ally.spawnDelay > 0 ||
              ally.kind === "shielder"
            )
              continue;
            const dAlly = Math.hypot(ally.x - e.x, ally.y - e.y);
            if (dAlly > 35 && dAlly < nearestAllyDist) {
              nearestAllyDist = dAlly;
              escortPullX = ((ally.x - e.x) / dAlly) * 34;
              escortPullY = ((ally.y - e.y) / dAlly) * 34;
            }
          }

          const targetVx =
            Math.cos(dirToPlayer) * archetype.baseSpeed * radialSign +
            Math.cos(strafeAng) * 64 +
            escortPullX;
          const targetVy =
            Math.sin(dirToPlayer) * archetype.baseSpeed * radialSign +
            Math.sin(strafeAng) * 64 +
            escortPullY;
          e.vx += (targetVx - e.vx) * Math.min(1, dt * 3.8);
          e.vy += (targetVy - e.vy) * Math.min(1, dt * 3.8);
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = "windup";
            e.stateTimer = 0.55;
            e.aimAngle = dirToPlayer;
            soundEngine.playTelegraph();
          }
        } else if (e.state === "windup") {
          e.vx *= Math.pow(0.08, dt);
          e.vy *= Math.pow(0.08, dt);
          if (e.stateTimer > 0.16) {
            e.aimAngle = dirToPlayer;
          }
          e.angle = e.aimAngle;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            const shotSpeed = this.difficulty === "ace" ? 275 : 245;
            for (const offset of [-0.24, 0, 0.24]) {
              this.spawnEnemyBullet(
                e.x,
                e.y,
                e.aimAngle + offset,
                shotSpeed,
                5,
                "#60A5FA",
                2.8,
                e.radius + 4,
              );
            }
            e.squash = 1.24;
            e.state = "cooldown";
            e.stateTimer = 1.45 + Math.random() * 0.45;
          }
        } else {
          e.vx *= Math.pow(0.22, dt);
          e.vy *= Math.pow(0.22, dt);
          e.angle = dirToPlayer;
          e.stateTimer -= dt;
          if (e.stateTimer <= 0) {
            e.state = "chase";
            e.stateTimer = 1.4 + Math.random() * 0.5;
          }
        }
      } else if (e.behavior === "medic_support") {
        // Non-aggressive support drone: seeks wounded allies and channels a repair beam
        let bestTarget: Enemy | null = null;
        let bestPriority = -Infinity;

        for (const ally of this.enemies) {
          if (
            ally.id === e.id ||
            ally.spawnDelay > 0 ||
            ally.kind === "repair_drone"
          )
            continue;
          const missingHp = Math.max(0, ally.maxHp - ally.hp);
          const missingRatio = missingHp / Math.max(1, ally.maxHp);
          const dAlly = Math.hypot(ally.x - e.x, ally.y - e.y);
          const tierBonus =
            ally.kind === "boss"
              ? 180
              : ally.kind === "juggernaut"
                ? 90
                : ally.kind === "shielder"
                  ? 45
                  : 0;
          const priority =
            missingHp > 0
              ? 1000 + missingRatio * 620 + tierBonus - dAlly * 0.42
              : tierBonus - dAlly * 0.5;
          if (priority > bestPriority) {
            bestPriority = priority;
            bestTarget = ally;
          }
        }

        if (bestTarget) {
          const awayAng = Math.atan2(e.y - bestTarget.y, e.x - bestTarget.x);
          const orbitDist = bestTarget.radius + 54;
          const orbitAng = awayAng + e.weaveSign * 0.45 * dt * 2.2;
          const desiredX = bestTarget.x + Math.cos(orbitAng) * orbitDist;
          const desiredY = bestTarget.y + Math.sin(orbitAng) * orbitDist;

          const toGoalX = desiredX - e.x;
          const toGoalY = desiredY - e.y;
          const dGoal = Math.hypot(toGoalX, toGoalY);
          const approachSpeed =
            dGoal > 12 ? Math.min(archetype.baseSpeed, dGoal * 4.2) : 0;
          let targetVx = dGoal > 1 ? (toGoalX / dGoal) * approachSpeed : 0;
          let targetVy = dGoal > 1 ? (toGoalY / dGoal) * approachSpeed : 0;

          // Keep safe distance away from player so Repair Drone stays behind enemy lines
          if (dist < 165) {
            const evadeStrength = ((165 - dist) / 165) * 135;
            targetVx -= Math.cos(dirToPlayer) * evadeStrength;
            targetVy -= Math.sin(dirToPlayer) * evadeStrength;
          }

          e.vx += (targetVx - e.vx) * Math.min(1, dt * 4.8);
          e.vy += (targetVy - e.vy) * Math.min(1, dt * 4.8);
          e.angle = Math.atan2(bestTarget.y - e.y, bestTarget.x - e.x);

          const healRange = bestTarget.radius + 118;
          const distToTarget = Math.hypot(
            bestTarget.x - e.x,
            bestTarget.y - e.y,
          );

          if (bestTarget.hp < bestTarget.maxHp && distToTarget <= healRange) {
            e.healTargetId = bestTarget.id;
            e.state = "action";
            const healRate =
              bestTarget.kind === "boss"
                ? 18
                : 13 + Math.min(10, this.wave * 0.9);
            const prevHp = bestTarget.hp;
            bestTarget.hp = Math.min(
              bestTarget.maxHp,
              bestTarget.hp + healRate * dt,
            );
            const healed = bestTarget.hp - prevHp;

            e.healPulseTimer = (e.healPulseTimer ?? 0) + dt;
            if (e.healPulseTimer >= 0.55 && healed > 0) {
              e.healPulseTimer = 0;
              const healDisplay = Math.max(1, Math.round(healRate * 0.55));
              this.addFloatingText(
                bestTarget.x + (Math.random() - 0.5) * 14,
                bestTarget.y - bestTarget.radius - 12,
                `+${healDisplay}`,
                "#4ADE80",
              );
              this.spawnRing(
                bestTarget.x,
                bestTarget.y,
                bestTarget.radius + 14,
                "#4ADE80",
                0.28,
              );
              for (let k = 0; k < 4; k++) {
                const a = Math.random() * Math.PI * 2;
                this.spawnParticle(
                  bestTarget.x + Math.cos(a) * bestTarget.radius * 0.7,
                  bestTarget.y + Math.sin(a) * bestTarget.radius * 0.7,
                  Math.cos(a) * 45,
                  Math.sin(a) * 45 - 18,
                  0.26,
                  2.6,
                  0.3,
                  "#86EFAC",
                  "spark",
                  a,
                  { drag: 0.2, additive: true },
                );
              }
              if (this.repairSoundCooldown <= 0) {
                soundEngine.playRepairBeam();
                this.repairSoundCooldown = 0.65;
              }
            }
          } else {
            e.healTargetId = undefined;
            e.state = "chase";
          }
        } else {
          // No combat allies left: patrol cautiously at mid-range without attacking
          e.healTargetId = undefined;
          e.state = "chase";
          const preferredDist = 225;
          const radialSign =
            dist > preferredDist + 40 ? 1 : dist < preferredDist - 40 ? -1 : 0;
          const strafeAng = dirToPlayer + (Math.PI / 2) * e.weaveSign;
          const targetVx =
            Math.cos(dirToPlayer) * archetype.baseSpeed * 0.65 * radialSign +
            Math.cos(strafeAng) * 95;
          const targetVy =
            Math.sin(dirToPlayer) * archetype.baseSpeed * 0.65 * radialSign +
            Math.sin(strafeAng) * 95;
          e.vx += (targetVx - e.vx) * Math.min(1, dt * 4);
          e.vy += (targetVy - e.vy) * Math.min(1, dt * 4);
          e.angle = Math.atan2(e.vy, e.vx);
        }
      } else if (e.kind === "boss") {
        this.updateBoss(e, dt, dirToPlayer, dist);
      }

      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // Keep inside arena (or detonate Kamikaze Drone on high-speed wall crash)
      const hitWall =
        e.x < minX + e.radius ||
        e.x > maxX - e.radius ||
        e.y < minY + e.radius ||
        e.y > maxY - e.radius;

      if (e.kind === "kamikaze" && e.state === "action" && hitWall) {
        e.x = Math.max(minX + e.radius, Math.min(maxX - e.radius, e.x));
        e.y = Math.max(minY + e.radius, Math.min(maxY - e.radius, e.y));
        this.detonateKamikaze(e, false);
        this.enemies.splice(i, 1);
        continue;
      }

      if (e.x < minX + e.radius) {
        e.x = minX + e.radius;
        e.vx = Math.abs(e.vx);
      } else if (e.x > maxX - e.radius) {
        e.x = maxX - e.radius;
        e.vx = -Math.abs(e.vx);
      }
      if (e.y < minY + e.radius) {
        e.y = minY + e.radius;
        e.vy = Math.abs(e.vy);
      } else if (e.y > maxY - e.radius) {
        e.y = maxY - e.radius;
        e.vy = -Math.abs(e.vy);
      }

      // Player collision check
      const postDist = Math.hypot(p.x - e.x, p.y - e.y);
      if (postDist < e.radius + p.radius - 3) {
        if (e.kind === "kamikaze") {
          this.detonateKamikaze(e, true);
          this.enemies.splice(i, 1);
          continue;
        }
        if (e.kind === "repair_drone") {
          // Repair Drone never attacks the player; gently push aside on overlap
          const len = Math.max(1, postDist);
          const push = e.radius + p.radius - postDist;
          e.x -= ((p.x - e.x) / len) * push;
          e.y -= ((p.y - e.y) / len) * push;
          continue;
        }
        if (p.invulnTimer <= 0) {
          const len = Math.max(1, postDist);
          const collisionDamage =
            e.kind === "boss" ? 1.48 : e.kind === "juggernaut" ? 1.35 : 1.0;
          this.damagePlayer(
            "collision",
            (p.x - e.x) / len,
            (p.y - e.y) / len,
            collisionDamage,
          );
        }
      }
    }
  }

  private updateBoss(
    e: Enemy,
    dt: number,
    dirToPlayer: number,
    dist: number,
  ): void {
    const isEnraged = e.bossStage === 2;
    const isBossRush = this.difficulty === "boss_rush";
    const rushTempo = isBossRush
      ? 1 + Math.min(0.4, (this.wave - 1) * 0.055)
      : 1;
    const phaseOffset =
      isBossRush && this.wave % 5 === 0 ? (e.id % 2) * Math.PI : 0;
    const centerX = this.width * 0.5;
    const centerY = isEnraged ? this.height * 0.36 : this.height * 0.32;
    const moveTempo = (isEnraged ? 1.35 : 0.8) * rushTempo;

    if (e.state === "chase") {
      // Glide across upper arena; faster, wider sweep in Phase 2
      const targetX =
        centerX +
        Math.sin(this.runDuration * moveTempo + phaseOffset) *
          (isEnraged ? 235 : 180);
      const targetY =
        centerY +
        Math.cos(this.runDuration * (moveTempo * 0.75) + phaseOffset) *
          (isEnraged ? 95 : 70);
      const pullRate = (isEnraged ? 2.1 : 1.4) * rushTempo;
      e.vx += ((targetX - e.x) * pullRate - e.vx) * Math.min(1, dt * 3.0);
      e.vy += ((targetY - e.y) * pullRate - e.vy) * Math.min(1, dt * 3.0);
      e.angle = dirToPlayer;
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.state = "windup";
        e.bossPatternIdx = (e.bossPatternIdx + 1) % 3;
        e.stateTimer = (isEnraged ? 0.65 : 0.85) / rushTempo;
        e.aimAngle = dirToPlayer;
        soundEngine.playTelegraph();
      }
    } else if (e.state === "windup") {
      e.vx *= Math.pow(0.1, dt);
      e.vy *= Math.pow(0.1, dt);
      if (e.stateTimer > 0.22) {
        e.aimAngle = dirToPlayer;
      }
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        e.state = "action";
        e.stateTimer =
          e.bossPatternIdx === 0
            ? isEnraged
              ? 1.75
              : 1.4
            : isEnraged
              ? 0.9
              : 0.7;
        e.bossPhase = 0;
        e.bossSubShot = 0;
      }
    } else if (e.state === "action") {
      e.stateTimer -= dt;
      e.bossPhase += dt * rushTempo;

      if (!isEnraged) {
        // ========== PHASE 1 (HP >= 50%) ==========
        if (e.bossPatternIdx === 0) {
          // Single 4-arm rotating spiral
          if (e.bossPhase >= 0.14) {
            e.bossPhase = 0;
            const arms = 4;
            for (let a = 0; a < arms; a++) {
              const ang = e.spinAngle * 2.2 + (a * Math.PI * 2) / arms;
              this.spawnEnemyBullet(
                e.x,
                e.y,
                ang,
                235,
                6,
                "#FB7185",
                3.4,
                32,
                1.15,
              );
            }
          }
        } else if (e.bossPatternIdx === 1) {
          // 5-way aimed heavy volley
          if (e.bossPhase >= 0.3) {
            e.bossPhase = -99;
            for (let k = -2; k <= 2; k++) {
              this.spawnEnemyBullet(
                e.x,
                e.y,
                e.aimAngle + k * 0.18,
                380,
                7,
                "#F59E0B",
                2.8,
                34,
                1.3,
              );
            }
            e.squash = 1.25;
          }
        } else {
          // Single 12-way radial ring
          if (e.bossPhase >= 0.2) {
            e.bossPhase = -99;
            const count = 12;
            for (let k = 0; k < count; k++) {
              const ang = (k * Math.PI * 2) / count + e.spinAngle;
              this.spawnEnemyBullet(
                e.x,
                e.y,
                ang,
                260,
                6,
                "#FB7185",
                3.0,
                32,
                1.2,
              );
            }
            if (dist > 280) {
              e.vx = Math.cos(dirToPlayer) * 220;
              e.vy = Math.sin(dirToPlayer) * 220;
            }
          }
        }
      } else {
        // ========== PHASE 2: ENRAGED (HP < 50%) ==========
        if (e.bossPatternIdx === 0) {
          // Counter-rotating double spiral (5 amber CW + 5 coral CCW)
          if (e.bossPhase >= 0.13) {
            e.bossPhase = 0;
            e.bossSubShot += 1;
            const arms = 5;
            for (let a = 0; a < arms; a++) {
              const baseOffset = (a * Math.PI * 2) / arms;
              const cwAng = e.bossSubShot * 0.26 + baseOffset;
              const ccwAng = -e.bossSubShot * 0.26 + baseOffset;
              this.spawnEnemyBullet(
                e.x,
                e.y,
                cwAng,
                255,
                6,
                "#F59E0B",
                3.4,
                34,
                1.25,
              );
              this.spawnEnemyBullet(
                e.x,
                e.y,
                ccwAng,
                220,
                5.5,
                "#FB7185",
                3.6,
                34,
                1.2,
              );
            }
          }
        } else if (e.bossPatternIdx === 1) {
          // Twin staggered barrage: 7-way burst followed by interlocking 6-way burst
          if (e.bossSubShot === 0 && e.bossPhase >= 0.12) {
            e.bossSubShot = 1;
            for (let k = -3; k <= 3; k++) {
              this.spawnEnemyBullet(
                e.x,
                e.y,
                e.aimAngle + k * 0.15,
                420,
                7,
                "#F59E0B",
                2.8,
                36,
                1.35,
              );
            }
            e.squash = 1.28;
          } else if (e.bossSubShot === 1 && e.bossPhase >= 0.42) {
            e.bossSubShot = 2;
            for (let k = -2.5; k <= 2.5; k += 1) {
              this.spawnEnemyBullet(
                e.x,
                e.y,
                dirToPlayer + k * 0.15,
                365,
                6.5,
                "#C084FC",
                2.9,
                36,
                1.3,
              );
            }
            e.squash = 1.22;
          }
        } else {
          // Dual-speed concentric Nova Rings + rush
          if (e.bossSubShot === 0 && e.bossPhase >= 0.18) {
            e.bossSubShot = 1;
            const outerCount = 16;
            for (let k = 0; k < outerCount; k++) {
              const ang = (k * Math.PI * 2) / outerCount + e.spinAngle;
              this.spawnEnemyBullet(
                e.x,
                e.y,
                ang,
                310,
                6,
                "#FB7185",
                3.0,
                34,
                1.25,
              );
            }
            const innerCount = 10;
            for (let k = 0; k < innerCount; k++) {
              const ang = ((k + 0.5) * Math.PI * 2) / innerCount + e.spinAngle;
              this.spawnEnemyBullet(
                e.x,
                e.y,
                ang,
                205,
                7,
                "#F59E0B",
                3.5,
                34,
                1.3,
              );
            }
            if (dist > 240) {
              e.vx = Math.cos(dirToPlayer) * 290;
              e.vy = Math.sin(dirToPlayer) * 290;
            }
          }
        }
      }

      if (e.stateTimer <= 0) {
        e.state = "chase";
        e.stateTimer = (isEnraged ? 0.85 : 1.35) / rushTempo;
      }
    }
  }

  private spawnEnemyBullet(
    ox: number,
    oy: number,
    ang: number,
    speed: number,
    radius: number,
    color: string,
    life: number,
    muzzleOffset: number,
    damage: number = 1,
  ): void {
    const bx = ox + Math.cos(ang) * muzzleOffset;
    const by = oy + Math.sin(ang) * muzzleOffset;
    this.bullets.push({
      x: bx,
      y: by,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      radius,
      damage,
      isEnemy: true,
      life,
      bouncesLeft: 0,
      pierceLeft: 0,
      hitIds: new Set<number>(),
      color,
      trailX: ox,
      trailY: oy,
    });
  }

  private detonateBomber(e: Enemy): void {
    const blastRadius = 110;
    this.spawnRing(e.x, e.y, blastRadius, "#FB7185", 0.35);
    const dx = this.player.x - e.x;
    const dy = this.player.y - e.y;
    const dPlayer = Math.hypot(dx, dy);
    const dirX = dPlayer > 1 ? dx / dPlayer : 0;
    const dirY = dPlayer > 1 ? dy / dPlayer : 0;
    const proximityScale = dPlayer < 260 ? 1.15 : 0.85;
    this.triggerShakePreset("bomber_blast", dirX, dirY, proximityScale);
    soundEngine.playExplosion("medium");
    this.spawnEnemyExplosion(e, true);

    if (
      this.player.invulnTimer <= 0 &&
      dPlayer <= blastRadius + this.player.radius
    ) {
      const blastDamage = dPlayer < blastRadius * 0.55 ? 1.4 : 1.15;
      this.damagePlayer("blast", dirX, dirY, blastDamage);
    }
  }

  private detonateKamikaze(e: Enemy, directContact: boolean): void {
    const blastRadius = directContact ? 76 : 64;
    this.spawnRing(e.x, e.y, blastRadius, "#EF4444", 0.3);
    const dx = this.player.x - e.x;
    const dy = this.player.y - e.y;
    const dPlayer = Math.hypot(dx, dy);
    const dirX = dPlayer > 1 ? dx / dPlayer : 0;
    const dirY = dPlayer > 1 ? dy / dPlayer : 0;
    const proximityScale = directContact ? 1.1 : dPlayer < 240 ? 0.9 : 0.65;
    this.triggerShakePreset("bomber_blast", dirX, dirY, proximityScale);
    soundEngine.playExplosion("medium");
    this.spawnEnemyExplosion(e, true);

    if (
      this.player.invulnTimer <= 0 &&
      (directContact || dPlayer <= blastRadius + this.player.radius)
    ) {
      const blastDamage = directContact ? 1.35 : 1.1;
      this.damagePlayer("blast", dirX, dirY, blastDamage);
    }
  }

  private updateBullets(playerDt: number, worldDt: number): void {
    const minX = this.arenaMargin;
    const maxX = this.width - this.arenaMargin;
    const minY = this.arenaMargin;
    const maxY = this.height - this.arenaMargin;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const stepDt = b.isEnemy ? worldDt : playerDt;

      // Curving / Homing steering for guided enemy projectiles
      if (b.isEnemy && b.homingTurnRate && (b.homingTimeLeft ?? 0) > 0) {
        if ((b.homingDelay ?? 0) > 0) {
          b.homingDelay = Math.max(0, (b.homingDelay ?? 0) - stepDt);
        } else {
          const curAng = Math.atan2(b.vy, b.vx);
          const targetAng = Math.atan2(
            this.player.y - b.y,
            this.player.x - b.x,
          );
          let diff = targetAng - curAng;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const maxTurn = b.homingTurnRate * stepDt;
          const nextAng = curAng + Math.max(-maxTurn, Math.min(maxTurn, diff));
          const spd = b.homingSpeed ?? Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(nextAng) * spd;
          b.vy = Math.sin(nextAng) * spd;
          b.homingTimeLeft = Math.max(0, (b.homingTimeLeft ?? 0) - stepDt);
        }

        if (Math.random() < 0.45) {
          this.spawnParticle(
            b.x,
            b.y,
            (Math.random() - 0.5) * 28,
            (Math.random() - 0.5) * 28,
            0.16,
            2.4,
            0.3,
            "#2DD4BF",
            "spark",
            undefined,
            { drag: 0.15, additive: true },
          );
        }
      }

      b.trailX = b.x;
      b.trailY = b.y;
      b.x += b.vx * stepDt;
      b.y += b.vy * stepDt;
      b.life -= stepDt;

      if (b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Arena edge collision / ricochet
      let bounced = false;
      if (b.x < minX || b.x > maxX) {
        if (!b.isEnemy && b.bouncesLeft > 0) {
          b.vx *= -1;
          b.x = Math.max(minX, Math.min(maxX, b.x));
          b.bouncesLeft -= 1;
          bounced = true;
        } else {
          this.bullets.splice(i, 1);
          continue;
        }
      }
      if (b.y < minY || b.y > maxY) {
        if (!b.isEnemy && b.bouncesLeft > 0) {
          b.vy *= -1;
          b.y = Math.max(minY, Math.min(maxY, b.y));
          b.bouncesLeft -= 1;
          bounced = true;
        } else {
          this.bullets.splice(i, 1);
          continue;
        }
      }
      if (bounced) {
        this.spawnParticle(b.x, b.y, 0, 0, 0.14, 5, 0, "#38BDF8", "spark");
      }

      if (b.isEnemy) {
        if (this.player.invulnTimer <= 0) {
          const d = Math.hypot(b.x - this.player.x, b.y - this.player.y);
          if (d <= b.radius + this.player.radius - 2) {
            const bSpd = Math.hypot(b.vx, b.vy);
            const hitDirX = bSpd > 1 ? b.vx / bSpd : 0;
            const hitDirY = bSpd > 1 ? b.vy / bSpd : 0;
            this.bullets.splice(i, 1);
            this.damagePlayer("bullet", hitDirX, hitDirY, b.damage);
            continue;
          }
        }
      } else {
        // Electromagnetic Shield Dome interception (reflects/vaporizes outside player shots)
        let vaporizedByShield = false;
        for (const s of this.enemies) {
          if (s.kind !== "shielder" || s.spawnDelay > 0) continue;
          if (b.bypassShieldIds?.has(s.id)) continue;
          const dx = b.x - s.x;
          const dy = b.y - s.y;
          const distToShield = Math.hypot(dx, dy);
          if (distToShield <= EMP_DOME_RADIUS + b.radius) {
            const bSpd = Math.max(1, Math.hypot(b.vx, b.vy));
            const nx = distToShield > 1 ? dx / distToShield : -b.vx / bSpd;
            const ny = distToShield > 1 ? dy / distToShield : -b.vy / bSpd;
            const rimX = s.x + nx * EMP_DOME_RADIUS;
            const rimY = s.y + ny * EMP_DOME_RADIUS;

            for (let k = 0; k < 4; k++) {
              const ang = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.6;
              const spd = 75 + Math.random() * 145;
              this.spawnParticle(
                rimX,
                rimY,
                Math.cos(ang) * spd,
                Math.sin(ang) * spd,
                0.18,
                2.8,
                0.3,
                k % 2 === 0 ? "#60A5FA" : "#BAE6FD",
                "spark",
                ang,
                { drag: 0.12, additive: true },
              );
            }
            this.spawnParticle(
              rimX,
              rimY,
              0,
              0,
              0.12,
              8,
              1.5,
              "#60A5FA",
              "glow",
              0,
              {
                drag: 1,
                additive: true,
              },
            );

            if (this.shieldDeflectSoundCooldown <= 0) {
              soundEngine.playShieldDeflect();
              this.shieldDeflectSoundCooldown = 0.055;
            }

            if (!b.reflectedByShield) {
              const dot = b.vx * nx + b.vy * ny;
              if (dot < 0) {
                b.vx -= 2 * dot * nx;
                b.vy -= 2 * dot * ny;
              }
              b.x = s.x + nx * (EMP_DOME_RADIUS + b.radius + 2.5);
              b.y = s.y + ny * (EMP_DOME_RADIUS + b.radius + 2.5);
              b.trailX = rimX;
              b.trailY = rimY;
              b.reflectedByShield = true;
              b.color = "#93C5FD";
              b.life = Math.min(b.life, 0.32);
              b.pierceLeft = 0;
              b.bouncesLeft = 0;
            } else {
              this.bullets.splice(i, 1);
              vaporizedByShield = true;
            }
            break;
          }
        }
        if (vaporizedByShield) continue;

        // Check against enemies
        let consumed = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (e.spawnDelay > 0 || b.hitIds.has(e.id)) continue;
          const d = Math.hypot(b.x - e.x, b.y - e.y);
          if (d <= b.radius + e.radius) {
            b.hitIds.add(e.id);
            const hitAngle = Math.atan2(b.vy, b.vx);
            this.damageEnemy(e, b.damage, hitAngle, 85, b.source ?? "player");

            if (b.pierceLeft > 0) {
              b.pierceLeft -= 1;
            } else {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          this.bullets.splice(i, 1);
        }
      }
    }
  }

  private damageEnemy(
    e: Enemy,
    damage: number,
    hitAngle: number,
    knockback: number = 95,
    source: DamageSource = "player",
  ): void {
    e.hp -= damage;
    e.hitFlash = 0.08;
    e.squash = 1.2;
    const kbFactor =
      e.kind === "boss" ? 0.05 : e.kind === "juggernaut" ? 0.35 : 1;
    e.vx += Math.cos(hitAngle) * knockback * kbFactor;
    e.vy += Math.sin(hitAngle) * knockback * kbFactor;

    this.spawnDamageText(e, damage, hitAngle, source);

    for (let k = 0; k < 4; k++) {
      const a = hitAngle + (Math.random() - 0.5) * 1.4;
      const spd = 80 + Math.random() * 140;
      this.spawnParticle(
        e.x,
        e.y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        0.18 + Math.random() * 0.1,
        3.5,
        0,
        "#F59E0B",
        "spark",
      );
    }

    if (e.kind === "boss") {
      const hitWeight = Math.min(1.4, 0.75 + damage / 45);
      this.triggerShakePreset(
        "boss_hit",
        Math.cos(hitAngle),
        Math.sin(hitAngle),
        hitWeight,
      );

      // Trigger Phase 2 transition when Boss HP drops below threshold (earlier in late Boss Rush)
      const enrageThreshold =
        this.difficulty === "boss_rush"
          ? this.wave >= 5
            ? 0.65
            : this.wave >= 3
              ? 0.58
              : 0.5
          : 0.5;
      if (e.bossStage === 1 && e.hp > 0 && e.hp < e.maxHp * enrageThreshold) {
        e.bossStage = 2;
        e.state = "chase";
        e.stateTimer = 0.7;
        e.hitFlash = 0.22;
        e.squash = 1.4;
        this.hitstopTimer = 0.065;
        this.triggerShakePreset("boss_phase");
        soundEngine.playPulse();
        this.spawnRing(e.x, e.y, 185, "#F59E0B", 0.5);
        this.spawnRing(e.x, e.y, 125, "#FB7185", 0.38);
        this.spawnScreenShockwave(e.x, e.y, "boss_phase");
        this.addFloatingText(
          e.x,
          e.y - 54,
          "GIAI ĐOẠN 2 · CUỒNG NỘ!",
          "#F59E0B",
        );

        for (let k = 0; k < 24; k++) {
          const a = (k * Math.PI * 2) / 24;
          const spd = 120 + Math.random() * 140;
          this.spawnParticle(
            e.x,
            e.y,
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            0.4,
            5,
            0,
            k % 2 === 0 ? "#F59E0B" : "#FB7185",
            "spark",
          );
        }
        this.emitHudSnapshot();
      }
    }

    if (e.hp <= 0) {
      this.killEnemy(e);
    } else {
      soundEngine.playHit(e.kind === "boss" || e.kind === "juggernaut");
    }
  }

  private killEnemy(e: Enemy): void {
    const idx = this.enemies.indexOf(e);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }

    this.kills += 1;
    this.combo = Math.min(8, this.combo + 1);
    this.comboTimer = this.comboMaxTime;

    this.achievementState.totalKills += 1;
    if (e.kind === "boss") {
      this.achievementState.bossKills += 1;
    }
    this.achievementState.maxComboReached = Math.max(
      this.achievementState.maxComboReached,
      this.combo,
    );
    this.evaluateAndEmitAchievements();

    const dailyScoreMult =
      this.difficulty === "daily" && this.activeDailyChallenge
        ? this.activeDailyChallenge.scoreMultiplier
        : 1;
    const points = Math.round(
      ENEMY_ARCHETYPES[e.kind].score * this.combo * dailyScoreMult,
    );
    this.score += points;
    if (this.difficulty !== "daily" && this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      } catch {
        // ignore
      }
    }

    // Hitstop & Camera shake scaled by enemy classification
    if (e.kind === "boss") {
      this.hitstopTimer = 0.075;
      this.triggerShakePreset("kill_boss");
      this.spawnScreenShockwave(e.x, e.y, "boss_kill");
      soundEngine.playExplosion("boss");
    } else if (e.kind === "juggernaut") {
      this.hitstopTimer = 0.045;
      this.triggerShakePreset("kill_heavy");
      soundEngine.playExplosion("medium");

      // Split into 2 mini shards from Wave 3+
      if (this.wave >= 3) {
        for (let s = -1; s <= 1; s += 2) {
          this.spawnEnemy("shard", e.x + s * 16, e.y);
        }
      }
    } else if (
      e.kind === "bomber" ||
      e.kind === "sniper" ||
      e.kind === "seeker" ||
      e.kind === "shielder"
    ) {
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.032);
      this.triggerShakePreset("kill_medium");
      soundEngine.playExplosion("small");
    } else if (e.kind === "shard") {
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.014);
      this.triggerShakePreset("kill_tiny");
      soundEngine.playExplosion("small");
    } else {
      this.hitstopTimer = Math.max(this.hitstopTimer, 0.024);
      this.triggerShakePreset("kill_light");
      soundEngine.playExplosion("small");
    }

    // Multi-layered explosion flash, shockwaves, sparks & hull debris shards
    this.spawnEnemyExplosion(e);

    this.spawnScoreBonusText(e, points);

    // Drop Star-Cores & occasional utility pickups (scarce in Boss Rush)
    const isBossRush = this.difficulty === "boss_rush";
    const coreDrops =
      e.kind === "boss"
        ? isBossRush
          ? 3
          : 8
        : e.kind === "juggernaut"
          ? 3
          : 1;
    for (let c = 0; c < coreDrops; c++) {
      const a = Math.random() * Math.PI * 2;
      this.pickups.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * (40 + Math.random() * 70),
        vy: Math.sin(a) * (40 + Math.random() * 70),
        kind: "core",
        life: 12,
        value: 25,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }

    if (isBossRush && e.kind === "boss") {
      const dropRepair =
        this.player.hp < this.player.maxHp &&
        this.wave % 2 === 0 &&
        Math.random() < 0.28;
      const dropOverdrive = !dropRepair && Math.random() < 0.3;
      if (dropRepair || dropOverdrive) {
        this.pickups.push({
          x: e.x,
          y: e.y,
          vx: (Math.random() - 0.5) * 50,
          vy: (Math.random() - 0.5) * 50,
          kind: dropRepair ? "repair" : "overdrive",
          life: 14,
          value: 1,
          bobPhase: 0,
        });
      }
    } else if (e.kind === "boss" || Math.random() < 0.085) {
      const dropKind =
        this.player.hp < this.player.maxHp && Math.random() < 0.65
          ? "repair"
          : "overdrive";
      this.pickups.push({
        x: e.x,
        y: e.y,
        vx: (Math.random() - 0.5) * 50,
        vy: (Math.random() - 0.5) * 50,
        kind: dropKind,
        life: 14,
        value: 1,
        bobPhase: 0,
      });
    }
  }

  private calculateDamageShakeIntensity(
    incomingDamage: number,
    hullDamaged: boolean,
    impactKind: "bullet" | "collision" | "blast",
  ): number {
    const clampedDmg = Math.max(0.5, Math.min(4, incomingDamage));
    const impactFactor =
      impactKind === "blast" ? 1.16 : impactKind === "collision" ? 1.1 : 1.0;
    const layerFactor = hullDamaged ? 1.24 : 0.78;
    const rawIntensity =
      (0.16 + clampedDmg * 0.14) * impactFactor * layerFactor;
    return Math.max(0.16, Math.min(0.65, rawIntensity));
  }

  private evaluateAndEmitAchievements(): void {
    const { nextState, newlyUnlocked } = evaluateAchievements(
      this.achievementState,
    );
    this.achievementState = nextState;
    for (const unlocked of newlyUnlocked) {
      soundEngine.playAchievement();
      this.callbacks.onAchievementUnlocked?.(unlocked);
    }
  }

  private damagePlayer(
    impactKind: "bullet" | "collision" | "blast" = "bullet",
    dirX: number = 0,
    dirY: number = 0,
    incomingDamage: number = 1,
  ): void {
    const p = this.player;
    p.invulnTimer = 1.05;
    p.hitFlash = 0.14;
    p.shieldRegenTimer = 0;
    this.tookDamageThisWave = true;
    this.noDamageWaveStreak = 0;

    const appliedDamage = Math.max(1, Math.round(incomingDamage));
    const shieldAbsorbed = Math.min(p.shield, appliedDamage);
    const hullDamage = appliedDamage - shieldAbsorbed;

    p.shield -= shieldAbsorbed;
    if (hullDamage > 0) {
      p.hp = Math.max(0, p.hp - hullDamage);
      this.combo = 1;
      this.comboTimer = 0;
    }

    const shakeIntensity = this.calculateDamageShakeIntensity(
      incomingDamage,
      hullDamage > 0,
      impactKind,
    );
    this.triggerScreenshake(shakeIntensity, dirX, dirY);

    if (hullDamage === 0) {
      soundEngine.playPlayerDamage(true);
      this.hitstopTimer = 0.04;
      this.spawnRing(p.x, p.y, 75, "#38BDF8", 0.35);
      this.addFloatingText(p.x, p.y - 26, "VỠ KHIÊN!", "#38BDF8");
    } else {
      soundEngine.playPlayerDamage(false);
      this.hitstopTimer = 0.06;
      this.spawnRing(p.x, p.y, 90, "#FB7185", 0.4);
      this.addFloatingText(p.x, p.y - 26, `-${hullDamage} GIÁP!`, "#FB7185");
    }

    for (let k = 0; k < 14; k++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 160;
      this.spawnParticle(
        p.x,
        p.y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        0.3,
        4.5,
        0,
        hullDamage === 0 ? "#38BDF8" : "#FB7185",
        "spark",
      );
    }

    this.emitHudSnapshot();

    if (p.hp <= 0) {
      this.triggerGameOver();
    }
  }

  private triggerGameOver(): void {
    this.gameState = "GAME_OVER";
    this.clearInputs();
    this.triggerShakePreset("game_over");
    soundEngine.playExplosion("boss");

    this.commitCurrentRunToLeaderboard();

    const modeBestScore =
      this.difficulty === "daily" && this.activeDailyChallenge
        ? Math.max(
            getDailyBestScore(this.activeDailyChallenge.dateKey),
            this.score,
          )
        : this.highScore;
    const isNewRecord = this.score > 0 && this.score > this.runStartHighScore;

    this.emitHudSnapshot();
    this.callbacks.onGameOver({
      mode: this.difficulty,
      score: this.score,
      highScore: modeBestScore,
      isNewRecord,
      wave: this.wave,
      kills: this.kills,
      coresCollected: this.coresCollected,
      durationSeconds: Math.round(this.runDuration),
      dailyCodeName: this.activeDailyChallenge?.codeName,
      dailyDateKey: this.activeDailyChallenge?.dateKey,
    });
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    const magnetLevel = this.upgrades.core_magnet ?? 0;
    const magnetRadius = 110 + magnetLevel * 75;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt;
      pk.bobPhase += dt * 4.5;
      if (pk.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }

      pk.vx *= Math.pow(0.08, dt);
      pk.vy *= Math.pow(0.08, dt);

      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const dist = Math.hypot(dx, dy);

      if (dist < magnetRadius) {
        const pull = 540 * (1 - dist / magnetRadius) + 180;
        pk.vx += (dx / Math.max(1, dist)) * pull * dt * 6;
        pk.vy += (dy / Math.max(1, dist)) * pull * dt * 6;
      }

      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;

      if (dist <= p.radius + 14) {
        if (pk.kind === "core") {
          this.coresCollected += 1;
          this.achievementState.totalCores += 1;
          this.evaluateAndEmitAchievements();
          this.score += pk.value * this.combo;
          if (this.score > this.highScore) {
            this.highScore = this.score;
            try {
              localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
            } catch {
              // ignore
            }
          }
          const empGain = 9 + magnetLevel * 2.5;
          p.empCharge = Math.min(100, p.empCharge + empGain);
          this.comboTimer = Math.min(this.comboMaxTime, this.comboTimer + 0.8);
          soundEngine.playPickup(this.combo);
        } else if (pk.kind === "repair") {
          if (p.hp < p.maxHp) {
            p.hp += 1;
            this.addFloatingText(p.x, p.y - 24, "+1 GIÁP", "#34D399");
          } else {
            p.shield = p.maxShield;
            this.addFloatingText(p.x, p.y - 24, "ĐẦY KHIÊN", "#38BDF8");
          }
          soundEngine.playPickup(4);
        } else if (pk.kind === "overdrive") {
          p.overdriveTimer = 5.5;
          this.addFloatingText(p.x, p.y - 24, "QUÁ TẢI HỎA LỰC!", "#F59E0B");
          soundEngine.playPickup(6);
        }
        this.pickups.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) {
        pt.active = false;
        continue;
      }
      pt.prevX = pt.x;
      pt.prevY = pt.y;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const damping = Math.pow(pt.drag, dt);
      pt.vx *= damping;
      pt.vy *= damping;
      pt.rotation += pt.vRot * dt;
    }
  }

  private updateFloatingTexts(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ft.vy += ft.gravity * dt;
      ft.vx *= Math.pow(0.08, dt);
      ft.x += ft.vx * dt;
      ft.y += ft.vy * dt;
      ft.scale += (1 - ft.scale) * Math.min(1, dt * 16);
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    maxLife: number,
    size: number,
    endSize: number,
    color: string,
    kind: Particle["kind"],
    fixedRotation?: number,
    options?: {
      drag?: number;
      sides?: number;
      aspect?: number;
      strokeColor?: string;
      additive?: boolean;
      vRot?: number;
    },
  ): void {
    for (const pt of this.particles) {
      if (!pt.active) {
        pt.active = true;
        pt.x = x;
        pt.y = y;
        pt.prevX = x;
        pt.prevY = y;
        pt.vx = vx;
        pt.vy = vy;
        pt.life = maxLife;
        pt.maxLife = maxLife;
        pt.size = size;
        pt.endSize = endSize;
        pt.color = color;
        pt.strokeColor = options?.strokeColor;
        pt.kind = kind;
        pt.rotation = fixedRotation ?? Math.random() * Math.PI * 2;
        pt.vRot =
          options?.vRot ??
          (fixedRotation !== undefined ? 0 : (Math.random() - 0.5) * 9);
        pt.drag = options?.drag ?? 0.25;
        pt.sides = options?.sides ?? 4;
        pt.aspect = options?.aspect ?? 1;
        pt.additive =
          options?.additive ??
          (kind === "flash" || kind === "glow" || kind === "ember");
        return;
      }
    }
  }

  private spawnRing(
    x: number,
    y: number,
    endRadius: number,
    color: string,
    duration: number,
  ): void {
    this.spawnParticle(x, y, 0, 0, duration, 10, endRadius, color, "ring");
  }

  private spawnScreenShockwave(
    x: number,
    y: number,
    preset: ShockwavePreset,
  ): void {
    const diag = Math.hypot(this.width, this.height);
    if (this.shockwaves.length >= 8) {
      this.shockwaves.shift();
    }

    if (preset === "boss_kill") {
      this.shockwaves.push({
        x,
        y,
        startRadius: 24,
        maxRadius: diag * 0.94,
        bandWidth: 110,
        life: 0.84,
        maxLife: 0.84,
        primaryRgb: "245, 158, 11",
        secondaryRgb: "251, 113, 133",
        coreRgb: "254, 243, 199",
        intensity: 1.0,
        chromaticShift: true,
        flashAlpha: 0.22,
        radialRays: 20,
        seed: Math.random() * Math.PI * 2,
      });
      this.shockwaves.push({
        x,
        y,
        startRadius: 12,
        maxRadius: diag * 0.7,
        bandWidth: 74,
        life: 0.62,
        maxLife: 0.62,
        primaryRgb: "251, 113, 133",
        secondaryRgb: "56, 189, 248",
        coreRgb: "255, 255, 255",
        intensity: 0.82,
        chromaticShift: true,
        flashAlpha: 0,
        radialRays: 0,
        seed: Math.random() * Math.PI * 2,
      });
    } else if (preset === "boss_phase") {
      this.shockwaves.push({
        x,
        y,
        startRadius: 22,
        maxRadius: Math.max(this.width, this.height) * 0.56,
        bandWidth: 74,
        life: 0.56,
        maxLife: 0.56,
        primaryRgb: "245, 158, 11",
        secondaryRgb: "251, 113, 133",
        coreRgb: "254, 240, 138",
        intensity: 0.86,
        chromaticShift: true,
        flashAlpha: 0.1,
        radialRays: 12,
        seed: Math.random() * Math.PI * 2,
      });
    } else if (preset === "emp") {
      this.shockwaves.push({
        x,
        y,
        startRadius: 16,
        maxRadius: diag * 0.78,
        bandWidth: 86,
        life: 0.64,
        maxLife: 0.64,
        primaryRgb: "245, 158, 11",
        secondaryRgb: "56, 189, 248",
        coreRgb: "254, 249, 195",
        intensity: 0.95,
        chromaticShift: true,
        flashAlpha: 0.13,
        radialRays: 16,
        seed: Math.random() * Math.PI * 2,
      });
    } else if (preset === "time_dilation") {
      this.shockwaves.push({
        x,
        y,
        startRadius: 14,
        maxRadius: diag * 0.84,
        bandWidth: 90,
        life: 0.68,
        maxLife: 0.68,
        primaryRgb: "129, 140, 248",
        secondaryRgb: "56, 189, 248",
        coreRgb: "224, 231, 255",
        intensity: 0.9,
        chromaticShift: true,
        flashAlpha: 0.11,
        radialRays: 0,
        seed: Math.random() * Math.PI * 2,
      });
    } else if (preset === "dash_blast") {
      const blastLvl = this.upgrades.phase_dash_blast ?? 1;
      this.shockwaves.push({
        x,
        y,
        startRadius: 14,
        maxRadius: 300 + blastLvl * 45,
        bandWidth: 56,
        life: 0.42,
        maxLife: 0.42,
        primaryRgb: "56, 189, 248",
        secondaryRgb: "129, 140, 248",
        coreRgb: "224, 242, 254",
        intensity: 0.82,
        chromaticShift: true,
        flashAlpha: 0.06,
        radialRays: 8,
        seed: Math.random() * Math.PI * 2,
      });
    } else {
      this.shockwaves.push({
        x,
        y,
        startRadius: 10,
        maxRadius: 148,
        bandWidth: 32,
        life: 0.28,
        maxLife: 0.28,
        primaryRgb: "56, 189, 248",
        secondaryRgb: "14, 165, 233",
        coreRgb: "224, 242, 254",
        intensity: 0.56,
        chromaticShift: false,
        flashAlpha: 0,
        radialRays: 0,
        seed: 0,
      });
    }
  }

  private updateShockwaves(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  private spawnEnemyExplosion(e: Enemy, isDetonation: boolean = false): void {
    const isBoss = e.kind === "boss";
    const isJuggernaut = e.kind === "juggernaut";
    const isMedium =
      isJuggernaut ||
      e.kind === "bomber" ||
      e.kind === "sniper" ||
      e.kind === "shielder";
    const accent = ENEMY_ARCHETYPES[e.kind].accentColor;
    const scaleFactor = this.reducedMotion ? 0.5 : 1;

    // 1. Core flash & glowing heat bloom
    const flashRadius = isBoss ? 58 : isJuggernaut ? 32 : isMedium ? 24 : 18;
    this.spawnParticle(
      e.x,
      e.y,
      0,
      0,
      isBoss ? 0.22 : 0.14,
      flashRadius * 0.45,
      flashRadius * 1.35,
      "#FFFFFF",
      "flash",
      0,
      { drag: 1, additive: true },
    );
    this.spawnParticle(
      e.x,
      e.y,
      0,
      0,
      isBoss ? 0.42 : 0.24,
      flashRadius * 0.65,
      flashRadius * 2.1,
      isBoss ? "#F59E0B" : accent,
      "glow",
      0,
      { drag: 1, additive: true },
    );

    // 2. Shockwave rings
    if (!isDetonation) {
      if (isBoss) {
        this.spawnRing(e.x, e.y, 210, "#F59E0B", 0.55);
        this.spawnRing(e.x, e.y, 140, "#FB7185", 0.38);
      } else if (isJuggernaut) {
        this.spawnRing(e.x, e.y, 88, "#FB7185", 0.36);
        this.spawnRing(e.x, e.y, 52, "#F59E0B", 0.25);
      } else {
        this.spawnRing(e.x, e.y, Math.max(38, e.radius * 2.8), accent, 0.26);
      }
    }

    // 3. Faceted metallic hull debris shards with glowing edges
    const shardCount = Math.round(
      (isBoss ? 22 : isJuggernaut ? 12 : isMedium ? 8 : 6) * scaleFactor,
    );
    for (let k = 0; k < shardCount; k++) {
      const a =
        (k * Math.PI * 2) / Math.max(1, shardCount) +
        (Math.random() - 0.5) * 0.45;
      const spd = (isBoss ? 120 : 85) + Math.random() * (isBoss ? 260 : 175);
      const shardSize =
        (isBoss ? 6.5 : isJuggernaut ? 5 : 3.6) + Math.random() * 2.6;
      const hullFill =
        k % 3 === 0 ? "#334155" : k % 3 === 1 ? "#1E293B" : "#475569";
      this.spawnParticle(
        e.x + Math.cos(a) * (e.radius * 0.35),
        e.y + Math.sin(a) * (e.radius * 0.35),
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        (isBoss ? 0.55 : 0.38) + Math.random() * 0.28,
        shardSize,
        shardSize * 0.25,
        hullFill,
        "shard",
        undefined,
        {
          drag: 0.42,
          sides: 3 + (k % 3),
          aspect: 0.55 + Math.random() * 0.75,
          strokeColor: k % 2 === 0 ? accent : "#F59E0B",
          vRot: (Math.random() - 0.5) * 16,
          additive: false,
        },
      );
    }

    // 4. Incandescent velocity-aligned sparks
    const sparkCount = Math.round(
      (isBoss ? 34 : isJuggernaut ? 18 : isMedium ? 13 : 10) * scaleFactor,
    );
    for (let k = 0; k < sparkCount; k++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (isBoss ? 190 : 140) + Math.random() * (isBoss ? 380 : 250);
      const sparkColor =
        k % 4 === 0
          ? "#FEF08A"
          : k % 4 === 1
            ? "#F59E0B"
            : k % 4 === 2
              ? accent
              : "#FFFFFF";
      this.spawnParticle(
        e.x,
        e.y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        0.22 + Math.random() * (isBoss ? 0.32 : 0.22),
        isBoss ? 3.2 : 2.3,
        0.4,
        sparkColor,
        "spark",
        a,
        {
          drag: 0.06,
          additive: true,
        },
      );
    }

    // 5. Lingering warm embers
    const emberCount = Math.round(
      (isBoss ? 18 : isJuggernaut ? 9 : 5) * scaleFactor,
    );
    for (let k = 0; k < emberCount; k++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * (isBoss ? 160 : 95);
      this.spawnParticle(
        e.x + (Math.random() - 0.5) * e.radius * 0.6,
        e.y + (Math.random() - 0.5) * e.radius * 0.6,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        0.42 + Math.random() * 0.36,
        isBoss ? 5.2 : 3.4,
        0.2,
        k % 2 === 0 ? "#FB923C" : accent,
        "ember",
        0,
        { drag: 0.16, additive: true },
      );
    }

    // 6. Boss secondary chain-detonation sub-bursts
    if (isBoss && !this.reducedMotion) {
      for (let b = 0; b < 4; b++) {
        const ang = (b * Math.PI) / 2 + Math.random() * 0.6;
        const ox = e.x + Math.cos(ang) * (e.radius * 0.58);
        const oy = e.y + Math.sin(ang) * (e.radius * 0.58);
        this.spawnParticle(ox, oy, 0, 0, 0.18, 12, 34, "#FEF08A", "flash", 0, {
          drag: 1,
          additive: true,
        });
        this.spawnRing(ox, oy, 64, b % 2 === 0 ? "#F59E0B" : "#FB7185", 0.3);
      }
    }
  }

  private pushFloatingText(entry: FloatingText): void {
    if (this.floatingTexts.length >= MAX_FLOATING_TEXTS) {
      const damageIdx = this.floatingTexts.findIndex(
        (ft) => ft.kind === "damage",
      );
      if (damageIdx !== -1) {
        this.floatingTexts.splice(damageIdx, 1);
      } else {
        this.floatingTexts.shift();
      }
    }
    this.floatingTexts.push(entry);
  }

  private addFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
  ): void {
    this.pushFloatingText({
      x,
      y,
      vx: 0,
      vy: -38,
      gravity: 0,
      text,
      color,
      fontSize: 13,
      scale: this.reducedMotion ? 1 : 1.24,
      life: 0.95,
      maxLife: 0.95,
      kind: "callout",
    });
  }

  private spawnDamageText(
    e: Enemy,
    damage: number,
    hitAngle: number,
    source: DamageSource,
  ): void {
    const rounded = Math.max(1, Math.round(damage));

    let color = "#F8FAFC";
    let fontSize = 12;
    let popScale = 1.22;

    if (source === "emp") {
      color = "#FDE047";
      fontSize = 15;
      popScale = 1.42;
    } else if (source === "ability") {
      color = "#38BDF8";
      fontSize = 14;
      popScale = 1.34;
    } else if (source === "overdrive" || damage >= 26) {
      color = "#FBBF24";
      fontSize = 13;
      popScale = 1.28;
    } else if (source === "drone") {
      color = "#6EE7B7";
      fontSize = 11;
      popScale = 1.15;
    }

    // Coalesce rapid consecutive hits of the same style on the same enemy for readability
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      if (
        ft.kind === "damage" &&
        ft.enemyId === e.id &&
        ft.color === color &&
        ft.maxLife - ft.life <= 0.085
      ) {
        const nextTotal = (ft.numericValue ?? 0) + rounded;
        ft.numericValue = nextTotal;
        ft.text = String(nextTotal);
        ft.life = Math.min(ft.maxLife, ft.life + 0.06);
        ft.scale = this.reducedMotion ? 1 : Math.min(1.48, ft.scale + 0.14);
        ft.vy = Math.min(ft.vy, -58);
        return;
      }
    }

    const spreadSide = (Math.random() - 0.5) * 2;
    const vx = this.reducedMotion
      ? 0
      : Math.cos(hitAngle) * 26 + spreadSide * 28;
    const vy = this.reducedMotion ? -34 : -72 - Math.random() * 18;

    this.pushFloatingText({
      x: e.x + (Math.random() - 0.5) * Math.min(18, e.radius * 0.9),
      y: e.y - e.radius * 0.55 - Math.random() * 6,
      vx,
      vy,
      gravity: this.reducedMotion ? 0 : 140,
      text: String(rounded),
      color,
      fontSize,
      scale: this.reducedMotion ? 1 : popScale,
      life: 0.62,
      maxLife: 0.62,
      kind: "damage",
      enemyId: e.id,
      numericValue: rounded,
    });
  }

  private spawnScoreBonusText(e: Enemy, points: number): void {
    const isBoss = e.kind === "boss";
    const isJuggernaut = e.kind === "juggernaut";

    let subtext: string | undefined;
    let subColor = "#38BDF8";

    if (isBoss) {
      subtext = this.combo > 1 ? `DIỆT BOSS · x${this.combo}` : "DIỆT BOSS!";
      subColor = "#FB7185";
    } else if (isJuggernaut) {
      subtext = this.combo > 1 ? `HẠ HẠM · x${this.combo}` : "HẠ HẠM!";
      subColor = "#38BDF8";
    } else if (this.combo > 1) {
      subtext = `x${this.combo} COMBO`;
      subColor = this.combo >= 5 ? "#38BDF8" : "#A5B4FC";
    }

    const fontSize = isBoss
      ? 22
      : isJuggernaut
        ? 17
        : this.combo >= 4
          ? 15
          : 14;
    const maxLife = isBoss ? 1.45 : isJuggernaut ? 1.15 : 0.95;

    this.pushFloatingText({
      x: e.x,
      y: e.y - Math.max(18, e.radius + 6),
      vx: 0,
      vy: isBoss ? -44 : -52,
      gravity: this.reducedMotion ? 0 : 20,
      text: `+${points.toLocaleString("vi-VN")}`,
      subtext,
      color: isBoss || isJuggernaut ? "#FDE047" : "#FBBF24",
      subColor,
      fontSize,
      scale: this.reducedMotion ? 1 : isBoss ? 1.52 : 1.34,
      life: maxLife,
      maxLife,
      kind: "score",
    });
  }

  private triggerShakePreset(
    preset: ShakePreset,
    dirX: number = 0,
    dirY: number = 0,
    scale: number = 1,
  ): void {
    const profiles: Record<
      ShakePreset,
      {
        amplitude: number;
        duration: number;
        frequency: number;
        rotScale: number;
        kick: number;
      }
    > = {
      kill_tiny: {
        amplitude: 4.5,
        duration: 0.12,
        frequency: 48,
        rotScale: 0.001,
        kick: 1.5,
      },
      kill_light: {
        amplitude: 7.5,
        duration: 0.17,
        frequency: 40,
        rotScale: 0.003,
        kick: 2.5,
      },
      kill_medium: {
        amplitude: 12.5,
        duration: 0.26,
        frequency: 30,
        rotScale: 0.006,
        kick: 4.5,
      },
      kill_heavy: {
        amplitude: 19,
        duration: 0.42,
        frequency: 21,
        rotScale: 0.012,
        kick: 6.5,
      },
      kill_boss: {
        amplitude: 30,
        duration: 0.92,
        frequency: 15,
        rotScale: 0.024,
        kick: 9,
      },
      boss_hit: {
        amplitude: 6.5,
        duration: 0.13,
        frequency: 44,
        rotScale: 0.002,
        kick: 4.5,
      },
      boss_phase: {
        amplitude: 22,
        duration: 0.56,
        frequency: 19,
        rotScale: 0.015,
        kick: 7,
      },
      bomber_blast: {
        amplitude: 17,
        duration: 0.34,
        frequency: 25,
        rotScale: 0.01,
        kick: 7,
      },
      emp_pulse: {
        amplitude: 16,
        duration: 0.36,
        frequency: 24,
        rotScale: 0.009,
        kick: 5,
      },
      dash_blast: {
        amplitude: 9.5,
        duration: 0.2,
        frequency: 34,
        rotScale: 0.004,
        kick: 5.5,
      },
      player_shield_hit: {
        amplitude: 13.5,
        duration: 0.28,
        frequency: 35,
        rotScale: 0.008,
        kick: 8,
      },
      player_hull_hit: {
        amplitude: 21,
        duration: 0.44,
        frequency: 25,
        rotScale: 0.015,
        kick: 12,
      },
      game_over: {
        amplitude: 28,
        duration: 0.85,
        frequency: 16,
        rotScale: 0.022,
        kick: 8,
      },
    };

    const cfg = profiles[preset];
    const mult = Math.max(0.2, Math.min(2, scale));

    if (this.shakeImpulses.length >= 10) {
      this.shakeImpulses.shift();
    }

    this.shakeImpulses.push({
      amplitude: cfg.amplitude * mult,
      frequency: cfg.frequency,
      rotScale: cfg.rotScale * mult,
      life: cfg.duration,
      maxLife: cfg.duration,
      elapsed: 0,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      dirX,
      dirY,
      kick: cfg.kick * mult,
    });

    if (dirX !== 0 || dirY !== 0) {
      const kickMag = Math.min(14, cfg.kick * mult);
      this.shakeKickX = Math.max(
        -16,
        Math.min(16, this.shakeKickX + dirX * kickMag),
      );
      this.shakeKickY = Math.max(
        -16,
        Math.min(16, this.shakeKickY + dirY * kickMag),
      );
    }
  }

  public triggerScreenshake(
    intensity: number,
    dirX: number = 0,
    dirY: number = 0,
  ): void {
    const clamped = Math.max(0, Math.min(1.5, intensity));
    if (clamped <= 0) return;
    if (this.shakeImpulses.length >= 10) {
      this.shakeImpulses.shift();
    }
    const duration = 0.14 + clamped * 0.42;
    this.shakeImpulses.push({
      amplitude: clamped * 22,
      frequency: 36 - clamped * 14,
      rotScale: clamped * 0.015,
      life: duration,
      maxLife: duration,
      elapsed: 0,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      dirX,
      dirY,
      kick: clamped * 10,
    });
    if (dirX !== 0 || dirY !== 0) {
      const kickMag = Math.min(12, clamped * 16);
      this.shakeKickX = Math.max(
        -16,
        Math.min(16, this.shakeKickX + dirX * kickMag),
      );
      this.shakeKickY = Math.max(
        -16,
        Math.min(16, this.shakeKickY + dirY * kickMag),
      );
    }
  }

  private decayScreenshake(dt: number): void {
    for (let i = this.shakeImpulses.length - 1; i >= 0; i--) {
      const imp = this.shakeImpulses[i];
      imp.life -= dt;
      imp.elapsed += dt;
      if (imp.life <= 0) {
        this.shakeImpulses.splice(i, 1);
      }
    }
    const kickDecay = Math.pow(0.001, dt);
    this.shakeKickX *= kickDecay;
    this.shakeKickY *= kickDecay;
  }

  private emitHudSnapshot(): void {
    const bosses = this.enemies.filter((e) => e.kind === "boss");
    const bossHpSum = bosses.reduce((sum, b) => sum + Math.max(0, b.hp), 0);
    const bossMaxHpSum = bosses.reduce((sum, b) => sum + b.maxHp, 0);
    const anyEnraged = bosses.some((b) => b.bossStage === 2);
    const bossPhase = this.isBossPhaseActive();
    const needsShield = this.player.shield < this.player.maxShield;
    const shieldRechargeProgress =
      needsShield && !bossPhase && this.player.shieldRegenDelay > 0
        ? Math.max(
            0,
            Math.min(
              1,
              this.player.shieldRegenTimer / this.player.shieldRegenDelay,
            ),
          )
        : 0;
    const shieldRechargeRemaining =
      needsShield && !bossPhase
        ? Math.max(
            0,
            this.player.shieldRegenDelay - this.player.shieldRegenTimer,
          )
        : 0;
    const isBossRush = this.difficulty === "boss_rush";
    const isDaily =
      this.difficulty === "daily" && this.activeDailyChallenge !== null;
    const dailyMaxUpgrades = isDaily ? this.dailyMods.maxUpgrades : null;
    const dailyUpgradesLeft =
      dailyMaxUpgrades !== null
        ? Math.max(0, dailyMaxUpgrades - this.dailyUpgradesUsed)
        : null;

    this.callbacks.onHudUpdate({
      mode: this.difficulty,
      shipId: this.selectedShipId,
      bossRushUpgradesLeft: isBossRush
        ? Math.max(0, BOSS_RUSH_MAX_UPGRADES - this.bossRushUpgradesUsed)
        : 0,
      dailyDateKey: this.activeDailyChallenge?.dateKey,
      dailyCodeName: this.activeDailyChallenge?.codeName,
      dailyScoreMultiplier: this.activeDailyChallenge?.scoreMultiplier,
      dailyMaxUpgrades,
      dailyUpgradesLeft,
      dailyShieldRegenDisabled: this.dailyMods.disableShieldRegen,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      shield: this.player.shield,
      maxShield: this.player.maxShield,
      shieldRechargeProgress,
      shieldRechargeRemaining,
      shieldRechargeBlockedByBoss:
        needsShield && (bossPhase || this.dailyMods.disableShieldRegen),
      empCharge: Math.floor(this.player.empCharge),
      dashActive: this.player.dashTimer > 0 || this.player.dashInvulnTimer > 0,
      dashInvulnRemaining: this.player.dashInvulnTimer,
      dashCooldownRatio:
        this.player.dashCooldownMax > 0
          ? 1 -
            Math.min(1, this.player.dashCooldown / this.player.dashCooldownMax)
          : 1,
      dashCooldownSeconds: this.player.dashCooldown,
      timeDilationActive: this.player.timeDilationTimer > 0,
      timeDilationRemaining: this.player.timeDilationTimer,
      timeDilationCooldownRatio:
        this.player.timeDilationCooldownMax > 0
          ? 1 -
            Math.min(
              1,
              this.player.timeDilationCooldown /
                this.player.timeDilationCooldownMax,
            )
          : 1,
      timeDilationCooldownSeconds: this.player.timeDilationCooldown,
      score: this.score,
      highScore:
        isDaily && this.activeDailyChallenge
          ? Math.max(
              getDailyBestScore(this.activeDailyChallenge.dateKey),
              this.score,
            )
          : this.highScore,
      wave: this.wave,
      enemiesRemaining: this.enemies.length + this.waveSpawnQueue.length,
      combo: this.combo,
      comboTimerRatio:
        this.combo > 1 ? Math.max(0, this.comboTimer / this.comboMaxTime) : 0,
      kills: this.kills,
      coresCollected: this.coresCollected,
      overdriveTimer: this.player.overdriveTimer,
      bossActive: bosses.length > 0,
      bossName: isBossRush
        ? bosses.length > 1
          ? `Song Trùm MK-${this.wave}`
          : `Lõi Thống Lĩnh MK-${this.wave}`
        : "Lõi Thống Lĩnh",
      bossHp: bossHpSum,
      bossMaxHp: bosses.length > 0 ? Math.max(1, bossMaxHpSum) : 1,
      bossStage: anyEnraged ? 2 : 1,
      activeUpgrades: { ...this.upgrades },
    });
  }

  // ==================== RENDERING ====================
  private render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // Multi-tiered camera shake (frequency-differentiated impulses + directional punch + rotational tilt)
    const motionScale = this.reducedMotion ? 0.18 : 1;
    let shakeX = this.shakeKickX * motionScale;
    let shakeY = this.shakeKickY * motionScale;
    let shakeRot = 0;

    for (const imp of this.shakeImpulses) {
      const env = Math.max(0, imp.life / imp.maxLife);
      const envSq = env * env;
      const omega = imp.frequency * Math.PI * 2;
      const waveX = Math.sin(imp.elapsed * omega + imp.phaseX);
      const waveY = Math.cos(imp.elapsed * omega * 0.93 + imp.phaseY);
      const jitterX = (Math.random() * 2 - 1) * 0.35;
      const jitterY = (Math.random() * 2 - 1) * 0.35;

      shakeX += (waveX * 0.8 + jitterX) * imp.amplitude * envSq * motionScale;
      shakeY += (waveY * 0.8 + jitterY) * imp.amplitude * envSq * motionScale;
      shakeRot +=
        Math.sin(imp.elapsed * omega * 0.6 + imp.phaseX) *
        imp.rotScale *
        envSq *
        motionScale;
    }

    if (
      Math.abs(shakeX) > 0.08 ||
      Math.abs(shakeY) > 0.08 ||
      Math.abs(shakeRot) > 0.0002
    ) {
      const clampedX = Math.max(-34, Math.min(34, shakeX));
      const clampedY = Math.max(-34, Math.min(34, shakeY));
      const clampedRot = Math.max(-0.03, Math.min(0.03, shakeRot));
      ctx.translate(w * 0.5 + clampedX, h * 0.5 + clampedY);
      ctx.rotate(clampedRot);
      ctx.translate(-w * 0.5, -h * 0.5);
    }

    // Deep Twilight Space Arena Background (60% Dominant Surface)
    const bgGrad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      40,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.78,
    );
    bgGrad.addColorStop(0, "#0E1729");
    bgGrad.addColorStop(1, "#070C17");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-40, -40, w + 80, h + 80);

    // Layered procedural nebulae, distant star clusters, and multi-tier parallax starfield
    const px = this.bgParallaxX;
    const py = this.bgParallaxY;
    renderParallaxSpaceState(ctx, this.parallaxSpace, w, h, px, py);

    // Background Weather System (nebula dust & distant asteroid fragments beneath arena grid)
    this.renderBackgroundWeather(ctx, w, h, px, py);

    // Subtle Orbital Grid Lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.055)";
    ctx.lineWidth = 1;
    const gridStep = 64;
    ctx.beginPath();
    for (let x = this.arenaMargin; x <= w - this.arenaMargin; x += gridStep) {
      ctx.moveTo(x, this.arenaMargin);
      ctx.lineTo(x, h - this.arenaMargin);
    }
    for (let y = this.arenaMargin; y <= h - this.arenaMargin; y += gridStep) {
      ctx.moveTo(this.arenaMargin, y);
      ctx.lineTo(w - this.arenaMargin, y);
    }
    ctx.stroke();

    // Arena Boundary Frame (glows indigo when Time Dilation is active)
    const dilated = this.player.timeDilationTimer > 0;
    ctx.strokeStyle = dilated
      ? "rgba(129, 140, 248, 0.72)"
      : "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = dilated ? 3 : 2;
    ctx.strokeRect(
      this.arenaMargin,
      this.arenaMargin,
      w - this.arenaMargin * 2,
      h - this.arenaMargin * 2,
    );

    // Pickups
    this.renderPickups(ctx);

    // Electromagnetic Shield Zones (drawn beneath telegraphs & ships for clear readability)
    this.renderShieldDomes(ctx);

    // Repair Drone Healing Tethers
    this.renderRepairBeams(ctx);

    // Enemy Telegraph Lines / Danger Circles (drawn beneath entities for clarity)
    this.renderEnemyTelegraphs(ctx);

    // Enemies & Spawn Portals
    this.renderEnemies(ctx);

    // Bullets
    this.renderBullets(ctx);

    // Movement trail particles & dynamic velocity ribbon (drawn beneath the player ship)
    this.renderParticles(ctx, "trails");
    if (this.gameState !== "TITLE_MENU") {
      this.renderPlayerTrail(ctx);
      this.renderPlayer(ctx);
    }

    // Pooled Combat Particles
    this.renderParticles(ctx, "combat");

    // Screen-Spanning Shockwave Distortion Rings
    this.renderShockwaves(ctx);

    // Floating Combat Text
    this.renderFloatingTexts(ctx);

    // Custom Aim Reticle during active play
    if (this.gameState === "PLAYING" && this.hasMouseMoved) {
      this.renderReticle(ctx);
    }

    ctx.restore();
  }

  private renderPickups(ctx: CanvasRenderingContext2D): void {
    for (const pk of this.pickups) {
      const bob = Math.sin(pk.bobPhase) * 2.5;
      const alpha = pk.life < 2.5 ? 0.35 + Math.sin(pk.life * 16) * 0.35 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, alpha);
      ctx.translate(pk.x, pk.y + bob);

      if (pk.kind === "core") {
        ctx.rotate(pk.bobPhase * 0.5);
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 7);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FEF3C7";
        ctx.fillRect(-1.5, -1.5, 3, 3);
      } else if (pk.kind === "repair") {
        ctx.fillStyle = "#10B981";
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-5, -1.6, 10, 3.2);
        ctx.fillRect(-1.6, -5, 3.2, 10);
      } else {
        ctx.fillStyle = "#38BDF8";
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-3, -4);
        ctx.lineTo(2, -4);
        ctx.lineTo(-1, 0);
        ctx.lineTo(3, 0);
        ctx.lineTo(-2, 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderShieldDomes(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      if (e.kind !== "shielder" || e.spawnDelay > 0) continue;

      const playerInside =
        Math.hypot(this.player.x - e.x, this.player.y - e.y) <=
        EMP_DOME_RADIUS - 2;
      const pulse =
        0.5 + 0.5 * Math.sin(this.runDuration * 4.5 + e.behaviorPhase);
      const flashBoost = e.hitFlash > 0 ? 0.18 : 0;

      ctx.save();
      ctx.translate(e.x, e.y);

      const grad = ctx.createRadialGradient(
        0,
        0,
        e.radius * 0.6,
        0,
        0,
        EMP_DOME_RADIUS,
      );
      if (playerInside) {
        grad.addColorStop(0, "rgba(52, 211, 153, 0.01)");
        grad.addColorStop(0.72, "rgba(52, 211, 153, 0.06)");
        grad.addColorStop(1, `rgba(52, 211, 153, ${0.19 + flashBoost})`);
      } else {
        grad.addColorStop(0, "rgba(59, 130, 246, 0.01)");
        grad.addColorStop(0.72, "rgba(59, 130, 246, 0.07)");
        grad.addColorStop(
          1,
          `rgba(96, 165, 250, ${0.21 + pulse * 0.06 + flashBoost})`,
        );
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, EMP_DOME_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Rotating inner tactical ring
      ctx.save();
      ctx.rotate(e.spinAngle * 0.55);
      ctx.strokeStyle = playerInside
        ? "rgba(52, 211, 153, 0.42)"
        : "rgba(96, 165, 250, 0.36)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, EMP_DOME_RADIUS * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Outer deflection boundary rim
      ctx.rotate(-e.spinAngle * 0.85);
      ctx.strokeStyle = playerInside
        ? "rgba(52, 211, 153, 0.82)"
        : `rgba(96, 165, 250, ${0.65 + pulse * 0.2 + flashBoost})`;
      ctx.lineWidth = playerInside ? 2.4 : 2;
      ctx.setLineDash([16, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, EMP_DOME_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderRepairBeams(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      if (
        e.kind !== "repair_drone" ||
        e.spawnDelay > 0 ||
        e.healTargetId === undefined
      )
        continue;
      const target = this.enemies.find(
        (t) => t.id === e.healTargetId && t.spawnDelay <= 0,
      );
      if (!target) continue;

      const pulse =
        0.5 + 0.5 * Math.sin(this.runDuration * 12 + e.behaviorPhase);
      ctx.save();

      // Outer emerald repair beam glow
      ctx.strokeStyle = `rgba(74, 222, 128, ${0.34 + pulse * 0.2})`;
      ctx.lineWidth = 6 + pulse * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      // Inner bright core tether
      ctx.strokeStyle = "#BBF7D0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      // Animated energy pulses traveling from drone to wounded ally
      for (let k = 0; k < 3; k++) {
        const t = (this.runDuration * 1.9 + k / 3) % 1;
        const px = e.x + (target.x - e.x) * t;
        const py = e.y + (target.y - e.y) * t;
        ctx.fillStyle = "#ECFDF5";
        ctx.beginPath();
        ctx.arc(px, py, 3.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle emerald restoration ring around healed ally
      ctx.strokeStyle = `rgba(74, 222, 128, ${0.48 + pulse * 0.24})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius + 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderEnemyTelegraphs(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      if (e.spawnDelay > 0 || e.state !== "windup") continue;

      if (
        e.kind === "sniper" ||
        (e.kind === "boss" && e.bossPatternIdx === 1)
      ) {
        const progress = 1 - e.stateTimer / 0.95;
        ctx.save();
        ctx.strokeStyle =
          progress > 0.72
            ? "rgba(251, 113, 133, 0.9)"
            : "rgba(251, 113, 133, 0.45)";
        ctx.lineWidth = progress > 0.72 ? 2.5 : 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(
          e.x + Math.cos(e.aimAngle) * 1400,
          e.y + Math.sin(e.aimAngle) * 1400,
        );
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === "rusher") {
        const progress = 1 - e.stateTimer / 0.52;
        ctx.save();
        ctx.strokeStyle =
          progress > 0.65
            ? "rgba(249, 115, 22, 0.92)"
            : "rgba(249, 115, 22, 0.45)";
        ctx.lineWidth = progress > 0.65 ? 3 : 1.6;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(
          e.x + Math.cos(e.aimAngle) * 340,
          e.y + Math.sin(e.aimAngle) * 340,
        );
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === "weaver") {
        ctx.save();
        ctx.strokeStyle = "rgba(192, 132, 252, 0.65)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === "scout") {
        ctx.save();
        ctx.strokeStyle = "rgba(245, 158, 11, 0.65)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(
          e.x + Math.cos(e.aimAngle) * 120,
          e.y + Math.sin(e.aimAngle) * 120,
        );
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === "bomber") {
        const fillRatio = 1 - e.stateTimer / 0.72;
        ctx.save();
        ctx.fillStyle = "rgba(251, 113, 133, 0.14)";
        ctx.strokeStyle = "rgba(251, 113, 133, 0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 110, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(e.x, e.y, 110 * fillRatio, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (e.kind === "kamikaze") {
        const lockProgress = 1 - e.stateTimer / 0.62;
        ctx.save();
        ctx.strokeStyle =
          lockProgress > 0.65
            ? "rgba(239, 68, 68, 0.92)"
            : "rgba(251, 191, 36, 0.58)";
        ctx.lineWidth = lockProgress > 0.65 ? 2.6 : 1.6;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(
          e.x + Math.cos(e.aimAngle) * 420,
          e.y + Math.sin(e.aimAngle) * 420,
        );
        ctx.stroke();
        ctx.setLineDash([]);

        // Contracting target-lock diamond around kamikaze drone
        const lockR = e.radius + 14 - lockProgress * 8;
        ctx.translate(e.x, e.y);
        ctx.rotate(lockProgress * Math.PI * 0.5);
        ctx.strokeStyle = lockProgress > 0.65 ? "#EF4444" : "#FBBF24";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -lockR);
        ctx.lineTo(lockR, 0);
        ctx.lineTo(0, lockR);
        ctx.lineTo(-lockR, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === "seeker") {
        const prog = 1 - e.stateTimer / 0.58;
        ctx.save();
        ctx.strokeStyle = "rgba(45, 212, 191, 0.72)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 5]);
        for (const side of [-1, 1]) {
          const launchAng = e.aimAngle + side * 0.62;
          const podAng = e.aimAngle + (side * Math.PI) / 2;
          const ox = e.x + Math.cos(podAng) * 10;
          const oy = e.y + Math.sin(podAng) * 10;
          const cx = ox + Math.cos(launchAng) * 75;
          const cy = oy + Math.sin(launchAng) * 75;
          const ex = ox + Math.cos(e.aimAngle) * (110 + prog * 40);
          const ey = oy + Math.sin(e.aimAngle) * (110 + prog * 40);
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.quadraticCurveTo(cx, cy, ex, ey);
          ctx.stroke();
        }
        ctx.restore();
      } else if (e.kind === "shielder") {
        const prog = 1 - e.stateTimer / 0.55;
        ctx.save();
        ctx.strokeStyle =
          prog > 0.65 ? "rgba(96, 165, 250, 0.88)" : "rgba(96, 165, 250, 0.45)";
        ctx.lineWidth = prog > 0.65 ? 2 : 1.4;
        ctx.setLineDash([6, 5]);
        for (const offset of [-0.24, 0, 0.24]) {
          const ang = e.aimAngle + offset;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(ang) * 165, e.y + Math.sin(ang) * 165);
          ctx.stroke();
        }
        ctx.restore();
      } else if (e.kind === "juggernaut") {
        const ringR = e.radius + 14 + (1 - e.stateTimer / 0.8) * 18;
        ctx.save();
        ctx.strokeStyle = "rgba(251, 113, 133, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);

      if (e.spawnDelay > 0) {
        // Portal materialize telegraph
        const prog = 1 - e.spawnDelay / 0.85;
        const portalColor = ENEMY_ARCHETYPES[e.kind].accentColor;
        ctx.strokeStyle = portalColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.35 + prog * 0.65;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * (2.2 - prog * 1.1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.4 * prog, 0, Math.PI * 2);
        ctx.fillStyle = portalColor;
        ctx.fill();
        ctx.restore();
        continue;
      }

      const isFlashing = e.hitFlash > 0;
      ctx.scale(e.squash, 2 - e.squash);

      if (e.kind === "scout" || e.kind === "shard") {
        ctx.rotate(e.angle);
        ctx.fillStyle = isFlashing
          ? "#FFFFFF"
          : e.state === "windup"
            ? "#F59E0B"
            : "#FB7185";
        ctx.beginPath();
        ctx.moveTo(e.radius * 1.2, 0);
        ctx.lineTo(-e.radius * 0.9, e.radius * 0.85);
        ctx.lineTo(-e.radius * 0.45, 0);
        ctx.lineTo(-e.radius * 0.9, -e.radius * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (e.kind === "rusher") {
        // Sleek needle-lance silhouette for straight-line charging enemy
        ctx.rotate(e.angle);
        ctx.fillStyle = isFlashing
          ? "#FFFFFF"
          : e.state === "windup"
            ? "#FBBF24"
            : "#F97316";
        ctx.beginPath();
        ctx.moveTo(e.radius * 1.55, 0);
        ctx.lineTo(-e.radius * 0.75, e.radius * 0.62);
        ctx.lineTo(-e.radius * 1.1, 0);
        ctx.lineTo(-e.radius * 0.75, -e.radius * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FEF3C7";
        ctx.beginPath();
        ctx.arc(2, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "weaver") {
        // Twin-crescent wing silhouette for sine-wave weaving enemy
        ctx.rotate(e.angle);
        const wingSweep = Math.sin(e.behaviorPhase * 8) * 2.5;
        ctx.fillStyle = isFlashing ? "#FFFFFF" : "#C084FC";
        ctx.beginPath();
        ctx.moveTo(e.radius * 1.05, 0);
        ctx.lineTo(-e.radius * 0.6, e.radius * 1.1 + wingSweep);
        ctx.lineTo(-e.radius * 0.2, 0);
        ctx.lineTo(-e.radius * 0.6, -e.radius * 1.1 - wingSweep);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = e.state === "windup" ? "#F59E0B" : "#F3E8FF";
        ctx.beginPath();
        ctx.arc(1, 0, 3.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "kamikaze") {
        // Twin-pronged warhead dart silhouette with pulsing volatile core
        ctx.rotate(e.angle);
        if (e.state === "action") {
          ctx.fillStyle = "#FBBF24";
          ctx.beginPath();
          ctx.moveTo(-e.radius * 0.7, -4);
          ctx.lineTo(-e.radius * 1.9 - Math.random() * 6, 0);
          ctx.lineTo(-e.radius * 0.7, 4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = isFlashing
          ? "#FFFFFF"
          : e.state === "windup"
            ? "#F59E0B"
            : "#DC2626";
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(e.radius * 1.38, -3.5);
        ctx.lineTo(e.radius * 0.35, 0);
        ctx.lineTo(e.radius * 1.38, 3.5);
        ctx.lineTo(-e.radius * 0.65, e.radius * 0.95);
        ctx.lineTo(-e.radius * 0.95, 0);
        ctx.lineTo(-e.radius * 0.65, -e.radius * 0.95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const corePulse = 3.2 + Math.sin(this.runDuration * 22) * 0.9;
        ctx.fillStyle = e.state === "action" ? "#FEF08A" : "#FCA5A5";
        ctx.beginPath();
        ctx.arc(-1, 0, corePulse, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "seeker") {
        // Twin-pod homing missile cruiser silhouette in electric teal
        ctx.rotate(e.angle);
        ctx.fillStyle = isFlashing ? "#FFFFFF" : "#0F766E";
        ctx.strokeStyle = isFlashing ? "#FFFFFF" : "#2DD4BF";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.radius * 1.15, 0);
        ctx.lineTo(e.radius * 0.15, e.radius * 0.95);
        ctx.lineTo(-e.radius * 0.95, e.radius * 0.75);
        ctx.lineTo(-e.radius * 0.5, 0);
        ctx.lineTo(-e.radius * 0.95, -e.radius * 0.75);
        ctx.lineTo(e.radius * 0.15, -e.radius * 0.95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Twin side missile pods
        ctx.fillStyle = e.state === "windup" ? "#FBBF24" : "#2DD4BF";
        ctx.fillRect(-3, -e.radius * 0.98, 8, 4);
        ctx.fillRect(-3, e.radius * 0.98 - 4, 8, 4);

        // Guidance optic core
        ctx.fillStyle = e.state === "windup" ? "#FEF08A" : "#99F6E4";
        ctx.beginPath();
        ctx.arc(3, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "shielder") {
        // Cobalt hexagonal electromagnetic field cruiser with 4 emitter pylons
        ctx.rotate(e.spinAngle * 0.45);
        ctx.fillStyle = isFlashing ? "#FFFFFF" : "#1E3A8A";
        ctx.strokeStyle = isFlashing ? "#FFFFFF" : "#60A5FA";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI) / 3;
          const px = Math.cos(a) * e.radius;
          const py = Math.sin(a) * e.radius;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 4 corner EMP emitter pylons
        ctx.fillStyle = e.state === "windup" ? "#FBBF24" : "#93C5FD";
        for (let pIdx = 0; pIdx < 4; pIdx++) {
          const pa = (pIdx * Math.PI) / 2 + Math.PI / 4;
          const px = Math.cos(pa) * (e.radius * 0.88);
          const py = Math.sin(pa) * (e.radius * 0.88);
          ctx.beginPath();
          ctx.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Pulsing cobalt capacitor core
        const coreR =
          5.5 + Math.sin(this.runDuration * 8 + e.behaviorPhase) * 1.1;
        ctx.fillStyle = e.state === "windup" ? "#FEF08A" : "#DBEAFE";
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "repair_drone") {
        // Active emerald aura ring while channeling heal beam
        if (e.state === "action") {
          ctx.save();
          ctx.strokeStyle = "rgba(74, 222, 128, 0.75)";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(
            0,
            0,
            e.radius + 5 + Math.sin(this.runDuration * 12) * 1.5,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
          ctx.restore();
        }

        // Spinning dual stabilizer arcs
        ctx.save();
        ctx.rotate(e.spinAngle * 2.1);
        ctx.strokeStyle = isFlashing ? "#FFFFFF" : "#4ADE80";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 1.5, -0.8, 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 1.5, Math.PI - 0.8, Math.PI + 0.8);
        ctx.stroke();
        ctx.restore();

        // Rounded medical drone hull with white-mint repair cross
        ctx.fillStyle = isFlashing ? "#FFFFFF" : "#064E3B";
        ctx.strokeStyle = isFlashing ? "#FFFFFF" : "#4ADE80";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = e.state === "action" ? "#DCFCE7" : "#86EFAC";
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillRect(-2, -6, 4, 12);
      } else if (e.kind === "sniper") {
        ctx.rotate(e.angle);
        ctx.fillStyle = isFlashing ? "#FFFFFF" : "#E11D48";
        ctx.beginPath();
        ctx.moveTo(e.radius * 1.35, 0);
        ctx.lineTo(0, e.radius * 0.72);
        ctx.lineTo(-e.radius * 1.1, 0);
        ctx.lineTo(0, -e.radius * 0.72);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#FDA4AF";
        ctx.beginPath();
        ctx.arc(2, 0, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "juggernaut") {
        ctx.rotate(e.spinAngle);
        ctx.fillStyle = isFlashing ? "#FFFFFF" : "#334155";
        ctx.strokeStyle = isFlashing ? "#FFFFFF" : "#FB7185";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI) / 3;
          const px = Math.cos(a) * e.radius;
          const py = Math.sin(a) * e.radius;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = e.state === "windup" ? "#F59E0B" : "#FB7185";
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "bomber") {
        const pulse = 1 + Math.sin(this.runDuration * 14) * 0.12;
        ctx.scale(pulse, pulse);
        ctx.fillStyle = isFlashing ? "#FFFFFF" : "#F43F5E";
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "boss") {
        const enraged = e.bossStage === 2;

        // Outer enraged energy aura ring in Phase 2
        if (enraged) {
          ctx.save();
          ctx.rotate(-e.spinAngle * 1.4);
          ctx.strokeStyle = "rgba(245, 158, 11, 0.65)";
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 8]);
          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 11, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Multi-ring Boss Core
        ctx.save();
        ctx.rotate(e.spinAngle);
        ctx.strokeStyle = isFlashing
          ? "#FFFFFF"
          : enraged
            ? "#F59E0B"
            : "#FB7185";
        ctx.lineWidth = enraged ? 4.5 : 4;
        for (let arc = 0; arc < (enraged ? 4 : 3); arc++) {
          const start = (arc * Math.PI * 2) / (enraged ? 4 : 3);
          ctx.beginPath();
          ctx.arc(0, 0, e.radius, start, start + (enraged ? 1.05 : 1.45));
          ctx.stroke();
        }
        ctx.restore();

        ctx.rotate(-e.spinAngle * 0.6);
        ctx.fillStyle = isFlashing
          ? "#FFFFFF"
          : enraged
            ? "#2A1222"
            : "#1E293B";
        ctx.strokeStyle = enraged ? "#FB7185" : "#F59E0B";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const a = (s * Math.PI) / 4;
          const px = Math.cos(a) * (e.radius * 0.72);
          const py = Math.sin(a) * (e.radius * 0.72);
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = e.state === "windup" || enraged ? "#F59E0B" : "#FB7185";
        ctx.beginPath();
        ctx.arc(0, 0, enraged ? 14 : 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Micro HP bar for damaged armored enemies (non-boss)
      if (e.kind !== "boss" && e.hp < e.maxHp) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        const bw = e.radius * 2;
        const bx = e.x - bw / 2;
        const by = e.y - e.radius - 10;
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(bx, by, bw, 4);
        ctx.fillStyle = "#FB7185";
        ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 4);
      }

      ctx.restore();
    }
  }

  private renderBullets(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bullets) {
      ctx.save();
      if (b.homingTurnRate) {
        const ang = Math.atan2(b.vy, b.vx);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.radius * 1.15;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(b.trailX - b.vx * 0.025, b.trailY - b.vy * 0.025);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        ctx.translate(b.x, b.y);
        ctx.rotate(ang);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(b.radius * 1.5, 0);
        ctx.lineTo(-b.radius * 0.9, b.radius * 0.85);
        ctx.lineTo(-b.radius * 0.45, 0);
        ctx.lineTo(-b.radius * 0.9, -b.radius * 0.85);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#CCFBF1";
        ctx.beginPath();
        ctx.arc(0, 0, b.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.radius * 1.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(b.trailX - b.vx * 0.014, b.trailY - b.vy * 0.014);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderPlayerTrail(ctx: CanvasRenderingContext2D): void {
    if (this.playerTrail.length === 0) return;

    const p = this.player;
    const shipSpec = getShipSpec(this.selectedShipId);
    const currentSpeed = Math.hypot(p.vx, p.vy);
    const liveSpeedRatio = Math.min(1.45, currentSpeed / shipSpec.maxSpeed);
    const cosA = Math.cos(p.angle);
    const sinA = Math.sin(p.angle);
    const perpX = -sinA;
    const perpY = cosA;
    const wingBackX = p.x - cosA * 9.5;
    const wingBackY = p.y - sinA * 9.5;
    const wingSpan = this.selectedShipId === "aegis" ? 14.5 : 13.5;

    const headNode: PlayerTrailNode = {
      x: p.x - cosA * 13,
      y: p.y - sinA * 13,
      wingLX: wingBackX - perpX * wingSpan,
      wingLY: wingBackY - perpY * wingSpan,
      wingRX: wingBackX + perpX * wingSpan,
      wingRY: wingBackY + perpY * wingSpan,
      speedRatio: liveSpeedRatio,
      life: 1,
      maxLife: 1,
      dashing: p.dashTimer > 0,
      overdrive: p.overdriveTimer > 0,
    };

    const points =
      currentSpeed > 28 ? [headNode, ...this.playerTrail] : this.playerTrail;
    if (points.length < 2) return;

    const exhaustProfile = shipSpec.exhaust;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const ageA = Math.max(0, Math.min(1, a.life / a.maxLife));
      const ageB = Math.max(0, Math.min(1, b.life / b.maxLife));
      const ageAvg = (ageA + ageB) * 0.5;
      const spdAvg = (a.speedRatio + b.speedRatio) * 0.5;
      const spdFactor = Math.max(0.08, Math.min(1.35, spdAvg));
      const isDashSeg = a.dashing || b.dashing;
      const isOverdriveSeg = a.overdrive || b.overdrive;

      // Outer luminous thruster wake colored by ship exhaust signature
      const coreAlpha = Math.min(
        0.82,
        ageAvg * ageAvg * (0.28 + spdFactor * 0.42),
      );
      const coreWidth = Math.max(
        0.8,
        ageAvg *
          (exhaustProfile.style === "bastion_plume"
            ? 3.2 + spdFactor * 6.0
            : 2.2 + spdFactor * 5.2),
      );

      if (coreAlpha > 0.01) {
        ctx.strokeStyle = isDashSeg
          ? `rgba(56, 189, 248, ${coreAlpha.toFixed(3)})`
          : isOverdriveSeg
            ? `rgba(251, 191, 36, ${coreAlpha.toFixed(3)})`
            : `rgba(${exhaustProfile.coreRgb}, ${coreAlpha.toFixed(3)})`;
        ctx.lineWidth = coreWidth;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Bright inner plasma filament at higher speeds / dash
        if (spdFactor > 0.42) {
          const innerAlpha = Math.min(0.78, coreAlpha * 0.85);
          ctx.strokeStyle = isDashSeg
            ? `rgba(224, 242, 254, ${innerAlpha.toFixed(3)})`
            : isOverdriveSeg
              ? `rgba(254, 243, 199, ${innerAlpha.toFixed(3)})`
              : `rgba(${exhaustProfile.innerRgb}, ${innerAlpha.toFixed(3)})`;
          ctx.lineWidth = Math.max(0.5, coreWidth * 0.42);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Twin wingtip slipstream ribbons colored by ship class
      const slipstreamFactor = isDashSeg
        ? 1
        : Math.max(0, (spdFactor - 0.32) / 0.68);
      if (slipstreamFactor > 0.05) {
        const wingAlpha = Math.min(
          0.62,
          ageAvg * ageAvg * slipstreamFactor * (isDashSeg ? 0.62 : 0.42),
        );
        const wingWidth = Math.max(
          0.6,
          ageAvg * (1.0 + slipstreamFactor * (isDashSeg ? 2.2 : 1.5)),
        );
        ctx.strokeStyle = isDashSeg
          ? `rgba(186, 230, 253, ${wingAlpha.toFixed(3)})`
          : `rgba(${exhaustProfile.wingtipRgb}, ${wingAlpha.toFixed(3)})`;
        ctx.lineWidth = wingWidth;

        ctx.beginPath();
        ctx.moveTo(a.wingLX, a.wingLY);
        ctx.lineTo(b.wingLX, b.wingLY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(a.wingRX, a.wingRY);
        ctx.lineTo(b.wingRX, b.wingRY);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;

    // Blink briefly during post-hit invulnerability (except during dash)
    if (
      p.invulnTimer > 0 &&
      p.dashTimer <= 0 &&
      Math.floor(p.invulnTimer * 18) % 2 === 0
    ) {
      ctx.save();
      ctx.globalAlpha = 0.45;
    } else {
      ctx.save();
    }

    // Orbiting Escort Drones
    const droneCount = this.upgrades.orbital_drone ?? 0;
    for (let i = 0; i < droneCount; i++) {
      const angle = this.droneOrbitAngle + (i * Math.PI * 2) / droneCount;
      const dx = p.x + Math.cos(angle) * 44;
      const dy = p.y + Math.sin(angle) * 44;
      ctx.fillStyle = "#34D399";
      ctx.beginPath();
      ctx.arc(dx, dy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ECFDF5";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Energy Shield Ring & Recharge Arc
    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (
      p.shield < p.maxShield &&
      p.shieldRegenTimer > 0 &&
      !this.isBossPhaseActive()
    ) {
      const rechargeFrac = Math.max(
        0,
        Math.min(1, p.shieldRegenTimer / p.shieldRegenDelay),
      );
      ctx.strokeStyle = "rgba(125, 211, 252, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        p.radius + 8,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * rechargeFrac,
      );
      ctx.stroke();
    }

    // EMP Ready subtle aura ring
    if (p.empCharge >= 100) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        p.radius + 13,
        this.runDuration * 2,
        this.runDuration * 2 + Math.PI * 2,
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Time Dilation active countdown arc around the ship
    if (p.timeDilationTimer > 0) {
      const frac = Math.max(0, p.timeDilationTimer / p.timeDilationDuration);
      ctx.strokeStyle = "rgba(165, 180, 252, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        p.radius + 18,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * frac,
      );
      ctx.stroke();
    }

    // Dash Phase-Invincibility Halo & Speed-Boost Ring
    if (p.dashInvulnTimer > 0 || p.dashTimer > 0) {
      const invFrac = Math.max(0, Math.min(1, p.dashInvulnTimer / 0.34));
      ctx.strokeStyle = `rgba(110, 231, 183, ${(0.35 + invFrac * 0.55).toFixed(3)})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.dashBoostTimer > 0) {
      const boostFrac = Math.max(0, Math.min(1, p.dashBoostTimer / 0.48));
      ctx.strokeStyle = `rgba(56, 189, 248, ${(boostFrac * 0.55).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.scale(p.squashX, p.squashY);

    // Velocity-scaled ship-specific Thruster flame
    const shipSpec = getShipSpec(this.selectedShipId);
    const speedNorm = Math.min(1, Math.hypot(p.vx, p.vy) / shipSpec.maxSpeed);
    const flameLen =
      p.dashTimer > 0
        ? 24
        : 5 + speedNorm * 11 + Math.random() * (2 + speedNorm * 3);
    const outerFlameColor =
      p.dashTimer > 0
        ? "#38BDF8"
        : p.overdriveTimer > 0
          ? "#FBBF24"
          : shipSpec.exhaust.primaryHex;
    const innerFlameColor =
      p.dashTimer > 0
        ? "#E0F2FE"
        : p.overdriveTimer > 0
          ? "#FEF3C7"
          : shipSpec.exhaust.secondaryHex;

    if (this.selectedShipId === "striker") {
      // Twin-nozzle cyan ion thruster plumes
      for (const side of [-5, 5]) {
        ctx.fillStyle = outerFlameColor;
        ctx.beginPath();
        ctx.moveTo(-11, side - 3);
        ctx.lineTo(-11 - flameLen * 1.05, side);
        ctx.lineTo(-11, side + 3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = innerFlameColor;
        ctx.beginPath();
        ctx.moveTo(-11, side - 1.4);
        ctx.lineTo(-11 - flameLen * 0.55, side);
        ctx.lineTo(-11, side + 1.4);
        ctx.closePath();
        ctx.fill();
      }
    } else if (this.selectedShipId === "aegis") {
      // Broad heavy emerald reactor plume
      ctx.fillStyle = outerFlameColor;
      ctx.beginPath();
      ctx.moveTo(-13, -7);
      ctx.lineTo(-13 - flameLen * 0.9, 0);
      ctx.lineTo(-13, 7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = innerFlameColor;
      ctx.beginPath();
      ctx.moveTo(-13, -3.5);
      ctx.lineTo(-13 - flameLen * 0.52, 0);
      ctx.lineTo(-13, 3.5);
      ctx.closePath();
      ctx.fill();
    } else {
      // Interceptor amber jet flame + bright core
      ctx.fillStyle = outerFlameColor;
      ctx.beginPath();
      ctx.moveTo(-11, -5);
      ctx.lineTo(-11 - flameLen, 0);
      ctx.lineTo(-11, 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = innerFlameColor;
      ctx.beginPath();
      ctx.moveTo(-11, -2.2);
      ctx.lineTo(-11 - flameLen * 0.55, 0);
      ctx.lineTo(-11, 2.2);
      ctx.closePath();
      ctx.fill();
    }

    if (this.selectedShipId === "striker") {
      // Striker Hull (Forward-Swept Agile Twin-Cannon Silhouette)
      ctx.fillStyle = p.hitFlash > 0 ? "#FFFFFF" : "#E2E8F0";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(-4, 15);
      ctx.lineTo(-1, 6);
      ctx.lineTo(-14, 10);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-14, -10);
      ctx.lineTo(-1, -6);
      ctx.lineTo(-4, -15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sky-cyan wing accent fins
      ctx.fillStyle = "#38BDF8";
      ctx.beginPath();
      ctx.moveTo(6, -4);
      ctx.lineTo(-6, -11);
      ctx.lineTo(-3, -5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, 4);
      ctx.lineTo(-6, 11);
      ctx.lineTo(-3, 5);
      ctx.closePath();
      ctx.fill();

      // Amber Canopy
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.ellipse(6, 0, 6, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.selectedShipId === "aegis") {
      // Aegis Bastion Hull (Heavy Hexagonal Shield Cruiser)
      ctx.fillStyle = p.hitFlash > 0 ? "#FFFFFF" : "#CBD5E1";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(7, 15);
      ctx.lineTo(-8, 13);
      ctx.lineTo(-14, 5);
      ctx.lineTo(-14, -5);
      ctx.lineTo(-8, -13);
      ctx.lineTo(7, -15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Emerald shield pylons
      ctx.fillStyle = "#34D399";
      ctx.beginPath();
      ctx.moveTo(6, -11);
      ctx.lineTo(-7, -10);
      ctx.lineTo(-9, -6);
      ctx.lineTo(4, -7);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, 11);
      ctx.lineTo(-7, 10);
      ctx.lineTo(-9, 6);
      ctx.lineTo(4, 7);
      ctx.closePath();
      ctx.fill();

      // Ice-blue Bastion Canopy
      ctx.fillStyle = "#BAE6FD";
      ctx.beginPath();
      ctx.ellipse(3, 0, 5.5, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Interceptor Hull (Delta Wing Silhouette)
      ctx.fillStyle = p.hitFlash > 0 ? "#FFFFFF" : "#E2E8F0";
      ctx.strokeStyle = "#0F172A";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-10, 14);
      ctx.lineTo(-6, 5);
      ctx.lineTo(-13, 3);
      ctx.lineTo(-13, -3);
      ctx.lineTo(-6, -5);
      ctx.lineTo(-10, -14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing accent stripes
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.moveTo(2, -5);
      ctx.lineTo(-7, -11);
      ctx.lineTo(-5, -6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, 5);
      ctx.lineTo(-7, 11);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();

      // Cockpit Canopy
      ctx.fillStyle = "#38BDF8";
      ctx.beginPath();
      ctx.ellipse(4, 0, 6.5, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderParticles(
    ctx: CanvasRenderingContext2D,
    layer: "trails" | "combat",
  ): void {
    for (const pt of this.particles) {
      if (!pt.active) continue;
      if (layer === "trails" && pt.kind !== "trail") continue;
      if (layer === "combat" && pt.kind === "trail") continue;

      const t = 1 - pt.life / pt.maxLife;
      const alpha = Math.max(0, 1 - t);
      const size = Math.max(0.4, pt.size + (pt.endSize - pt.size) * t);

      ctx.save();
      if (pt.additive) {
        ctx.globalCompositeOperation = "lighter";
      }
      ctx.globalAlpha = pt.kind === "flash" ? alpha * alpha : alpha;

      if (pt.kind === "spark") {
        const tailX = pt.x - pt.vx * 0.026;
        const tailY = pt.y - pt.vy * 0.026;
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = Math.max(0.8, size);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else if (pt.kind === "trail") {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rotation);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = Math.max(0.8, size);
        ctx.lineCap = "round";
        const streakLen = Math.max(2, size * 2.6);
        ctx.beginPath();
        ctx.moveTo(-streakLen, 0);
        ctx.lineTo(streakLen * 0.35, 0);
        ctx.stroke();
      } else if (pt.kind === "ring") {
        ctx.translate(pt.x, pt.y);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = Math.max(1, 3.6 * (1 - t));
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pt.kind === "shard") {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rotation);
        const sides = Math.max(3, pt.sides);
        ctx.beginPath();
        for (let s = 0; s < sides; s++) {
          const ang = (s * Math.PI * 2) / sides;
          const rx = Math.cos(ang) * size * 1.15;
          const ry = Math.sin(ang) * size * pt.aspect;
          if (s === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.fillStyle = pt.color;
        ctx.fill();
        if (pt.strokeColor) {
          ctx.strokeStyle = pt.strokeColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      } else if (
        pt.kind === "flash" ||
        pt.kind === "glow" ||
        pt.kind === "ember"
      ) {
        ctx.translate(pt.x, pt.y);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        grad.addColorStop(0, pt.color);
        grad.addColorStop(0.55, pt.color);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.translate(pt.x, pt.y);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderShockwaves(ctx: CanvasRenderingContext2D): void {
    if (this.shockwaves.length === 0) return;

    const motionMult = this.reducedMotion ? 0.5 : 1;

    for (const sw of this.shockwaves) {
      const progress = 1 - Math.max(0, sw.life / sw.maxLife);
      const eased = 1 - Math.pow(1 - progress, 3);
      const radius = sw.startRadius + (sw.maxRadius - sw.startRadius) * eased;
      const fade = Math.pow(1 - progress, 1.3) * sw.intensity * motionMult;
      if (fade <= 0.01) continue;

      ctx.save();

      // Brief kinetic screen flash on Boss kill / major skill activation
      if (sw.flashAlpha > 0 && progress < 0.24) {
        const flashEnv = Math.sin((progress / 0.24) * Math.PI);
        const veilAlpha =
          sw.flashAlpha * flashEnv * (this.reducedMotion ? 0.35 : 1);
        ctx.fillStyle = `rgba(${sw.coreRgb}, ${veilAlpha})`;
        ctx.fillRect(-40, -40, this.width + 80, this.height + 80);
      }

      ctx.globalCompositeOperation = "lighter";

      // Volumetric multi-stop shockwave pressure band
      const bandScale = 0.85 - progress * 0.25;
      const innerR = Math.max(0, radius - sw.bandWidth * bandScale);
      const outerR = Math.max(2, radius + sw.bandWidth * 0.24);
      const grad = ctx.createRadialGradient(
        sw.x,
        sw.y,
        innerR,
        sw.x,
        sw.y,
        outerR,
      );
      grad.addColorStop(0, `rgba(${sw.secondaryRgb}, 0)`);
      grad.addColorStop(0.45, `rgba(${sw.secondaryRgb}, ${0.28 * fade})`);
      grad.addColorStop(0.78, `rgba(${sw.coreRgb}, ${0.72 * fade})`);
      grad.addColorStop(0.9, `rgba(${sw.primaryRgb}, ${0.42 * fade})`);
      grad.addColorStop(1, `rgba(${sw.primaryRgb}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, outerR, 0, Math.PI * 2);
      if (innerR > 1) {
        ctx.arc(sw.x, sw.y, innerR, 0, Math.PI * 2, true);
      }
      ctx.fill();

      // Razor-sharp leading shock crest
      ctx.strokeStyle = `rgba(${sw.coreRgb}, ${0.85 * fade})`;
      ctx.lineWidth = Math.max(1.2, (4.2 - progress * 2.5) * sw.intensity);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Twin chromatic / harmonic refraction rings
      if (sw.chromaticShift && !this.reducedMotion) {
        ctx.strokeStyle = `rgba(${sw.secondaryRgb}, ${0.48 * fade})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, radius * 1.032, 0, Math.PI * 2);
        ctx.stroke();

        const echoR = Math.max(4, radius * 0.955);
        ctx.strokeStyle = `rgba(${sw.primaryRgb}, ${0.42 * fade})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, echoR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // High-energy radial pressure streaks riding behind the crest
      if (sw.radialRays > 0 && !this.reducedMotion && progress < 0.78) {
        const rayInner = Math.max(4, radius - sw.bandWidth * 0.68);
        const rayOuter = radius * 1.04;
        ctx.strokeStyle = `rgba(${sw.coreRgb}, ${0.52 * fade})`;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let k = 0; k < sw.radialRays; k++) {
          const ang = sw.seed + (k * Math.PI * 2) / sw.radialRays;
          ctx.moveTo(
            sw.x + Math.cos(ang) * rayInner,
            sw.y + Math.sin(ang) * rayInner,
          );
          ctx.lineTo(
            sw.x + Math.cos(ang) * rayOuter,
            sw.y + Math.sin(ang) * rayOuter,
          );
        }
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    if (this.floatingTexts.length === 0) return;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";

    for (const ft of this.floatingTexts) {
      const lifeRatio = Math.max(0, ft.life / ft.maxLife);
      const alpha = lifeRatio < 0.35 ? lifeRatio / 0.35 : 1;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ft.x, ft.y);
      if (ft.scale !== 1) {
        ctx.scale(ft.scale, ft.scale);
      }

      ctx.font = `700 ${ft.fontSize}px "JetBrains Mono", monospace`;
      ctx.lineWidth = ft.kind === "score" ? 4 : 3;
      ctx.strokeStyle = "rgba(2, 6, 23, 0.92)";
      ctx.strokeText(ft.text, 0, 0);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, 0, 0);

      if (ft.subtext) {
        const subSize = Math.max(10, Math.round(ft.fontSize * 0.65));
        ctx.font = `700 ${subSize}px "JetBrains Mono", monospace`;
        ctx.lineWidth = 3;
        const subY = ft.fontSize * 0.88;
        ctx.strokeText(ft.subtext, 0, subY);
        ctx.fillStyle = ft.subColor ?? "#38BDF8";
        ctx.fillText(ft.subtext, 0, subY);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private renderReticle(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.mouseX, this.mouseY);
    ctx.strokeStyle = this.mouseDown ? "#F59E0B" : "rgba(226, 232, 240, 0.8)";
    ctx.lineWidth = 1.6;
    const r = this.mouseDown ? 9 : 12;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-r - 4, 0);
    ctx.lineTo(-r + 3, 0);
    ctx.moveTo(r - 3, 0);
    ctx.lineTo(r + 4, 0);
    ctx.moveTo(0, -r - 4);
    ctx.lineTo(0, -r + 3);
    ctx.moveTo(0, r - 3);
    ctx.lineTo(0, r + 4);
    ctx.stroke();

    ctx.fillStyle = "#F59E0B";
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private createDustSprite(rgb: string): HTMLCanvasElement | null {
    if (typeof document === "undefined") return null;
    const size = 64;
    const offscreen = document.createElement("canvas");
    offscreen.width = size;
    offscreen.height = size;
    const octx = offscreen.getContext("2d");
    if (!octx) return null;
    const half = size * 0.5;
    const grad = octx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(${rgb}, 0.55)`);
    grad.addColorStop(0.45, `rgba(${rgb}, 0.2)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    octx.fillStyle = grad;
    octx.fillRect(0, 0, size, size);
    return offscreen;
  }

  private initBackgroundWeather(): void {
    this.coolDustSprite = this.createDustSprite("56, 189, 248");
    this.warmDustSprite = this.createDustSprite("245, 158, 11");

    // Nebula dust motes: mix of soft diffuse vapor puffs and tiny drifting cosmic specks
    for (let i = 0; i < 58; i++) {
      const isSpeck = i >= 24;
      const windSpeed = 0.008 + Math.random() * 0.016;
      this.nebulaDust.push({
        x: Math.random(),
        y: Math.random(),
        vx: -windSpeed * (0.85 + Math.random() * 0.35),
        vy: windSpeed * (0.35 + Math.random() * 0.25),
        radius: isSpeck ? 1.1 + Math.random() * 1.6 : 18 + Math.random() * 32,
        alpha: isSpeck
          ? 0.1 + Math.random() * 0.14
          : 0.045 + Math.random() * 0.055,
        depth: isSpeck
          ? 0.35 + Math.random() * 0.4
          : 0.15 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        swayFreq: 0.4 + Math.random() * 0.7,
        warm: i % 4 === 0,
        isSpeck,
      });
    }

    // Passing distant asteroid fragments: low-contrast faceted rocks drifting slowly
    for (let i = 0; i < 14; i++) {
      const sides = 5 + (i % 3);
      const vertices: { cos: number; sin: number; scale: number }[] = [];
      for (let v = 0; v < sides; v++) {
        const ang = (v * Math.PI * 2) / sides + (Math.random() - 0.5) * 0.28;
        const scale = 0.68 + Math.random() * 0.36;
        vertices.push({
          cos: Math.cos(ang),
          sin: Math.sin(ang),
          scale,
        });
      }
      const drift = 0.012 + Math.random() * 0.02;
      this.asteroidFragments.push({
        x: Math.random(),
        y: Math.random(),
        vx: -drift * (0.9 + Math.random() * 0.3),
        vy: drift * (0.4 + Math.random() * 0.25),
        radius: 6 + Math.random() * 11,
        depth: 0.22 + Math.random() * 0.35,
        alpha: 0.24 + Math.random() * 0.2,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.45,
        vertices,
      });
    }
  }

  private updateCameraParallax(dt: number): void {
    const scale = this.reducedMotion ? 0.35 : 1;
    const targetPx =
      this.gameState === "PLAYING"
        ? (this.player.x - this.width * 0.5) * 0.14 * scale
        : 0;
    const targetPy =
      this.gameState === "PLAYING"
        ? (this.player.y - this.height * 0.5) * 0.14 * scale
        : 0;
    const lerp = 1 - Math.exp(-5.5 * Math.max(0.001, dt));
    this.bgParallaxX += (targetPx - this.bgParallaxX) * lerp;
    this.bgParallaxY += (targetPy - this.bgParallaxY) * lerp;
  }

  private updateBackgroundWeather(dt: number): void {
    const scale = this.reducedMotion ? 0.25 : 1;
    const step = dt * scale;

    for (const d of this.nebulaDust) {
      d.phase += step * d.swayFreq;
      d.x = (d.x + d.vx * step + 1) % 1;
      d.y = (d.y + (d.vy + Math.sin(d.phase) * 0.0025) * step + 1) % 1;
    }

    for (const a of this.asteroidFragments) {
      a.x = (a.x + a.vx * step + 1) % 1;
      a.y = (a.y + a.vy * step + 1) % 1;
      a.rotation += a.vRot * step;
    }
  }

  private renderBackgroundWeather(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    px: number,
    py: number,
  ): void {
    const pad = 60;
    const spanW = w + pad * 2;
    const spanH = h + pad * 2;

    // 1. Drifting nebula dust puffs and fine cosmic motes
    for (const d of this.nebulaDust) {
      const wx =
        ((((d.x * spanW - px * d.depth) % spanW) + spanW) % spanW) - pad;
      const wy =
        ((((d.y * spanH - py * d.depth) % spanH) + spanH) % spanH) - pad;

      ctx.globalAlpha = d.alpha;
      if (d.isSpeck) {
        ctx.fillStyle = d.warm ? "#F59E0B" : "#94A3B8";
        ctx.fillRect(wx, wy, d.radius, d.radius);
      } else {
        const sprite = d.warm ? this.warmDustSprite : this.coolDustSprite;
        if (sprite) {
          const diam = d.radius * 2;
          ctx.drawImage(sprite, wx - d.radius, wy - d.radius, diam, diam);
        }
      }
    }

    // 2. Passing distant asteroid fragments (dark muted slate silhouettes)
    for (const a of this.asteroidFragments) {
      const ax =
        ((((a.x * spanW - px * a.depth) % spanW) + spanW) % spanW) - pad;
      const ay =
        ((((a.y * spanH - py * a.depth) % spanH) + spanH) % spanH) - pad;

      ctx.save();
      ctx.globalAlpha = a.alpha;
      ctx.translate(ax, ay);
      ctx.rotate(a.rotation);

      ctx.beginPath();
      for (let i = 0; i < a.vertices.length; i++) {
        const v = a.vertices[i];
        const vx = v.cos * a.radius * v.scale;
        const vy = v.sin * a.radius * v.scale;
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();

      ctx.fillStyle = "#162238";
      ctx.fill();
      ctx.strokeStyle = "#263859";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
  }
}
