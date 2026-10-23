/*
 * data.js — Pune Metro network, landmarks and cost assumptions for MetroMitra.
 *
 * Coordinates are approximate (good to ~200 m) and were entered by hand.
 * Fares, auto/cab tariffs, timings and emission factors are ESTIMATES used
 * for the prototype. Check them against the official Maha-Metro fare chart
 * and the Pune RTA tariff before the demo. Everything tunable lives here so
 * the planner itself never needs to change when numbers do.
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
    'range-hills':       ['Range Hills',                18.5500, 73.8420],
    'shivaji-nagar':     ['Shivaji Nagar',              18.5320, 73.8500],
    'civil-court':       ['Civil Court',                18.5270, 73.8550],
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

  // Stations in running order. Shared ids are interchanges.
  var LINES = {
    purple: {
      name: 'Purple Line',
      short: 'Line 1',
      color: '#8e3fa8',
      lengthKm: 17.4,      // published route length; station gaps are scaled to match
      stations: ['pcmc', 'sant-tukaram-nagar', 'bhosari', 'kasarwadi', 'phugewadi', 'dapodi',
                 'bopodi', 'khadki', 'range-hills', 'shivaji-nagar', 'civil-court',
                 'budhwar-peth', 'mandai', 'swargate']
    },
    aqua: {
      name: 'Aqua Line',
      short: 'Line 2',
      color: '#0fa3b1',
      lengthKm: 15.7,
      stations: ['vanaz', 'anand-nagar', 'ideal-colony', 'nal-stop', 'garware-college', 'deccan',
                 'sambhaji-udyan', 'pmc', 'civil-court', 'mangalwar-peth', 'pune-station',
                 'ruby-hall', 'bund-garden', 'yerawada', 'kalyani-nagar', 'ramwadi']
    }
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

  var CONFIG = {
    // Metro fare by trip distance (km, inclusive upper bound -> rupees).
    fareSlabs: [[2, 10], [4, 15], [8, 20], [12, 25], [18, 30], [Infinity, 35]],

    // Metro operations.
    metroSpeedKmh: 33,       // average running speed between stations
    dwellMin: 0.5,           // stop time at each intermediate station
    transferMin: 4,          // walking between platforms at an interchange
    firstTrain: '06:00',
    lastTrain: '22:00',
    peakHeadwayMin: 7,
    offPeakHeadwayMin: 10,
    peakWindows: [['08:00', '11:00'], ['17:00', '20:00']],
    stationEntryMin: 3,      // security check, ticket, reaching the platform

    // Roads. Straight-line distance is multiplied by this to estimate road distance.
    roadFactor: 1.3,
    walkKmh: 4.5,
    cycleKmh: 13,
    roadKmhOffPeak: 22,
    roadKmhPeak: 14,

    // First/last mile: walk anything shorter than this (km of road).
    maxWalkKm: 1.0,
    // ...and cycle up to this far when the rider picks cycling; beyond it, take an auto.
    maxCycleKm: 5,

    auto: { baseFare: 26, baseKm: 1.5, perKm: 18, waitMin: 4 },
    cab:  { baseFare: 60, perKm: 15, waitMin: 6 },

    // Grams of CO2 per passenger-km.
    co2: { metro: 15, auto: 70, cab: 150, walk: 0, cycle: 0 },

    // Pune's rough bounding box, used to reject far-away GPS fixes.
    bounds: { minLat: 18.40, maxLat: 18.72, minLng: 73.68, maxLng: 74.02 }
  };

  var MetroData = { STATIONS: STATIONS, LINES: LINES, LANDMARKS: LANDMARKS, CONFIG: CONFIG };

  if (typeof module !== 'undefined' && module.exports) module.exports = MetroData;
  else root.MetroData = MetroData;
})(this);
