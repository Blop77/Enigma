/*
 * guide.js — a short first-visit tour of the Gap Map: pick a destination,
 * add feeders, tap a square, read the city report, then the trip planner.
 * Shown once per device (localStorage), replayable from the "?" button.
 * Depends on i18n.js and app.js (window.MetroMitra).
 */
(function () {
  'use strict';

  const t = I18N.t, M = window.MetroMitra;
  const $ = (sel) => document.querySelector(sel);
  const DONE_KEY = 'metromitra-guide-done';
  // Keys are written out in full so tests/i18n.test.js can check they exist.
  const STEPS = [
    { title: 'guide.title.hub', text: 'guide.text.hub', target: '#gap-hub' },
    { title: 'guide.title.feeders', text: 'guide.text.feeders', target: '#recs' },
    { title: 'guide.title.map', text: 'guide.text.map', target: '.gap-map-panel' },
    { title: 'guide.title.report', text: 'guide.text.report', target: '#report' },
    { title: 'guide.title.plan', text: 'guide.text.plan', target: '#tab-plan' }
  ];

  let card = null, index = 0, returnFocus = null;

  // If storage is blocked we can't remember the tour, so don't start it on our own.
  function seen() {
    try { return localStorage.getItem(DONE_KEY) === '1'; } catch (e) { return true; }
  }

  function build() {
    card = document.createElement('div');
    card.className = 'guide';
    card.hidden = true;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-labelledby', 'guide-title');
    card.innerHTML = '<p class="guide-step" id="guide-step"></p><h3 id="guide-title"></h3><p id="guide-text"></p>' +
      '<div class="guide-actions"><button type="button" class="link-btn" data-act="skip"></button><span class="spacer"></span>' +
      '<button type="button" class="share" data-act="back"></button>' +
      '<button type="button" class="primary small-btn" data-act="next"></button></div>';
    card.addEventListener('click', (e) => {
      const act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'skip') close();
      if (act === 'back') show(index - 1);
      if (act === 'next') { if (index === STEPS.length - 1) close(); else show(index + 1); }
    });
    card.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.body.appendChild(card);
  }

  function clearFocus() {
    document.querySelectorAll('.guide-focus').forEach((el) => el.classList.remove('guide-focus'));
  }

  function show(i) {
    index = Math.max(0, Math.min(STEPS.length - 1, i));
    const step = STEPS[index], last = index === STEPS.length - 1;
    clearFocus();
    $('#guide-step').textContent = t('guide.step', { n: index + 1, total: STEPS.length });
    $('#guide-title').textContent = t(step.title);
    $('#guide-text').textContent = t(step.text);
    card.querySelector('[data-act=skip]').textContent = t('guide.skip');
    card.querySelector('[data-act=skip]').hidden = last;
    card.querySelector('[data-act=back]').textContent = t('guide.back');
    card.querySelector('[data-act=back]').hidden = index === 0;
    card.querySelector('[data-act=next]').textContent = t(last ? 'guide.done' : 'guide.next');
    const target = $(step.target);
    if (target) {
      target.classList.add('guide-focus');
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    }
    card.querySelector('[data-act=next]').focus({ preventScroll: true });
  }

  function close() {
    clearFocus();
    card.hidden = true;
    try { localStorage.setItem(DONE_KEY, '1'); } catch (e) { /* no storage */ }
    if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
  }

  function start() {
    if (!card) build();
    returnFocus = document.activeElement;
    if (M.view !== 'gap') M.showView('gap');
    card.hidden = false;
    show(0);
  }

  $('#guide-btn').addEventListener('click', start);
  // First visit: start once the Gap Map has drawn, so the highlighted parts exist.
  document.addEventListener('mm:gapready', () => { if (!seen()) setTimeout(start, 500); }, { once: true });
  document.addEventListener('mm:lang', () => { if (card && !card.hidden) show(index); });
  window.MetroGuide = { start };
})();
