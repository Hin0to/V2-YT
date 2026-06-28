// ============================================================
// Shared animation layer. Load on every page (defer):
//   <script src="anim.js" defer></script>
// Attribute / class driven, so pages only add hooks:
//   .reveal            fade+rise in when scrolled into view
//   .stagger           its direct children reveal in sequence
//   [data-count="68"]  number counts up to 68 on reveal (keeps suffix)
//   <circle data-ring data-pct="68" data-circ="339.3">  ring draws on
//   <i data-fill style="width:74%">  bar grows from 0 to its width
//   .tick / .tick-box / .tick-label  CSS handles the check-off (see theme.css)
// Also installs an accent page-transition wipe on internal <a> clicks.
// Everything is disabled under prefers-reduced-motion.
// ============================================================
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches;

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    var dec = (el.getAttribute('data-dec') | 0);
    var dur = parseInt(el.getAttribute('data-dur') || '1100', 10);
    var node = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : el;
    var start = null;
    function frame(t) {
      if (!start) start = t;
      var p = Math.min((t - start) / dur, 1);
      var v = (target * (1 - Math.pow(1 - p, 3)));
      node.nodeValue = dec ? v.toFixed(dec) : Math.round(v);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function drawRing(c) {
    var pct = parseFloat(c.getAttribute('data-pct')) || 0;
    var circ = parseFloat(c.getAttribute('data-circ')) || 339.3;
    c.style.strokeDashoffset = circ;
    requestAnimationFrame(function () {
      c.style.strokeDashoffset = circ * (1 - pct / 100);
    });
  }

  function fillBar(b) {
    var w = b.style.width || b.getAttribute('data-fill') || '0';
    b.style.width = '0';
    requestAnimationFrame(function () { setTimeout(function () { b.style.width = w; }, 60); });
  }

  function activate(el) {
    if (el.dataset && el.dataset.animDone) return;
    if (el.dataset) el.dataset.animDone = '1';
    if (el.classList.contains('stagger')) {
      [].forEach.call(el.children, function (ch, i) { setTimeout(function () { ch.classList.add('in'); }, i * 90); });
    }
    if (el.classList.contains('reveal')) el.classList.add('in');
    if (el.hasAttribute('data-count')) countUp(el);
    if (el.hasAttribute('data-ring')) drawRing(el);
    if (el.hasAttribute('data-fill')) fillBar(el);
    // nested hooks inside a revealed block
    el.querySelectorAll('[data-count]').forEach(function (n) { if (!n.dataset.animDone) { n.dataset.animDone = '1'; countUp(n); } });
    el.querySelectorAll('[data-ring]').forEach(function (n) { if (!n.dataset.animDone) { n.dataset.animDone = '1'; drawRing(n); } });
    el.querySelectorAll('[data-fill]').forEach(function (n) { if (!n.dataset.animDone) { n.dataset.animDone = '1'; fillBar(n); } });
  }

  function init() {
    var hooks = document.querySelectorAll('.reveal,.stagger,[data-count],[data-ring],[data-fill]');

    if (reduce) {
      hooks.forEach(function (el) {
        el.classList.add('in');
        [].forEach.call(el.children || [], function (c) { c.classList && c.classList.add('in'); });
      });
      return;
    }

    if (!('IntersectionObserver' in window)) { hooks.forEach(activate); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { activate(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    hooks.forEach(function (el) { io.observe(el); });

    installWipe();
  }

  // accent curtain on internal navigation
  function installWipe() {
    var wipe = document.createElement('div');
    wipe.id = 'pgwipe';
    document.body.appendChild(wipe);
    // reveal-out on entry
    requestAnimationFrame(function () { wipe.classList.add('in'); requestAnimationFrame(function () { wipe.classList.remove('in'); wipe.classList.add('out'); }); });

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href[0] === '#' || a.target === '_blank' || a.hasAttribute('download')) return;
      if (/^(https?:|mailto:|tel:)/i.test(href) && a.host !== location.host) return;
      e.preventDefault();
      wipe.classList.remove('out'); wipe.classList.add('in');
      setTimeout(function () { location.href = href; }, 380);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
