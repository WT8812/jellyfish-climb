# Jellyfish Climb

Jellyfish Climb is a browser game where you guide a jellyfish upward by timing pulses, tilting with keyboard input, collecting plankton, and reaching the goal before time runs out.

The game is built as a small static web app with Vanilla TypeScript and Vite. It does not use React, Vue, or a game engine.

## Overview

- Click or tap to pulse upward.
- Hold `A` / `D` or arrow keys to tilt the jellyfish.
- A well-timed pulse gives stronger upward movement.
- Collect plankton to gain score.
- Reach the goal before the time limit.
- When cleared, remaining time applies a 100%–300% rate to the plankton score.
- A time-up game over awards zero score.
- BestScore is tracked in memory only for the current session.

## Tech Stack

- HTML
- CSS
- Vanilla TypeScript
- Vite
- Canvas API
- Web Audio via `HTMLAudioElement`
- GitHub Actions for GitHub Pages deployment

## Project Structure

```text
.
+-- index.html
+-- styles.css
+-- sound/
+-- scripts/
|   +-- copy-sound-assets.mjs
+-- src/
|   +-- main.ts
|   +-- Game.ts
|   +-- Player.ts
|   +-- Obstacle.ts
|   +-- InputController.ts
|   +-- analytics.ts
|   +-- types.ts
+-- vite.config.ts
+-- tsconfig.json
+-- .github/
    +-- workflows/
        +-- deploy-pages.yml
```

Audio files in `sound/` are copied to `dist/sound/` during build. Do not edit, transform, or derive new audio files from these assets unless the license allows it.

## Audio Credits

Third-party audio is used as-is for in-game sound effects and ambience. The audio files are not used for AI training.

| Project file | Source | License / terms |
| --- | --- | --- |
| `sound/environment/wind-in-trees-1.mp3` | [Wind in trees 1.mp3 by alppdcjr12](https://freesound.org/people/alppdcjr12/sounds/662575/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `sound/flow/down/ambiance-waterfall-loop-04.wav` | [Ambiance_Waterfall_Loop_04.wav by Nox_Sound](https://freesound.org/people/Nox_Sound/sounds/511075/) | [Creative Commons 0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `sound/button/決定ボタンを押す42.mp3` | [効果音ラボ](https://soundeffect-lab.info/sound/button/) | [効果音ラボ利用規約](https://soundeffect-lab.info/agreement/) |
| `sound/count/メッセージ表示音2.mp3` | [効果音ラボ](https://soundeffect-lab.info/sound/button/) | [効果音ラボ利用規約](https://soundeffect-lab.info/agreement/) |
| `sound/bubble/late&fast/ルアー着水.mp3` | [効果音ラボ](https://soundeffect-lab.info/sound/various/various3.html) | [効果音ラボ利用規約](https://soundeffect-lab.info/agreement/) |
| `sound/bubble/perfect/魚を釣り上げる.mp3` | [効果音ラボ](https://soundeffect-lab.info/sound/various/various3.html) | [効果音ラボ利用規約](https://soundeffect-lab.info/agreement/) |
| `sound/flow/up/水ぶくぶく2.mp3` | [効果音ラボ](https://soundeffect-lab.info/sound/various/) | [効果音ラボ利用規約](https://soundeffect-lab.info/agreement/) |

## Setup

Use Node.js 24 to match the GitHub Actions workflow.

```bash
npm install
npm run dev
```

If PowerShell blocks `npm` on Windows because of execution policy, use `npm.cmd` instead.

```powershell
npm.cmd install
npm.cmd run dev
```

## TypeScript

TypeScript runs in strict mode. Type checking is separated from development server startup.

```bash
npm run typecheck
```

The main game logic is in `src/Game.ts`, while shared types are in `src/types.ts`.

## Vite

Vite is used for development, production builds, and local preview.

```bash
npm run dev
npm run build
npm run preview
```

`vite.config.ts` uses `base: "./"` so the built assets work under a GitHub Pages repository subpath.

## Build

Build output is written to `dist/`.

```bash
npm run build
```

The build script performs:

- `tsc --noEmit`
- `vite build`
- copy publishable `sound/` assets to `dist/sound/`


## Notes

- The current UI is designed to avoid scrolling during gameplay.
- Mobile play is supported through tap input.
- BestScore is not persisted yet.
- Browser console and GA DebugView should be checked manually before public release.
