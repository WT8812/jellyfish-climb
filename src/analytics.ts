type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;
type Gtag = (...args: [string, ...unknown[]]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

interface ScoreParams {
  score: number;
  bestScore: number;
  planktonScore: number;
  timeRate: number;
  timeBonus: number;
  timeRemaining: number;
  altitude: number;
}

interface HighScoreParams extends ScoreParams {
  previousBestScore: number;
}

const GA_SCRIPT_BASE_URL = "https://www.googletagmanager.com/gtag/js";
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

let initialized = false;

/**
 * GA測定IDが設定されているかだけを見る。
 * 未設定時はAnalytics処理全体をno-opにする。
 */
function isAnalyticsEnabled(): boolean {
  return Boolean(measurementId);
}

/**
 * GA4のgtagスクリプトをページに追加する。
 * 測定IDはURLエンコードして、環境変数由来の文字列をそのまま連結しない。
 */
function appendGoogleAnalyticsScript(id: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = `${GA_SCRIPT_BASE_URL}?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}

/**
 * GAイベントに送る値からundefinedだけを除外する。
 * nullは「空値として送る」意図があり得るため残す。
 */
function toEventParams(params: AnalyticsParams): AnalyticsParams {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  );
}

/**
 * ゲーム側から使う共通のイベント送信口。
 * 初期化されていない場合は安全に何もしない。
 */
function trackEvent(name: string, params: AnalyticsParams = {}): void {
  if (!initialized || !window.gtag) {
    return;
  }

  window.gtag("event", name, toEventParams(params));
}

/**
 * GA4を初期化する。
 * VITE_GA_MEASUREMENT_IDがないローカル開発や公開前環境では読み込まない。
 */
export function initializeAnalytics(): void {
  if (initialized || !isAnalyticsEnabled()) {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args) => {
    window.dataLayer?.push(args);
  };

  appendGoogleAnalyticsScript(measurementId);
  window.gtag("js", new Date());
  window.gtag("config", measurementId);
  initialized = true;
}

/**
 * プレイ開始を記録する。
 * その時点のBestScoreだけを添えて、個人情報は送らない。
 */
export function trackGameStart(bestScore: number): void {
  trackEvent("game_start", {
    best_score: bestScore,
  });
}

/**
 * リトライ操作を記録する。
 * 開始イベントとは分けて、遊び直しの頻度を後から見られるようにする。
 */
export function trackGameRetry(bestScore: number): void {
  trackEvent("game_retry", {
    best_score: bestScore,
  });
}

/**
 * クリアまたはタイムアップを記録する。
 * スコア内訳と到達高度だけを送り、ゲーム改善に必要な最小限の値に絞る。
 */
export function trackGameOver(result: "clear" | "time_up", params: ScoreParams): void {
  trackEvent("game_over", {
    result,
    score: params.score,
    best_score: params.bestScore,
    plankton_score: params.planktonScore,
    time_rate_percent: params.timeRate,
    time_bonus: params.timeBonus,
    time_remaining: params.timeRemaining,
    altitude: params.altitude,
  });
}

/**
 * BestScore更新時だけ追加で記録する。
 * 通常のgame_overと分けることで、更新率を見やすくする。
 */
export function trackHighScore(params: HighScoreParams): void {
  trackEvent("high_score", {
    score: params.score,
    previous_best_score: params.previousBestScore,
    best_score: params.bestScore,
    plankton_score: params.planktonScore,
    time_rate_percent: params.timeRate,
    time_bonus: params.timeBonus,
    time_remaining: params.timeRemaining,
    altitude: params.altitude,
  });
}
