import { InputController } from "./InputController";
import { buildCurrents, buildMotes, buildPlankton, switchCurrentDirections } from "./Obstacle";
import { createPlayer } from "./Player";
import { trackGameOver, trackGameRetry, trackGameStart, trackHighScore } from "./analytics";
import type {
  AudioState,
  CurrentBoost,
  GameState,
  InputState,
  PlaySoundOptions,
  PulseRingState,
  PulseTiming,
  ResultAnimation,
  ScorePopupKind,
  ScreenPoint,
  SoundOptions,
  WorldState,
} from "./types";

/**
 * 必須DOM要素を取得し、HTML側のID変更や欠落を起動時に検出する。
 * nullチェックをここに集約して、以降のゲーム処理では安全に要素を扱う。
 */
function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }

  return element as T;
}

const canvas = requireElement<HTMLCanvasElement>("gameCanvas");
const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas 2D context is not available.");
}

const ctx = context;

const overlay = requireElement<HTMLDivElement>("overlay");
const startButton = requireElement<HTMLButtonElement>("startButton");
const restartButton = requireElement<HTMLButtonElement>("restartButton");
const goalBanner = requireElement<HTMLDivElement>("resultBanner");
const resultKicker = requireElement<HTMLElement>("resultKicker");
const resultTitle = requireElement<HTMLElement>("resultTitle");
const resultSummary = requireElement<HTMLElement>("resultSummary");
const resultTotalScore = requireElement<HTMLElement>("resultTotalScore");
const resultPlanktonScore = requireElement<HTMLElement>("resultPlanktonScore");
const resultTimeRate = requireElement<HTMLElement>("resultTimeRate");
const resultPlanktonRow = requireElement<HTMLDivElement>("resultPlanktonRow");
const resultTimeRateRow = requireElement<HTMLDivElement>("resultTimeRateRow");
const resultRecord = requireElement<HTMLDivElement>("resultRecord");
const resultRecordLabel = requireElement<HTMLElement>("resultRecordLabel");
const resultMaxScore = requireElement<HTMLElement>("resultMaxScore");
const altitudeLabel = requireElement<HTMLElement>("altitude");
const scoreLabel = requireElement<HTMLElement>("score");
const maxScoreLabel = requireElement<HTMLElement>("maxScore");
const timerLabel = requireElement<HTMLElement>("timer");
const statusLabel = requireElement<HTMLElement>("status");

const TIME_LIMIT_SECONDS = 90;
const PLANKTON_SCORE = 100;
const MIN_TIME_RATE_PERCENT = 100;
const MAX_TIME_RATE_PERCENT = 300;
const MAX_UPWARD_SPEED = -250;
const MAX_SIDE_SPEED = 340;
const SIDE_DRIFT_ACCELERATION = 105;
const SIDE_DRIFT_MAX_SPEED = 78;
const PULSE_SIDE_FORCE = 1.45;
const PULSE_SIDE_BLEND = 0.88;
const MIN_PULSE_SPEED = -95;
const PULSE_RECOVERY_SECONDS = 0.7;
const PULSE_PERFECT_START = 0.86;
const PULSE_PERFECT_END = 1.12;
const PULSE_LATE_WINDOW_SECONDS = 0.36;
const PULSE_COOLDOWN_SECONDS = 0.14;
const MAX_TILT_ANGLE = Math.PI * 0.26;
const TURN_ACCELERATION = 4.4;
const MAX_ROTATION_SPEED = 1.7;

// Licensed audio is loaded as-is. Do not transform, rewrite, or derive new audio files.
const SOUND_FILES = {
  ambient: "sound/environment/wind-in-trees-1.mp3",
  button: "sound/button/決定ボタンを押す42.mp3",
  count: "sound/count/メッセージ表示音2.mp3",
  flowDown: "sound/flow/down/ambiance-waterfall-loop-04.wav",
  flowUp: "sound/flow/up/水ぶくぶく2.mp3",
  pulseNormal: "sound/bubble/late&fast/ルアー着水.mp3",
  pulsePerfect: "sound/bubble/perfect/魚を釣り上げる.mp3",
};

type SoundKey = keyof typeof SOUND_FILES;

/**
 * 音声ファイルからHTMLAudioElementを作成する。
 * 著作権フリー素材の音声自体は加工せず、再生設定だけをここで持つ。
 */
function createSound(src: string, { loop = false, volume = 0.5 }: SoundOptions = {}): HTMLAudioElement {
  const audio = new Audio(src);
  audio.loop = loop;
  audio.preload = "auto";
  audio.volume = volume;
  return audio;
}

const sounds: Record<SoundKey, HTMLAudioElement> = {
  ambient: createSound(SOUND_FILES.ambient, { loop: true, volume: 0.16 }),
  button: createSound(SOUND_FILES.button, { volume: 0.42 }),
  count: createSound(SOUND_FILES.count, { volume: 0.3 }),
  flowDown: createSound(SOUND_FILES.flowDown, { loop: true, volume: 0.14 }),
  flowUp: createSound(SOUND_FILES.flowUp, { loop: true, volume: 0.2 }),
  pulseNormal: createSound(SOUND_FILES.pulseNormal, { volume: 0.32 }),
  pulsePerfect: createSound(SOUND_FILES.pulsePerfect, { volume: 0.36 }),
};

const audioState: AudioState = {
  enabled: false,
  activeFlow: null,
  lastPlayedAt: new WeakMap(),
};

const state: GameState = {
  running: false,
  finished: false,
  pointerQueued: false,
  time: 0,
  cameraY: 0,
  bestAltitude: 0,
  score: 0,
  maxScore: 0,
  runStartMaxScore: 0,
  isNewRecord: false,
  planktonScore: 0,
  timeRemaining: TIME_LIMIT_SECONDS,
  timeRate: 0,
  timeBonus: 0,
  targetAltitude: 3200,
  pulseGlow: 0,
  currentSwitchTimer: 6,
  currentSwitchInterval: 6,
  currentBoost: "-",
};

const input: InputState = {
  left: false,
  right: false,
};

const world: WorldState = {
  width: 1400,
  currents: [],
  plankton: [],
  bubbles: [],
  scorePopups: [],
  motes: [],
};

const player = createPlayer();

/**
 * 最初のユーザー操作後に音声を有効化する。
 * ブラウザの自動再生制限に合わせ、操作前はloadだけに留める。
 */
function unlockAudio(): void {
  if (audioState.enabled) {
    return;
  }

  audioState.enabled = true;
  for (const audio of Object.values(sounds)) {
    audio.load();
  }
}

/**
 * 単発の効果音を安全に再生する。
 * cooldownで連打時の音割れを防ぎ、再生拒否はゲーム進行に影響させない。
 */
function playSound(
  audio: HTMLAudioElement | null,
  { cooldown = 0, restart = true }: PlaySoundOptions = {}
): void {
  if (!audioState.enabled || !audio) {
    return;
  }

  const now = performance.now() / 1000;
  const lastPlayedAt = audioState.lastPlayedAt.get(audio) || 0;
  if (cooldown > 0 && now - lastPlayedAt < cooldown) {
    return;
  }

  audioState.lastPlayedAt.set(audio, now);
  if (restart) {
    audio.currentTime = 0;
  }

  audio.play().catch(() => {
    // Browser autoplay policies can reject playback until the first user gesture.
  });
}

/**
 * BGMや水流音のようなループ音を開始する。
 * すでに再生中なら何もしないことで、同じ音が重ならないようにする。
 */
function playLoop(audio: HTMLAudioElement | null): void {
  if (!audioState.enabled || !audio || !audio.paused) {
    return;
  }

  audio.play().catch(() => {
    // Keep the game resilient if playback is blocked by the browser.
  });
}

/**
 * ループ音を停止して、次回再生時に先頭から鳴るよう戻す。
 */
function stopLoop(audio: HTMLAudioElement | null): void {
  if (!audio) {
    return;
  }

  audio.pause();
  audio.currentTime = 0;
}

/**
 * 現在鳴っている水流音だけを止める。
 * 上向き/下向きの流れが切り替わるたびに呼ばれる。
 */
function stopFlowAudio(): void {
  stopLoop(audioState.activeFlow);
  audioState.activeFlow = null;
}

/**
 * プレイ開始時の環境音を整える。
 * 前回の水流音を残さないため、いったん全て止めてからBGMを流す。
 */
function startGameAudio(): void {
  stopLoop(sounds.ambient);
  stopFlowAudio();
  playLoop(sounds.ambient);
}

/**
 * プレイ終了時にゲーム中のループ音を止める。
 */
function stopGameAudio(): void {
  stopLoop(sounds.ambient);
  stopFlowAudio();
}

/**
 * クラゲが乗っている水流に合わせてループ音を切り替える。
 * 水流外では静かにして、状態変化があった時だけ音を更新する。
 */
function updateFlowAudio(currentName: CurrentBoost): void {
  const nextFlow =
    currentName === "Up Flow" ? sounds.flowUp : currentName === "Down Flow" ? sounds.flowDown : null;

  if (audioState.activeFlow === nextFlow) {
    return;
  }

  stopFlowAudio();
  audioState.activeFlow = nextFlow;
  playLoop(audioState.activeFlow);
}

/**
 * 1プレイ分の状態を初期化する。
 * スコア・タイマー・オブジェクト生成・表示状態をここでまとめてリセットする。
 */
function resetGame(): void {
  Object.assign(player, createPlayer());
  state.running = true;
  state.finished = false;
  state.pointerQueued = true;
  state.time = 0;
  state.cameraY = 0;
  state.bestAltitude = 0;
  state.score = 0;
  state.runStartMaxScore = state.maxScore;
  state.isNewRecord = false;
  state.planktonScore = 0;
  state.timeRemaining = TIME_LIMIT_SECONDS;
  state.timeRate = 0;
  state.timeBonus = 0;
  state.pulseGlow = 0;
  state.currentSwitchTimer = state.currentSwitchInterval;
  state.currentBoost = "-";
  world.currents = buildCurrents(state.targetAltitude);
  world.plankton = buildPlankton();
  world.bubbles = [];
  world.scorePopups = [];
  world.motes = buildMotes(world.width);
  overlay.hidden = true;
  goalBanner.hidden = true;
  goalBanner.classList.remove("is-new-record");
  resetResultScoreboard();
  updateHud();
  startGameAudio();
}

/**
 * CSS上のcanvasサイズと実描画サイズを同期する。
 * devicePixelRatioを考慮して、Retina等でもぼやけにくくする。
 */
function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * 0から1の変化をなめらかにする補間関数。
 * スコア加算や拍動ゲージなど、急に変化させたくない演出で使う。
 */
function smoothStep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * 現在の拍動チャージ量からクリック評価を決める。
 * PERFECT時に最大上昇速度となり、早すぎ/遅すぎは少し弱くなる。
 */
function getPulseTiming(): PulseTiming {
  if (player.pulseCharge < PULSE_PERFECT_START) {
    return {
      label: "EARLY",
      quality: Math.max(0.35, smoothStep(player.pulseCharge / PULSE_PERFECT_START) * 0.86),
    };
  }

  if (player.pulseCharge <= PULSE_PERFECT_END) {
    return {
      label: "PERFECT",
      quality: 1,
    };
  }

  const lateProgress =
    (player.pulseCharge - PULSE_PERFECT_END) /
    (PULSE_LATE_WINDOW_SECONDS / PULSE_RECOVERY_SECONDS);
  return {
    label: "LATE",
    quality: Math.max(0.52, 1 - lateProgress * 0.48),
  };
}

/**
 * 拍動リングの見た目用状態を作る。
 * ゲーム判定とは分けて、PERFECT範囲が視覚的に分かるようにする。
 */
function getPulseRingState(): PulseRingState {
  if (player.pulseCharge < PULSE_PERFECT_START) {
    return {
      charge: player.pulseCharge / PULSE_PERFECT_START,
      late: false,
      perfect: false,
    };
  }

  if (player.pulseCharge <= PULSE_PERFECT_END) {
    return {
      charge: 1,
      late: false,
      perfect: true,
    };
  }

  const lateProgress = Math.min(
    1,
    (player.pulseCharge - PULSE_PERFECT_END) /
      (PULSE_LATE_WINDOW_SECONDS / PULSE_RECOVERY_SECONDS)
  );
  const lateShrink = smoothStep(Math.min(1, lateProgress * 2.2));

  return {
    charge: 0.82 - lateShrink * 0.42,
    late: true,
    perfect: false,
  };
}

/**
 * 取得スコアや拍動評価を、ゲーム画面上に短時間だけ浮かせる。
 */
function addFloatingText(x: number, y: number, text: string, kind: ScorePopupKind = "score"): void {
  world.scorePopups.push({
    x,
    y,
    text,
    kind,
    life: kind === "pulse" ? 0.8 : 1,
  });
}

// リザルトの加算演出は、ゲーム進行状態とは別に持って表示だけを制御する。
const resultAnimation: ResultAnimation = {
  active: false,
  stage: "idle",
  elapsed: 0,
  planktonScore: 0,
  totalScore: 0,
};

/**
 * スコア表示用に整数へ丸め、桁区切りを付ける。
 */
function formatScore(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

/**
 * リザルト画面のスコア表示を初期状態に戻す。
 */
function resetResultScoreboard(): void {
  resultAnimation.active = false;
  resultAnimation.stage = "idle";
  resultAnimation.elapsed = 0;
  resultTotalScore.textContent = "0";
  resultPlanktonScore.textContent = "+0";
  resultTimeRate.textContent = "-";
  resultTotalScore.classList.remove("is-counting");
  resultPlanktonRow.classList.remove("is-active", "is-done");
  resultTimeRateRow.classList.remove("is-active", "is-done");
  updateResultRecord();
}

/**
 * リザルト画面の合計とプランクトン基本点をまとめて反映する。
 */
function setResultScoreValues(total: number, plankton: number): void {
  resultTotalScore.textContent = formatScore(total);
  resultPlanktonScore.textContent = `+${formatScore(plankton)}`;
}

/**
 * BestScore表示と新記録状態の見た目を更新する。
 */
function updateResultRecord(): void {
  resultRecord.classList.toggle("is-new-record", state.isNewRecord);
  resultRecordLabel.textContent = state.isNewRecord ? "NEW RECORD!" : "BestScore";
  resultMaxScore.textContent = formatScore(state.maxScore);
}

/**
 * リザルトのスコア加算アニメーションを開始する。
 * プランクトン基本点を表示してから、タイムレート適用後の合計へ進める。
 */
function startResultScoreAnimation(): void {
  if (state.score === 0) {
    resultAnimation.active = false;
    resultAnimation.stage = "done";
    resultAnimation.elapsed = 0;
    resultAnimation.planktonScore = 0;
    resultAnimation.totalScore = 0;
    resultTimeRate.textContent = "-";
    setResultScoreValues(0, 0);
    updateResultRecord();
    resultSummary.textContent = "Click to retry";
    return;
  }

  resultAnimation.active = true;
  resultAnimation.stage = "plankton";
  resultAnimation.elapsed = 0;
  resultAnimation.planktonScore = state.planktonScore;
  resultAnimation.totalScore = state.score;
  resultTimeRate.textContent = "-";
  setResultScoreValues(0, 0);
  resultTotalScore.classList.add("is-counting");
  resultPlanktonRow.classList.add("is-active");
  resultPlanktonRow.classList.remove("is-done");
  resultTimeRateRow.classList.remove("is-active", "is-done");
  updateResultRecord();
  resultSummary.textContent = state.isNewRecord
    ? "New BestScore! Press Enter to skip"
    : "Press Enter to skip";
  playSound(sounds.count, { cooldown: 0.12 });
}

/**
 * リザルトの加算アニメーションを最後まで進める。
 * Enterキーのスキップ時もここを通り、表示状態を完成形に揃える。
 */
function finishResultScoreAnimation(): void {
  resultAnimation.active = false;
  resultAnimation.stage = "done";
  resultTimeRate.textContent = `${state.timeRate}%`;
  setResultScoreValues(resultAnimation.totalScore, resultAnimation.planktonScore);
  resultTotalScore.classList.remove("is-counting");
  resultPlanktonRow.classList.remove("is-active");
  resultPlanktonRow.classList.add("is-done");
  resultTimeRateRow.classList.remove("is-active");
  resultTimeRateRow.classList.add("is-done");
  updateResultRecord();
  resultSummary.textContent = state.isNewRecord
    ? "New BestScore! Click to retry"
    : "Click to retry";
}

/**
 * リザルトのスコアを時間経過で加算表示する。
 * activeでない時は何もせず、ゲームループから毎フレーム呼べるようにしている。
 */
function updateResultScoreAnimation(deltaTime: number): void {
  if (!resultAnimation.active) {
    return;
  }

  resultAnimation.elapsed += deltaTime;
  const stageDuration = 1.05;
  const progress = smoothStep(resultAnimation.elapsed / stageDuration);

  if (resultAnimation.stage === "plankton") {
    const plankton = resultAnimation.planktonScore * progress;
    setResultScoreValues(plankton, plankton);

    if (progress >= 1) {
      resultPlanktonRow.classList.remove("is-active");
      resultPlanktonRow.classList.add("is-done");
      resultAnimation.stage = "rate";
      resultAnimation.elapsed = 0;
      resultTimeRate.textContent = `${state.timeRate}%`;
      resultTimeRateRow.classList.add("is-active");
      playSound(sounds.count, { cooldown: 0.12 });
    }

    return;
  }

  if (resultAnimation.stage === "rate") {
    const scoreIncrease = resultAnimation.totalScore - resultAnimation.planktonScore;
    const total = resultAnimation.planktonScore + scoreIncrease * progress;
    setResultScoreValues(total, resultAnimation.planktonScore);

    if (progress >= 1) {
      finishResultScoreAnimation();
    }
  }
}

/**
 * クリアまたはタイムアップ時の終了処理を行う。
 * スコア確定、BestScore更新、Analytics送信、リザルト表示までをここで完結させる。
 */
function finishGame(cleared: boolean): void {
  if (state.finished) {
    return;
  }

  state.running = false;
  state.finished = true;

  // 結果種別ごとに、スコア内訳とリザルト文言を確定する。
  if (cleared) {
    const remainingSeconds = Math.ceil(state.timeRemaining);
    const timeRateRange = MAX_TIME_RATE_PERCENT - MIN_TIME_RATE_PERCENT;
    state.timeRate =
      MIN_TIME_RATE_PERCENT +
      Math.floor((remainingSeconds * timeRateRange) / TIME_LIMIT_SECONDS);
    state.score = Math.floor((state.planktonScore * state.timeRate) / 100);
    state.timeBonus = state.score - state.planktonScore;
    state.currentBoost = "-";
    resultKicker.textContent = "Moon layer reached";
    resultTitle.textContent = "Clear";
    goalBanner.classList.remove("is-game-over");
    goalBanner.classList.add("is-clear");
  } else {
    state.timeRate = 0;
    state.timeBonus = 0;
    state.score = 0;
    state.currentBoost = "-";
    resultKicker.textContent = "Time up";
    resultTitle.textContent = "Game Over";
    goalBanner.classList.remove("is-clear");
    goalBanner.classList.add("is-game-over");
  }

  // 1プレイ開始時点のBestScoreと比較して、新記録かどうかを判定する。
  const previousBestScore = state.runStartMaxScore;
  state.isNewRecord = state.score > previousBestScore;
  state.maxScore = Math.max(state.maxScore, state.score);
  const finishParams = {
    score: state.score,
    bestScore: state.maxScore,
    planktonScore: state.planktonScore,
    timeRate: state.timeRate,
    timeBonus: state.timeBonus,
    timeRemaining: Math.ceil(state.timeRemaining),
    altitude: Math.max(0, Math.floor(-player.y)),
  };

  trackGameOver(cleared ? "clear" : "time_up", finishParams);

  // 新記録時だけ追加イベントを送る。ゲーム本体はAnalyticsの有無を意識しない。
  if (state.isNewRecord) {
    trackHighScore({
      ...finishParams,
      previousBestScore,
    });
  }

  // 音と画面表示を終了状態へ切り替え、スコア加算演出を開始する。
  stopGameAudio();
  goalBanner.classList.toggle("is-new-record", state.isNewRecord);
  updateResultRecord();
  goalBanner.hidden = false;
  startResultScoreAnimation();
  updateHud();
}

/**
 * クリック/タップ/開始/リトライを受け取る入口。
 * プレイ中は次フレームで拍動し、停止中はゲーム開始やリトライに使う。
 */
function queuePulse(): void {
  unlockAudio();

  if (!state.running) {
    playSound(sounds.button, { cooldown: 0.08 });

    if (state.finished) {
      resetGame();
      trackGameRetry(state.maxScore);
      trackGameStart(state.maxScore);
      return;
    }

    resetGame();
    trackGameStart(state.maxScore);
    goalBanner.classList.remove("is-clear", "is-game-over", "is-new-record");
    return;
  }

  state.pointerQueued = true;
}

/**
 * クリックタイミングに応じてクラゲを拍動させる。
 * クラゲの傾き方向へ横成分も入れ、PERFECTほど強く上昇する。
 */
function performPulse(): void {
  if (player.pulseCooldown > 0 || state.finished) {
    return;
  }

  const timing = getPulseTiming();
  const timingQuality = timing.quality;
  const pulseSpeed = Math.abs(MIN_PULSE_SPEED + (MAX_UPWARD_SPEED - MIN_PULSE_SPEED) * timingQuality);
  const directionX = Math.sin(player.angle);
  const directionY = -Math.cos(player.angle);
  const targetSpeed = directionY * pulseSpeed;
  const targetSideSpeed = directionX * pulseSpeed * PULSE_SIDE_FORCE;
  const bubbleCount = Math.round(6 + timingQuality * 8);

  if (player.vy > targetSpeed) {
    player.vy = targetSpeed;
  }

  player.vx += (targetSideSpeed - player.vx) * (PULSE_SIDE_BLEND + timingQuality * 0.08);
  player.pulseCooldown = PULSE_COOLDOWN_SECONDS;
  player.pulseCharge = 0;
  player.pulseStretch = 0.48 + timingQuality * 0.52;
  state.pulseGlow = 0.45 + timingQuality * 0.55;

  addFloatingText(player.x, player.y - player.radius * 1.2, timing.label, "pulse");
  playSound(timing.label === "PERFECT" ? sounds.pulsePerfect : sounds.pulseNormal, { cooldown: 0.08 });

  for (let index = 0; index < bubbleCount; index += 1) {
    world.bubbles.push({
      x: player.x + (Math.random() - 0.5) * 24,
      y: player.y + 16 + Math.random() * 24,
      vx: (Math.random() - 0.5) * 40,
      vy: -(40 + Math.random() * 90),
      radius: Math.random() * 6 + 2,
      life: 0.9 + Math.random() * 0.7,
    });
  }
}

/**
 * ゲーム進行の中心となる更新処理。
 * 入力、物理、水流、取得判定、終了判定を毎フレーム同じ順番で処理する。
 */
function update(deltaTime: number): void {
  const dt = Math.min(deltaTime, 0.033);

  // 停止中はリザルト加算演出だけを進め、ゲーム内の物理は止める。
  if (!state.running) {
    updateResultScoreAnimation(dt);
    render();
    return;
  }

  // 経過時間・制限時間・拍動ゲージなど、毎フレーム進む基礎タイマー。
  state.time += dt;
  state.timeRemaining = Math.max(0, state.timeRemaining - dt);
  player.swayPhase += dt * 2.4;

  if (state.pointerQueued) {
    performPulse();
    state.pointerQueued = false;
  }

  player.pulseCharge = Math.min(
    1 + PULSE_LATE_WINDOW_SECONDS / PULSE_RECOVERY_SECONDS,
    player.pulseCharge + dt / PULSE_RECOVERY_SECONDS
  );

  player.pulseCooldown = Math.max(0, player.pulseCooldown - dt);
  player.pulseStretch = Math.max(0, player.pulseStretch - dt * 3.5);
  state.pulseGlow = Math.max(0, state.pulseGlow - dt * 1.8);
  state.currentSwitchTimer -= dt;

  // 一定時間ごとに水流の上下方向を反転し、単調なルート固定を避ける。
  if (state.currentSwitchTimer <= 0) {
    switchCurrentDirections(world.currents);
    state.currentSwitchTimer = state.currentSwitchInterval;
  }

  // 左右入力は直接移動ではなく、クラゲの傾きと少しの横流れに変換する。
  const steer = Number(input.right) - Number(input.left);
  if (steer !== 0) {
    player.angularVelocity += steer * TURN_ACCELERATION * dt;
    if (player.vx * steer < SIDE_DRIFT_MAX_SPEED) {
      player.vx += steer * SIDE_DRIFT_ACCELERATION * dt;
    }
    player.heading = steer;
  } else {
    player.angularVelocity -= player.angle * 2.1 * dt;
  }

  player.angularVelocity = Math.max(
    -MAX_ROTATION_SPEED,
    Math.min(MAX_ROTATION_SPEED, player.angularVelocity)
  );
  player.angle += player.angularVelocity * dt;
  player.angularVelocity *= Math.pow(0.18, dt);

  if (player.angle < -MAX_TILT_ANGLE) {
    player.angle = -MAX_TILT_ANGLE;
    player.angularVelocity *= 0.25;
  } else if (player.angle > MAX_TILT_ANGLE) {
    player.angle = MAX_TILT_ANGLE;
    player.angularVelocity *= 0.25;
  }

  if (steer === 0 && Math.abs(player.angularVelocity) < 0.02) {
    player.angularVelocity = 0;
  }

  // 入力がない時の揺らぎ、重力による沈下、速度の減衰をまとめて適用する。
  const idleWobble = Math.sin(state.time * 2.4 + player.swayPhase) * 12;
  player.vx += idleWobble * dt;
  player.vy += 74 * dt;
  player.vx *= 0.986;
  player.vy *= 0.991;

  let strongestCurrent = 0;
  let currentName: CurrentBoost = "-";

  // 近くの水流に入っている時だけ、上下の力と横ドリフトを受ける。
  for (const current of world.currents) {
    const inColumn = Math.abs(player.x - current.x) < current.width * 0.5;
    const nearHeight = Math.abs(player.y - current.y) < 160;

    if (!inColumn || !nearHeight) {
      continue;
    }

    const horizontalFactor = 1 - Math.abs(player.x - current.x) / (current.width * 0.5);
    const verticalFactor = 1 - Math.abs(player.y - current.y) / 160;
    const lift = current.strength * horizontalFactor * verticalFactor;

    player.vy += current.direction * lift * dt * 12;
    player.vx += current.drift * dt;

    if (lift > strongestCurrent) {
      strongestCurrent = lift;
      currentName = current.direction < 0 ? "Up Flow" : "Down Flow";
    }
  }

  // 背景粒子はカメラ範囲から外れたら上方へ戻し、少ない数で流れ続けて見せる。
  for (const mote of world.motes) {
    mote.y += mote.speed * dt;
    if (mote.y - state.cameraY > canvas.clientHeight * 0.7) {
      mote.y = state.cameraY - canvas.clientHeight - Math.random() * 900;
      mote.x = Math.random() * world.width - world.width / 2;
    }
  }

  // プランクトンを泳がせ、クラゲとの接触時にスコアと小さな上昇を与える。
  for (const item of world.plankton) {
    if (item.taken) {
      continue;
    }

    item.x = item.baseX + Math.sin(state.time * item.swimSpeed + item.phase) * item.driftRadius;
    item.y = item.baseY + Math.cos(state.time * item.swimSpeed * 0.72 + item.phase) * item.bobRadius;

    const distance = Math.hypot(player.x - item.x, player.y - item.y);
    if (distance < player.radius + item.radius + 8) {
      item.taken = true;
      state.planktonScore += PLANKTON_SCORE;
      state.score += PLANKTON_SCORE;
      player.vy -= 70;
      state.pulseGlow = Math.min(1, state.pulseGlow + 0.55);
      addFloatingText(item.x, item.y, `+${PLANKTON_SCORE}`);
      playSound(sounds.count, { cooldown: 0.05 });
    }
  }

  // 泡と浮き文字は寿命を減らしながら動かし、寿命切れで配列から取り除く。
  world.bubbles = world.bubbles.filter((bubble) => {
    bubble.life -= dt;
    bubble.x += bubble.vx * dt;
    bubble.y += bubble.vy * dt;
    bubble.vy -= 24 * dt;
    return bubble.life > 0;
  });

  world.scorePopups = world.scorePopups.filter((popup) => {
    popup.life -= dt;
    popup.y -= 34 * dt;
    return popup.life > 0;
  });

  // 速度制限、座標更新、左右端での跳ね返りを最後にまとめて反映する。
  player.vy = Math.max(player.vy, MAX_UPWARD_SPEED);
  player.vx = Math.max(-MAX_SIDE_SPEED, Math.min(MAX_SIDE_SPEED, player.vx));
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const boundary = world.width / 2 - 70;
  if (player.x < -boundary) {
    player.x = -boundary;
    player.vx *= -0.2;
  } else if (player.x > boundary) {
    player.x = boundary;
    player.vx *= -0.2;
  }

  // 高度とカメラを更新し、ゴール到達または時間切れなら即座に終了する。
  state.bestAltitude = Math.max(state.bestAltitude, -player.y);
  const desiredCameraY = player.y - canvas.clientHeight * 0.2;
  state.cameraY += (desiredCameraY - state.cameraY) * Math.min(1, dt * 1.9);

  if (state.bestAltitude >= state.targetAltitude) {
    finishGame(true);
    render();
    return;
  }

  if (state.timeRemaining <= 0) {
    finishGame(false);
    render();
    return;
  }

  // HUD、流れの状態音、描画を現在フレームの最終状態に合わせる。
  state.currentBoost = currentName;
  updateFlowAudio(currentName);
  updateHud();
  render();
}

/**
 * 画面上部のHUD表示を現在の状態に合わせて更新する。
 */
function updateHud(): void {
  altitudeLabel.textContent = `${Math.max(0, Math.floor(-player.y))} m`;
  scoreLabel.textContent = state.score.toLocaleString("ja-JP");
  maxScoreLabel.textContent = state.maxScore.toLocaleString("ja-JP");
  timerLabel.textContent = `${Math.ceil(state.timeRemaining)} s`;
  statusLabel.textContent = state.currentBoost;
}

/**
 * 高度に応じて水中から空に近づく背景色へ変化させる。
 */
function renderBackground(): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ascentRatio = Math.min(1, state.bestAltitude / state.targetAltitude);
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, `rgba(${Math.round(76 + ascentRatio * 98)}, ${Math.round(130 + ascentRatio * 70)}, ${Math.round(168 + ascentRatio * 60)}, 1)`);
  background.addColorStop(0.55, `rgba(${Math.round(16 + ascentRatio * 52)}, ${Math.round(61 + ascentRatio * 79)}, ${Math.round(98 + ascentRatio * 96)}, 1)`);
  background.addColorStop(1, "rgba(4, 16, 34, 1)");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.24 + ascentRatio * 0.22;
  ctx.fillStyle = "#d9fbff";
  ctx.beginPath();
  ctx.arc(width * 0.78, height * (0.18 + ascentRatio * 0.16), 90 + ascentRatio * 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawWaterBands(width, height);
}

/**
 * ゆっくり揺れる水の帯を描き、単色背景にならないよう奥行きを足す。
 */
function drawWaterBands(width: number, height: number): void {
  const layers = [
    { color: "rgba(11, 40, 70, 0.48)", height: 0.28, sway: 26, speed: 0.15 },
    { color: "rgba(15, 62, 101, 0.38)", height: 0.48, sway: 32, speed: 0.1 },
    { color: "rgba(89, 179, 204, 0.22)", height: 0.72, sway: 38, speed: 0.06 },
  ];

  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let x = 0; x <= width; x += 18) {
      const y =
        height * layer.height +
        Math.sin(x * 0.012 + state.time * layer.speed + layer.height * 8) * layer.sway;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * ワールド座標をcanvas上のスクリーン座標へ変換する。
 * cameraYの分だけ表示位置をずらし、クラゲが上昇しているように見せる。
 */
function worldToScreen(x: number, y: number): ScreenPoint {
  return {
    x: canvas.clientWidth / 2 + x,
    y: canvas.clientHeight / 2 + (y - state.cameraY),
  };
}

/**
 * 上向き/下向きの水流を描画する。
 * 画面外の水流はスキップして、描画負荷を抑える。
 */
function renderCurrents(): void {
  for (const current of world.currents) {
    const center = worldToScreen(current.x, current.y);

    if (center.y < -200 || center.y > canvas.clientHeight + 200) {
      continue;
    }

    const isUpdraft = current.direction < 0;
    const flowAlpha = 0.18 + Math.sin(state.time * 2 + current.phase) * 0.04;
    // 流れの範囲を淡い楕円グラデーションで示す。
    const gradient = ctx.createLinearGradient(center.x, center.y - 170, center.x, center.y + 170);
    gradient.addColorStop(0, isUpdraft ? "rgba(155, 236, 255, 0)" : "rgba(255, 164, 148, 0)");
    gradient.addColorStop(0.5, isUpdraft ? `rgba(155, 236, 255, ${flowAlpha})` : `rgba(255, 164, 148, ${flowAlpha})`);
    gradient.addColorStop(1, isUpdraft ? "rgba(155, 236, 255, 0)" : "rgba(255, 164, 148, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, current.width * 0.65, 170, 0, 0, Math.PI * 2);
    ctx.fill();

    // 中央の曲線矢印で、水流の向きと横ドリフトを読めるようにする。
    const startY = isUpdraft ? center.y + 95 : center.y - 95;
    const endY = isUpdraft ? center.y - 95 : center.y + 95;
    const arrowDirection = isUpdraft ? -1 : 1;

    ctx.strokeStyle = isUpdraft ? "rgba(205, 247, 255, 0.34)" : "rgba(255, 205, 190, 0.34)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x, startY);
    ctx.quadraticCurveTo(center.x + current.drift * 0.8, center.y, center.x, endY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(center.x, endY);
    ctx.lineTo(center.x - 9, endY - arrowDirection * 14);
    ctx.moveTo(center.x, endY);
    ctx.lineTo(center.x + 9, endY - arrowDirection * 14);
    ctx.stroke();
  }
}

/**
 * 背景粒子を描画する。
 * 判定を持たない演出なので、画面外の粒子は単純に描かない。
 */
function renderMotes(): void {
  for (const mote of world.motes) {
    const point = worldToScreen(mote.x, mote.y);

    if (point.y < -20 || point.y > canvas.clientHeight + 20) {
      continue;
    }

    ctx.fillStyle = `rgba(220, 251, 255, ${mote.alpha})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, mote.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 未取得のプランクトンを発光付きで描画する。
 */
function renderPlankton(): void {
  for (const item of world.plankton) {
    if (item.taken) {
      continue;
    }

    const point = worldToScreen(item.x, item.y);

    if (point.y < -40 || point.y > canvas.clientHeight + 40) {
      continue;
    }

    const pulse = 0.55 + Math.sin(state.time * 3.2 + item.phase) * 0.18;
    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, item.radius * 3.5);
    gradient.addColorStop(0, `rgba(255, 250, 186, ${0.95 * pulse})`);
    gradient.addColorStop(1, "rgba(255, 250, 186, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, item.radius * 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 245, 163, ${0.8 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * スコア取得や拍動評価の浮き文字を描画する。
 * pulse系はEARLY/PERFECT/LATEで色と光り方を変える。
 */
function renderScorePopups(): void {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const popup of world.scorePopups) {
    const point = worldToScreen(popup.x, popup.y);
    const alpha = Math.max(0, popup.life);

    if (popup.kind === "pulse") {
      const isPerfect = popup.text === "PERFECT";
      const isLate = popup.text === "LATE";
      ctx.font = '800 22px "Yu Gothic", "Hiragino Sans", "Meiryo", sans-serif';
      ctx.fillStyle = isPerfect
        ? `rgba(164, 241, 255, ${alpha})`
        : isLate
          ? `rgba(255, 196, 180, ${alpha})`
          : `rgba(255, 232, 160, ${alpha})`;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = isPerfect ? 24 : 16;
    } else {
      ctx.font = '700 18px "Yu Gothic", "Hiragino Sans", "Meiryo", sans-serif';
      ctx.fillStyle = `rgba(255, 250, 186, ${alpha})`;
      ctx.shadowColor = `rgba(255, 250, 186, ${alpha})`;
      ctx.shadowBlur = 14;
    }

    ctx.fillText(popup.text, point.x, point.y);
  }

  ctx.restore();
}

/**
 * 拍動時に発生した泡を描画する。
 */
function renderBubbles(): void {
  ctx.save();
  ctx.strokeStyle = "rgba(215, 248, 255, 0.7)";
  ctx.lineWidth = 1.3;

  for (const bubble of world.bubbles) {
    const point = worldToScreen(bubble.x, bubble.y);
    if (point.y < -30 || point.y > canvas.clientHeight + 30) {
      continue;
    }

    ctx.globalAlpha = Math.max(0, bubble.life);
    ctx.beginPath();
    ctx.arc(point.x, point.y, bubble.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * クラゲ本体を描画する。
 * 拍動リング、触手、本体の順に重ねて、クラゲらしい柔らかさを出す。
 */
function renderJellyfish(): void {
  const point = worldToScreen(player.x, player.y);
  const stretch = player.pulseStretch;
  const bellHeight = player.radius * (1.18 - stretch * 0.38);
  const bellWidth = player.radius * (1 + stretch * 0.24);
  const driftTilt = Math.max(-0.09, Math.min(0.09, player.vx / 900));
  const sway = Math.sin(state.time * 3.1) * 8;

  ctx.save();
  ctx.translate(point.x + sway, point.y);
  ctx.rotate(player.angle + driftTilt);

  // 拍動直後の発光と、クリックタイミングを読むためのリングを描く。
  const glow = ctx.createRadialGradient(0, 0, player.radius * 0.15, 0, 0, player.radius * 2.4);
  glow.addColorStop(0, `rgba(249, 216, 255, ${0.38 + state.pulseGlow * 0.18})`);
  glow.addColorStop(1, "rgba(249, 216, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -8, player.radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  const ring = getPulseRingState();
  const ringAlpha = ring.perfect ? 0.62 + Math.sin(state.time * 8) * 0.1 : 0.12 + ring.charge * 0.36;
  ctx.strokeStyle = ring.late
    ? `rgba(255, 196, 180, ${ringAlpha})`
    : `rgba(164, 241, 255, ${ringAlpha})`;
  ctx.lineWidth = 1.5 + ring.charge * 2.8;
  ctx.beginPath();
  ctx.arc(0, -6, player.radius * (1.18 + ring.charge * 0.34), 0, Math.PI * 2);
  ctx.stroke();

  // 触手は速度と時間で曲げ、直線的なキャラクターに見えないようにする。
  for (let index = 0; index < 7; index += 1) {
    const offsetX = -player.radius * 0.62 + index * (player.radius * 0.21);
    const tentacleLength = 90 + index * 12 + Math.sin(state.time * 3 + index) * 9;

    ctx.strokeStyle = `rgba(243, 183, 255, ${0.32 + index * 0.04})`;
    ctx.lineWidth = 2 + ((index + 1) % 2) * 1.2;
    ctx.beginPath();
    ctx.moveTo(offsetX, player.radius * 0.44);
    ctx.bezierCurveTo(
      offsetX + Math.sin(state.time * 2.4 + index) * 18,
      player.radius * 0.9,
      offsetX - player.vx * 0.03 + Math.cos(state.time * 2 + index) * 24,
      player.radius + tentacleLength * 0.52,
      offsetX + Math.sin(state.time * 3.2 + index * 1.5) * 14,
      player.radius + tentacleLength
    );
    ctx.stroke();
  }

  // 傘部分は拍動時に少し潰して、クリックの反動を視覚的に伝える。
  const bell = ctx.createLinearGradient(0, -bellHeight, 0, player.radius * 0.7);
  bell.addColorStop(0, "#fff6ff");
  bell.addColorStop(0.55, "#f3b7ff");
  bell.addColorStop(1, "#9ee7ff");

  ctx.fillStyle = bell;
  ctx.beginPath();
  ctx.moveTo(-bellWidth, 0);
  ctx.quadraticCurveTo(-bellWidth * 0.76, -bellHeight, 0, -bellHeight * 0.98);
  ctx.quadraticCurveTo(bellWidth * 0.76, -bellHeight, bellWidth, 0);
  ctx.quadraticCurveTo(0, player.radius * 0.84, -bellWidth, 0);
  ctx.closePath();
  ctx.fill();

  // 最後にハイライトを重ね、半透明のぷにっとした質感を足す。
  ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
  ctx.beginPath();
  ctx.ellipse(-bellWidth * 0.22, -bellHeight * 0.34, bellWidth * 0.28, bellHeight * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * ゴール高度が近づいた時に、目標ラインを描画する。
 */
function renderDepthGuide(): void {
  const topTarget = worldToScreen(0, -state.targetAltitude);

  if (topTarget.y > -100 && topTarget.y < canvas.clientHeight + 100) {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(0, topTarget.y);
    ctx.lineTo(canvas.clientWidth, topTarget.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255, 255, 255, 0.76)";
    ctx.font = '700 14px "Yu Gothic", "Hiragino Sans", "Meiryo", sans-serif';
    ctx.fillText("Moon Layer", 18, topTarget.y - 12);
    ctx.restore();
  }
}

/**
 * 1フレーム分の描画を決まった順番で実行する。
 * 背景から前景へ重ねることで、表示の前後関係を保つ。
 */
function render(): void {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  renderBackground();
  renderMotes();
  renderCurrents();
  renderPlankton();
  renderBubbles();
  renderDepthGuide();
  renderJellyfish();
  renderScorePopups();
}

let lastFrame = performance.now();
let initialized = false;

/**
 * requestAnimationFrameから呼ばれるメインループ。
 * 前フレームとの差分秒だけをupdateへ渡す。
 */
function tick(now: number): void {
  const deltaTime = (now - lastFrame) / 1000;
  lastFrame = now;
  update(deltaTime);
  requestAnimationFrame(tick);
}

/**
 * ゲーム全体の初期化入口。
 * 入力イベント、初期ワールド生成、初回描画、メインループ開始を一度だけ行う。
 */
export function initializeGame(): void {
  if (initialized) {
    return;
  }

  initialized = true;

  const inputController = new InputController({
    input,
    canvas,
    startButton,
    restartButton,
    resultBanner: goalBanner,
    onPulse: queuePulse,
    onSkipResult: () => {
      if (!resultAnimation.active) {
        return false;
      }

      unlockAudio();
      playSound(sounds.button, { cooldown: 0.08 });
      finishResultScoreAnimation();
      return true;
    },
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    render();
  });

  inputController.bind();
  resizeCanvas();
  world.currents = buildCurrents(state.targetAltitude);
  world.plankton = buildPlankton();
  world.motes = buildMotes(world.width);
  updateHud();
  render();
  requestAnimationFrame(tick);
}
