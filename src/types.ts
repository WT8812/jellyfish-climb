export type CurrentBoost = "-" | "Up Flow" | "Down Flow";
export type PulseLabel = "EARLY" | "PERFECT" | "LATE";
export type ScorePopupKind = "score" | "pulse";
export type ResultAnimationStage = "idle" | "plankton" | "rate" | "done";

// ランダムに生成され、一定時間ごとに上下方向が入れ替わる水流。
export interface Current {
  x: number;
  y: number;
  width: number;
  strength: number;
  drift: number;
  direction: number;
  phase: number;
}

// 取得対象のプランクトン。base座標を中心に小さく泳ぎ続ける。
export interface Plankton {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  phase: number;
  driftRadius: number;
  bobRadius: number;
  swimSpeed: number;
  taken: boolean;
}

// クリック時にクラゲから出る泡の一粒。
export interface Bubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
}

// スコア取得や拍動評価をゲーム画面上へ一時表示する文字。
export interface ScorePopup {
  x: number;
  y: number;
  text: string;
  kind: ScorePopupKind;
  life: number;
}

// 背景に漂う微粒子。奥行き表現だけに使う。
export interface Mote {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
}

// クラゲ本体の位置、速度、拍動、傾きに関する状態。
export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulseCooldown: number;
  pulseCharge: number;
  pulseStretch: number;
  swayPhase: number;
  angle: number;
  angularVelocity: number;
  heading: number;
}

// 1プレイ全体の進行、スコア、HUD、リザルトに関する状態。
export interface GameState {
  running: boolean;
  finished: boolean;
  pointerQueued: boolean;
  time: number;
  cameraY: number;
  bestAltitude: number;
  score: number;
  maxScore: number;
  runStartMaxScore: number;
  isNewRecord: boolean;
  planktonScore: number;
  timeRemaining: number;
  timeRate: number;
  timeBonus: number;
  targetAltitude: number;
  pulseGlow: number;
  currentSwitchTimer: number;
  currentSwitchInterval: number;
  currentBoost: CurrentBoost;
}

// 左右入力の押下状態。クリック/タップは即時コールバックで処理する。
export interface InputState {
  left: boolean;
  right: boolean;
}

// ステージ上に存在する動的オブジェクトの集合。
export interface WorldState {
  width: number;
  currents: Current[];
  plankton: Plankton[];
  bubbles: Bubble[];
  scorePopups: ScorePopup[];
  motes: Mote[];
}

// クリックタイミングの評価結果。qualityは上昇力の倍率に使う。
export interface PulseTiming {
  label: PulseLabel;
  quality: number;
}

// クラゲ周囲の拍動リング表示に必要な状態。
export interface PulseRingState {
  charge: number;
  late: boolean;
  perfect: boolean;
}

// リザルト画面でスコア内訳を順番に加算表示するための状態。
export interface ResultAnimation {
  active: boolean;
  stage: ResultAnimationStage;
  elapsed: number;
  planktonScore: number;
  totalScore: number;
}

// ブラウザの自動再生制限や水流ループ音を管理する状態。
export interface AudioState {
  enabled: boolean;
  activeFlow: HTMLAudioElement | null;
  lastPlayedAt: WeakMap<HTMLAudioElement, number>;
}

// 音声生成時に指定する初期設定。
export interface SoundOptions {
  loop?: boolean;
  volume?: number;
}

// 効果音再生時に指定する再生制御。
export interface PlaySoundOptions {
  cooldown?: number;
  restart?: boolean;
}

// ワールド座標をcanvas上の表示座標へ変換した結果。
export interface ScreenPoint {
  x: number;
  y: number;
}
