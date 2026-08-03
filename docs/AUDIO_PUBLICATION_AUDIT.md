# Audio Publication Audit

Checked: 2026-08-03

This note records the publication check for audio used by Jellyfish Climb. It does not replace legal advice, and source terms should be checked again before a major release.

## Current use

- Audio is used as ambience, current sounds, button feedback, pulse feedback, and score feedback inside the game.
- The website does not provide a download button or a direct local-audio link.
- The Audio Credits interface links to each provider or source page, not to the provider's underlying media URL.
- Files are not edited by the build. The build copies permitted assets and excludes the locally retained restricted VSQ plus+ filenames.
- Audio must be fetched by the player's browser to be played. On a static website, a technically knowledgeable visitor can therefore retrieve the delivered file even when no download UI exists.

## Freesound files

The following source pages currently identify the works as Creative Commons 0:

- `sound/environment/wind-in-trees-1.mp3`
  - Source: https://freesound.org/people/alppdcjr12/sounds/662575/
- `sound/flow/down/ambiance-waterfall-loop-04.wav`
  - Source: https://freesound.org/people/Nox_Sound/sounds/511075/
- License reference: https://creativecommons.org/publicdomain/zero/1.0/

CC0 permits copying, modification, distribution, performance, and commercial use without requiring permission. The project still provides source credits as a courtesy.

## Sound Effect Lab files

The following files are credited to Sound Effect Lab:

- `sound/button/決定ボタンを押す42.mp3`
- `sound/count/メッセージ表示音2.mp3`
- `sound/bubble/late&fast/ルアー着水.mp3`
- `sound/bubble/perfect/魚を釣り上げる.mp3`
- `sound/flow/up/水ぶくぶく2.mp3`

References:

- Terms: https://soundeffect-lab.info/agreement/
- FAQ: https://soundeffect-lab.info/faq/

The current terms allow free commercial use and identify an effect embedded as an application's operation sound as a non-redistribution example. The current FAQ also says that distributing a game or publishing an application on GitHub with exposed audio files is permitted, while requesting reasonable hiding measures where practical.

Sound Effect Lab's prohibition on direct linking concerns sharing a media URL hosted on the Sound Effect Lab server. Jellyfish Climb links to the provider's normal web pages and serves its in-game copies from the game's own deployment.

## Exposure controls

- No HTML anchor points to a local `.mp3` or `.wav` file.
- No `download` attribute is used for audio.
- `robots.txt` disallows the deployed `/sound/` path to discourage search indexing.
- This robots rule is not access control and cannot prevent a visitor or browser developer tools from retrieving a file already needed for playback.

If fully preventing file retrieval becomes a requirement, the affected audio must be removed or replaced. Renaming, bundling, encoding, or hiding client-side URLs does not provide reliable protection.
