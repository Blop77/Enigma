'use strict';
const assert = require('assert');
const Assistant = require('../js/assistant');
const Data = require('../js/data');
const Planner = require('../js/planner');
const GapMap = require('../js/gapmap');
const Reports = require('../js/reports');

const now = new Date('2026-10-24T09:00:00');
const ask = (q, lang) => Assistant.answer(q, lang, now);
const both = (en, mr, key) => {
  assert.strictEqual(ask(en, 'en').textKey, key, en);
  assert.strictEqual(ask(mr, 'mr').textKey, key, mr);
};

// English and Marathi intents, including aliases and place names.
both('How do I get from PCMC to Swargate?', 'PCMC ते स्वारगेट', 'assistant.trip');
both('Fare from Vanaz to Swargate', 'वनाझ ते स्वारगेट भाडे', 'assistant.fare');
both('When is the first train?', 'पहिली गाडी कधी?', 'assistant.first');
both('When is the last train?', 'शेवटची गाडी कधी?', 'assistant.last');
both('How often do trains run?', 'गाड्या किती वेळाने येतात?', 'assistant.frequency');
both('What is the student concession?', 'विद्यार्थी सवलत किती?', 'assistant.concession');
both('How good is the metro near Vanaz?', 'वनाझ जवळ मेट्रो कशी आहे?', 'assistant.gap.good');
both('Where should feeder buses go?', 'फीडर बस कुठे हव्यात?', 'assistant.feeders');
both('Is the lift working at Swargate?', 'स्वारगेट येथे लिफ्ट चालू आहे का?', 'assistant.liftNoReport');
both('I have a question about buses', 'मला बसबद्दल प्रश्न आहे', 'assistant.fallback');

const fare = ask('Fare from Vanaz to Swargate', 'en');
assert.strictEqual(fare.vars.fare, '₹' + Planner.chartFare('vanaz', 'swargate'));
const tripFare = Planner.planTrip({ stationId: 'pcmc' }, { stationId: 'swargate' }, { date: now, mile: 'auto', pass: 'regular' }).best.cost;
assert.strictEqual(ask('PCMC to Swargate', 'en').vars.fare, '₹' + Math.round(tripFare));
assert.strictEqual(ask('When is the first train?', 'en').vars.time, Data.CONFIG.firstTrain);
assert.strictEqual(ask('When is the last train?', 'en').vars.time, Data.CONFIG.lastTrain);
assert.strictEqual(ask('How often do trains run?', 'en').vars.minutes, Planner.headwayMin(now));
assert.strictEqual(ask('किती वेळाने गाड्या?', 'mr').vars.minutes, Data.CONFIG.peakHeadwayMin);
assert.strictEqual(ask('Student concession', 'en').vars.weekday, Data.CONFIG.concessions.student.weekday);
assert.strictEqual(ask('Pune card discount', 'en').vars.weekend, Data.CONFIG.concessions.card.weekend);
assert.deepStrictEqual(ask('PCMC to Swargate', 'en').action, { type: 'trip', from: 'PCMC', to: 'Swargate' });
const picks = GapMap.recommend(GapMap.build({ peak: true }), Data.CONFIG.assistant.feederSuggestions).map((p) => Data.STATIONS[p.station][0]);
assert.strictEqual(ask('Where should feeder buses go?', 'en').vars.stations, picks.join(', '));
const report = Reports.addReport([], 'swargate', 'lift', now.getTime(), Data.CONFIG.reportExpiryMs);
assert.strictEqual(Assistant.answer('Is the lift working at Swargate?', 'en', now, report).textKey, 'assistant.liftReported');
console.log('assistant.test.js: ok');
