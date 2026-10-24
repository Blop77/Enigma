/*
 * savings.js — pure month filtering and totals for the savings tracker.
 * Works in the browser (window.MetroSavings) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var I = isNode ? require('./i18n.js') : root.I18N;

  function monthTrips(trips, date) {
    var target = date || new Date();
    return trips.filter(function (trip) {
      var d = new Date(trip.t);
      return d.getMonth() === target.getMonth() && d.getFullYear() === target.getFullYear();
    });
  }

  function totals(list) {
    return list.reduce(function (sum, trip) {
      return { n: sum.n + 1, rs: sum.rs + trip.autoCost - trip.cost, co2: sum.co2 + trip.co2SavedG };
    }, { n: 0, rs: 0, co2: 0 });
  }

  function cardData(trips, date) {
    var target = date || new Date(), sum = totals(monthTrips(trips, target));
    return {
      month: target.toLocaleString(I.locale(), { month: 'long' }),
      year: target.getFullYear(),
      n: sum.n,
      rs: Math.max(0, sum.rs),
      co2: Math.max(0, sum.co2)
    };
  }

  var MetroSavings = { monthTrips: monthTrips, totals: totals, cardData: cardData };
  if (isNode) module.exports = MetroSavings;
  else root.MetroSavings = MetroSavings;
})(this);
