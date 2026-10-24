/*
 * savings-card.js — draw and export the fixed-style 1080px savings card.
 * Browser only; no DOM access until a function is called.
 */
(function (root) {
  'use strict';

  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", sans-serif';
  var PURPLE = '#8e3fa8', AQUA = '#0fa3b1', INK = '#241a2b', MUTED = '#645a69';
  var I = function () { return root.I18N; };

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitSize(ctx, text, maxWidth, size, weight) {
    var px = size;
    while (px > 18) {
      ctx.font = weight + ' ' + px + 'px ' + FONT;
      if (ctx.measureText(text).width <= maxWidth) break;
      px -= 1;
    }
    return px;
  }

  function wrap(ctx, text, maxWidth) {
    var words = text.split(/\s+/), lines = [], line = '';
    words.forEach(function (word) {
      var candidate = line ? line + ' ' + word : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawLogo(ctx, x, y, size) {
    ctx.save();
    roundedRect(ctx, x, y, size, size, size * 0.22);
    ctx.clip();
    ctx.fillStyle = AQUA;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = PURPLE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 ' + Math.round(size * 0.59) + 'px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('M', x + size / 2, y + size * 0.59);
    ctx.restore();
  }

  function label(ctx, text, x, y, width) {
    ctx.font = '600 24px ' + FONT;
    var lines = wrap(ctx, text, width);
    lines.slice(0, 2).forEach(function (line, i) { ctx.fillText(line, x, y + i * 31); });
  }

  function drawCard(canvas, data) {
    var ctx = canvas.getContext('2d'), t = I().t, locale = I().locale();
    var size = root.MetroData.CONFIG.savingsCardSize;
    canvas.width = size;
    canvas.height = size;
    ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 1080, 1080);
    ctx.fillStyle = '#f4f0f7';
    ctx.fillRect(0, 0, 1080, 1080);

    // Two angled ribbons echo the purple and aqua metro lines.
    ctx.fillStyle = PURPLE;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(1080, 0); ctx.lineTo(890, 22); ctx.lineTo(0, 22); ctx.fill();
    ctx.fillStyle = AQUA;
    ctx.beginPath();
    ctx.moveTo(0, 22); ctx.lineTo(890, 22); ctx.lineTo(850, 36); ctx.lineTo(0, 36); ctx.fill();

    ctx.fillStyle = '#fff';
    roundedRect(ctx, 54, 60, 972, 960, 30);
    ctx.fill();

    drawLogo(ctx, 100, 104, 88);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    var title = t('sav.title');
    ctx.font = '700 ' + fitSize(ctx, title, 790, 50, '700') + 'px ' + FONT;
    ctx.fillText(title, 220, 145);
    ctx.font = '500 ' + fitSize(ctx, data.month + ' ' + data.year, 790, 30, '500') + 'px ' + FONT;
    ctx.fillStyle = MUTED;
    ctx.fillText(data.month + ' ' + data.year, 220, 193);

    var tagline = t('sav.card.tagline');
    ctx.font = '500 27px ' + FONT;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    var tagLines = wrap(ctx, tagline, 780);
    tagLines.slice(0, 2).forEach(function (line, i) { ctx.fillText(line, 540, 300 + i * 37); });

    // Three 270 px boxes spread across the same 888 px as the divider below (x 96–984).
    var blocks = [
      { x: 96, color: PURPLE, value: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(data.n),
        text: t('sav.card.trips') },
      { x: 405, color: AQUA, value: '₹' + new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(data.rs),
        text: t('sav.saved') },
      { x: 714, color: PURPLE, value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(data.co2 >= 1000 ? data.co2 / 1000 : Math.round(data.co2)) +
          ' ' + (data.co2 >= 1000 ? t('unit.kg') : t('unit.g')),
        text: t('sav.co2') }
    ];

    blocks.forEach(function (block) {
      ctx.fillStyle = '#faf8fc';
      roundedRect(ctx, block.x, 420, 270, 300, 22);
      ctx.fill();
      ctx.fillStyle = block.color;
      roundedRect(ctx, block.x, 420, 270, 10, 5);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      var numberSize = fitSize(ctx, block.value, 238, 58, '750');
      ctx.font = '750 ' + numberSize + 'px ' + FONT;
      ctx.fillText(block.value, block.x + 135, 535);
      ctx.fillStyle = MUTED;
      label(ctx, block.text, block.x + 135, 620, 232);
    });

    ctx.fillStyle = '#e9e0ef';
    roundedRect(ctx, 96, 800, 888, 2, 1);
    ctx.fill();
    drawLogo(ctx, 100, 858, 68);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    var brand = t('sav.card.brand');
    ctx.font = '700 ' + fitSize(ctx, brand, 770, 28, '700') + 'px ' + FONT;
    ctx.fillText(brand, 190, 889);
    ctx.fillStyle = MUTED;
    var url = t('sav.card.url');
    ctx.font = '500 ' + fitSize(ctx, url, 770, 23, '500') + 'px ' + FONT;
    ctx.fillText(url, 190, 930);

    ctx.textAlign = 'right';
    ctx.fillStyle = AQUA;
    ctx.font = '600 22px ' + FONT;
    ctx.fillText(t('sav.card.footer'), 980, 977);
    return canvas;
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('Unable to encode PNG'));
      }, 'image/png');
    });
  }

  root.MetroSavingsCard = { drawCard: drawCard, toBlob: toBlob };
})(this);
