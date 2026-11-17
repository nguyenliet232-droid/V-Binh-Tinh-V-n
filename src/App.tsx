import { useCallback, useEffect, useRef, useState } from "react";
import { GameHud } from "./components/GameHud";
import {
  AchievementsModal,
  DailyChallengeModal,
  GameOverModal,
  PausedModal,
  RoundSummaryModal,
} from "./components/GameModals";
import { TitleScreen } from "./components/TitleScreen";
import { loadAchievementProgress } from "./game/achievements";
import { soundEngine } from "./game/audio";
import { generateDailyChallenge } from "./game/dailyChallenge";
import { GameEngine } from "./game/engine";
import { loadDailyLeaderboard, loadLeaderboard } from "./game/leaderboard";
import type {
  AchievementProgressState,
  AchievementUnlockEvent,
  DailyChallengeSpec,
  DailyLeaderboardEntry,
  DifficultyMode,
  GameState,
  HudSnapshot,
  LeaderboardEntry,
  RunSummary,
  ShipId,
  UpgradeId,
  UpgradeOption,
} from "./game/types";
import { rollUpgradeChoices } from "./game/upgrades";

const SHIP_STORAGE_KEY = "vb_starforge_selected_ship";

function loadSavedShip(): ShipId {
  try {
    const raw = window.localStorage.getItem(SHIP_STORAGE_KEY);
    if (raw === "interceptor" || raw === "striker" || raw === "aegis") {
      return raw;
    }
  } catch {
    // Ignore storage errors
  }
  return "interceptor";
}

const INITIAL_HUD: HudSnapshot = {
  mode: "standard",
  shipId: "interceptor",
  bossRushUpgradesLeft: 0,
  hp: 4,
  maxHp: 4,
  shield: 2,
  maxShield: 2,
  shieldRechargeProgress: 0,
  shieldRechargeRemaining: 0,
  shieldRechargeBlockedByBoss: false,
  empCharge: 50,
  dashActive: false,
  dashInvulnRemaining: 0,
  dashCooldownRatio: 1,
  dashCooldownSeconds: 0,
  timeDilationActive: false,
  timeDilationRemaining: 0,
  timeDilationCooldownRatio: 1,
  timeDilationCooldownSeconds: 0,
  score: 0,
  highScore: 0,
  wave: 1,
  enemiesRemaining: 0,
  combo: 1,
  comboTimerRatio: 0,
  kills: 0,
  coresCollected: 0,
  overdriveTimer: 0,
  bossActive: false,
  bossName: "Lõi Thống Lĩnh",
  bossHp: 0,
  bossMaxHp: 1,
  bossStage: 1,
  activeUpgrades: {},
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const toastTimersRef = useRef<number[]>([]);

  const [gameState, setGameState] = useState<GameState>("TITLE_MENU");
  const gameStateRef = useRef<GameState>("TITLE_MENU");
  const [difficulty, setDifficulty] = useState<"standard" | "ace">("standard");
  const [activeMode, setActiveMode] = useState<DifficultyMode>("standard");
  const [selectedShip, setSelectedShip] = useState<ShipId>(() =>
    loadSavedShip(),
  );
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [highScore, setHighScore] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    loadLeaderboard(),
  );
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeSpec>(() =>
    generateDailyChallenge(),
  );
  const [dailyLeaderboard, setDailyLeaderboard] = useState<
    DailyLeaderboardEntry[]
  >(() => loadDailyLeaderboard());
  const [achievementProgress, setAchievementProgress] =
    useState<AchievementProgressState>(() => loadAchievementProgress());
  const [achievementToasts, setAchievementToasts] = useState<
    AchievementUnlockEvent[]
  >([]);
  const [achievementsOpen, setAchievementsOpen] = useState<boolean>(false);
  const [dailyModalOpen, setDailyModalOpen] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(() => soundEngine.isMuted());

  const [clearedWave, setClearedWave] = useState<number>(1);
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeOption[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

  const refreshDailyState = useCallback(() => {
    const todaySpec = generateDailyChallenge();
    setDailyChallenge(todaySpec);
    setDailyLeaderboard(loadDailyLeaderboard(todaySpec.dateKey));
  }, []);

  const syncGameState = useCallback((next: GameState) => {
    gameStateRef.current = next;
    setGameState(next);
    engineRef.current?.setGameState(next);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
        if (snapshot.mode !== "daily") {
          setHighScore(snapshot.highScore);
        }
      },
      onWaveCleared: (waveNum) => {
        setAchievementProgress(loadAchievementProgress());
        const stacks = engine.getActiveUpgrades();
        const choices = rollUpgradeChoices(stacks, 3);
        if (choices.length === 0) {
          // All upgrades maxed: advance to next wave without offering upgrades
          engine.advanceWithoutUpgrade();
          syncGameState("PLAYING");
          return;
        }
        setClearedWave(waveNum);
        setUpgradeChoices(choices);
        gameStateRef.current = "ROUND_SUMMARY";
        setGameState("ROUND_SUMMARY");
      },
      onGameOver: (summary) => {
        setRunSummary(summary);
        if (summary.mode !== "daily") {
          setHighScore(summary.highScore);
        }
        setLeaderboard(loadLeaderboard());
        refreshDailyState();
        setAchievementProgress(loadAchievementProgress());
        gameStateRef.current = "GAME_OVER";
        setGameState("GAME_OVER");
      },
      onPauseToggle: () => {
        if (gameStateRef.current === "PLAYING") {
          syncGameState("PAUSED");
        } else if (gameStateRef.current === "PAUSED") {
          syncGameState("PLAYING");
        }
      },
      onAchievementUnlocked: (unlocked) => {
        setAchievementProgress(loadAchievementProgress());
        setAchievementToasts((prev) => [...prev.slice(-2), unlocked]);
        const timerId = window.setTimeout(() => {
          setAchievementToasts((prev) =>
            prev.filter(
              (item) =>
                !(
                  item.id === unlocked.id &&
                  item.unlockedAt === unlocked.unlockedAt
                ),
            ),
          );
          toastTimersRef.current = toastTimersRef.current.filter(
            (id) => id !== timerId,
          );
        }, 4500);
        toastTimersRef.current.push(timerId);
      },
    });

    engineRef.current = engine;
    setHighScore(engine.getHighScore());

    return () => {
      for (const timerId of toastTimersRef.current) {
        window.clearTimeout(timerId);
      }
      toastTimersRef.current = [];
      engine.destroy();
      engineRef.current = null;
    };
  }, [refreshDailyState, syncGameState]);

  const handleSelectShip = useCallback((shipId: ShipId) => {
    setSelectedShip(shipId);
    try {
      window.localStorage.setItem(SHIP_STORAGE_KEY, shipId);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const startMode = useCallback(
    (mode: DifficultyMode) => {
      if (!engineRef.current) return;
      if (gameStateRef.current === "PAUSED") {
        setLeaderboard(engineRef.current.commitCurrentRunToLeaderboard());
        refreshDailyState();
      }
      setAchievementsOpen(false);
      setDailyModalOpen(false);
      setActiveMode(mode);
      setRunSummary(null);
      gameStateRef.current = "PLAYING";
      setGameState("PLAYING");
      engineRef.current.startNewGame(mode, selectedShip);
    },
    [refreshDailyState, selectedShip],
  );

  const handleStart = useCallback(() => {
    startMode(difficulty);
  }, [difficulty, startMode]);

  const handleStartBossRush = useCallback(() => {
    startMode("boss_rush");
  }, [startMode]);

  const handleStartDaily = useCallback(() => {
    startMode("daily");
  }, [startMode]);

  const handleRestartMode = useCallback(() => {
    startMode(activeMode);
  }, [activeMode, startMode]);

  const handleToggleMute = useCallback(() => {
    soundEngine.unlock();
    const next = !soundEngine.isMuted();
    soundEngine.setMuted(next);
    setMuted(next);
  }, []);

  const handlePause = useCallback(() => {
    if (gameStateRef.current === "PLAYING") {
      syncGameState("PAUSED");
    }
  }, [syncGameState]);

  const handleResume = useCallback(() => {
    if (gameStateRef.current === "PAUSED") {
      syncGameState("PLAYING");
    }
  }, [syncGameState]);

  const handleQuitToTitle = useCallback(() => {
    if (engineRef.current) {
      setLeaderboard(engineRef.current.commitCurrentRunToLeaderboard());
    }
    refreshDailyState();
    setAchievementProgress(loadAchievementProgress());
    syncGameState("TITLE_MENU");
    setRunSummary(null);
  }, [refreshDailyState, syncGameState]);

  const handleOpenDailyChallenge = useCallback(() => {
    refreshDailyState();
    setAchievementsOpen(false);
    setDailyModalOpen(true);
  }, [refreshDailyState]);

  const handleSelectUpgrade = useCallback((id: UpgradeId) => {
    if (!engineRef.current) return;
    gameStateRef.current = "PLAYING";
    setGameState("PLAYING");
    engineRef.current.applyUpgradeAndContinue(id);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080E1A]">
      {/* Isolated Canvas Viewport Container */}
      <div
        className={`absolute inset-0 ${
          gameState === "PLAYING" ? "cursor-none" : "cursor-default"
        }`}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Title Screen */}
      {gameState === "TITLE_MENU" && (
        <TitleScreen
          highScore={highScore}
          leaderboard={leaderboard}
          dailyChallenge={dailyChallenge}
          dailyLeaderboard={dailyLeaderboard}
          dailyModalOpen={dailyModalOpen}
          onOpenDailyChallenge={handleOpenDailyChallenge}
          difficulty={difficulty}
          onChangeDifficulty={setDifficulty}
          selectedShip={selectedShip}
          onSelectShip={handleSelectShip}
          achievementProgress={achievementProgress}
          achievementsOpen={achievementsOpen}
          onOpenAchievements={() => {
            setDailyModalOpen(false);
            setAchievementsOpen(true);
          }}
          onStart={handleStart}
          onStartBossRush={handleStartBossRush}
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Daily Challenge Briefing & Dedicated Leaderboard Modal */}
      {gameState === "TITLE_MENU" && dailyModalOpen && (
        <DailyChallengeModal
          challenge={dailyChallenge}
          dailyLeaderboard={dailyLeaderboard}
          onStartDaily={handleStartDaily}
          onClose={() => setDailyModalOpen(false)}
        />
      )}

      {/* Achievements Inspection Modal */}
      {gameState === "TITLE_MENU" && achievementsOpen && (
        <AchievementsModal
          progress={achievementProgress}
          onClose={() => setAchievementsOpen(false)}
        />
      )}

      {/* Active Play HUD */}
      {gameState !== "TITLE_MENU" && (
        <GameHud
          hud={hud}
          muted={muted}
          achievementToasts={achievementToasts}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
        />
      )}

      {/* Pause Modal */}
      {gameState === "PAUSED" && (
        <PausedModal
          mode={hud.mode}
          wave={hud.wave}
          score={hud.score}
          onResume={handleResume}
          onRestart={handleRestartMode}
          onQuitToTitle={handleQuitToTitle}
        />
      )}

      {/* Between-Wave Upgrade Selection */}
      {gameState === "ROUND_SUMMARY" && (
        <RoundSummaryModal
          mode={hud.mode}
          upgradesLeft={
            hud.mode === "boss_rush"
              ? hud.bossRushUpgradesLeft
              : (hud.dailyUpgradesLeft ?? undefined)
          }
          waveCleared={clearedWave}
          choices={upgradeChoices}
          currentStacks={hud.activeUpgrades}
          onSelectUpgrade={handleSelectUpgrade}
        />
      )}

      {/* Game Over Modal */}
      {gameState === "GAME_OVER" && runSummary && (
        <GameOverModal
          summary={runSummary}
          onPlayAgain={handleRestartMode}
          onQuitToTitle={handleQuitToTitle}
        />
      )}
    </main>
  );
}
