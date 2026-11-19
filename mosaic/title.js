/* "Mosaic" title drawn as a mosaic: a grid of small coloured tiles clipped to the word.
   Tiles settle in one by one, then a few keep changing colour. The real heading text
   stays in the page for screen readers and search engines. */
(function () {
  var svg = document.getElementById('title-mosaic');
  if (!svg) return;
  var NS = 'http://www.w3.org/2000/svg';
  var W = 560, H = 150, T = 9, GAP = 1.6, KINDS = 6;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  var defs = el('defs', {}, svg);
  var clip = el('clipPath', { id: 'title-clip' }, defs);
  var txt = el('text', { x: W / 2, y: 118, 'text-anchor': 'middle', 'class': 'tm-text' }, clip);
  txt.textContent = 'Mosaic';
  var g = el('g', { 'clip-path': 'url(#title-clip)' }, svg);
  var tiles = [];
  for (var y = 0; y < H; y += T) for (var x = 0; x < W; x += T) {
    var r = el('rect', { x: x + GAP / 2, y: y + GAP / 2, width: T - GAP, height: T - GAP, rx: 1.2,
      'class': 'tm-tile tm-k' + Math.floor(Math.random() * KINDS) }, g);
    if (!reduced) {
      // tiles drop into place roughly left to right, with some scatter
      r.style.animationDelay = (x / W * 0.9 + Math.random() * 0.7).toFixed(2) + 's';
      r.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(0) + 'px');
      r.style.setProperty('--dy', (-20 - Math.random() * 50).toFixed(0) + 'px');
      r.style.setProperty('--rot', (Math.random() * 120 - 60).toFixed(0) + 'deg');
    }
    tiles.push(r);
  }
  svg.classList.add('ready');
  if (reduced) return;
  // gentle shimmer: every so often a handful of tiles swap colour
  setInterval(function () {
    if (document.hidden) return;
    for (var i = 0; i < 14; i++) {
      var t = tiles[Math.floor(Math.random() * tiles.length)];
      t.setAttribute('class', 'tm-tile tm-k' + Math.floor(Math.random() * KINDS));
    }
  }, 700);
})();
