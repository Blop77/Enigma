# AGENTS.md: guide for Codex and other coding agents

MetroMitra is a Pune Metro hackathon project with two views:
- **Gap Map:** where the metro beats an auto, plus a feeder-bus simulator and a printable city report.
- **Trip planner:** door to door, for riders.

It is plain HTML, CSS and JavaScript with **no build step and no dependencies**, served as static files (GitHub Pages).

## Layout

| File | Role | Rules |
|---|---|---|
| `js/data.js` | Stations, lines, Marathi names, landmarks, hubs, `CONFIG` (fares, speeds, tariffs, feeder model, grid) | **Every number lives here.** Never hard-code fares, speeds or coordinates elsewhere. |
| `js/planner.js` | Trip engine: routing, fares, concessions, first/last mile, verdict | No DOM. UMD: works in Node and the browser. |
| `js/gapmap.js` | Gap Map engine: grid, scoring, feeders, recommendations | No DOM. Must stay consistent with `planner.js` (a test checks this). |
| `js/app.js` | Trip planner UI, tabs, savings tracker; exposes `window.MetroMitra` | Browser only. |
| `js/gap-ui.js` | Gap Map UI, feeder simulator, city report | Browser only. |
| `js/i18n.js` | Every user-visible string as `[English, Marathi]`; `I18N.t(key, vars)`, `I18N.station/place/line` for names | **No string literals for users anywhere else.** Add both languages for every new key. |
| `css/style.css` | All styles; colour tokens on `:root` with a dark-mode override | Mobile first, two columns from 900px. |
| `sw.js` | Offline cache | **Bump `VERSION` and update `FILES` when you add or change a cached file.** |

## Commands

```bash
node tests/planner.test.js     # must pass
node tests/gapmap.test.js      # must pass
node tests/i18n.test.js        # must pass: catches missing keys and untranslated strings
npx serve .                    # then open http://localhost:3000
```

## Conventions

- Match the existing style: `'use strict'`, small functions, short comments that explain *why*, `const`/arrow functions in UI files, ES5 style in the engines (they also run in Node via `require`).
- Engines stay pure: no `document`, no `window` access except the UMD export.
- Escape anything user-visible that comes from data with `MetroMitra.esc` before putting it in `innerHTML`.
- User-visible text goes through `I18N.t('key', vars)` (static HTML uses `data-i18n`, `data-i18n-html`, `data-i18n-attr`). Marathi templates must not attach case endings to a `{place}`; use forms like `{place} येथे`. When the language changes, `mm:lang` fires; re-render anything you draw.
- Keep the page free of horizontal scroll at 390px wide and check dark mode.
- Fares, timings and coordinates are **estimates**. Do not present them as official; keep the footer disclaimer.
- Add a test for every engine change. Never weaken or delete an existing test to make a change pass.

## Ready-to-run tasks

Each task is self-contained. Paste one as a prompt.

1. **PMPML feeder buses from GTFS.** Load PMPML stops (GTFS `stops.txt`, converted to a small JSON file in `data/`) and treat any bus stop within 400 m of a metro station as an existing feeder in the Gap Map, so the map shows today's reality and the simulator only suggests new feeders.
2. **Line 3 (Hinjewadi–Shivajinagar).** Add Line 3 to `LINES` with its stations and coordinates, marked `status: 'planned'`. Add a Gap Map toggle "Include Line 3" that rebuilds with it, and show the Hinjewadi headline before and after.
3. **Crowd and lift reports.** Let riders report "crowded / lift not working / escalator not working" at a station. Store reports in `localStorage` for the demo, show them as icons on the planner map, and warn in the timeline when a step uses an affected station.
4. **Accessibility mode.** A toggle that avoids stations flagged without lifts (add a `lift` flag in `data.js`), uses larger text, and adds 3 min per interchange.
5. **Shareable savings card.** Render the "My metro savings" totals into a 1080×1080 canvas image the rider can download or share.

## Definition of done

All three test files pass, the page loads with no console errors on desktop and at 390px, dark mode looks right, the offline cache is updated if files changed, every new string exists in English and Marathi, and the README mentions the new feature.
