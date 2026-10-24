/*
 * share.js — shareable links and QR codes.
 *
 * encodeGap/decodeGap turn the Gap Map's settings into a URL hash and back.
 * They are pure, so tests/share.test.js checks them in Node. In the browser,
 * MetroShare.showQr(url, title) opens a dialog with a QR code (drawn by
 * js/vendor/qrcode.js) and MetroShare.copy(url, button) copies a link.
 *
 * Works in the browser (window.MetroShare, after data.js and i18n.js) and in
 * Node (module.exports).
 */
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var Data = isNode ? require('./data.js') : root.MetroData;

  // state: { hub: English hub name or null (all hubs), peak, line3, feeders: [ids], lang }
  // Defaults are left out so a plain link stays short.
  function encodeGap(state) {
    var p = new URLSearchParams();
    p.set('view', 'gap');
    if (state.hub) p.set('hub', state.hub);
    if (state.peak === false) p.set('time', 'off');
    if (state.line3) p.set('line3', '1');
    if (state.feeders && state.feeders.length) p.set('feeders', state.feeders.slice().sort().join(','));
    if (state.lang && state.lang !== 'en') p.set('lang', state.lang);
    return p.toString();
  }

  // Unknown hubs and stations are dropped, so an old or edited link never breaks the page.
  function decodeGap(hash) {
    var p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    var hub = p.get('hub'), lang = p.get('lang');
    var feeders = (p.get('feeders') || '').split(',').filter(function (id, i, all) {
      return Object.prototype.hasOwnProperty.call(Data.STATIONS, id) && all.indexOf(id) === i;
    });
    return {
      view: p.get('view'),
      hub: Data.HUBS.indexOf(hub) !== -1 ? hub : null,
      peak: p.get('time') !== 'off',
      line3: p.get('line3') === '1',
      feeders: feeders,
      lang: lang === 'mr' || lang === 'en' ? lang : null
    };
  }

  var MetroShare = { encodeGap: encodeGap, decodeGap: decodeGap };

  if (isNode) { module.exports = MetroShare; return; }

  /* ------------------------------------------------------------------
   * Browser: copy a link, show a QR code
   * ------------------------------------------------------------------ */
  var t = function (key, vars) { return root.I18N.t(key, vars); };
  var dlg = null;

  function copy(url, button) {
    var done = function () { if (button) button.textContent = t('res.copied'); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt(t('res.copyPrompt'), url); });
    else prompt(t('res.copyPrompt'), url);
  }

  function buildDialog() {
    dlg = document.createElement('dialog');
    dlg.className = 'qr-dialog';
    dlg.setAttribute('aria-labelledby', 'qr-title');
    dlg.innerHTML = '<h2 id="qr-title"></h2><div class="qr-code"></div><p class="qr-url"></p>' +
      '<div class="qr-actions"><button type="button" class="share" data-act="copy"></button>' +
      '<button type="button" class="primary small-btn" data-act="close"></button></div>';
    dlg.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'close' || e.target === dlg) dlg.close();          // a click on the backdrop closes too
      if (act === 'copy') copy(dlg.getAttribute('data-url'), e.target);
    });
    document.body.appendChild(dlg);
  }

  function showQr(url, title) {
    if (!dlg) buildDialog();
    var code = root.qrcode(0, 'M');
    root.qrcode.stringToBytes = root.qrcode.stringToBytesFuncs['UTF-8'];
    code.addData(url);
    code.make();
    dlg.setAttribute('data-url', url);
    dlg.querySelector('#qr-title').textContent = title;
    dlg.querySelector('.qr-code').innerHTML = code.createSvgTag({ cellSize: 4, margin: 4, scalable: true, title: title });
    dlg.querySelector('.qr-url').textContent = url;
    dlg.querySelector('[data-act=copy]').textContent = t('share.copy');
    dlg.querySelector('[data-act=close]').textContent = t('share.close');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.querySelector('[data-act=close]').focus();
  }

  MetroShare.copy = copy;
  MetroShare.showQr = showQr;
  root.MetroShare = MetroShare;
})(this);
