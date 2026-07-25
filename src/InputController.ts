import type { InputState } from "./types";

interface InputControllerOptions {
  input: InputState;
  canvas: HTMLCanvasElement;
  startButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
  resultBanner: HTMLElement;
  onPulse: () => void;
  onSkipResult: () => boolean;
}

/**
 * キーボード・クリック・タップ入力をゲーム本体から分離して扱う。
 * ゲーム側はInputStateとコールバックだけを見ればよい構造にしている。
 */
export class InputController {
  private readonly input: InputState;
  private readonly canvas: HTMLCanvasElement;
  private readonly startButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly resultBanner: HTMLElement;
  private readonly onPulse: () => void;
  private readonly onSkipResult: () => boolean;

  constructor(options: InputControllerOptions) {
    this.input = options.input;
    this.canvas = options.canvas;
    this.startButton = options.startButton;
    this.restartButton = options.restartButton;
    this.resultBanner = options.resultBanner;
    this.onPulse = options.onPulse;
    this.onSkipResult = options.onSkipResult;
  }

  /**
   * 必要な入力イベントを一括登録する。
   * スマホ操作はcanvas/resultBannerのpointerdownでクリック操作と共通化する。
   */
  bind(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.canvas.addEventListener("pointerdown", this.onPulse);
    this.startButton.addEventListener("click", this.onPulse);
    this.restartButton.addEventListener("click", this.onPulse);
    this.resultBanner.addEventListener("pointerdown", this.handleResultBannerPointerDown);
  }

  /**
   * リザルト画面のクリックを処理する。
   * 将来の広告枠など、ゲーム入力にしたくない要素はdata-ignore-game-inputで除外する。
   */
  private readonly handleResultBannerPointerDown = (event: PointerEvent): void => {
    const target = event.target;

    if (target instanceof Element && target.closest("[data-ignore-game-input]")) {
      event.stopPropagation();
      return;
    }

    this.onPulse();
  };

  /**
   * キーを押した瞬間の入力状態を更新する。
   * Enterはリザルト加算アニメーションのスキップを優先する。
   */
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Enter" && this.onSkipResult()) {
      event.preventDefault();
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
