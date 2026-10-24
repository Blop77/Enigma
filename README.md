# MetroMitra · मेट्रोमित्र

**Fixing Pune Metro's last mile.** A Gap Map that shows where the metro beats an auto and where it fails, a simulator that finds the feeder buses that would fix it, and a door-to-door trip planner for riders.

Built for the Pune Metro hackathon · theme **Urban mobility**.

### ▶ [Live demo: blop77.github.io/metro-mitra](https://blop77.github.io/metro-mitra/)

![Urban mobility](https://img.shields.io/badge/theme-urban%20mobility-8e3fa8) ![No build step](https://img.shields.io/badge/build-none-555) ![Tests](https://img.shields.io/badge/tests-44%20passing-2f9e5f) ![License: MIT](https://img.shields.io/badge/license-MIT-blue)

[![The Gap Map with five suggested feeders switched on](screenshot.png)](https://blop77.github.io/metro-mitra/)

## The problem

Pune now has two metro lines, but for most trips people still take an auto. The train isn't the problem. **The first and last mile is.** If your home or office is 3–5 km from a station, the auto to and from the station costs more time and money than the metro saves.

Nobody can see where this happens. Ridership numbers say *how many* people use a station, not *who can't*.

## What MetroMitra does

### 🗺️ Gap Map (for the city: Maha-Metro, PMC, PMPML)

- **Splits Pune into ~0.9 km squares.** For every square and each of 12 major hubs (Hinjewadi, Kharadi, Magarpatta, Bhosari MIDC, the railway station, Swargate, the airport, Camp, Fergusson, SPPU, COEP, MIT-WPU), it plans the trip door to door and compares it with an auto.
- **Colours each square:** green where the metro beats an auto, amber where it's cheaper but slower, red where an auto is simply better.
- **Gives one headline number:** *"At peak hour, the metro beats an auto from 37% of Pune's area near the metro."*
- **Simulates feeders** (₹10 e-bus or shared e-rickshaw from a station, up to 6 km). It tests a feeder at every station and greedily picks the five that improve access the most: **37% → 53%**.
- **Lets you place feeders yourself:** tap any station to add or remove one and the map updates instantly.
- **City report:** ranks all 12 hubs by metro access, with the single best feeder for each. Print it or save it as a PDF to hand to decision-makers.
- **Tap any square** to see every trip from there (route, time and cost vs an auto), then open it in the trip planner.

What the model finds (peak hour; official fares, timetable and auto tariff, road model calibrated on real trips):

| Finding | Number |
|---|---|
| Worst-served hub | **Hinjewadi**: the metro wins from only 23% of the area (Line 3 can't come soon enough) |
| Best-served hubs | **Pune Railway Station** and **COEP**: 77% |
| Best single feeder for the city | **Ramwadi**: serves Kharadi, Viman Nagar and the airport |
| One feeder at Kalyani Nagar, for the Airport | Area where an auto is better: 26% → 11% |
| Opening Range Hill station (built, not yet open) | Metro wins for SPPU trips: 26% → 42%; city-wide: 37% → 42% |
| Five suggested feeders | Area where the metro wins: **37% → 53%** |

### 🌐 English / मराठी

The whole app (both tabs, the city report, errors and units) switches to Marathi with one tap, and remembers the choice. Station, landmark and line names switch too, and you can search in either language. Browsers set to Marathi start in Marathi. *The Marathi was written for the hackathon. Please have a native speaker review `js/i18n.js` and the names in `js/data.js`.*

### 🧭 Trip planner (for riders)

- Plan from a station, a landmark, a Marathi name (स्वारगेट) or 📍 GPS
- Door-to-door timeline with clock times: first mile → right line and direction → change at District Court → last mile
- Total cost including first and last mile, and an **honest verdict**: it says *take an auto* when the metro doesn't pay off
- Metro vs auto vs cab: time, ₹, CO₂
- Concession fares: student 30% off; Pune card / e-ticket 10% off on weekdays, 30% on weekends
- Live service status, interactive network map, shareable trip links
- **My metro savings:** log the trips you take; see ₹ and CO₂ saved this month
- **Works offline** (installable PWA), even underground with no signal

## How it works

```
js/data.js       Network (29 stations, 2 lines), Marathi names, landmarks, 12 hubs, every tunable number
js/i18n.js       Every user-visible string in English and Marathi; t(key, vars)
js/planner.js    Trip engine: Dijkstra routing, fares, concessions, first/last mile, verdict (no DOM)
js/gapmap.js     Gap Map engine: grid, scoring, feeder simulation, greedy recommendations (no DOM)
js/app.js        Trip planner UI, tabs, savings tracker, share links
js/gap-ui.js     Gap Map UI: heat map, feeder simulator, city report
sw.js            Service worker for offline use
tests/           Engine and translation tests (Node, no dependencies)
```

- **Routing.** One graph node per *(line, station)*, so changing lines at District Court costs real time (a platform walk plus half a headway). Dijkstra finds the fastest route.
- **Door to door.** The engine tries up to 3 stations near each end of the trip and picks the fastest combination. Short hops are walked, longer ones taken by auto.
- **Verdict.** *Metro* if it's cheaper and at most 5 min slower than an auto; *trade-off* if cheaper but slower; *auto* otherwise.
- **Gap Map score.** Each square scores 1 / 0.5 / 0 per hub (metro / trade-off / auto), averaged over the hubs. Green ≥ 0.67, amber ≥ 0.34, red below.
- **Consistency.** The Gap Map and the trip planner run the same rules, and a test checks that they agree trip for trip.
- **Feeders.** A rider can always ignore a feeder, so adding one never makes a trip worse (also tested). "km² better served" is the total score gain × square area, so a red square turning amber counts half.
- **Speed.** All 812 station-to-station trips are precomputed once, so the 645 × 12 grid builds in about 0.1 s. A feeder only re-scores the trips that can use it.

### Where the numbers come from

| Data | Value used | Source |
|---|---|---|
| **Fares** | Official station-to-station fare chart, ₹10–₹35 (`FARE_CHART`) | **Maha-Metro fare chart.** 10 of 378 pairs are printed with different fares each way; kept as printed (`FARE_ASYMMETRIC`) |
| **Stations** | 13 open on Line 1 (Range Hill not yet open), 16 on Line 2 | **Maha-Metro project profile** |
| **Hours, frequency** | 06:00–23:00; every 6 min at peak (8–11 AM, 4–8 PM), every 10 min otherwise | **Official timetable, w.e.f. 15 Aug 2025** |
| **End-to-end times** | PCMC–Swargate 34 min / 17.5 km; Vanaz–Ramwadi 37 min / 14.5 km (speeds calibrated to match) | **Official timetable** |
| **Auto fare** | ₹26 for the first 1.5 km, ₹17.14/km after, +25% from midnight to 5 AM | **Pune RTA official meter tariff** (app autos charge more, so metro savings shown are conservative) |
| Road model | Road distance = 1.39 × straight line; 14.6 km/h at 9 AM, 24.1 km/h at 2 PM; cab ₹35 + ₹22.5/km, ×1.5 surge at peak; auto wait 4 min; station entry 2.5 min; interchange 4 min | Fitted to 4 team-collected trips (MIT-WPU → Airport, MIT-WPU → Pune Station, Hinjewadi → Shivajinagar, Kharadi → Pune Station), stored as ranges in `CALIBRATION_TRIPS`; a test keeps the model within 10% of every range. The ranges are summaries, not app screenshots |
| Concessions | Student 30% daily; card/e-ticket 10% weekdays, 30% weekends | News reports 2023–25 |
| Station coordinates, Marathi names | hand-entered | Approximate; please check against signage |
| CO₂, feeder model | see `CONFIG` | Estimates |

> ⚠️ Metro fares, stations and timings are from official Maha-Metro material, the auto tariff from Pune RTA, and the road model is calibrated on real trips; coordinates, CO₂ and the feeder model are estimated. Everything lives in `js/data.js`, so each fix is a one-line edit, and the Gap Map and the planner both update. Search also understands the fare chart's station names (Paud Phata, S.N.D.T. College, R.T.O., Kasba Peth, Nashik Phata, Mahatma Phule Mandai, Civil Court).

## Run it

No build step, nothing to install.

- **Online:** [blop77.github.io/metro-mitra](https://blop77.github.io/metro-mitra/), hosted on GitHub Pages and redeployed whenever `main` changes.
- **Locally:**

```bash
npx serve .                    # GPS and offline mode need http(s), not file://
node tests/planner.test.js     # trip engine
node tests/gapmap.test.js      # Gap Map engine
node tests/i18n.test.js        # every string translated, every key used exists
```

## Demo script (3 minutes)

1. **The problem (Gap Map, all hubs, peak).** "The metro beats an auto from only 37% of Pune. Amber is everywhere: the metro is cheaper, but the last mile makes it slower."
2. **Pick Hinjewadi.** The map turns red: 23%. "This is why Line 3 matters."
3. **Pick Kharadi.** Red around EON IT Park. Tap a red square to show the 5 km auto from Ramwadi that kills the trip.
4. **Add the suggested feeders.** Watch the map turn green: 37% → 53%. Then tap a station to add a feeder by hand.
5. **City report.** "Here is the one feeder each hub needs." Print it as a PDF for the judges.
6. **Open in trip planner** from a square. Show the honest verdict, switch to a *Student* ticket, then tap *I took this trip*.
7. **Airplane mode.** Plan again: it still works offline.

## Working with Codex (optional)

The project is complete without it. If Codex credits are available at the event, [`AGENTS.md`](AGENTS.md) gives Codex the architecture, rules and a list of ready-to-paste tasks (PMPML GTFS feeders, Line 3, crowd reports, accessibility, a shareable savings card).

## License

MIT, see [LICENSE](LICENSE).
