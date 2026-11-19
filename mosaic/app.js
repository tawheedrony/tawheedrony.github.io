/* Mosaic project page: interactive charts. Vanilla JS + inline SVG, data from data.js (see ../build_data.py). */
(function () {
  'use strict';
  var D = window.MOSAIC_DATA;
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };

  // ---------- helpers ----------
  function svg(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function html(tag, attrs, parent, text) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function f1(v) { return v.toFixed(1); }
  function signed(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2); }
  function signed1(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  var tipEl = $('tip');
  function tipShow(evt, content) {
    tipEl.innerHTML = content;
    tipEl.classList.add('on');
    var r = tipEl.getBoundingClientRect();
    var x = Math.min(evt.clientX + 14, window.innerWidth - r.width - 8);
    var y = evt.clientY + 16;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - 10;
    tipEl.style.left = Math.max(8, x) + 'px';
    tipEl.style.top = Math.max(8, y) + 'px';
  }
  function tipHide() { tipEl.classList.remove('on'); }
  function hover(el, contentFn) {
    el.addEventListener('pointerenter', function (e) { tipShow(e, contentFn()); });
    el.addEventListener('pointermove', function (e) { tipShow(e, contentFn()); });
    el.addEventListener('pointerleave', tipHide);
  }
  window.addEventListener('scroll', tipHide, { passive: true });

  function seg(id, options, value, onChange) {
    var box = $(id);
    box.setAttribute('role', 'group');
    options.forEach(function (o) {
      var b = html('button', { type: 'button', 'aria-pressed': String(o.v === value) }, box, o.label);
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(box.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        onChange(o.v);
      });
    });
  }
  function select(id, options, value, onChange) {
    var sel = $(id);
    options.forEach(function (o) {
      var op = html('option', { value: o.v }, sel, o.label);
      if (o.v === value) op.selected = true;
    });
    sel.addEventListener('change', function () { onChange(sel.value); });
  }
  function niceTicks(lo, hi, n) {
    var span = hi - lo, step = Math.pow(10, Math.floor(Math.log10(span / n)));
    var err = span / n / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var t = [], v = Math.ceil(lo / step - 1e-9) * step;
    for (; v <= hi + 1e-9; v += step) t.push(Math.round(v * 1e6) / 1e6);
    return t;
  }
  var redraws = [];
  function size(chart, H, minW) {
    var W = Math.max(minW || 300, Math.round(chart.clientWidth || chart.getBoundingClientRect().width || 600));
    if (typeof H === 'function') H = H(W);
    chart.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    return { W: W, H: H };
  }
  var CAL = [{ v: 'in1k', label: 'ImageNet-1K' }, { v: 'lt', label: 'ImageNet-LT' }];

  // ====================================================================
  // 1. Complementarity explorer
  // ====================================================================
  (function explorer() {
    var E = D.explorer, st = { model: 'augreg', set: 'NINCO', tpr: 95, showId: false };
    var W, H, m = { l: 52, r: 12, t: 16, b: 46 };
    var chart = $('ex-chart');
    var domains = {};
    Object.keys(E.models).forEach(function (k) {
      var xs = [], ys = [], M = E.models[k];
      E.order.forEach(function (d) { M.sets[d].pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
      M.id_pts.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); });
      xs.sort(function (a, b) { return a - b; }); ys.sort(function (a, b) { return a - b; });
      var q = function (a, p) { return a[Math.floor(p * (a.length - 1))]; };
      domains[k] = { x: [q(xs, 0.004) * 0.92, q(xs, 0.998) * 1.05], y: [q(ys, 0.004) * 0.92, q(ys, 0.998) * 1.05] };
    });
    function logTicks(lo, hi) {
      var out = [];
      for (var e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
        [1, 2, 3, 5].forEach(function (mant) { var v = mant * Math.pow(10, e); if (v >= lo && v <= hi) out.push(v); });
      return out;
    }
    var QUAD = [
      { key: 'both', label: 'Both Detects', color: 'var(--c-both)' },
      { key: 'g', label: 'Only Global Score Detects', color: 'var(--c-global)' },
      { key: 'p', label: 'Only Patch Score Detects', color: 'var(--c-patch)' },
      { key: 'miss', label: 'Both miss', color: 'var(--c-miss)' }
    ];

    function draw() {
      var M = E.models[st.model], S = M.sets[st.set], ti = E.tprs.indexOf(st.tpr);
      var thr = M.thr[ti], stats = S.stats[ti], dom = domains[st.model];
      var lx0 = Math.log(dom.x[0]), lx1 = Math.log(dom.x[1]), ly0 = Math.log(dom.y[0]), ly1 = Math.log(dom.y[1]);
      var X = function (v) { return m.l + (Math.log(Math.min(Math.max(v, dom.x[0]), dom.x[1])) - lx0) / (lx1 - lx0) * (W - m.l - m.r); };
      var Y = function (v) { return H - m.b - (Math.log(Math.min(Math.max(v, dom.y[0]), dom.y[1])) - ly0) / (ly1 - ly0) * (H - m.t - m.b); };
      clear(chart);
      var sz = size(chart, function (w) { return Math.round(Math.min(470, Math.max(320, w * 0.8))); }); W = sz.W; H = sz.H;
      var tx = X(thr[0]), ty = Y(thr[1]);

      // quadrant tints for the two "exclusive" regions
      svg('rect', { x: m.l, y: m.t, width: Math.max(0, tx - m.l), height: Math.max(0, ty - m.t), fill: 'var(--c-patch)', opacity: 0.09 }, chart);
      svg('rect', { x: tx, y: ty, width: Math.max(0, W - m.r - tx), height: Math.max(0, H - m.b - ty), fill: 'var(--c-global)', opacity: 0.07 }, chart);

      logTicks(dom.x[0], dom.x[1]).forEach(function (v) {
        svg('line', { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, class: 'gridline' }, chart);
        svg('text', { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle' }, chart, v >= 1000 ? v / 1000 + 'k' : v);
      });
      logTicks(dom.y[0], dom.y[1]).forEach(function (v) {
        svg('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'gridline' }, chart);
        svg('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, chart, v >= 1000 ? v / 1000 + 'k' : v);
      });
      svg('text', { x: (m.l + W - m.r) / 2, y: H - 8, 'text-anchor': 'middle', class: 'axis-title' }, chart, 'Global distance (more OOD-like →)');
      svg('text', { x: 14, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'axis-title', transform: 'rotate(-90 14 ' + (m.t + H - m.b) / 2 + ')' }, chart, 'Patch distance (more OOD-like →)');

      if (st.showId) M.id_pts.forEach(function (p) {
        svg('circle', { cx: X(p[0]), cy: Y(p[1]), r: 2.2, fill: 'var(--c-neutral)', opacity: 0.75 }, chart);
      });
      var g = svg('g', { opacity: 0.72 }, chart);
      S.pts.forEach(function (p) {
        var gd = p[0] > thr[0], pd = p[1] > thr[1];
        var c = gd && pd ? QUAD[0] : gd ? QUAD[1] : pd ? QUAD[2] : QUAD[3];
        svg('circle', { cx: X(p[0]), cy: Y(p[1]), r: 2.7, fill: c.color }, g);
      });

      // thresholds
      svg('line', { x1: tx, x2: tx, y1: m.t, y2: H - m.b, stroke: 'var(--c-global)', 'stroke-width': 1.75 }, chart);
      svg('line', { x1: m.l, x2: W - m.r, y1: ty, y2: ty, stroke: 'var(--c-patch)', 'stroke-width': 1.75 }, chart);

      // Mosaic boundary: dG + dP = thr[2]
      var path = '', n = 80, started = false;
      for (var i = 0; i <= n; i++) {
        var xv = Math.exp(lx0 + (lx1 - lx0) * i / n), yv = thr[2] - xv;
        if (yv < dom.y[0] || yv > dom.y[1]) continue;
        path += (started ? 'L' : 'M') + X(xv).toFixed(1) + ' ' + Y(yv).toFixed(1);
        started = true;
      }
      if (path) svg('path', { d: path, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.25, 'stroke-dasharray': '7 5' }, chart);

      // corner labels
      var pad = 7;
      function corner(x, y, anchor, text) {
        var t = svg('text', { x: x, y: y, 'text-anchor': anchor, class: 'strong', 'font-size': 12, 'paint-order': 'stroke', stroke: 'var(--bg)', 'stroke-width': 3.5, 'stroke-linejoin': 'round' }, chart, text);
        return t;
      }
      corner(m.l + pad, m.t + 14, 'start', 'patch only · ' + f1(stats[2]) + '%');
      corner(W - m.r - pad, m.t + 14, 'end', 'both detect · ' + f1(stats[0]) + '%');
      corner(m.l + pad, H - m.b - pad, 'start', 'both miss · ' + f1(stats[3]) + '%');
      corner(W - m.r - pad, H - m.b - pad, 'end', 'global only · ' + f1(stats[1]) + '%');

      // legend / readout
      var leg = $('ex-legend'); clear(leg);
      QUAD.forEach(function (qd, i) {
        var row = html('div', { class: 'legend-row' }, leg);
        html('span', { class: 'sw', style: 'background:' + qd.color }, row);
        html('span', {}, row, qd.label);
        html('span', { class: 'pct' }, row, f1(stats[i]) + '%');
      });
      var row = html('div', { class: 'legend-row' }, leg);
      row.innerHTML = '<svg viewBox="0 0 14 12" width="14" height="12"><line x1="0" x2="14" y1="6" y2="6" stroke="var(--accent)" stroke-width="2.25" stroke-dasharray="4 3"/></svg><span>Mosaic decision boundary</span><span></span>';

      var met = $('ex-meters'); clear(met);
      [['Global Score (Mahalanobis++)', stats[4], 'var(--c-global)'],
       ['Patch Score', stats[5], 'var(--c-patch)'],
       ['Mosaic (Global + Patch)', stats[6], 'var(--accent)']].forEach(function (r) {
        var box = html('div', { class: 'meter' }, met);
        html('span', {}, box, r[0]);
        html('span', { class: 'pct' }, box, f1(r[1]) + '%');
        var tr = html('div', { class: 'track' }, box);
        html('div', { class: 'fill', style: 'width:' + r[1] + '%;background:' + r[2] }, tr);
      });
      var d = stats[6] - stats[4];
      $('ex-note').textContent = 'With ' + st.tpr + '% of ID images accepted, Mosaic ' +
        (d < 0 ? 'lowers' : 'raises') + ' the false-positive rate on ' + S.label + ' from ' + f1(stats[4]) + '% to ' +
        f1(stats[6]) + '% (' + signed1(d) + ' pp).';
      $('ex-tpr-val').textContent = st.tpr + '%';
    }

    seg('ex-model', Object.keys(E.models).map(function (k) { return { v: k, label: E.models[k].label }; }), st.model, function (v) { st.model = v; draw(); });
    seg('ex-set', E.order.map(function (k) { return { v: k, label: E.models.augreg.sets[k].label }; }), st.set, function (v) { st.set = v; draw(); });
    $('ex-tpr').addEventListener('input', function (e) { st.tpr = +e.target.value; draw(); });
    $('ex-id').addEventListener('change', function (e) { st.showId = e.target.checked; draw(); });
    draw(); redraws.push(draw);
  })();

  // ====================================================================
  // 2. Per-patch grid
  // ====================================================================
  (function grid() {
    var st = { set: 'NINCO' }, heat = $('gr-heat'), bars = $('gr-bars');
    function draw() {
      var G = D.grid[st.set], flat = [];
      G.grid.forEach(function (row, r) { row.forEach(function (v, c) { flat.push({ v: v, r: r, c: c }); }); });
      var sorted = flat.slice().sort(function (a, b) { return a.v - b.v; });
      var lo = sorted[0].v, hi = sorted[sorted.length - 1].v, cut = sorted[4].v;
      clear(heat);
      flat.forEach(function (o) {
        var p = Math.round((o.v - lo) / (hi - lo || 1) * 100);
        var cell = html('div', { style: 'background:color-mix(in oklab, var(--seq-hi) ' + p + '%, var(--seq-lo))' }, heat);
        if (o.v <= cut) cell.className = 'best';
        hover(cell, function () { return 'Row ' + (o.r + 1) + ', column ' + (o.c + 1) + '<br><b>FPR95 ' + f1(o.v) + '%</b>'; });
      });
      $('gr-lo').textContent = f1(lo) + '%'; $('gr-hi').textContent = f1(hi) + '%';

      var ex = D.explorer.models.augreg.sets[st.set].stats[D.explorer.tprs.indexOf(95)];
      var rows = [
        ['Median Single Patch', sorted[98].v, 'var(--c-neutral)'],
        ['Best Single Patch', lo, 'var(--c-neutral)'],
        ['Patch Descriptor', ex[5], 'var(--c-patch)'],
        ['Global Token (Maha++)', ex[4], 'var(--c-global)'],
        ['Mosaic (Global + Patch)', ex[6], 'var(--accent)']
      ];
      clear(bars);
      var W = size(bars, 250).W, L = 158, R = 46, bh = 22, gap = 16, top = 26;
      var X = function (v) { return L + v / 100 * (W - L - R); };
      [0, 25, 50, 75, 100].forEach(function (t) {
        svg('line', { x1: X(t), x2: X(t), y1: top - 6, y2: top + rows.length * (bh + gap) - gap + 6, class: 'gridline' }, bars);
        svg('text', { x: X(t), y: top - 12, 'text-anchor': 'middle' }, bars, t);
      });
      rows.forEach(function (r, i) {
        var y = top + i * (bh + gap);
        svg('text', { x: L - 8, y: y + bh / 2 + 4, 'text-anchor': 'end', class: i === 4 ? 'strong' : '' }, bars, r[0]);
        var b = svg('rect', { x: L, y: y, width: Math.max(1, X(r[1]) - L), height: bh, rx: 3, fill: r[2] }, bars);
        svg('text', { x: X(r[1]) + 6, y: y + bh / 2 + 4, class: 'val' }, bars, f1(r[1]));
        hover(b, function () { return esc(r[0]) + '<br><b>FPR95 ' + r[1].toFixed(2) + '%</b> on ' + G.label; });
      });
      svg('text', { x: L, y: top + rows.length * (bh + gap) + 12, class: 'axis-title' }, bars, 'FPR95 (%) on ' + G.label + ', lower is better');
    }
    seg('gr-set', D.explorer.order.map(function (k) { return { v: k, label: D.grid[k].label }; }), st.set, function (v) { st.set = v; draw(); });
    draw(); redraws.push(draw);
  })();

  // ====================================================================
  // 3. 50-checkpoint benchmark
  // ====================================================================
  (function bench() {
    var FULL = { MSP: 'MSP', MLS: 'MaxLogit', KL: 'KL-Matching', EN: 'Energy', GEN: 'GEN', OD: 'ODIN', RE: 'Energy + ReAct', SC: 'SCALE',
      ASC: 'AdaSCALE', ViM: 'ViM', fDBD: 'fDBD', NNG: 'NNGuide', NCI: 'NCI', NECO: 'NECO', KNN: 'KNN', KPCA: 'KPCA', M: 'Mahalanobis', 'M++': 'Mahalanobis++' };
    var GROUPS = [
      { key: 'Supervised', label: 'Supervised (IN-1K / IN-21K)', color: 'var(--g-sup)', shape: 'circle' },
      { key: 'CLIP', label: 'CLIP', color: 'var(--g-clip)', shape: 'triangle' },
      { key: 'MIM', label: 'Masked image modeling', color: 'var(--g-mim)', shape: 'diamond' }
    ];
    var st = { cal: 'in1k', base: 'M++' };
    var chart = $('bn-chart'), delta = $('bn-delta');

    function marker(shape, x, y, r, attrs, parent) {
      var e;
      if (shape === 'circle') e = svg('circle', { cx: x, cy: y, r: r }, parent);
      else if (shape === 'triangle') e = svg('path', { d: 'M' + x + ' ' + (y - r * 1.25) + 'L' + (x + r * 1.15) + ' ' + (y + r * 0.85) + 'L' + (x - r * 1.15) + ' ' + (y + r * 0.85) + 'Z' }, parent);
      else e = svg('path', { d: 'M' + x + ' ' + (y - r * 1.3) + 'L' + (x + r * 1.3) + ' ' + y + 'L' + x + ' ' + (y + r * 1.3) + 'L' + (x - r * 1.3) + ' ' + y + 'Z' }, parent);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    function draw() {
      var B = D.bench[st.cal], ib = B.methods.indexOf(st.base), io = B.methods.indexOf('Mosaic');
      var rows = B.models.map(function (mo, i) {
        return { name: mo.name, g: GROUPS.filter(function (g) { return g.key === mo.group; })[0], b: B.fpr[i][ib], o: B.fpr[i][io] };
      });
      var wins = rows.filter(function (r) { return r.o < r.b; }).length;
      var mb = rows.reduce(function (s, r) { return s + r.b; }, 0) / rows.length, mo = rows.reduce(function (s, r) { return s + r.o; }, 0) / rows.length;
      $('bn-summary').innerHTML = 'Mosaic has lower FPR95 than ' + esc(FULL[st.base]) + ' on <b>' + wins + ' of ' + rows.length +
        '</b> checkpoints. Mean FPR95: ' + mb.toFixed(2) + '% → <b>' + mo.toFixed(2) + '%</b> (' + signed(mo - mb) + ' pp).';

      // scatter
      clear(chart);
      var sz = size(chart, function (w) { return Math.min(440, w); }), W = sz.W, H = sz.H, m = { l: 46, r: 12, t: 12, b: 44 };
      var all = []; rows.forEach(function (r) { all.push(r.b, r.o); });
      var lo = Math.floor(Math.min.apply(null, all) / 5) * 5, hi = Math.ceil(Math.max.apply(null, all) / 5) * 5;
      var X = function (v) { return m.l + (v - lo) / (hi - lo) * (W - m.l - m.r); };
      var Y = function (v) { return H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b); };
      niceTicks(lo, hi, 6).forEach(function (t) {
        svg('line', { x1: X(t), x2: X(t), y1: m.t, y2: H - m.b, class: 'gridline' }, chart);
        svg('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: 'gridline' }, chart);
        svg('text', { x: X(t), y: H - m.b + 16, 'text-anchor': 'middle' }, chart, t);
        svg('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end' }, chart, t);
      });
      svg('line', { x1: X(lo), y1: Y(lo), x2: X(hi), y2: Y(hi), class: 'axisline', 'stroke-dasharray': '4 4' }, chart);
      svg('text', { x: X(hi) - 6, y: Y(hi) + 16, 'text-anchor': 'end', transform: 'rotate(-45 ' + (X(hi) - 6) + ' ' + (Y(hi) + 16) + ')' }, chart, 'no change');
      svg('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-title' }, chart, FULL[st.base] + ' FPR95 (%)');
      svg('text', { x: 13, y: (m.t + H - m.b) / 2, 'text-anchor': 'middle', class: 'axis-title', transform: 'rotate(-90 13 ' + (m.t + H - m.b) / 2 + ')' }, chart, 'Mosaic FPR95 (%)');
      rows.forEach(function (r) {
        svg('line', { x1: X(r.b), x2: X(r.b), y1: Y(r.b), y2: Y(r.o), stroke: r.g.color, 'stroke-width': 1.5, opacity: 0.45, 'stroke-linecap': 'round' }, chart);
      });
      rows.forEach(function (r) {
        var mk = marker(r.g.shape, X(r.b), Y(r.o), 4.6, { fill: r.g.color, stroke: 'var(--bg)', 'stroke-width': 1.2 }, chart);
        var hit = svg('circle', { cx: X(r.b), cy: Y(r.o), r: 10, fill: 'transparent' }, chart);
        hit.addEventListener('pointerenter', function () { mk.setAttribute('stroke', 'var(--ink)'); });
        hit.addEventListener('pointerleave', function () { mk.setAttribute('stroke', 'var(--bg)'); });
        hover(hit, function () {
          return '<b>' + esc(r.name) + '</b> · ' + r.g.key + '<br>' + esc(FULL[st.base]) + ' ' + r.b.toFixed(2) + '%<br>Mosaic ' + r.o.toFixed(2) + '%<br>' + signed(r.o - r.b) + ' pp';
        });
      });

      // sorted deltas
      var ds = rows.map(function (r) { return { r: r, d: r.o - r.b }; }).sort(function (a, b) { return a.d - b.d; });
      var dm = { l: 14, r: 14, t: 26, b: 30 };
      var dlo = Math.min(0, ds[0].d), dhi = Math.max(0, ds[ds.length - 1].d);
      var padv = (dhi - dlo) * 0.04 || 1; dlo -= padv; dhi += dhi > 0 ? padv : 0;
      var DX = function (v) { return dm.l + (v - dlo) / (dhi - dlo) * (W - dm.l - dm.r); };
      clear(delta);
      W = size(delta, H).W;
      var bh = (H - dm.t - dm.b) / ds.length;
      niceTicks(dlo, dhi, 6).forEach(function (t) {
        svg('line', { x1: DX(t), x2: DX(t), y1: dm.t, y2: H - dm.b, class: 'gridline' }, delta);
        svg('text', { x: DX(t), y: H - dm.b + 16, 'text-anchor': 'middle' }, delta, t === 0 ? '0' : (t > 0 ? '+' : '−') + Math.abs(t));
      });
      svg('text', { x: W / 2, y: 12, 'text-anchor': 'middle', class: 'axis-title' }, delta, 'Mosaic − ' + FULL[st.base] + ', FPR95 (pp)');
      ds.forEach(function (o, i) {
        var x0 = DX(Math.min(0, o.d)), w = Math.max(1, Math.abs(DX(o.d) - DX(0)));
        var b = svg('rect', { x: x0, y: dm.t + i * bh + 1, width: w, height: Math.max(1, bh - 2), rx: 1.5, fill: o.d <= 0 ? 'var(--accent)' : 'var(--c-miss)' }, delta);
        var hit = svg('rect', { x: dm.l, y: dm.t + i * bh, width: W - dm.l - dm.r, height: bh, fill: 'transparent' }, delta);
        hit.addEventListener('pointerenter', function () { b.setAttribute('opacity', 0.6); });
        hit.addEventListener('pointerleave', function () { b.setAttribute('opacity', 1); });
        hover(hit, function () { return '<b>' + esc(o.r.name) + '</b><br>' + o.r.b.toFixed(2) + '% → ' + o.r.o.toFixed(2) + '%<br>' + signed(o.d) + ' pp'; });
      });
      svg('line', { x1: DX(0), x2: DX(0), y1: dm.t - 2, y2: H - dm.b + 2, class: 'axisline' }, delta);
    }

    var leg = $('bn-legend');
    GROUPS.forEach(function (g) {
      var sp = html('span', {}, leg), s = svg('svg', { viewBox: '0 0 14 14' }, sp);
      marker(g.shape, 7, 7, 4.4, { fill: g.color }, s);
      sp.appendChild(document.createTextNode(g.label));
    });
    seg('bn-cal', CAL, st.cal, function (v) { st.cal = v; draw(); });
    var opts = D.bench.in1k.methods.filter(function (k) { return k !== 'Mosaic'; }).reverse().map(function (k) { return { v: k, label: FULL[k] }; });
    select('bn-base', opts, st.base, function (v) { st.base = v; draw(); });
    draw(); redraws.push(draw);
  })();

  var rt, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth; clearTimeout(rt);
    rt = setTimeout(function () { redraws.forEach(function (f) { f(); }); }, 120);
  });

  // ---------- BibTeX copy ----------
  $('bib-copy').addEventListener('click', function () {
    var btn = this, text = $('bib').textContent;
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    else {
      var r = document.createRange(); r.selectNodeContents($('bib'));
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  });
})();
