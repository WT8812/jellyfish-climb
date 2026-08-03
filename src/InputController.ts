import type { InputState } from "./types";
import type { GameplayInputMethod } from "./analytics";

interface InputControllerOptions {
  input: InputState;
  canvas: HTMLCanvasElement;
  startButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
  tiltHint: HTMLElement;
  onPulse: (inputMethod: GameplayInputMethod) => void;
  onSkipResult: () => boolean;
}

interface DeviceOrientationPermissionApi {
  requestPermission?: () => Promise<"granted" | "denied">;
}

const TILT_DEAD_ZONE_DEGREES = 3;
const TILT_MAX_DEGREES = 15;
const TILT_SMOOTHING = 0.18;

/**
 * キーボード・クリック・タップ入力をゲーム本体から分離して扱う。
 * ゲーム側はInputStateとコールバックだけを見ればよい構造にしている。
 */
export class InputController {
  private readonly input: InputState;
  private readonly canvas: HTMLCanvasElement;
  private readonly startButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly tiltHint: HTMLElement;
  private readonly tiltHintTitle: HTMLElement;
  private readonly tiltHintBody: HTMLElement;
  private readonly onPulse: (inputMethod: GameplayInputMethod) => void;
  private readonly onSkipResult: () => boolean;
  private tiltEnabled = false;
  private tiltPermissionPending = false;
  private tiltNeutral: number | null = null;
  private filteredTilt = 0;
  private tiltHintShown = false;
  private tiltActivationTimer: number | null = null;

  constructor(options: InputControllerOptions) {
    this.input = options.input;
    this.canvas = options.canvas;
    this.startButton = options.startButton;
    this.restartButton = options.restartButton;
    this.tiltHint = options.tiltHint;
    this.tiltHintTitle = this.requireTiltHintElement("tiltHintTitle");
    this.tiltHintBody = this.requireTiltHintElement("tiltHintBody");
    this.onPulse = options.onPulse;
    this.onSkipResult = options.onSkipResult;
  }

  /**
   * 必要な入力イベントを一括登録する。
   * スマホ操作はcanvasのpointerdownでクリック操作と共通化する。
   */
  bind(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("orientationchange", this.resetTiltCalibration);
    this.canvas.addEventListener("pointerdown", this.handleCanvasPointerDown);
    this.startButton.addEventListener("click", this.handleStartButtonClick);
    this.restartButton.addEventListener("click", () => this.onPulse("pointer"));
  }

  /**
   * iPhoneではStartのクリック中にセンサー権限を要求する必要がある。
   * 拒否・非対応でもゲーム開始自体は止めない。
   */
  private readonly handleStartButtonClick = (): void => {
    if (this.tiltPermissionPending) {
      return;
    }

    this.tiltPermissionPending = true;
    this.startButton.setAttribute("aria-busy", "true");

    void this.enableTilt()
      .catch(() => {
        this.showTiltUnavailable();
      })
      .finally(() => {
        this.tiltPermissionPending = false;
        this.startButton.removeAttribute("aria-busy");
        this.onPulse("pointer");
      });
  };

  /**
   * Canvasのタップを拍動へ変換し、ブラウザのタッチジェスチャーを抑える。
   */
  private readonly handleCanvasPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      event.preventDefault();
    }

    this.onPulse("pointer");
  };

  /**
   * 対応端末では傾きセンサーを有効化する。
   * requestPermissionがあるSafari系だけ、ユーザー操作内で許可を求める。
   */
  private async enableTilt(): Promise<void> {
    if (this.tiltEnabled) {
      return;
    }

    if (!window.isSecureContext || typeof DeviceOrientationEvent === "undefined") {
      this.showTiltUnavailable();
      return;
    }

    const orientationApi = DeviceOrientationEvent as unknown as DeviceOrientationPermissionApi;
    if (typeof orientationApi.requestPermission === "function") {
      const permission = await orientationApi.requestPermission();
      if (permission !== "granted") {
        this.showTiltUnavailable();
        return;
      }
    }

    window.addEventListener("deviceorientation", this.handleDeviceOrientation);
    this.tiltEnabled = true;
    this.tiltActivationTimer = window.setTimeout(() => {
      if (this.tiltNeutral === null) {
        this.showTiltUnavailable();
      }
    }, 1800);
  }

  /**
   * 端末を自然に持った初回角度を中央として、左右傾斜を-1〜1へ変換する。
   */
  private readonly handleDeviceOrientation = (event: DeviceOrientationEvent): void => {
    const horizontalTilt = this.getHorizontalTilt(event);
    if (horizontalTilt === null) {
      return;
    }

    if (this.tiltActivationTimer !== null) {
      window.clearTimeout(this.tiltActivationTimer);
      this.tiltActivationTimer = null;
    }

    if (this.tiltNeutral === null) {
      this.tiltNeutral = horizontalTilt;
      this.filteredTilt = 0;
      this.input.tilt = 0;
      this.showTiltHint("Tilt to steer", "Tap anywhere to pulse");
      return;
    }

    const tiltFromNeutral = Math.max(
      -TILT_MAX_DEGREES,
      Math.min(TILT_MAX_DEGREES, horizontalTilt - this.tiltNeutral)
    );
    this.filteredTilt += (tiltFromNeutral - this.filteredTilt) * TILT_SMOOTHING;

    const tiltMagnitude = Math.abs(this.filteredTilt);
    if (tiltMagnitude <= TILT_DEAD_ZONE_DEGREES) {
      this.input.tilt = 0;
      return;
    }

    const normalizedTilt = Math.min(
      1,
      (tiltMagnitude - TILT_DEAD_ZONE_DEGREES) /
        (TILT_MAX_DEGREES - TILT_DEAD_ZONE_DEGREES)
    );
    this.input.tilt = Math.sign(this.filteredTilt) * normalizedTilt;
  };

  /**
   * 縦横の画面向きに応じ、画面上の左右方向へセンサー軸を合わせる。
   */
  private getHorizontalTilt(event: DeviceOrientationEvent): number | null {
    if (event.beta === null || event.gamma === null) {
      return null;
    }

    const screenAngle = ((window.screen.orientation?.angle ?? 0) + 360) % 360;
    if (screenAngle === 90) {
      return event.beta;
    }
    if (screenAngle === 180) {
      return -event.gamma;
    }
    if (screenAngle === 270) {
      return -event.beta;
    }
    return event.gamma;
  }

  /**
   * 画面回転後は、その時点の持ち方を新しい中央角度として取り直す。
   */
  private readonly resetTiltCalibration = (): void => {
    this.tiltNeutral = null;
    this.filteredTilt = 0;
    this.input.tilt = 0;
  };

  /**
   * 傾きセンサーを使えない環境では、HTTPSの外部ブラウザで開く案内を表示する。
   */
  private showTiltUnavailable(): void {
    this.showTiltHint(
      "Tilt unavailable here",
      "Open the HTTPS game in Safari or Chrome",
      true,
      5600
    );
  }

  /**
   * 傾き操作の状態をゲーム画面上へ短時間表示する。
   */
  private showTiltHint(
    title: string,
    body: string,
    warning = false,
    duration = 3800
  ): void {
    if (this.tiltHintShown) {
      return;
    }

    this.tiltHintShown = true;
    this.tiltHintTitle.textContent = title;
    this.tiltHintBody.textContent = body;
    this.tiltHint.classList.toggle("is-warning", warning);
    this.tiltHint.hidden = false;
    window.requestAnimationFrame(() => {
      this.tiltHint.classList.add("is-visible");
    });

    window.setTimeout(() => {
      this.tiltHint.classList.remove("is-visible");
      window.setTimeout(() => {
        this.tiltHint.hidden = true;
      }, 340);
    }, duration);
  }

  /**
   * tiltHint内の必須表示要素を取得する。
   */
  private requireTiltHintElement(id: string): HTMLElement {
    const element = this.tiltHint.querySelector<HTMLElement>(`#${id}`);
    if (!element) {
      throw new Error(`Missing tilt hint element: #${id}`);
    }
    return element;
  }

  /**
   * キーを押した瞬間の入力状態を更新する。
   * Enterはリザルト加算アニメーションのスキップを優先する。
   */
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Enter" && this.onSkipResult()) {
      event.preventDefault();
      return;
    }

    const eventTarget = event.target;
    const isInteractiveTarget =
      eventTarget instanceof HTMLButtonElement ||
      eventTarget instanceof HTMLInputElement ||
      eventTarget instanceof HTMLSelectElement ||
      eventTarget instanceof HTMLTextAreaElement;

    if (event.code === "Space" && !event.repeat && !isInteractiveTarget) {
      event.preventDefault();
      this.onPulse("keyboard");
      return;
    }

    if (event.code === "KeyA" || event.code === "ArrowLeft") {
      event.preventDefault();
      this.input.left = true;
    }

    if (event.code === "KeyD" || event.code === "ArrowRight") {
      event.preventDefault();
      this.input.right = true;
    }
  };

  /**
   * キーを離した瞬間に左右入力を解除する。
   * 押下状態を持ち続けないよう、keydownとは対になる処理にしている。
   */
  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "KeyA" || event.code === "ArrowLeft") {
      event.preventDefault();
      this.input.left = false;
    }

    if (event.code === "KeyD" || event.code === "ArrowRight") {
      event.preventDefault();
      this.input.right = false;
    }
  };
}
