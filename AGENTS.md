# AGENTS.md: guide for Codex and other coding agents

MetroMitra is a Pune Metro hackathon project with two views:
- **Gap Map:** where the metro beats an auto, plus a feeder-bus simulator and a printable city report.
- **Trip planner:** door to door, for riders.

It is plain HTML, CSS and JavaScript with **no build step and no dependencies**, served as static files (GitHub Pages).

## Layout

| File | Role | Rules |
|---|---|---|
| `js/data.js` | Stations, lines, Marathi names, landmarks, hubs, `CONFIG` (fares, speeds, tariffs, feeder model, grid) | **Every number lives here.** Never hard-code fares, speeds or coordinates elsewhere. |
| `js/population.js` | Residents in every Gap Map square (WorldPop 2020) | **Generated** by `tools/population.py`; do not edit by hand. Rerun it if the grid in `CONFIG.gapMap` changes (a test checks they match). |
| `js/planner.js` | Trip engine: routing, fares, concessions, first/last mile, verdict | No DOM. UMD: works in Node and the browser. |
| `js/savings.js` | Month filtering and totals for the savings tracker | No DOM. UMD: works in Node and the browser. |
| `js/gapmap.js` | Gap Map engine: grid, scoring, feeders, recommendations | No DOM. Must stay consistent with `planner.js` (a test checks this). |
| `js/app.js` | Trip planner UI, tabs, savings tracker; exposes `window.MetroMitra` | Browser only. |
| `js/savings-card.js` | Draws and exports the shareable savings card | Browser only; canvas UI. |
| `js/gap-ui.js` | Gap Map UI, feeder simulator, city report; keeps the view's settings in the URL | Browser only. Call `syncHash()` after any change to hub, time, Line 3 or feeders. |
| `js/share.js` | `encodeGap`/`decodeGap` (pure, tested) and the QR / copy-link dialog | Decoding must ignore unknown values, never throw. |
| `js/guide.js` | First-visit guide | Write i18n keys out in full so the i18n test can check them. |
| `js/vendor/qrcode.js` | Third-party QR generator (MIT) | Do not edit. |
| `js/i18n.js` | Every user-visible string as `[English, Marathi]`; `I18N.t(key, vars)`, `I18N.station/place/line` for names | **No string literals for users anywhere else.** Add both languages for every new key. |
| `css/style.css` | All styles; colour tokens on `:root` with a dark-mode override | Mobile first, two columns from 900px. |
| `sw.js` | Offline cache | **Bump `VERSION` and update `FILES` when you add or change a cached file.** |

## Commands

```bash
node tests/planner.test.js     # must pass
node tests/gapmap.test.js      # must pass
node tests/i18n.test.js        # must pass: catches missing keys and untranslated strings
node tests/savings.test.js     # savings totals and month filtering
node tests/reports.test.js     # station reports and expiry
node tests/share.test.js       # share-link encode/decode
npx serve .                    # then open http://localhost:3000
```

## Data rules (official Maha-Metro sources)

- **Fares** for Lines 1 and 2 come only from `FARE_CHART` (Maha-Metro's official station-to-station chart, row = from, column = to) via `MetroPlanner.chartFare`. Never compute them from distance. `CONFIG.fareSlabs` is only a fallback for stations not on the chart. The 10 pairs in `FARE_ASYMMETRIC` are printed differently each way on the official chart; keep them as printed.
- **Running times** come from each line's `runMin` (official end-to-end time) and `lengthKm`; the planner derives each line's speed from them. A new line needs both.
- **Timetable** (w.e.f. 15 Aug 2025): 06:00–23:00; every 6 min at peak (08:00–11:00, 16:00–20:00), every 10 min otherwise.
- **Stations**: Range Hill is built but not open, so it is not a stop. The interchange's id is `civil-court`; its official name is **District Court** (Civil Court is a search alias in `STATION_ALIASES`).
- **Auto fares** use the Pune RTA meter tariff (`CONFIG.auto`, night surcharge included). Road distance, road speeds and cab fares are calibrated on `CALIBRATION_TRIPS`; a test keeps the model within 10% of every collected range, so change those numbers together.
- **Population** comes from WorldPop's 2020 India 1 km grid (CC BY 4.0, keep the attribution). The raw file is on the `data/worldpop` branch, never on `main`. Gap Map headlines and feeder rankings count residents; area is shown only as a secondary figure.
- Coordinates, CO₂ and the feeder model are still estimates.

## Conventions

- Match the existing style: `'use strict'`, small functions, short comments that explain *why*, `const`/arrow functions in UI files, ES5 style in the engines (they also run in Node via `require`).
- Engines stay pure: no `document`, no `window` access except the UMD export.
- Escape anything user-visible that comes from data with `MetroMitra.esc` before putting it in `innerHTML`.
- User-visible text goes through `I18N.t('key', vars)` (static HTML uses `data-i18n`, `data-i18n-html`, `data-i18n-attr`). Marathi templates must not attach case endings to a `{place}`; use forms like `{place} येथे`. When the language changes, `mm:lang` fires; re-render anything you draw.
- Keep the page free of horizontal scroll at 390px wide and check dark mode.
- Line 3's run time and coordinates, plus road fares, emissions and feeder assumptions, are **estimates**. Do not present estimates as official; keep the footer disclaimer.
- Add a test for every engine change. Never weaken or delete an existing test to make a change pass.

## Ready-to-run tasks

Each task is self-contained. Paste one as a prompt.

1. **PMPML feeder buses from GTFS.** Load PMPML stops (GTFS `stops.txt`, converted to a small JSON file in `data/`) and treat any bus stop within 400 m of a metro station as an existing feeder in the Gap Map, so the map shows today's reality and the simulator only suggests new feeders.
2. **Crowd and lift reports.** Let riders report "crowded / lift not working / escalator not working" at a station. Store reports in `localStorage` for the demo, show them as icons on the planner map, and warn in the timeline when a step uses an affected station.

## Definition of done

All test files in Commands pass, the page loads with no console errors on desktop and at 390px, dark mode looks right, the offline cache is updated if files changed, every new string exists in English and Marathi, and the README mentions the new feature.
