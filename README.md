# MetroMitra · मेट्रोमित्र

**Fixing Pune Metro's last mile.** A Gap Map that shows where the metro beats an auto and where it fails, a simulator that finds the feeder buses that would fix it, and a door-to-door trip planner for riders.

Built for the Pune Metro hackathon · theme **Urban mobility**.

### ▶ [Live demo: blop77.github.io/metro-mitra](https://blop77.github.io/metro-mitra/) · 🚇 [Ride the story](https://blop77.github.io/metro-mitra/story.html)

![Urban mobility](https://img.shields.io/badge/theme-urban%20mobility-8e3fa8) ![No build step](https://img.shields.io/badge/build-none-555) ![Tests](https://img.shields.io/badge/tests-84%20passing-2f9e5f) ![License: MIT](https://img.shields.io/badge/license-MIT-blue)

[![The Gap Map with five suggested feeders switched on](screenshot.png)](https://blop77.github.io/metro-mitra/)

## The problem

Pune has two open metro lines, but for most trips people still take an auto. The train isn't the problem. **The first and last mile is.** If your home or office is 3–5 km from a station, the auto to and from the station costs more time and money than the metro saves.

Nobody can see where this happens. Ridership numbers say *how many* people use a station, not *who can't*.

## What MetroMitra does

### 🗺️ Gap Map (for the city: Maha-Metro, PMC, PMPML)

- **Splits Pune into ~0.9 km squares.** For every square and each of 12 major hubs (Hinjewadi, Kharadi, Magarpatta, Bhosari MIDC, the railway station, Swargate, the airport, Camp, Fergusson, SPPU, COEP, MIT-WPU), it plans the trip door to door and compares it with an auto.
- **Colours each square:** green where the metro beats an auto, amber where it's cheaper but slower, red where an auto is simply better. Squares where hardly anyone lives (hills, the river, the airfield) are faded.
- **Counts people, not area.** Every square carries its residents from WorldPop's 2020 population grid. The headline is *"At peak hour, the metro beats an auto for 30% of the 61 lakh people living near the metro."* By area it would be 37%, so the gaps are worse where people actually live.
- **Simulates feeders** (₹10 e-bus or shared e-rickshaw from a station, up to 6 km). It tests a feeder at every station and greedily picks the five that help the most residents: **30% → 44%** of residents. Each suggestion says how many residents it serves better (*"Ramwadi: +1.1 lakh residents"*).
- **Lets you place feeders yourself:** tap any station to add or remove one and the map updates instantly.
- **City report:** ranks all 12 hubs by the share of residents the metro serves, with the single best feeder for each. Print it or save it as a PDF to hand to decision-makers.
- **Tap any square** to see how many people live there and every trip from there (route, time and cost vs an auto), then open it in the trip planner.
- **Share any view:** the destination, peak/off-peak, Line 3, chosen feeders and language live in the link. Copy it, or show a **QR code** on stage so judges open your exact view on their phones. Trips in the planner have a QR code too.
- **Quick guide:** a 5-step tour on the first visit (pick a destination → add feeders → tap a square → city report → trip planner), replayable from the **?** button.

What the model finds (peak hour; official fares, timetable and auto tariff, road model calibrated on real trips; shares are of the 61 lakh residents within reach of the metro):

| Finding | Number |
|---|---|
| Headline | The metro beats an auto for **30% of residents** (37% of the area): the metro serves empty land better than dense neighbourhoods |
| Worst-served hub | **Magarpatta City**: the metro wins for only **17%** of residents, and an auto is better for 53% |
| Best-served hubs | **COEP** 67% and **Pune Railway Station** 60% |
| Hinjewadi and planned Line 3 | 47% of residents today (23% of the area); the Line 3 scenario raises it to **81%** |
| Best single feeder for the city | **Ramwadi**: +1.1 lakh residents better served (Kharadi, Viman Nagar, the airport) |
| One feeder at Kalyani Nagar, for the Airport | Residents for whom an auto is better: 27% → **5%** |
| Opening Range Hill station (built, not yet open) | Metro wins for SPPU trips: 32% → 56% of residents; city-wide: 30% → 37% |
| Five suggested feeders | Residents for whom the metro wins: **30% → 44%** |

### 🚇 Ride the story (`story.html`)

The pitch as a scroll-driven ride. Scrolling drives a Pune Metro train from PCMC to Swargate over the elevated line, from morning peak to night. It stops at seven stations, and each stop tells one part of the story:

| Stop | Chapter |
|---|---|
| PCMC | MetroMitra: "Pune built a metro. Now let's get people to it." |
| Khadki | The metro is here: 32 km, 28 stations, a train every 6 min, ₹10–35 |
| Shivaji Nagar | The trip doesn't start at a station: MIT-WPU → SPPU at 9 AM, a race between metro + autos (1 h 02, ₹134) and an auto (27 min, ₹97) |
| District Court | How big is the gap: 30% of 61 lakh residents, one dot per 1% |
| Budhwar Peth | The Gap Map tilts in and the five feeders are added as you scroll: 30% → 44% |
| Mandai | A phone turns towards you, running the real trip planner |
| Swargate | End of the line: open the app, or scan the QR code |

- **Live numbers.** Every number is computed live by the app's own engines (`js/story-data.js`), so the story can't drift from the app. The Gap Map work runs in a Web Worker so scrolling stays smooth.
- **The scene** is drawn on one canvas with no libraries: hills with Parvati's temples, the city with rooftop water tanks, Shaniwar Wada, the viaduct and overhead wires, stations with bilingual name boards, autos below, and ₹10 feeder e-buses after the Gap Map stop. The sky moves from sunrise to night, and windows light up.
- **Getting around:** an in-train LED display shows the clock and the next station. The line along the bottom jumps to any stop.
- **Languages and access:** English and Marathi. It works with the keyboard, with reduced motion, and offline once the app has been opened.

### 🌐 English / मराठी

The whole app (both tabs, the city report, errors and units) switches to Marathi with one tap, and remembers the choice. Station, landmark and line names switch too, and you can search in either language. Browsers set to Marathi start in Marathi. *The Marathi was written for the hackathon. Please have a native speaker review `js/i18n.js` and the names in `js/data.js`.*

### 🚈 Line 3 (planned)

The Gap Map can include the planned Hinjewadi–Shivajinagar Line 3 as a scenario. At peak hour, the share of residents for whom the metro beats an auto for trips to Hinjewadi Phase 1 rises from **47% to 81%** in this model (by area, 23% to 54%). Line 3's 45-minute end-to-end time is an estimate; the station list and coordinates are unverified estimates that should be checked on a map. PMRDA's fare is modeled with the existing slabs and may differ from the final fare.

### 🧭 Trip planner (for riders)

- Plan from a station, a landmark, a Marathi name (स्वारगेट) or 📍 GPS
- Door-to-door timeline with clock times: first mile → right line and direction → change at District Court → last mile
- Total cost including first and last mile, and an **honest verdict**: it says *take an auto* when the metro doesn't pay off
- Metro vs auto vs cab: time, ₹, CO₂
- Concession fares: student 30% off; Pune card / e-ticket 10% off on weekdays, 30% on weekends
- **Accessible mode:** larger controls and a step-free routing option with slower walking and extra station time; lift data are unverified placeholders until checked against Maha-Metro accessibility information
- Live service status, interactive network map, shareable trip links
- Report crowding, lift and escalator problems; active reports appear on the map and can inform accessible routing
- **My metro savings:** log the trips you take; see ₹ and CO₂ saved this month
- **Shareable savings card:** create a 1080×1080 English or Marathi PNG with this month's totals, ready to share or download
- **Works offline** (installable PWA), even underground with no signal

## How it works

```
js/data.js       Network (50 stations, 3 lines including planned Line 3), Marathi names, landmarks, 12 hubs, every tunable number
js/population.js Residents in every Gap Map square (WorldPop 2020), generated by tools/population.py
js/i18n.js       Every user-visible string in English and Marathi; t(key, vars)
js/planner.js    Trip engine: Dijkstra routing, fares, concessions, first/last mile, verdict (no DOM)
js/savings.js    Month filtering and trip totals for My metro savings (no DOM)
js/gapmap.js     Gap Map engine: grid, scoring, feeder simulation, greedy recommendations (no DOM)
js/app.js        Trip planner UI, tabs, savings tracker, share links
js/savings-card.js Draws and exports the shareable 1080×1080 savings card
js/gap-ui.js     Gap Map UI: heat map, feeder simulator, city report, link state
js/share.js      Shareable links (encode/decode) and the QR-code dialog
js/guide.js      First-visit guide
js/vendor/qrcode.js  QR Code Generator by Kazuhiko Arase (MIT), unmodified
story.html       The scroll-driven pitch (css/story.css)
js/story-data.js Every number the story shows, from the app's engines (no DOM)
js/story-worker.js Runs the story's Gap Map work off the main thread
js/story.js      The story: scroll timeline, canvas scene, chapters
sw.js            Service worker for offline use
tests/           Engine and translation tests (Node, no dependencies)
tools/           population.py: rebuilds js/population.js from the WorldPop raster
```

- **Routing.** One graph node per *(line, station)*, so changing lines at District Court costs real time (a platform walk plus half a headway). Dijkstra finds the fastest route.
- **Door to door.** The engine tries up to 3 stations near each end of the trip and picks the fastest combination. Short hops are walked, longer ones taken by auto.
- **Verdict.** *Metro* if it's cheaper and at most 5 min slower than an auto; *trade-off* if cheaper but slower; *auto* otherwise.
- **Gap Map score.** Each square scores 1 / 0.5 / 0 per hub (metro / trade-off / auto), averaged over the hubs. Green ≥ 0.67, amber ≥ 0.34, red below. Headline shares weight each square by its residents.
- **Population.** WorldPop's 1 km India grid is cropped to Pune, and each pixel is shared between the squares it overlaps in proportion to the overlap, so no one is counted twice. A test checks the file matches the grid in `data.js`.
- **Consistency.** The Gap Map and the trip planner run the same rules, and a test checks that they agree trip for trip.
- **Feeders.** A rider can always ignore a feeder, so adding one never makes a trip worse (also tested). "Residents better served" is each square's score gain × its residents, so a red square turning amber counts half. Suggestions are ranked by it.
- **Speed.** The open network's 756 station-to-station trips are precomputed once; the planned scenario has its own cached table. A feeder only re-scores trips that can use it.

### Where the numbers come from

| Data | Value used | Source |
|---|---|---|
| **Fares** | Official station-to-station fare chart, ₹10–₹35 (`FARE_CHART`) | **Maha-Metro fare chart.** 10 of 378 pairs are printed with different fares each way; kept as printed (`FARE_ASYMMETRIC`) |
| **Stations** | 13 open on Line 1 (Range Hill not yet open), 16 on Line 2 | **Maha-Metro project profile** |
| **Hours, frequency** | 06:00–23:00; every 6 min at peak (8–11 AM, 4–8 PM), every 10 min otherwise | **Official timetable, w.e.f. 15 Aug 2025** |
| **End-to-end times** | PCMC–Swargate 34 min / 17.5 km; Vanaz–Ramwadi 37 min / 14.5 km (speeds calibrated to match) | **Official timetable** |
| **Auto fare** | ₹26 for the first 1.5 km, ₹17.14/km after, +25% from midnight to 5 AM | **Pune RTA official meter tariff** (app autos charge more, so metro savings shown are conservative) |
| Road model | Road distance = 1.39 × straight line; 14.6 km/h at 9 AM, 24.1 km/h at 2 PM; cab ₹35 + ₹22.5/km, ×1.5 surge at peak; auto wait 4 min; station entry 2.5 min; interchange 4 min | Fitted to 4 team-collected trips (MIT-WPU → Airport, MIT-WPU → Pune Station, Hinjewadi → Shivajinagar, Kharadi → Pune Station), stored as ranges in `CALIBRATION_TRIPS`; a test keeps the model within 10% of every range. The ranges are summaries, not app screenshots |
| Planned Line 3 | 23.3 km; 45 min in the model; PMRDA fares estimated from distance slabs | Corridor length supplied; run time, fares, station list and coordinates are estimates |
| Concessions | Student 30% daily; card/e-ticket 10% weekdays, 30% weekends | News reports 2023–25 |
| Station coordinates, Marathi names | hand-entered | Approximate; please check against signage |
| CO₂, feeder model | see `CONFIG` | Estimates |
| **Population** | Residents per square, 61 lakh within reach of the metro | **WorldPop 2020** India 1 km grid (`ind_ppp_2020_1km_Aggregated`), CC BY 4.0. Modelled estimates, not a census. Raw file on the `data/worldpop` branch |

> ⚠️ Lines 1–2 fares, open stations and operating times use official Maha-Metro material, the auto tariff is Pune RTA's, and the road model is calibrated on team-collected trips. Line 3's timing, fares, station list and coordinates are estimates, as are coordinates, CO₂ and the feeder model. Everything lives in `js/data.js`, so each fix is a one-line edit, and the Gap Map and the planner both update. Search also understands the fare chart's station names (Paud Phata, S.N.D.T. College, R.T.O., Kasba Peth, Nashik Phata, Mahatma Phule Mandai, Civil Court).

## Run it

No build step, nothing to install.

- **Online:** [blop77.github.io/metro-mitra](https://blop77.github.io/metro-mitra/), hosted on GitHub Pages and redeployed whenever `main` changes.
- **Locally:**

```bash
npx serve .                    # GPS and offline mode need http(s), not file://
node tests/planner.test.js     # trip engine
node tests/gapmap.test.js      # Gap Map engine
node tests/i18n.test.js        # every string translated, every key used exists
node tests/savings.test.js     # savings totals and month filtering
node tests/reports.test.js     # station reports and expiry
node tests/share.test.js       # share links round-trip; bad links are ignored safely
node tests/story.test.js       # the story's numbers match the planner and the Gap Map
```

## Demo script (3 minutes)

0. **Open with the story** (`story.html`, full screen) and scroll through it in about 90 seconds. It sets up the problem, the numbers and the fix. Press *Open the Gap Map* at the end.
1. **The problem (Gap Map, all hubs, peak).** "Of the 61 lakh people living near the metro, it beats an auto for only 30%. Amber is everywhere: the metro is cheaper, but the last mile makes it slower."
2. **Pick Magarpatta City.** 17%, the worst hub. Then pick Hinjewadi, tick *Include Line 3 (planned)* and watch it rise from 47% to 81%. "This is why Line 3 matters."
3. **Pick Kharadi.** Red around EON IT Park. Tap a red square to show how many people live there, and the 5 km auto from Ramwadi that kills the trip.
4. **Add the suggested feeders.** Watch the map turn green: 30% → 44% of residents. Ramwadi alone serves 1.1 lakh people better. Then tap a station to add a feeder by hand.
5. **City report.** "Here is the one feeder each hub needs." Print it as a PDF for the judges.
6. **Open in trip planner** from a square. Show the honest verdict, switch to a *Student* ticket, then tap *I took this trip*.
7. **Airplane mode.** Plan again: it still works offline.

**Tip:** set up the view you want on your laptop, press **▣ Show QR code**, and put it on screen. Judges can scan it and follow along on their phones.

## Working with Codex (optional)

The project is complete without it. If Codex credits are available at the event, [`AGENTS.md`](AGENTS.md) gives Codex the architecture, rules and ready-to-paste tasks (PMPML GTFS feeders, crowd and lift reports). Line 3, the savings card and accessible mode were built this way.

## License

MIT, see [LICENSE](LICENSE). `js/vendor/qrcode.js` is © Kazuhiko Arase, MIT licence (header kept in the file). Population data: WorldPop (www.worldpop.org, School of Geography and Environmental Science, University of Southampton), CC BY 4.0.
