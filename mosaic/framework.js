/* Animated framework diagram for the Mosaic page.
   Draws: image -> patches -> frozen ViT layers -> (global token | max-pooled patch tokens)
   -> two Gaussian feature spaces -> summed ID confidence. Steps play in a loop; the
   captions under the diagram are clickable. Illustrative only: token values are synthetic. */
(function () {
  var root = document.getElementById('fw');
  if (!root) return;
  var svg = root.querySelector('svg');
  var NS = 'http://www.w3.org/2000/svg';
  var STEPS = 6;

  function el(tag, attrs, parent, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    (parent || svg).appendChild(e);
    return e;
  }
  function group(step, delay) {
    var g = el('g', { 'class': 'fw-s', 'data-step': step });
    if (delay) g.style.transitionDelay = delay + 's';
    return g;
  }
  // "z_g(x)" -> z, subscript g, (x)
  function label(x, y, str, parent, cls, anchor) {
    var t = el('text', { x: x, y: y, 'class': 'fw-t ' + (cls || ''), 'text-anchor': anchor || 'middle' }, parent);
    var parts = str.split(/_(\w)/);
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2 === 1) el('tspan', { dy: 4, 'font-size': '0.75em' }, t, parts[i]);
      else el('tspan', i > 0 ? { dy: -4 } : {}, t, parts[i]);
    }
    return t;
  }
  function arrow(d, parent, cls) {
    return el('path', { d: d, 'class': 'fw-line ' + (cls || ''), 'marker-end': 'url(#fw-arrow)' }, parent);
  }

  var defs = el('defs', {});
  var mk = el('marker', { id: 'fw-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0L10 5L0 10z', 'class': 'fw-arrowhead' }, mk);

  /* ---- 0/1: image and patches ---- */
  var g0 = el('g', {});
  var tiles = [];
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
    var hue = 195 + ((r * 5 + c * 3) % 7) * 6, lig = 46 + ((r * 3 + c * 5) % 5) * 6;
    var t = el('rect', { x: 20 + c * 27, y: 121 + r * 27, width: 27, height: 27, 'class': 'fw-tile', fill: 'hsl(' + hue + ',42%,' + lig + '%)' }, g0);
    t._dx = (c - 1.5) * 3; t._dy = (r - 1.5) * 3;
    tiles.push(t);
  }
  label(74, 262, 'input image', g0, 'dim');
  var g1 = group(1);
  label(74, 278, 'split into M patches', g1, 'dim small');

  /* ---- 2: frozen ViT layers ---- */
  var panels = [[175, 'Layer 1'], [265, 'Layer 2'], [380, 'Layer L']];
  label(312, 92, 'pre-trained ViT (frozen)', group(2), 'dim');
  arrow('M138 175H170', group(2));
  panels.forEach(function (p, i) {
    var g = group(2, i * 0.35), x = p[0], last = i === 2;
    el('rect', { x: x, y: 110, width: 70, height: 130, rx: 8, 'class': 'fw-panel' + (last ? ' last' : '') }, g);
    el('rect', { x: x + 28, y: 120, width: 14, height: 14, rx: 2, 'class': 'fw-cls', opacity: last ? 1 : 0.55 }, g);
    for (var rr = 0; rr < 4; rr++) for (var cc = 0; cc < 4; cc++)
      el('rect', { x: x + 6 + cc * 15, y: 166 + rr * 15, width: 12, height: 12, rx: 2, 'class': 'fw-tok', opacity: last ? 0.9 : 0.45 }, g);
    label(x + 35, 258, p[1], g, last ? 'strong' : 'dim');
    if (i === 0) arrow('M247 175H261', g);
    if (i === 1) { label(357, 180, '···', g, 'dim'); }
  });

  /* ---- 3: global token ---- */
  var g3 = group(3);
  arrow('M450 127H470V95H692', g3, 'glob');
  label(580, 87, 'global (CLS) token', g3, 'glob');
  var zg = [0.9, 0.35, 0.7, 0.5, 0.8];
  zg.forEach(function (v, i) { el('rect', { x: 700, y: 53 + i * 17, width: 14, height: 14, rx: 2, 'class': 'fw-cls', opacity: v }, g3); });
  label(707, 45, 'z_g(x)', g3, 'glob strong');

  /* ---- 4: patch-token matrix (M patches x D channels) ---- */
  var M = 8, Dn = 5, V = [], seed = 7;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  for (var k = 0; k < Dn; k++) { V.push([]); for (var j = 0; j < M; j++) V[k].push(0.12 + 0.5 * rnd()); }
  // one clearly strongest patch per channel, at different positions
  [5, 1, 6, 3, 0].forEach(function (j, k) { V[k][j] = 0.95; });
  var g4 = group(4), cells = [];
  arrow('M450 205H470V257H494', g4, 'pat');
  label(568, 206, 'patch tokens of layer L', g4, 'pat');
  for (k = 0; k < Dn; k++) { cells.push([]); for (j = 0; j < M; j++)
    cells[k].push(el('rect', { x: 500 + j * 17, y: 215 + k * 17, width: 14, height: 14, rx: 2, 'class': 'fw-tok', opacity: V[k][j] }, g4)); }
  label(568, 316, 'M patches (columns) × D channels (rows)', g4, 'dim small');

  /* ---- 5: channel-wise max over patches ---- */
  var g5 = group(5);
  arrow('M642 257H694', g5, 'pat');
  label(668, 249, 'max', g5, 'pat strong');
  label(668, 272, 'over patches', g5, 'pat small');
  label(707, 316, 'z_p(x)', g5, 'pat strong');
  var band = el('rect', { x: 497, y: 212, width: 139, height: 20, rx: 4, 'class': 'fw-band' }, g5);
  var pooled = [];
  for (k = 0; k < Dn; k++) pooled.push(el('rect', { x: 700, y: 215 + k * 17, width: 14, height: 14, rx: 2, 'class': 'fw-tok', opacity: 0 }, g5));

  /* ---- 6: two feature spaces, two scores, one sum ---- */
  function space(cy, cls, g) {
    el('rect', { x: 770, y: cy - 48, width: 120, height: 96, rx: 10, 'class': 'fw-panel' }, g);
    [[-28, -18], [24, -20], [-4, 22]].forEach(function (o) {
      el('ellipse', { cx: 830 + o[0], cy: cy + o[1], rx: 21, ry: 9, transform: 'rotate(-25 ' + (830 + o[0]) + ' ' + (cy + o[1]) + ')', 'class': 'fw-gauss ' + cls }, g);
      el('circle', { cx: 830 + o[0], cy: cy + o[1], r: 2, 'class': 'fw-dot ' + cls }, g);
    });
    el('path', { d: 'M' + (830 + 14) + ' ' + (cy + 4) + 'L' + (830 - 4) + ' ' + (cy + 22), 'class': 'fw-dash' }, g);
    el('path', { d: 'M' + (830 + 10) + ' ' + cy + 'l8 8m0 -8l-8 8', 'class': 'fw-x' }, g);
  }
  var g6 = group(6);
  arrow('M718 95H765', g6, 'glob');
  arrow('M718 257H765', g6, 'pat');
  space(95, 'glob', g6); space(257, 'pat', g6);
  label(830, 38, 'global feature space', g6, 'glob');
  label(830, 322, 'patch feature space', g6, 'pat');
  var g6b = group(6, 0.5);
  arrow('M890 95H930V162', g6b, 'glob');
  arrow('M890 257H930V188', g6b, 'pat');
  label(936, 88, 's_g(x)', g6b, 'glob strong', 'start');
  label(936, 274, 's_p(x)', g6b, 'pat strong', 'start');
  el('circle', { cx: 930, cy: 175, r: 11, 'class': 'fw-sum' }, g6b);
  el('path', { d: 'M923 175h14M930 168v14', 'class': 'fw-sumx' }, g6b);
  var g6c = group(6, 0.9);
  arrow('M942 175H960', g6c);
  el('rect', { x: 964, y: 150, width: 88, height: 50, rx: 8, 'class': 'fw-out' }, g6c);
  label(1008, 170, 'ID confidence', g6c, 'out small');
  label(1008, 190, 'S(x)', g6c, 'out strong');

  /* ---- timeline ---- */
  var groups = [].slice.call(svg.querySelectorAll('.fw-s'));
  var caps = [].slice.call(root.querySelectorAll('.fw-steps li'));
  var btn = root.querySelector('.fw-play');
  var cur = 0, playing = true, timer = null, poolTimers = [];
  var DUR = [900, 1700, 2300, 2000, 2000, 5600, 3200];   // time spent on step n before advancing
  var HOLD = 4500;

  function clearPool() { poolTimers.forEach(clearTimeout); poolTimers = []; }
  function setPool(upto, bandRow) {
    for (var k = 0; k < Dn; k++) {
      var on = k < upto;
      pooled[k].setAttribute('opacity', on ? 0.95 : 0);
      pooled[k].classList.toggle('max', on);
      for (var j = 0; j < M; j++) cells[k][j].classList.toggle('max', on && V[k][j] > 0.9);
    }
    band.style.opacity = bandRow == null ? 0 : 1;
    if (bandRow != null) band.setAttribute('y', 212 + bandRow * 17);
  }
  function show(n, animate) {
    cur = n;
    groups.forEach(function (g) { g.classList.toggle('on', +g.getAttribute('data-step') <= n); });
    tiles.forEach(function (t) { t.style.transform = n >= 1 ? 'translate(' + t._dx + 'px,' + t._dy + 'px)' : ''; });
    caps.forEach(function (c, i) { c.classList.toggle('on', i < n); c.classList.toggle('cur', i === n - 1); });
    clearPool();
    if (n < 5) setPool(0, null);
    else if (n > 5 || !animate) setPool(Dn, null);
    else {
      setPool(0, null);
      for (var k = 0; k < Dn; k++) (function (k) {
        poolTimers.push(setTimeout(function () { setPool(k, k); }, 500 + k * 900));
        poolTimers.push(setTimeout(function () { setPool(k + 1, k); }, 500 + k * 900 + 450));
      })(k);
      poolTimers.push(setTimeout(function () { setPool(Dn, null); }, 500 + Dn * 900));
    }
  }
  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(function () { show(cur >= STEPS ? 0 : cur + 1, true); schedule(); }, cur >= STEPS ? HOLD : DUR[cur]);
  }
  function setPlaying(p) {
    playing = p;
    if (btn) { btn.textContent = p ? 'Pause' : 'Play'; btn.setAttribute('aria-pressed', String(!p)); }
    schedule();
  }
  if (btn) btn.addEventListener('click', function () {
    if (!playing && cur >= STEPS) show(0, true);
    setPlaying(!playing);
  });
  var replay = root.querySelector('.fw-replay');
  if (replay) replay.addEventListener('click', function () { show(0, true); setPlaying(true); });
  caps.forEach(function (c, i) {
    c.addEventListener('click', function () { setPlaying(false); show(i + 1, true); });
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } });
  });

  var q = new URLSearchParams(location.search).get('fwstep');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (q !== null) { show(Math.max(0, Math.min(STEPS, +q)), false); setPlaying(false); }
  else if (reduced) { show(STEPS, false); setPlaying(false); }
  else { show(0, true); setPlaying(true); }
})();
