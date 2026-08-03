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
- BestScore is tracked in memory for the current page session.

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
+-- play/
+-- ja/
+-- how-to-play/ and other information pages
+-- styles.css
+-- site.css
+-- site.config.json
+-- sound/
+-- scripts/
|   +-- copy-sound-assets.mjs
+|   +-- generate-seo-assets.mjs
+|   +-- validate-site.mjs
+-- src/
|   +-- main.ts
+|   +-- site.ts
+|   +-- ads.ts
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

The game does not expose a download button or link to its local audio files. Because a browser must fetch client-side audio to play it, static hosting cannot make those files technically impossible to retrieve. Generated `robots.txt` asks search crawlers not to index the deployed `/sound/` path. See `docs/AUDIO_PUBLICATION_AUDIT.md` for the current publication review.

## Site and SEO configuration

The English site is the default locale and Japanese pages live below `/ja/`. The playable game is isolated at `/play/`, so information pages do not load the game bundle.

- Set `SITE_URL` to the final public origin and base path, without a trailing slash. Canonical URLs, hreflang links, `robots.txt`, and `sitemap.xml` are generated from this single value.
- Set `VITE_GOOGLE_SITE_VERIFICATION` to the Search Console HTML-tag verification value when needed.
- Set `VITE_GA_MEASUREMENT_ID` to enable Google Analytics. When empty, Analytics is not loaded.
- `VITE_ADSENSE_PUBLISHER_ID` is reserved for a future approved AdSense account. No advertising script or `ads.txt` is generated yet.

Copy `.env.example` to a local `.env` for development values, or use GitHub Actions repository variables for deployment. The unpublished Development Story pages intentionally remain `noindex` and outside `sitemap.xml` until creator-approved content is available.

Analytics uses GA4's automatic `page_view` plus a compact game funnel:
`play_intent`, `game_entry`, `game_start`, `game_first_input`,
`game_progress`, and `game_over`. See
[`docs/ANALYTICS_REPORTING.md`](docs/ANALYTICS_REPORTING.md) for event
parameters and the GA4 custom-definition setup needed for reporting.

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
