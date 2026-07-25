import type { Player } from "./types";

/**
 * 1プレイ開始時のクラゲの初期状態を作る。
 * reset時も同じ形を使うため、初期値はここに集約している。
 */
export function createPlayer(): Player {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 46,
    pulseCooldown: 0,
    pulseCharge: 1,
    pulseStretch: 0,
    swayPhase: 0,
    angle: 0,
    angularVelocity: 0,
    heading: 1,
  };
}
