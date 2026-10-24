# MetroMitra · मेट्रोमित्र

**Your door-to-door Pune Metro companion.** Built for the Pune Metro hackathon, theme **Urban mobility**.

### ▶ [Live demo: blop77.github.io/metro-mitra](https://blop77.github.io/metro-mitra/)

![Urban mobility](https://img.shields.io/badge/theme-urban%20mobility-8e3fa8) ![No build step](https://img.shields.io/badge/build-none-555) ![License: MIT](https://img.shields.io/badge/license-MIT-blue)

[![MetroMitra planning a trip from MIT-WPU to Pune Airport](screenshot.png)](https://blop77.github.io/metro-mitra/)

## The problem

Pune Metro now runs two lines, but most people still don't use it for everyday trips. People don't avoid it because the metro is slow. They avoid it because the trip is hard to plan:

- *Which* station is nearest to my college/office, and is it on the line I need?
- Do I have to change at Civil Court? Which platform, which direction?
- How much does the **whole** trip cost once I add the auto to and from the station?
- Is it actually better than just taking an auto?

Google Maps answers some of this, but it doesn't put the metro next to the road options in rupees, minutes and CO₂, and it doesn't tell you plainly when the metro is the *wrong* choice.

## What MetroMitra does

Type where you are and where you're going: a station, a college, a landmark, or 📍 your GPS location. You get:

1. **A door-to-door plan:** first mile (walk / auto / cycle) → board the right line in the right direction → change at Civil Court if needed → last mile, with clock times for every step.
2. **The real total cost:** metro fare plus first and last mile, not just the ticket.
3. **An honest verdict:** "Metro wins: ₹155 cheaper and 2 min faster than an auto", or "For this trip an auto is the better deal".
4. **A side-by-side comparison:** metro vs auto vs cab, by time, cost and CO₂.
5. **Concession fares:** student (30% off every day) and One Pune card / e-ticket (10% off on weekdays, 30% on weekends).
6. **Live service status:** running, peak/off-peak frequency, closed, or "opens in 20 min".
7. **An interactive network map:** tap two stations to plan; the route and first/last mile are drawn on it.
8. **My metro savings:** tap "I took this trip" and MetroMitra keeps a monthly total of the rupees and CO₂ you saved compared with an auto. It's stored only on your phone.
9. **Works offline:** it's an installable web app (PWA) that keeps planning underground with no signal.
10. **Shareable trip links:** send a friend `…#from=MIT-WPU&to=Pune Airport`.

It tries up to 3 stations near each end of the trip (9 combinations) and picks the fastest door to door. So it will happily tell you to walk 10 minutes to a different station if that skips an interchange.

## How it works

```
js/data.js       Network (29 stations, 2 lines), 28 landmarks, every tunable number
js/planner.js    Engine: Dijkstra routing, fares, first/last mile, comparison (no DOM; runs in Node)
js/app.js        UI: form, results timeline, SVG map, GPS, savings tracker, share links
sw.js            Service worker: caches the app for offline use
manifest.webmanifest, icons/   Installable app metadata and icons
tests/           node tests/planner.test.js
```

- **Routing:** the graph has one node per *(line, station)*, so changing lines at Civil Court costs real time (platform walk + half a headway of waiting). Dijkstra finds the fastest route.
- **Distances:** straight-line gaps between station coordinates, scaled so each line adds up to its published length (Purple 16.59 km, Aqua 14.66 km).
- **Fares:** distance slabs ₹10–₹35, then any concession for the trip's date. Autos: Pune RTA-style meter (minimum fare for the first 1.5 km, then per km). Road distance ≈ 1.3 × straight line, and traffic is slower in peak hours.

### Where the numbers come from

| Data | Value used | Source / confidence |
|---|---|---|
| Fare slabs | ≤1 km ₹10, ≤2 ₹15, ≤4 ₹20, ≤8 ₹25, ≤16 ₹30, more ₹35 | Third-party guides; matches published trip fares (Swargate–Vanaz ₹30, Ramwadi–PCMC ₹35) |
| Concessions | Student 30% daily; card/e-ticket 10% weekdays, 30% weekends | News reports 2023–25 |
| Hours | 06:00–23:00 | Extended to 11 PM in Jan 2025 (festival hours differ) |
| Frequency | ~7 min peak, ~10 min off-peak | Third-party guides |
| Line lengths | 16.59 km / 14.66 km | Wikipedia |
| Station coordinates | hand-entered, ±200 m | Approximate |
| Auto / cab tariffs, CO₂ | see `CONFIG` | Estimates |

> ⚠️ None of this is official Maha-Metro data. Check it against the official fare chart and timetable at [punemetrorail.org](https://www.punemetrorail.org) before the demo. Everything lives in `js/data.js`, so each fix is a one-line edit.

## Run it

No build step, nothing to install.

- **Online:** [blop77.github.io/metro-mitra](https://blop77.github.io/metro-mitra/), hosted on GitHub Pages and redeployed whenever `main` changes.
- **Locally:** open `index.html` in a browser, or:

```bash
npx serve .            # GPS and offline mode need http(s), not file://
node tests/planner.test.js
```

## Done before the event

- Core engine: routing, fares, first/last mile, comparison (23 tests)
- Door-to-door UI with timeline, map, GPS and share links
- Data cross-checked against news and guide sources; concession fares
- Savings tracker and offline/installable PWA

## Hackathon plan: what to build next (Codex sprint)

The core (data → engine → UI) works end to end and has tests. Each item below is self-contained, so it makes a good prompt for Codex, or for us if the credits fall through:

| # | Feature | Why judges care | Size |
|---|---|---|---|
| 1 | **Verify data** against the official fare chart and real station coordinates (cross-checked with news sources so far) | Accuracy | S |
| 2 | **Marathi / Hindi UI** (station names + labels; `data.js` already has a single place for names) | Inclusion | S |
| 3 | **Crowd reports:** "how crowded is the train / is the lift working?" tap-to-report, shown on the map | Civic, community | M |
| 4 | **PMPML feeder buses** as a first/last-mile option (Pune open-data GTFS) | Real last-mile fix | M |
| 5 | **Line 3 (Hinjewadi–Shivajinagar):** first phase reported cleared by CMRS but not confirmed open. Add its stations to `LINES` when it opens; the engine needs no changes | Future-proof | S |
| 6 | **Savings badges and sharing:** turn the savings tracker into a shareable card ("I saved ₹2,400 this month") | Engagement | S |
| 7 | **Accessibility mode:** lift/escalator-only routes, larger text | Inclusion | M |

**Demo script (2 min):** MIT-WPU → Airport at 9 AM (metro wins, saves well over ₹100) → switch the ticket to *Student* → tap *I took this trip* to show the savings tracker → Hinjewadi → Koregaon Park in cycle mode (honest trade-off) → Fergusson College → Shaniwar Wada, where the app says *take an auto* → turn on airplane mode and plan again (works offline). That honesty is the pitch.

## License

MIT, see [LICENSE](LICENSE).
