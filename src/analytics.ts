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

interface PlayEntryContext {
  entrySource: string;
  sourcePage: string;
  journeyOrigin: string;
  journeyOriginPage: string;
  siteLanguage: string;
  recordedAt: number;
}

export type GameplayInputMethod = "pointer" | "keyboard";
export type GameStartType = "new" | "retry";

const GA_SCRIPT_BASE_URL = "https://www.googletagmanager.com/gtag/js";
const PLAY_ENTRY_STORAGE_KEY = "jellyfish-climb-play-entry-v1";
const PLAY_ENTRY_MAX_AGE_MS = 30 * 60 * 1000;
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

let initialized = false;
let siteAnalyticsInitialized = false;
let activePlayEntry: PlayEntryContext | null = null;
const developmentEventLog: Array<{ name: string; params: AnalyticsParams }> = [];

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
 * canonical URLを基準に、GA4のContent groupへ送るページ分類を返す。
 * GitHub Pagesのサブディレクトリや将来の独自ドメインに依存しない。
 */
function getContentGroup(): string {
  const canonicalHref =
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
    window.location.href;
  const pathname = new URL(canonicalHref, window.location.href).pathname.toLowerCase();
  const routeGroups: Array<[RegExp, string]> = [
    [/\/development-story\/?$/, "development_story"],
    [/\/how-to-play\/?$/, "how_to_play"],
    [/\/ja\/play\/?$/, "play_landing"],
    [/\/play\/?$/, "game"],
    [/\/updates\/?$/, "updates"],
    [/\/privacy\/?$/, "privacy"],
    [/\/contact\/?$/, "contact"],
    [/\/terms\/?$/, "terms"],
    [/\/about\/?$/, "about"],
    [/\/faq\/?$/, "faq"],
    [/\/404(?:\.html)?\/?$/, "not_found"],
  ];

  return routeGroups.find(([pattern]) => pattern.test(pathname))?.[1] ?? "home";
}

function getSiteLanguage(): string {
  return document.documentElement.lang.toLowerCase().startsWith("ja") ? "ja" : "en";
}

function normalizeEventLabel(value: string | undefined, fallback: string): string {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function readStoredPlayEntry(): PlayEntryContext | null {
  try {
    const rawValue = window.sessionStorage.getItem(PLAY_ENTRY_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<PlayEntryContext>;
    const isValid =
      typeof parsed.entrySource === "string" &&
      typeof parsed.sourcePage === "string" &&
      typeof parsed.journeyOrigin === "string" &&
      typeof parsed.journeyOriginPage === "string" &&
      typeof parsed.siteLanguage === "string" &&
      typeof parsed.recordedAt === "number" &&
      Date.now() - parsed.recordedAt <= PLAY_ENTRY_MAX_AGE_MS;

    if (!isValid) {
      window.sessionStorage.removeItem(PLAY_ENTRY_STORAGE_KEY);
      return null;
    }

    return parsed as PlayEntryContext;
  } catch {
    return null;
  }
}

function storePlayEntry(context: PlayEntryContext): void {
  try {
    window.sessionStorage.setItem(PLAY_ENTRY_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Storageが使えない環境でも、画面遷移とAnalytics本体は止めない。
  }
}

function consumePlayEntry(): PlayEntryContext {
  const storedEntry = readStoredPlayEntry();

  try {
    window.sessionStorage.removeItem(PLAY_ENTRY_STORAGE_KEY);
  } catch {
    // 読み出し後の削除に失敗しても、計測やゲーム開始には影響させない。
  }

  return (
    storedEntry ?? {
      entrySource: "direct_or_external",
      sourcePage: "external",
      journeyOrigin: "direct_or_external",
      journeyOriginPage: "external",
      siteLanguage: getSiteLanguage(),
      recordedAt: Date.now(),
    }
  );
}

function getActivePlayEntry(): PlayEntryContext {
  activePlayEntry ??= consumePlayEntry();
  return activePlayEntry;
}

function getPlayEntryParams(): AnalyticsParams {
  const entry = getActivePlayEntry();
  return {
    entry_source: entry.entrySource,
    source_page: entry.sourcePage,
    journey_origin: entry.journeyOrigin,
    journey_origin_page: entry.journeyOriginPage,
    site_language: entry.siteLanguage,
  };
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
  const eventParams = toEventParams(params);

  if (import.meta.env.DEV) {
    developmentEventLog.push({ name, params: eventParams });
    document.documentElement.dataset.analyticsEvents = JSON.stringify(
      developmentEventLog.slice(-20)
    );
  }

  if (!initialized || !window.gtag) {
    return;
  }

  window.gtag("event", name, eventParams);
}

/**
 * GA4を初期化する。
 * VITE_GA_MEASUREMENT_IDがないローカル開発や公開前環境では読み込まない。
 */
export function initializeAnalytics(): void {
  const contentGroup = getContentGroup();

  if (import.meta.env.DEV) {
    document.documentElement.dataset.analyticsContentGroup = contentGroup;
    document.documentElement.dataset.analyticsEnabled = String(isAnalyticsEnabled());
  }

  if (initialized || !isAnalyticsEnabled()) {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function (..._args) {
    window.dataLayer?.push(arguments);
  };

  appendGoogleAnalyticsScript(measurementId);
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    content_group: contentGroup,
  });
  initialized = true;
}

/**
 * サイト内のゲーム導線を記録する。
 * 直前の入口と最初の入口をsessionStorageへ保持し、実ゲーム側のイベントへ引き継ぐ。
 */
export function initializeSiteAnalytics(): void {
  if (siteAnalyticsInitialized) {
    return;
  }

  siteAnalyticsInitialized = true;
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link) {
      return;
    }

    const destinationUrl = new URL(link.href, window.location.href);
    if (
      destinationUrl.origin !== window.location.origin ||
      !/\/play\/?$/.test(destinationUrl.pathname)
    ) {
      return;
    }

    const existingEntry = readStoredPlayEntry();
    const sourcePage = getContentGroup();
    const entrySource = normalizeEventLabel(
      link.dataset.playSource ??
        (link.classList.contains("site-nav__play") ? "header_nav" : undefined),
      "content_link"
    );
    const destination = /\/ja\/play\/?$/.test(destinationUrl.pathname)
      ? "play_landing"
      : "game";
    const context: PlayEntryContext = {
      entrySource,
      sourcePage,
      journeyOrigin: existingEntry?.journeyOrigin ?? entrySource,
      journeyOriginPage: existingEntry?.journeyOriginPage ?? sourcePage,
      siteLanguage: getSiteLanguage(),
      recordedAt: Date.now(),
    };

    storePlayEntry(context);
    trackEvent("play_intent", {
      entry_source: context.entrySource,
      source_page: context.sourcePage,
      journey_origin: context.journeyOrigin,
      journey_origin_page: context.journeyOriginPage,
      destination,
      site_language: context.siteLanguage,
    });
  });
}

/**
 * 実ゲーム画面まで到達したことを記録する。
 */
export function trackGameEntry(): void {
  trackEvent("game_entry", getPlayEntryParams());
}

/**
 * プレイ開始を記録する。
 * 入口と新規/リトライを添えて、導線ごとの開始率を確認できるようにする。
 */
export function trackGameStart(bestScore: number, startType: GameStartType): void {
  trackEvent("game_start", {
    ...getPlayEntryParams(),
    best_score: bestScore,
    start_type: startType,
  });
}

/**
 * リトライ操作を記録する。
 * 開始イベントとは分けて、遊び直しの頻度を後から見られるようにする。
 */
export function trackGameRetry(bestScore: number): void {
  trackEvent("game_retry", {
    ...getPlayEntryParams(),
    best_score: bestScore,
  });
}

/**
 * Start後に初めて行われたプレイ入力を記録する。
 * Startだけ押して離脱したケースと、実際に操作したケースを区別する。
 */
export function trackGameFirstInput(
  inputMethod: GameplayInputMethod,
  timeRemaining: number,
  altitude: number
): void {
  trackEvent("game_first_input", {
    ...getPlayEntryParams(),
    input_method: inputMethod,
    time_remaining: Math.ceil(timeRemaining),
    altitude: Math.max(0, Math.floor(altitude)),
  });
}

/**
 * コースの25%・50%・75%到達を記録し、プレイの継続度を確認できるようにする。
 */
export function trackGameProgress(
  milestoneAltitude: number,
  timeRemaining: number,
  planktonScore: number
): void {
  trackEvent("game_progress", {
    ...getPlayEntryParams(),
    milestone_altitude: milestoneAltitude,
    time_remaining: Math.ceil(timeRemaining),
    plankton_score: planktonScore,
  });
}

/**
 * クリアまたはタイムアップを記録する。
 * スコア内訳と到達高度だけを送り、ゲーム改善に必要な最小限の値に絞る。
 */
export function trackGameOver(result: "clear" | "time_up", params: ScoreParams): void {
  trackEvent("game_over", {
    ...getPlayEntryParams(),
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
    ...getPlayEntryParams(),
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
