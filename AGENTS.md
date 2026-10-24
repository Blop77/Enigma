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
| `css/style.css` | All styles; colour tokens on `:root` with a dark-mode override | Mobile first, two columns from 900px. |
| `sw.js` | Offline cache | **Bump `VERSION` and update `FILES` when you add or change a cached file.** |

## Commands

```bash
node tests/planner.test.js     # must pass
node tests/gapmap.test.js      # must pass
npx serve .                    # then open http://localhost:3000
```

## Conventions

- Match the existing style: `'use strict'`, small functions, short comments that explain *why*, `const`/arrow functions in UI files, ES5 style in the engines (they also run in Node via `require`).
- Engines stay pure: no `document`, no `window` access except the UMD export.
- Escape anything user-visible that comes from data with `MetroMitra.esc` before putting it in `innerHTML`.
- Keep the page free of horizontal scroll at 390px wide and check dark mode.
- Fares, timings and coordinates are **estimates**. Do not present them as official; keep the footer disclaimer.
- Add a test for every engine change. Never weaken or delete an existing test to make a change pass.

## Ready-to-run tasks

Each task is self-contained. Paste one as a prompt.

1. **Full Marathi UI.** Add an EN / मराठी toggle in the header. Move every user-visible string in `js/app.js`, `js/gap-ui.js` and `index.html` into a dictionary in a new `js/i18n.js` (`t(key, vars)`); use `STATIONS_MR` for station names. Remember the choice in `localStorage`. Flag the translations for review by a native speaker.
2. **PMPML feeder buses from GTFS.** Load PMPML stops (GTFS `stops.txt`, converted to a small JSON file in `data/`) and treat any bus stop within 400 m of a metro station as an existing feeder in the Gap Map, so the map shows today's reality and the simulator only suggests new feeders.
3. **Line 3 (Hinjewadi–Shivajinagar).** Add Line 3 to `LINES` with its stations and coordinates, marked `status: 'planned'`. Add a Gap Map toggle "Include Line 3" that rebuilds with it, and show the Hinjewadi headline before and after.
4. **Crowd and lift reports.** Let riders report "crowded / lift not working / escalator not working" at a station. Store reports in `localStorage` for the demo, show them as icons on the planner map, and warn in the timeline when a step uses an affected station.
5. **Accessibility mode.** A toggle that avoids stations flagged without lifts (add a `lift` flag in `data.js`), uses larger text, and adds 3 min per interchange.
6. **Shareable savings card.** Render the "My metro savings" totals into a 1080×1080 canvas image the rider can download or share.

## Definition of done

Both test files pass, the page loads with no console errors on desktop and at 390px, dark mode looks right, the offline cache is updated if files changed, and the README mentions the new feature.
