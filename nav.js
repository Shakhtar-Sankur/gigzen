/* Mobile navigation.
 *
 * The bar is a flex row of brand, five links and a language picker. Below
 * roughly 820px those cannot all fit, and the links were shrinking into the
 * wordmark and then scrolling sideways — a nav you have to swipe is a nav
 * whose items nobody finds. Below that width the links move into a panel
 * behind a single button.
 *
 * The language picker deliberately stays in the bar: on a site that ships in
 * sixteen languages, changing language should not be hidden behind a menu.
 *
 * Progressive: with this file missing the links are simply always visible, the
 * state the site was in before.
 */
(function () {
  "use strict";

  var nav = document.getElementById("nav");
  if (!nav) return;
  var wrap = nav.querySelector(".wrap");
  var links = nav.querySelector(".navlinks");
  if (!wrap || !links) return;

  var panelId = "nav-menu";
  links.id = panelId;

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "navtoggle";
  btn.setAttribute("aria-label", "Menu");
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", panelId);
  // An SVG with real strokes, not three 1.5px-tall divs. A hairline div
  // background is at the mercy of sub-pixel rounding and can rasterise to
  // nothing at some device pixel ratios; a stroked path cannot.
  btn.innerHTML =
    '<svg class="bars" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line class="b1" x1="3.5" y1="7" x2="20.5" y2="7"/>' +
    '<line class="b2" x1="3.5" y1="12" x2="20.5" y2="12"/>' +
    '<line class="b3" x1="3.5" y1="17" x2="20.5" y2="17"/>' +
    "</svg>";
  wrap.appendChild(btn);

  function open() { return nav.classList.contains("menu-open"); }

  function setOpen(v) {
    nav.classList.toggle("menu-open", v);
    btn.setAttribute("aria-expanded", v ? "true" : "false");
    // Stop the page scrolling behind an open panel, but only while it is open.
    document.documentElement.style.overflow = v ? "hidden" : "";
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!open());
  });

  // Choosing a destination should close the menu. The links themselves scroll
  // the page, so leaving the panel over the top would hide what was chosen.
  links.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });

  document.addEventListener("click", function (e) {
    if (!open()) return;
    if (!nav.contains(e.target)) setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open()) { setOpen(false); btn.focus(); }
  });

  // Never leave the panel open when the layout grows past the breakpoint: the
  // links become visible in the bar again and the panel would sit over them.
  var mq = window.matchMedia("(min-width: 821px)");
  var onChange = function (e) { if (e.matches) setOpen(false); };
  mq.addEventListener ? mq.addEventListener("change", onChange)
                      : mq.addListener(onChange);
})();
