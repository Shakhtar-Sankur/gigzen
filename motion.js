/* Gigzen — hero motion and scroll choreography.
 *
 * The hero is a long-exposure night city: traffic running a perspective road
 * grid toward a horizon, with a slow camera drift. It is drawn rather than
 * filmed, for three reasons. We have no licensed footage. A hero video would
 * be tens of megabytes on a site whose whole argument is that it respects
 * prepaid data. And drawn motion stays sharp at any resolution and loops with
 * no seam.
 *
 * Everything here is decoration. If this file never loads, the page keeps its
 * layout, its colours and all of its text.
 */
(function () {
  "use strict";

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ───────────────────────── hero: long-exposure traffic ───────── */

  var mounted = [];   // [{el, resize, start, stop}] so hidden views can re-init

  function city(canvas, opts) {
    if (!canvas) return;
    var ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    opts = opts || {};
    var LIME_SHARE = opts.limeShare == null ? 0.13 : opts.limeShare;
    var DENSITY = opts.density == null ? 1 : opts.density;

    var W = 0, H = 0, dpr = 1;
    var horizon = 0, focal = 0;
    var cars = [], roadsX = [], roadsZ = [];
    var camX = 0, drift = 0;
    var running = false, raf = 0, retries = 0;

    var NEAR = 2.4;          // nearest z the camera can see
    var FAR = 46;            // fog swallows everything past this
    var CAM_H = 3.1;         // camera height above the road plane

    function rand(a, b) { return a + Math.random() * (b - a); }

    function build() {
      // A loose grid: avenues running away from the camera, cross-streets
      // stepping back into the distance. Irregular spacing so it reads as a
      // city rather than graph paper.
      roadsX = [];
      for (var x = -26; x <= 26; x += rand(3.6, 7.4)) roadsX.push(x);
      roadsZ = [];
      for (var z = NEAR; z < FAR; z += rand(3.2, 6.8)) roadsZ.push(z);

      var budget = Math.round((W < 700 ? 190 : W < 1300 ? 330 : 460) * DENSITY);
      cars = [];
      for (var i = 0; i < budget; i++) cars.push(spawn(true));
    }

    function spawn(seed) {
      var alongZ = Math.random() < 0.62;
      var lime = Math.random() < LIME_SHARE; // "our" drivers
      var warm = Math.random() < 0.5;       // headlights vs tail lights
      if (alongZ) {
        var lane = roadsX[(Math.random() * roadsX.length) | 0] + rand(-0.32, 0.32);
        var dir = Math.random() < 0.5 ? 1 : -1;
        return {
          axis: 0, x: lane, z: seed ? rand(NEAR, FAR) : (dir > 0 ? FAR : NEAR),
          dir: dir, v: rand(0.055, 0.16), lime: lime, warm: warm, size: rand(0.7, 1.9)
        };
      }
      var row = roadsZ[(Math.random() * roadsZ.length) | 0] + rand(-0.22, 0.22);
      var d = Math.random() < 0.5 ? 1 : -1;
      return {
        axis: 1, x: seed ? rand(-26, 26) : d * -26, z: row,
        dir: d, v: rand(0.05, 0.14), lime: lime, warm: warm, size: rand(0.7, 1.7)
      };
    }

    // Perspective projection onto the road plane.
    function project(x, z) {
      var d = z;
      if (d < 0.35) return null;
      var s = focal / d;
      return { sx: W / 2 + (x - camX) * s, sy: horizon + CAM_H * s, s: s };
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var b = canvas.getBoundingClientRect();
      // Measured before layout settles, the box can come back degenerate. Sizing
      // the backing store to that leaves a 1px-wide canvas stretched across the
      // hero, which reads as a blank black band. Retry instead of committing.
      if (b.width < 2 || b.height < 2) {
        // A canvas in a hidden view measures zero and always will, so retrying
        // forever would spin a frame loop behind a screen nobody is looking at.
        if (++retries < 90) requestAnimationFrame(resize);
        return;
      }
      retries = 0;
      W = Math.round(b.width);
      H = Math.round(b.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      horizon = H * 0.30;
      focal = H * 0.62;
      build();
      ctx.fillStyle = "#05070A";
      ctx.fillRect(0, 0, W, H);
      grid(1);
      paintOnce();
    }

    // Faint road surface, so the traffic is clearly running on streets.
    function grid(alpha) {
      ctx.lineWidth = 1;
      var i, p0, p1;
      for (i = 0; i < roadsX.length; i++) {
        p0 = project(roadsX[i], NEAR);
        p1 = project(roadsX[i], FAR);
        if (!p0 || !p1) continue;
        var g = ctx.createLinearGradient(p0.sx, p0.sy, p1.sx, p1.sy);
        g.addColorStop(0, "rgba(150,185,215,0.42)");
        g.addColorStop(1, "rgba(150,185,215,0)");
        ctx.strokeStyle = g;
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke();
      }
      for (i = 0; i < roadsZ.length; i++) {
        p0 = project(-26, roadsZ[i]);
        p1 = project(26, roadsZ[i]);
        if (!p0 || !p1) continue;
        var fade = 1 - roadsZ[i] / FAR;
        ctx.strokeStyle = "rgba(150,185,215," + (0.30 * fade).toFixed(3) + ")";
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.moveTo(p0.sx, p0.sy); ctx.lineTo(p1.sx, p1.sy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function car(c) {
      var p = project(c.x, c.z);
      if (!p) { c.px = null; return; }
      if (p.sx < -120 || p.sx > W + 120 || p.sy > H + 60) { c.px = null; return; }

      var fade = Math.max(0, 1 - c.z / FAR);
      var w = Math.min(5.5, Math.max(0.7, c.size * p.s * 0.024));
      var a = Math.min(1, 0.18 + fade * fade * 1.5);
      var col = c.lime ? "211,255,0" : c.warm ? "255,206,150" : "255,86,64";

      // The streak is the point: a headlight photographed over a long exposure
      // is a line, not a dot. Drawing from the previous screen position to this
      // one gives that for free and makes speed and direction readable.
      if (c.px != null) {
        ctx.strokeStyle = "rgba(" + col + "," + a.toFixed(3) + ")";
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(c.px, c.py);
        ctx.lineTo(p.sx, p.sy);
        ctx.stroke();

        if (fade > 0.4) {
          ctx.strokeStyle = "rgba(" + col + "," + (a * 0.16).toFixed(3) + ")";
          ctx.lineWidth = Math.min(20, w * 5);
          ctx.beginPath();
          ctx.moveTo(c.px, c.py);
          ctx.lineTo(p.sx, p.sy);
          ctx.stroke();
        }
      }
      c.px = p.sx; c.py = p.sy;
    }

    function step(dt) {
      // Trails come from painting the background at low alpha instead of
      // clearing: each light smears into the last frames, the way a long
      // exposure records a road.
      ctx.fillStyle = "rgba(5,7,10,0.085)";
      ctx.fillRect(0, 0, W, H);

      grid(0.30);

      for (var i = 0; i < cars.length; i++) {
        var c = cars[i];
        if (c.axis === 0) {
          c.z -= c.dir * c.v * dt;
          if (c.z < NEAR - 0.6 || c.z > FAR + 1) cars[i] = spawn(false);
        } else {
          c.x += c.dir * c.v * dt * 1.6;
          if (c.x < -27 || c.x > 27) cars[i] = spawn(false);
        }
        car(c);
      }

      drift += dt * 0.0016;
      camX = Math.sin(drift) * 3.4;
    }

    function paintOnce() {
      for (var i = 0; i < cars.length; i++) car(cars[i]);
      atmosphere();
    }

    // Painted once over the canvas by CSS layers instead of per frame — see
    // .hero-veil — so the loop stays cheap.
    function atmosphere() {}

    var last = 0;
    function frame(now) {
      if (!running) return;
      var dt = Math.min(48, now - last || 16);
      last = now;
      step(dt * 0.06);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduced) return;
      running = true; last = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    mounted.push({ el: canvas, resize: resize, start: start, stop: stop });

    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); else window.addEventListener("resize", resize);
    resize();

    // Never animate a canvas nobody is looking at.
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        es[0].isIntersecting ? start() : stop();
      }, { threshold: 0.01 }).observe(canvas);
    } else {
      start();
    }
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });
  }

  /* ───────────────────────── scroll choreography ───────────────── */

  // Numbers count up the first time they are seen. Static if the visitor asked
  // for less motion, because a number that changes under you is exactly the
  // kind of thing that setting is for.
  function counters() {
    var els = [].slice.call(document.querySelectorAll(".stat .v"));
    if (!els.length) return;

    // Read every target ONCE, out of the markup, and keep it. The previous
    // version re-read the element's text each time it ran, so a number caught
    // mid-animation became the new target — and a number sitting at 0 pinned
    // itself at 0 for good.
    els.forEach(function (el) {
      if (el.hasAttribute("data-count-to")) return;
      var m = el.textContent.trim().match(/^(\d+)(\D*)$/);
      if (!m) return;
      el.setAttribute("data-count-to", m[1]);
      el.setAttribute("data-count-suffix", m[2] || "");
    });

    function finish(el) {
      el.textContent = el.getAttribute("data-count-to") + el.getAttribute("data-count-suffix");
    }

    function run(el) {
      if (el.getAttribute("data-counted") === "1") return;
      el.setAttribute("data-counted", "1");
      var target = +el.getAttribute("data-count-to");
      // No frames to animate with: a hidden tab does not run rAF, and the old
      // code wrote a synchronous 0 before the first frame and left it there.
      if (document.hidden) { finish(el); return; }
      var t0 = null, dur = 1100;
      el.style.fontVariantNumeric = "tabular-nums";
      requestAnimationFrame(function tick(now) {
        // t0 comes from the first frame's own timestamp. Seeding it from
        // performance.now() could put it AFTER the frame time and make the
        // first progress value negative.
        if (t0 === null) t0 = now;
        var p = Math.min(1, (now - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        if (p < 1) {
          el.textContent = String(Math.round(target * eased));
          requestAnimationFrame(tick);
        } else {
          finish(el);
        }
      });
    }

    // Reduced motion, or no observer to tell us when they are on screen: the
    // number stays exactly as authored. Never zero.
    if (reduced || !window.IntersectionObserver) {
      els.forEach(function (el) { if (el.hasAttribute("data-count-to")) finish(el); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        run(e.target);
      });
    }, { threshold: 0.6 });

    els.forEach(function (el) { if (el.hasAttribute("data-count-to")) io.observe(el); });

    // If the tab is hidden while a count is in flight, the frames stop and the
    // half-finished number is what the visitor comes back to. Settle them.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      els.forEach(function (el) {
        if (el.getAttribute("data-counted") === "1") finish(el);
      });
    });
  }

  // A slow parallax lift on the hero copy as it leaves, so the section has
  // depth rather than simply scrolling away.
  function parallax() {
    var hero = document.querySelector(".hero");
    var stage = document.querySelector(".hero-stage");
    if (!hero || !stage || reduced) return;
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        var h = stage.offsetHeight || 1;
        if (y < h * 1.2) {
          var p = y / h;
          hero.style.transform = "translate3d(0," + (y * 0.28).toFixed(1) + "px,0)";
          hero.style.opacity = String(Math.max(0, 1 - p * 1.55));
        }
        ticking = false;
      });
    }
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Stagger reuses the page's own .rv reveal rather than introducing a second
  // opacity system: each child is tagged .rv with an increasing delay, and a
  // local observer flips it to .in. Self-contained, so it does not depend on
  // when the inline script happened to collect its items.
  function stagger() {
    var groups = [].slice.call(document.querySelectorAll(".stagger"));
    if (!groups.length) return;

    var kids = [];
    groups.forEach(function (g) {
      [].slice.call(g.children).forEach(function (c, i) {
        if (reduced) return;
        c.classList.add("rv");
        c.style.transitionDelay = (i * 0.09).toFixed(2) + "s";
        kids.push(c);
      });
    });
    if (!kids.length || !window.IntersectionObserver) {
      kids.forEach(function (c) { c.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    kids.forEach(function (c) { io.observe(c); });

    // Same belt-and-braces as the page's own reveal: never leave copy invisible.
    setTimeout(function () { kids.forEach(function (c) { c.classList.add("in"); }); }, 2200);
  }

  // Views are toggled with the hidden attribute. A canvas inside a hidden one
  // cannot measure itself, so it is re-measured and restarted the moment its
  // view appears.
  function watchViews() {
    var views = [].slice.call(document.querySelectorAll(".view"));
    if (!views.length || !window.MutationObserver) return;
    var mo = new MutationObserver(function (recs) {
      recs.forEach(function (r) {
        if (r.attributeName !== "hidden" || r.target.hidden) return;
        mounted.forEach(function (m) {
          if (r.target.contains(m.el)) { m.resize(); m.start(); }
        });
      });
    });
    views.forEach(function (v) { mo.observe(v, { attributes: true }); });
  }

  function boot() {
    city(document.getElementById("cityscape"));
    // Buzz Buzz is an app for people driving through cities, so it gets the
    // same scene with a higher share of "our" drivers in it.
    city(document.getElementById("cityscape-buzz"), { limeShare: 0.3, density: 0.85 });
    counters();
    parallax();
    stagger();
    watchViews();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
