import type { Current, Mote, Plankton } from "./types";

/**
 * ゴールまでの高度に合わせて、水流の発生位置と強さを生成する。
 * 上昇・下降方向は初期状態で交互にし、時間経過で反転させる。
 */
export function buildCurrents(targetAltitude: number, worldWidth = 1400): Current[] {
  const currents: Current[] = [];
  const layers = 9;
  const spacing = targetAltitude / (layers + 1);
  const centerRange = Math.min(470, Math.max(0, worldWidth / 2 - 110));
  const horizontalScale = Math.min(1, Math.max(0.65, worldWidth / 900));

  for (let index = 0; index < layers; index += 1) {
    const y = -220 - index * spacing - Math.random() * 90;
    const x = Math.random() * centerRange * 2 - centerRange;
    const width = (140 + Math.random() * 80) * horizontalScale;
    const strength = 30 + Math.random() * 28;
    const drift = (Math.random() * 56 - 28) * horizontalScale;
    const direction = index % 2 === 0 ? -1 : 1;
    const phase = Math.random() * Math.PI * 2;
    currents.push({ x, y, width, strength, drift, direction, phase });
  }

  return currents;
}

/**
 * 既存の水流を作り直さず、方向・横流れ・強さだけを更新する。
 * 位置を維持することで、見えている水流が突然消える違和感を避ける。
 */
export function switchCurrentDirections(currents: Current[]): void {
  for (const current of currents) {
    current.direction *= -1;
    current.drift = Math.random() * 56 - 28;
    current.strength = 30 + Math.random() * 28;
  }
}

/**
 * スコア源となるプランクトンをコース全体に配置する。
 * baseX/baseYを持たせて、ゲーム中はそこを中心に泳がせる。
 */
export function buildPlankton(worldWidth = 1400): Plankton[] {
  const plankton: Plankton[] = [];
  const driftScale = Math.min(1, Math.max(0.45, worldWidth / 700));
  const maximumDrift = 52 * driftScale;
  const courseHalfWidth = Math.max(30, worldWidth / 2 - 70 - maximumDrift);
  const routeScale = Math.min(1, courseHalfWidth / 510);

  for (let index = 0; index < 58; index += 1) {
    const y = -130 - index * 60;
    const x =
      (Math.sin(index * 2.1) * 430 + Math.cos(index * 0.65) * 80) *
      routeScale;
    plankton.push({
      x,
      y,
      baseX: x,
      baseY: y,
      radius: 8 + (index % 4),
      phase: index * 0.4,
      driftRadius: (24 + (index % 5) * 7) * driftScale,
      bobRadius: 8 + (index % 4) * 4,
      swimSpeed: 0.8 + (index % 6) * 0.11,
      taken: false,
    });
  }

  return plankton;
}

/**
 * 背景の浮遊粒子を生成する。
 * ゲーム性には影響せず、水中の奥行きと移動感を出すための演出。
 */
export function buildMotes(worldWidth: number): Mote[] {
  const motes: Mote[] = [];

  for (let index = 0; index < 130; index += 1) {
    motes.push({
      x: Math.random() * worldWidth - worldWidth / 2,
      y: -Math.random() * 3600,
      radius: Math.random() * 3 + 1,
      speed: Math.random() * 12 + 10,
      alpha: Math.random() * 0.4 + 0.14,
    });
  }

  return motes;
}
