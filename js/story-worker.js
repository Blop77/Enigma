/*
 * story-worker.js — runs MetroStory.gap() off the main thread so the story
 * keeps scrolling smoothly while the feeders are tested.
 */
/* global importScripts, MetroStory */
'use strict';
importScripts('data.js', 'population.js', 'planner.js', 'gapmap.js', 'story-data.js');
self.onmessage = () => self.postMessage(MetroStory.gap());
