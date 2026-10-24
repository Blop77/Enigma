/*
 * reports.js — pure station report storage helpers.
 * Works in the browser (window.MetroReports) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var TYPES = ['crowded', 'lift', 'escalator'];

  function dropExpired(reports, now, expiryMs) {
    var current = now === undefined ? Date.now() : now;
    return (Array.isArray(reports) ? reports : []).filter(function (report) {
      return report && typeof report.stationId === 'string' && TYPES.indexOf(report.type) !== -1 &&
        typeof report.time === 'number' && current - report.time < expiryMs && report.time <= current;
    });
  }

  function addReport(reports, stationId, type, time, expiryMs) {
    if (typeof stationId !== 'string' || !stationId || TYPES.indexOf(type) === -1) return dropExpired(reports, time, expiryMs);
    var current = time === undefined ? Date.now() : time;
    return dropExpired(reports, current, expiryMs).concat([{ stationId: stationId, type: type, time: current }]);
  }

  function activeForStation(reports, stationId, now, expiryMs) {
    return dropExpired(reports, now, expiryMs).filter(function (report) { return report.stationId === stationId; });
  }

  var MetroReports = { addReport: addReport, activeForStation: activeForStation, dropExpired: dropExpired };
  if (isNode) module.exports = MetroReports;
  else root.MetroReports = MetroReports;
})(this);
