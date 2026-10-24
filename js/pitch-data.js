/* Pure pitch-sheet figures derived from the Gap Map engine. */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var G = isNode ? require('./gapmap.js') : root.GapMap;
  var Data = isNode ? require('./data.js') : root.MetroData;

  function findHub(hubs, prefix) {
    for (var i = 0; i < hubs.length; i++) if (hubs[i].indexOf(prefix) === 0) return i;
    return -1;
  }

  function pitchNumbers() {
    var bare = G.build({ peak: true });
    var feeders = G.recommend(bare, 5, -1).filter(function (r) { return r.gainKm2 >= 0.5; });
    var basePct = G.summary(bare, -1).goodPct;
    var withFeeders = G.build({ peak: true, feeders: feeders.map(function (r) { return r.station; }) });
    var withFeedersPct = G.summary(withFeeders, -1).goodPct;
    var hubs = bare.hubs.map(function (h, i) { return { hub: h.name, pct: G.summary(bare, i).goodPct }; });
    hubs.sort(function (a, b) { return a.pct - b.pct; });
    var hinjewadiIndex = findHub(Data.HUBS, 'Hinjewadi');
    var planned = G.build({ peak: true, planned: true });
    var plannedIndex = -1;
    for (var i = 0; i < planned.hubs.length; i++) if (planned.hubs[i].name === Data.HUBS[hinjewadiIndex]) plannedIndex = i;
    return {
      basePct: basePct,
      withFeedersPct: withFeedersPct,
      feeders: feeders,
      worst: hubs[0],
      best: hubs[hubs.length - 1],
      hinjewadi: { pct: G.summary(bare, hinjewadiIndex).goodPct, line3Pct: G.summary(planned, plannedIndex).goodPct }
    };
  }

  if (isNode) module.exports = { pitchNumbers: pitchNumbers };
  else root.MetroPitchData = { pitchNumbers: pitchNumbers };
})(this);
