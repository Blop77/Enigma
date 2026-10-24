/*
 * data.js — Pune Metro network, landmarks and cost assumptions for MetroMitra.
 *
 * Official Maha-Metro sources (shared by the team, Oct 2026):
 *   - station list and open status: Maha-Metro "Project profile"
 *   - service hours, peak hours, frequencies, end-to-end times and distances:
 *     Pune Metro timetable "W.E.F. 15th August 2025"
 *   - fares: Maha-Metro station-to-station fare chart (FARE_CHART below)
 *   - auto meter tariff: Pune RTA official meter rates
 * Calibrated on team-collected trips (CALIBRATION_TRIPS): road distance factor,
 * road speeds, cab fares, auto wait, station entry and interchange times.
 * Still ESTIMATES: station coordinates (entered by hand, good to ~200 m),
 * emission factors and the feeder model.
 * Everything tunable lives here so the engines never change when numbers do.
 *
 * Works in the browser (window.MetroData) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  // id: [name, lat, lng]
  var STATIONS = {
    'pcmc':              ['PCMC',                       18.6293, 73.7998],
    'sant-tukaram-nagar':['Sant Tukaram Nagar',         18.6205, 73.8136],
    'bhosari':           ['Bhosari (Nashik Phata)',     18.6122, 73.8237],
    'kasarwadi':         ['Kasarwadi',                  18.6030, 73.8290],
    'phugewadi':         ['Phugewadi',                  18.5925, 73.8350],
    'dapodi':            ['Dapodi',                     18.5830, 73.8400],
    'bopodi':            ['Bopodi',                     18.5730, 73.8440],
    'khadki':            ['Khadki',                     18.5640, 73.8470],
    'shivaji-nagar':     ['Shivaji Nagar',              18.5320, 73.8500],
    'civil-court':       ['District Court',             18.5270, 73.8550],   // also called Civil Court
    'budhwar-peth':      ['Budhwar Peth',               18.5180, 73.8560],
    'mandai':            ['Mandai',                     18.5120, 73.8560],
    'swargate':          ['Swargate',                   18.5010, 73.8630],

    'vanaz':             ['Vanaz',                      18.5070, 73.8050],
    'anand-nagar':       ['Anand Nagar',                18.5075, 73.8130],
    'ideal-colony':      ['Ideal Colony',               18.5085, 73.8195],
    'nal-stop':          ['Nal Stop',                   18.5095, 73.8290],
    'garware-college':   ['Garware College',            18.5135, 73.8370],
    'deccan':            ['Deccan Gymkhana',            18.5170, 73.8420],
    'sambhaji-udyan':    ['Chhatrapati Sambhaji Udyan', 18.5200, 73.8460],
    'pmc':               ['PMC',                        18.5235, 73.8520],
    'mangalwar-peth':    ['Mangalwar Peth',             18.5280, 73.8640],
    'pune-station':      ['Pune Railway Station',       18.5290, 73.8740],
    'ruby-hall':         ['Ruby Hall Clinic',           18.5320, 73.8790],
    'bund-garden':       ['Bund Garden',                18.5385, 73.8850],
    'yerawada':          ['Yerawada',                   18.5460, 73.8920],
    'kalyani-nagar':     ['Kalyani Nagar',              18.5480, 73.9010],
    'ramwadi':           ['Ramwadi',                    18.5530, 73.9110]
  };

  // Station names in Marathi, so riders can search the way they read signboards.
  // Please have a native speaker check these against station signage.
  var STATIONS_MR = {
    'pcmc': 'पीसीएमसी', 'sant-tukaram-nagar': 'संत तुकाराम नगर', 'bhosari': 'भोसरी (नाशिक फाटा)',
    'kasarwadi': 'कासारवाडी', 'phugewadi': 'फुगेवाडी', 'dapodi': 'दापोडी', 'bopodi': 'बोपोडी',
    'khadki': 'खडकी', 'shivaji-nagar': 'शिवाजीनगर', 'civil-court': 'जिल्हा न्यायालय',
    'budhwar-peth': 'बुधवार पेठ', 'mandai': 'मंडई', 'swargate': 'स्वारगेट',
    'vanaz': 'वनाझ', 'anand-nagar': 'आनंदनगर', 'ideal-colony': 'आयडियल कॉलनी', 'nal-stop': 'नळ स्टॉप',
    'garware-college': 'गरवारे कॉलेज', 'deccan': 'डेक्कन जिमखाना', 'sambhaji-udyan': 'छत्रपती संभाजी उद्यान',
    'pmc': 'पीएमसी', 'mangalwar-peth': 'मंगळवार पेठ', 'pune-station': 'पुणे रेल्वे स्थानक',
    'ruby-hall': 'रुबी हॉल क्लिनिक', 'bund-garden': 'बंड गार्डन', 'yerawada': 'येरवडा',
    'kalyani-nagar': 'कल्याणीनगर', 'ramwadi': 'रामवाडी'
  };

  // Stations in running order. Shared ids are interchanges.
  // lengthKm and runMin are the end-to-end distance and time from the official
  // timetable; station gaps and running speed are scaled to match them.
  // Range Hill (between Khadki and Shivaji Nagar) is built but not open yet, so
  // trains pass it without stopping; add it back here when it opens.
  var LINES = {
    purple: {
      name: 'Purple Line',
      short: 'Line 1',
      color: '#8e3fa8',
      lengthKm: 17.5,
      runMin: 34,
      stations: ['pcmc', 'sant-tukaram-nagar', 'bhosari', 'kasarwadi', 'phugewadi', 'dapodi',
                 'bopodi', 'khadki', 'shivaji-nagar', 'civil-court',
                 'budhwar-peth', 'mandai', 'swargate']
    },
    aqua: {
      name: 'Aqua Line',
      short: 'Line 2',
      color: '#0fa3b1',
      lengthKm: 14.5,
      runMin: 37,
      stations: ['vanaz', 'anand-nagar', 'ideal-colony', 'nal-stop', 'garware-college', 'deccan',
                 'sambhaji-udyan', 'pmc', 'civil-court', 'mangalwar-peth', 'pune-station',
                 'ruby-hall', 'bund-garden', 'yerawada', 'kalyani-nagar', 'ramwadi']
    }
  };

  // Official station-to-station fares (₹), transcribed from Maha-Metro's fare chart.
  // Row = boarding station, column = destination, both in FARE_CODES order. The chart
  // lists District Court under both lines with identical fares; it appears once here.
  // The printed chart is not perfectly symmetric: the pairs in FARE_ASYMMETRIC cost
  // differently each way and are kept exactly as printed. Please confirm them in the app.
  var FARE_CODES = ['PIM', 'STG', 'BHO', 'KWA', 'PGD', 'DDI', 'BPI', 'KHK', 'SJO', 'CVC', 'BPD', 'MNA', 'SGT', 'VNZ', 'AND', 'ICY', 'NST', 'GWC', 'DGK', 'SAN', 'PMC', 'MGA', 'PRS', 'RUC', 'BUN', 'YER', 'KNA', 'RAW'];
  var FARE_CHART = [
    /* PIM */ [ 0, 15, 15, 20, 20, 25, 25, 25, 30, 30, 30, 30, 30, 35, 35, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 35, 35],
    /* STG */ [15,  0, 10, 15, 15, 15, 20, 25, 25, 25, 30, 30, 30, 30, 30, 30, 30, 25, 25, 30, 25, 30, 30, 30, 30, 30, 30, 35],
    /* BHO */ [15, 10,  0, 10, 15, 15, 20, 20, 25, 25, 25, 30, 30, 30, 30, 30, 30, 30, 30, 25, 25, 25, 30, 30, 30, 30, 30, 35],
    /* KWA */ [20, 15, 10,  0, 10, 10, 15, 20, 25, 25, 25, 25, 30, 30, 30, 30, 30, 25, 25, 25, 25, 25, 25, 25, 30, 30, 30, 30],
    /* PGD */ [20, 15, 15, 10,  0, 10, 15, 15, 25, 25, 25, 25, 30, 30, 30, 30, 25, 25, 25, 25, 25, 25, 25, 25, 25, 30, 30, 30],
    /* DDI */ [25, 15, 15, 10, 10,  0, 10, 15, 25, 25, 25, 25, 30, 30, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 30, 30],
    /* BPI */ [25, 20, 20, 15, 15, 10,  0, 10, 20, 20, 25, 25, 25, 30, 25, 25, 25, 25, 20, 25, 25, 25, 25, 25, 25, 25, 25, 30],
    /* KHK */ [25, 25, 20, 20, 15, 15, 10,  0, 15, 20, 20, 25, 25, 25, 25, 25, 25, 25, 25, 20, 20, 20, 25, 25, 25, 25, 25, 30],
    /* SJO */ [30, 25, 25, 25, 25, 25, 20, 15,  0, 10, 15, 15, 20, 25, 25, 20, 20, 15, 15, 15, 10, 15, 15, 15, 20, 20, 25, 25],
    /* CVC */ [30, 25, 25, 25, 25, 25, 20, 20, 10,  0, 10, 15, 15, 25, 20, 20, 15, 15, 10, 10, 10, 10, 10, 15, 15, 20, 25, 25],
    /* BPD */ [30, 30, 25, 25, 25, 25, 25, 20, 15, 10,  0, 10, 15, 25, 25, 20, 20, 15, 15, 15, 10, 15, 15, 15, 20, 20, 25, 25],
    /* MNA */ [30, 30, 30, 25, 25, 25, 25, 25, 15, 15, 10,  0, 10, 25, 25, 25, 20, 20, 15, 15, 15, 15, 15, 20, 20, 25, 25, 25],
    /* SGT */ [30, 30, 30, 30, 25, 25, 25, 25, 20, 15, 15, 10,  0, 25, 25, 25, 25, 25, 20, 20, 20, 20, 20, 25, 25, 25, 25, 25],
    /* VNZ */ [35, 30, 30, 30, 30, 30, 30, 25, 25, 25, 25, 25, 25,  0, 10, 10, 15, 15, 20, 20, 20, 25, 25, 25, 25, 25, 30, 30],
    /* AND */ [35, 30, 30, 30, 30, 30, 25, 25, 25, 20, 25, 25, 25, 10,  0, 10, 10, 15, 15, 20, 20, 25, 25, 25, 25, 25, 30, 30],
    /* ICY */ [30, 30, 30, 30, 30, 25, 25, 25, 20, 20, 20, 25, 25, 10, 10,  0, 10, 10, 15, 15, 20, 20, 25, 25, 25, 25, 25, 30],
    /* NST */ [30, 30, 30, 30, 25, 25, 25, 25, 20, 15, 20, 20, 25, 15, 10, 10,  0, 10, 10, 15, 15, 20, 20, 25, 25, 25, 25, 25],
    /* GWC */ [30, 30, 30, 25, 25, 25, 25, 25, 15, 15, 15, 20, 25, 15, 15, 10, 10,  0, 10, 10, 15, 15, 20, 20, 25, 25, 25, 25],
    /* DGK */ [30, 30, 30, 25, 25, 25, 25, 25, 15, 10, 15, 15, 20, 20, 15, 15, 10, 10,  0, 10, 10, 15, 15, 25, 25, 20, 25, 25],
    /* SAN */ [30, 30, 25, 25, 25, 25, 25, 20, 15, 10, 15, 15, 20, 20, 20, 15, 15, 10, 10,  0, 10, 15, 15, 15, 25, 20, 25, 25],
    /* PMC */ [30, 25, 25, 25, 25, 25, 25, 20, 10, 10, 10, 15, 20, 20, 20, 20, 15, 15, 10, 10,  0, 10, 15, 15, 20, 20, 25, 25],
    /* MGA */ [30, 30, 25, 25, 25, 25, 25, 20, 15, 10, 15, 15, 20, 25, 25, 20, 20, 15, 15, 15, 10,  0, 10, 10, 15, 15, 20, 25],
    /* PRS */ [30, 30, 30, 25, 25, 25, 25, 25, 15, 10, 15, 15, 20, 25, 25, 25, 20, 20, 15, 15, 15, 10,  0, 10, 10, 15, 20, 25],
    /* RUC */ [30, 30, 30, 25, 25, 25, 25, 25, 15, 15, 15, 20, 25, 25, 25, 25, 25, 20, 20, 15, 15, 10, 10,  0, 10, 10, 20, 20],
    /* BUN */ [30, 30, 30, 30, 25, 25, 25, 25, 20, 15, 20, 20, 25, 25, 25, 25, 25, 25, 20, 20, 20, 15, 10, 10,  0, 10, 15, 20],
    /* YER */ [30, 30, 30, 30, 30, 25, 25, 25, 20, 20, 20, 25, 25, 25, 25, 25, 25, 25, 20, 20, 20, 15, 15, 10, 10,  0, 15, 15],
    /* KNA */ [35, 30, 30, 30, 30, 30, 25, 25, 25, 25, 25, 25, 25, 30, 30, 25, 25, 25, 25, 25, 25, 20, 20, 15, 15, 15,  0, 10],
    /* RAW */ [35, 35, 35, 30, 30, 30, 30, 30, 25, 25, 25, 25, 25, 30, 30, 30, 25, 25, 25, 25, 25, 25, 25, 20, 20, 15, 10,  0]
  ];
  var FARE_ASYMMETRIC = [['STG', 'GWC'], ['STG', 'DGK'], ['PGD', 'SGT'], ['DDI', 'SGT'], ['DDI', 'AND'], ['BPI', 'DGK'], ['DGK', 'RUC'], ['DGK', 'BUN'], ['SAN', 'BUN'], ['RUC', 'KNA']];

  // Station id -> code used on Maha-Metro's fare chart.
  var STATION_CODES = {
    'pcmc': 'PIM', 'sant-tukaram-nagar': 'STG', 'bhosari': 'BHO', 'kasarwadi': 'KWA', 'phugewadi': 'PGD',
    'dapodi': 'DDI', 'bopodi': 'BPI', 'khadki': 'KHK', 'shivaji-nagar': 'SJO', 'civil-court': 'CVC',
    'budhwar-peth': 'BPD', 'mandai': 'MNA', 'swargate': 'SGT', 'vanaz': 'VNZ', 'anand-nagar': 'AND',
    'ideal-colony': 'ICY', 'nal-stop': 'NST', 'garware-college': 'GWC', 'deccan': 'DGK',
    'sambhaji-udyan': 'SAN', 'pmc': 'PMC', 'mangalwar-peth': 'MGA', 'pune-station': 'PRS', 'ruby-hall': 'RUC',
    'bund-garden': 'BUN', 'yerawada': 'YER', 'kalyani-nagar': 'KNA', 'ramwadi': 'RAW'
  };

  // Other names riders use for a station (the fare chart and older maps use some
  // of these), so search finds them. English and Marathi.
  var STATION_ALIASES = {
    'civil-court': ['Civil Court', 'सिव्हिल कोर्ट'],
    'bhosari': ['Nashik Phata', 'नाशिक फाटा'],
    'budhwar-peth': ['Kasba Peth', 'कसबा पेठ'],
    'mandai': ['Mahatma Phule Mandai', 'महात्मा फुले मंडई'],
    'ideal-colony': ['Paud Phata', 'पौड फाटा'],
    'nal-stop': ['S. N. D. T. College', 'SNDT College', 'एसएनडीटी कॉलेज'],
    'mangalwar-peth': ['R.T.O., Pune', 'RTO', 'आरटीओ'],
    'yerawada': ['Yerwada']
  };

  // Places people actually travel to. name, lat, lng.
  var LANDMARKS = [
    ['MIT-WPU, Kothrud',            18.5182, 73.8153],
    ['Fergusson College',           18.5236, 73.8410],
    ['COEP',                        18.5293, 73.8566],
    ['Shaniwar Wada',               18.5195, 73.8553],
    ['Dagdusheth Ganpati',          18.5164, 73.8561],
    ['Laxmi Road',                  18.5150, 73.8560],
    ['Sarasbaug',                   18.5003, 73.8524],
    ['Parvati Hill',                18.4970, 73.8470],
    ['Kothrud',                     18.5074, 73.8077],
    ['Karve Nagar',                 18.4900, 73.8180],
    ['Katraj',                      18.4575, 73.8585],
    ['Savitribai Phule Pune University', 18.5536, 73.8247],
    ['Aundh',                       18.5580, 73.8075],
    ['Baner',                       18.5590, 73.7868],
    ['Balewadi Stadium',            18.5775, 73.7735],
    ['Wakad',                       18.5987, 73.7650],
    ['Hinjewadi Phase 1',           18.5913, 73.7389],
    ['Nigdi',                       18.6510, 73.7700],
    ['Bhosari MIDC',                18.6280, 73.8450],
    ['Camp (MG Road)',              18.5167, 73.8790],
    ['Koregaon Park',               18.5362, 73.8940],
    ['Aga Khan Palace',             18.5524, 73.9015],
    ['Viman Nagar',                 18.5679, 73.9143],
    ['Phoenix Marketcity',          18.5622, 73.9167],
    ['Pune Airport',                18.5793, 73.9089],
    ['Kharadi (EON IT Park)',       18.5515, 73.9474],
    ['Hadapsar',                    18.5089, 73.9260],
    ['Magarpatta City',             18.5157, 73.9272]
  ];

  // Landmark names in Marathi (keyed by the English name above). Please have
  // a native speaker check these too.
  var LANDMARKS_MR = {
    'MIT-WPU, Kothrud': 'एमआयटी-डब्ल्यूपीयू, कोथरूड',
    'Fergusson College': 'फर्ग्युसन कॉलेज',
    'COEP': 'सीओईपी',
    'Shaniwar Wada': 'शनिवार वाडा',
    'Dagdusheth Ganpati': 'दगडूशेठ गणपती',
    'Laxmi Road': 'लक्ष्मी रस्ता',
    'Sarasbaug': 'सारसबाग',
    'Parvati Hill': 'पर्वती',
    'Kothrud': 'कोथरूड',
    'Karve Nagar': 'कर्वेनगर',
    'Katraj': 'कात्रज',
    'Savitribai Phule Pune University': 'सावित्रीबाई फुले पुणे विद्यापीठ',
    'Aundh': 'औंध',
    'Baner': 'बाणेर',
    'Balewadi Stadium': 'बालेवाडी स्टेडियम',
    'Wakad': 'वाकड',
    'Hinjewadi Phase 1': 'हिंजवडी फेज 1',
    'Nigdi': 'निगडी',
    'Bhosari MIDC': 'भोसरी एमआयडीसी',
    'Camp (MG Road)': 'कॅम्प (एम.जी. रोड)',
    'Koregaon Park': 'कोरेगाव पार्क',
    'Aga Khan Palace': 'आगाखान पॅलेस',
    'Viman Nagar': 'विमाननगर',
    'Phoenix Marketcity': 'फिनिक्स मार्केटसिटी',
    'Pune Airport': 'पुणे विमानतळ',
    'Kharadi (EON IT Park)': 'खराडी (इऑन आयटी पार्क)',
    'Hadapsar': 'हडपसर',
    'Magarpatta City': 'मगरपट्टा सिटी'
  };

  var CONFIG = {
    // Fallback fare by trip distance (km, inclusive upper bound -> rupees), used only
    // for station pairs missing from FARE_CHART (e.g. a future line).
    fareSlabs: [[1, 10], [2, 15], [4, 20], [8, 25], [16, 30], [Infinity, 35]],

    // Concessions, as reported in 2023–25 news. Percent off the fare.
    // card = One Pune card or e-ticket. Weekend means Saturday and Sunday.
    concessions: {
      regular: { weekday: 0,  weekend: 0,  label: 'Regular' },
      card:    { weekday: 10, weekend: 30, label: 'Pune card / e-ticket' },
      student: { weekday: 30, weekend: 30, label: 'Student' }
    },

    // Metro operations.
    dwellMin: 0.5,           // stop time at each intermediate station (running speed comes from LINES.runMin)
    transferMin: 4,          // District Court interchange walk: 3–5 min (team)
    firstTrain: '06:00',
    lastTrain: '23:00',
    peakHeadwayMin: 6,
    offPeakHeadwayMin: 10,
    peakWindows: [['08:00', '11:00'], ['16:00', '20:00']],
    stationEntryMin: 2.5,    // gate to platform at elevated stations: 2–3 min (team, Vanaz)

    // Roads. Straight-line distance is multiplied by this to estimate road distance.
    roadFactor: 1.39,        // fitted to CALIBRATION_TRIPS (1.32–1.48)
    walkKmh: 4.5,
    cycleKmh: 13,
    roadKmhOffPeak: 24.1,    // 2 PM, fitted to CALIBRATION_TRIPS (21–27 km/h)
    roadKmhPeak: 14.6,       // 9 AM, fitted to CALIBRATION_TRIPS (13–16 km/h)

    // First/last mile: walk anything shorter than this (km of road).
    maxWalkKm: 1.0,
    // ...and cycle up to this far when the rider picks cycling; beyond it, take an auto.
    maxCycleKm: 5,

    // Auto: Pune RTA meter tariff. App autos (Uber/Ola) often charge ₹18–21/km, so
    // using the meter rate keeps the metro's savings conservative.
    auto: { baseFare: 26, baseKm: 1.5, perKm: 17.14, waitMin: 4,       // wait near Vanaz: 3–5 min (team)
            night: { pct: 25, from: '00:00', to: '05:00' } },
    // Cab (Uber Go / Ola Mini): off-peak fare fitted to CALIBRATION_TRIPS; at peak
    // hours app prices surge by about this factor (1.38–1.59 on those trips).
    cab:  { baseFare: 35, perKm: 22.5, waitMin: 6, peakSurge: 1.5 },

    // Grams of CO2 per passenger-km.
    co2: { metro: 15, auto: 70, cab: 150, walk: 0, cycle: 0, feeder: 40 },

    // A hypothetical feeder service (e-bus / shared e-rickshaw) used by the Gap Map
    // simulator: flat fare, serves stops up to maxKm from its station.
    feeder: { fare: 10, kmh: 16, waitMin: 6, maxKm: 6 },

    // Gap Map grid: cell size in degrees (~0.9 km), how far from a station a cell
    // may be and still be drawn, and the shortest trip worth considering.
    gapMap: { minLat: 18.44, maxLat: 18.67, minLng: 73.72, maxLng: 73.97, step: 0.008,
              maxStationKm: 9, minTripKm: 2.5 },

    // Pune's rough bounding box, used to reject far-away GPS fixes.
    bounds: { minLat: 18.40, maxLat: 18.72, minLng: 73.68, maxLng: 74.02 }
  };

  // Trips the team collected (Oct 2026) that the road model is calibrated on, as
  // [low, high] ranges (summaries of app and meter prices, not single app
  // screenshots, so treat them as indicative). The model is fitted to the midpoints.
  // km: road distance; auto: RTO meter fare; cab / cabPeak: Uber Go / Ola Mini at
  // 2 PM / 9 AM; peakMin / offMin: car time at 9 AM / 2 PM.
  var CALIBRATION_TRIPS = [
    { from: 'MIT-WPU, Kothrud', to: 'Pune Airport', km: [16.5, 17], auto: [285, 330],
      cab: [420, 470], cabPeak: [550, 680], peakMin: [65, 75], offMin: [40, 45] },
    { from: 'MIT-WPU, Kothrud', to: 'Pune Railway Station', km: [8.5, 9], auto: [145, 175],
      cab: [210, 260], cabPeak: [320, 420], peakMin: [35, 45], offMin: [22, 28] },
    { from: 'Hinjewadi Phase 1', to: 'Shivaji Nagar', km: [17, 18.5], auto: [295, 350],
      cab: [380, 440], cabPeak: [550, 750], peakMin: [60, 75], offMin: [35, 45] },
    { from: 'Kharadi (EON IT Park)', to: 'Pune Railway Station', km: [11.5, 12.5], auto: [200, 245],
      cab: [260, 330], cabPeak: [380, 490], peakMin: [45, 55], offMin: [25, 35] }
  ];

  // Where Pune travels to every day: jobs, colleges, transport hubs. Names refer
  // to a station or a landmark above. The Gap Map measures access to these.
  var HUBS = [
    'Hinjewadi Phase 1', 'Kharadi (EON IT Park)', 'Magarpatta City', 'Bhosari MIDC',
    'Pune Railway Station', 'Swargate', 'Pune Airport', 'Camp (MG Road)',
    'Fergusson College', 'Savitribai Phule Pune University', 'COEP', 'MIT-WPU, Kothrud'
  ];

  var MetroData = { STATIONS: STATIONS, STATIONS_MR: STATIONS_MR, LINES: LINES, LANDMARKS: LANDMARKS,
                    LANDMARKS_MR: LANDMARKS_MR, HUBS: HUBS, CONFIG: CONFIG,
                    FARE_CODES: FARE_CODES, FARE_CHART: FARE_CHART, FARE_ASYMMETRIC: FARE_ASYMMETRIC,
                    STATION_CODES: STATION_CODES, STATION_ALIASES: STATION_ALIASES,
                    CALIBRATION_TRIPS: CALIBRATION_TRIPS };

  if (typeof module !== 'undefined' && module.exports) module.exports = MetroData;
  else root.MetroData = MetroData;
})(this);
