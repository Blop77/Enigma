# MetroMitra · मेट्रोमित्र

**Your door-to-door Pune Metro companion.** Built for the Pune Metro hackathon, theme **Urban mobility**.

### ▶ Live: [blop77.github.io/Enigma/metro-mitra](https://blop77.github.io/Enigma/metro-mitra/) (once merged to `main`)

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
5. **Live service status:** running, peak/off-peak frequency, closed, or "opens in 20 min".
6. **An interactive network map:** tap two stations to plan; the route and first/last mile are drawn on it.
7. **Shareable trip links:** send a friend `…#from=MIT-WPU&to=Pune Airport`.

It tries up to 3 stations near each end of the trip (9 combinations) and picks the fastest door to door. So it will happily tell you to walk 10 minutes to a different station if that skips an interchange.

## How it works

```
js/data.js       Network (29 stations, 2 lines), 28 landmarks, every tunable number
js/planner.js    Engine: Dijkstra routing, fares, first/last mile, comparison (no DOM; runs in Node)
js/app.js        UI: form, results timeline, SVG map, GPS, share links
tests/           node tests/planner.test.js
```

- **Routing:** the graph has one node per *(line, station)*, so changing lines at Civil Court costs real time (platform walk + half a headway of waiting). Dijkstra finds the fastest route.
- **Distances:** straight-line gaps between station coordinates, scaled so each line adds up to its published length (Purple 17.4 km, Aqua 15.7 km).
- **Fares:** distance slabs ₹10–₹35. Autos: Pune RTA-style meter (minimum fare for the first 1.5 km, then per km). Road distance ≈ 1.3 × straight line, and traffic is slower in peak hours.

> ⚠️ **All fares, timings, coordinates and tariffs are estimates** kept in `js/data.js`. Check them against the official Maha-Metro fare chart and timetable before the demo. Fixing a number means editing one line there.

## Run it

No build step, nothing to install. Open `index.html` in a browser, or:

```bash
npx serve .            # GPS needs http(s), not file://
node tests/planner.test.js
```

## Hackathon plan: what to build next (Codex sprint)

The core (data → engine → UI) works end to end and has tests. Each item below is self-contained, so it makes a good prompt for Codex, or for us if the credits fall through:

| # | Feature | Why judges care | Size |
|---|---|---|---|
| 1 | **Verify data:** official fare chart, real station coordinates, first/last train times | Accuracy | S |
| 2 | **Marathi / Hindi UI** (station names + labels; `data.js` already has a single place for names) | Inclusion | S |
| 3 | **Crowd reports:** "how crowded is the train / is the lift working?" tap-to-report, shown on the map | Civic, community | M |
| 4 | **PMPML feeder buses** as a first/last-mile option (Pune open-data GTFS) | Real last-mile fix | M |
| 5 | **Offline PWA:** installable, works underground with no signal | Practical | S |
| 6 | **Line 3 (Hinjewadi–Shivajinagar)**: add stations to `LINES` when it opens; the engine needs no changes | Future-proof | S |
| 7 | **Monthly savings tracker:** "you saved ₹2,400 and 18 kg CO₂ this month by taking the metro" | Engagement | M |
| 8 | **Accessibility mode:** lift/escalator-only routes, larger text | Inclusion | M |

**Demo script (2 min):** MIT-WPU → Airport (metro wins, ₹155 saved) → Hinjewadi → Koregaon Park in cycle mode (honest trade-off) → Fergusson College → Shaniwar Wada, where the app says *take an auto*. That honesty is the pitch.
