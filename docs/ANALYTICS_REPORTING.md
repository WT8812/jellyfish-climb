# Google Analytics 4 measurement guide

Jellyfish Climb sends a small, privacy-conscious event set when
`VITE_GA_MEASUREMENT_ID` is configured. No name, email address, precise
location, or locally stored audio setting is included.

## Measurement funnel

| Step | Event | Meaning |
| --- | --- | --- |
| 1 | `page_view` | A content page was viewed. This is collected automatically by GA4. |
| 2 | `play_intent` | A link leading toward the game was selected. |
| 3 | `game_entry` | The actual `/play/` game page was reached. |
| 4 | `game_start` | Start or Retry began a run. |
| 5 | `game_first_input` | The player made their first gameplay input after Start. |
| 6 | `game_progress` | The player reached 800 m, 1,600 m, or 2,400 m. |
| 7 | `game_over` | The run ended with `clear` or `time_up`. |

Existing `game_retry` and `high_score` events remain available.

## Page reporting

The Google tag config includes GA4's built-in `content_group` parameter.
Use **Reports → Engagement → Pages and screens**, then select
**Content group** to compare:

- `home`
- `game`
- `play_landing`
- `how_to_play`
- `about`
- `updates`
- `faq`
- `privacy`
- `terms`
- `contact`
- `development_story`
- `not_found`

Page title, page location, referrer, browser language, and device information
are collected by GA4 automatically. The site does not duplicate `page_view`.

## Game-entry parameters

The following parameters connect the site journey to game events:

| Parameter | Meaning | Example |
| --- | --- | --- |
| `entry_source` | The most recent game link placement | `home_hero`, `header_nav`, `how_to_play_cta` |
| `source_page` | The page group containing that link | `home`, `how_to_play` |
| `journey_origin` | The first game link selected in the current journey | `header_nav` |
| `journey_origin_page` | The page where that journey began | `home` |
| `site_language` | Site language when the link was selected | `en`, `ja` |
| `start_type` | New run or Retry | `new`, `retry` |
| `input_method` | First gameplay input method | `pointer`, `keyboard` |
| `result` | How the run ended | `clear`, `time_up` |

The entry context is kept temporarily in `sessionStorage`, expires after
30 minutes, and is consumed by the actual game page. It is not a user ID.

## GA4 custom definitions

Custom event parameters are collected immediately, but they must be registered
as event-scoped custom dimensions before they can be selected in standard
reports and explorations.

In **Admin → Data display → Custom definitions**, create event-scoped custom
dimensions for:

- `entry_source`
- `source_page`
- `journey_origin`
- `journey_origin_page`
- `site_language`
- `destination`
- `start_type`
- `input_method`
- `result`

Optional custom metrics:

- `milestone_altitude`
- `altitude`
- `time_remaining`
- `plankton_score`
- `score`

`content_group` is a built-in dimension and does not need a custom definition.

## Suggested exploration

Create a Funnel exploration with these steps:

1. `page_view`
2. `play_intent`
3. `game_entry`
4. `game_start`
5. `game_first_input`
6. `game_over`

Break it down by `entry_source`, `source_page`, `site_language`, or GA4's
built-in Device category. Add `game_progress` as a separate free-form report
to compare how many runs reach each altitude milestone.

If one event should be marked as a key event, `game_first_input` is the clearest
signal that someone began interacting with the game rather than only opening
the game page.

## Verification

After deployment:

1. Open **Reports → Realtime** or **Admin → DebugView**.
2. Visit a content page and select a Play link.
3. Press Start, then tap/click the game canvas.
4. Confirm the event order and inspect the parameters.

References:

- [Enhanced measurement and automatic page views](https://support.google.com/analytics/answer/9216061)
- [Set up GA4 events with gtag.js](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [Create content groups](https://support.google.com/analytics/answer/11523339)
- [Create event-scoped custom dimensions](https://support.google.com/analytics/answer/14239696)
