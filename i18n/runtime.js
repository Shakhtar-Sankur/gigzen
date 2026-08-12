/* Gigzen site localisation.
 *
 * Keys are the English source strings themselves, so the markup needs no
 * data-i18n attributes and the page still reads correctly with this file
 * missing, blocked, or failed. Nothing here runs before the English page has
 * already rendered.
 *
 * Each language lives in its own file and is fetched only when chosen. The
 * markets this site is aimed at are largely prepaid-data markets, so shipping
 * sixteen dictionaries to every visitor to serve one of them would contradict
 * the thing the site claims to care about.
 */
(function () {
  "use strict";

  // `ready` gates both the picker and the hreflang alternates. A dictionary
  // that does not exist yet must not be offered: the fallback is silent, so a
  // visitor would pick their language, get English, and conclude the site is
  // broken. Flip the flag in the same commit that adds i18n/<code>.js.
  var LANGS = [
    { code: "en", label: "English", ready: true },
    { code: "fil", label: "Filipino", ready: true },
    { code: "es", label: "Español", ready: true },
    { code: "hi", label: "हिन्दी", ready: true },
    { code: "bn", label: "বাংলা", ready: false },
    { code: "id", label: "Bahasa Indonesia", ready: true },
    { code: "ms", label: "Bahasa Melayu", ready: false },
    { code: "th", label: "ไทย", ready: false },
    { code: "vi", label: "Tiếng Việt", ready: false },
    { code: "pt", label: "Português", ready: false },
    { code: "fr", label: "Français", ready: false },
    { code: "de", label: "Deutsch", ready: false },
    { code: "zh", label: "中文", ready: false },
    { code: "ja", label: "日本語", ready: false },
    { code: "ko", label: "한국어", ready: false },
    { code: "ar", label: "العربية", ready: true }
  ].filter(function (l) { return l.ready; });
  var RTL = { ar: true };
  var STORE = "gigzen.lang";

  // Only the marketing surfaces. The two deep product views stay English for
  // now and say so, rather than being half-translated.
  var ROOT_IDS = ["nav", "view-home"];

  var nodes = null;   // [{node, en}] captured once, from the English DOM
  var loaded = { en: {} };
  var current = "en";

  function collect() {
    if (nodes) return nodes;
    nodes = [];
    var roots = [];
    ROOT_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) roots.push(el);
    });
    var foot = document.querySelector("footer");
    if (foot) roots.push(foot);

    roots.forEach(function (root) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = walker.nextNode())) {
        var parent = n.parentElement;
        if (!parent || parent.closest("script,style,svg,canvas,.langpick")) continue;
        var text = n.textContent;
        if (!text.replace(/\s+/g, " ").trim()) continue;
        nodes.push({ node: n, en: text });
      }
    });
    return nodes;
  }

  function apply(code) {
    var dict = loaded[code] || {};
    collect().forEach(function (rec) {
      var key = rec.en.replace(/\s+/g, " ").trim();
      var hit = code === "en" ? null : dict[key];
      // Preserve the original leading/trailing whitespace: these are inline
      // fragments, and eating a space welds two words together.
      var lead = rec.en.match(/^\s*/)[0];
      var tail = rec.en.match(/\s*$/)[0];
      rec.node.textContent = hit ? lead + hit + tail : rec.en;
    });

    var html = document.documentElement;
    html.setAttribute("lang", code);
    html.setAttribute("dir", RTL[code] ? "rtl" : "ltr");
    current = code;

    var url = new URL(window.location.href);
    if (code === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", code);
    history.replaceState(history.state, "", url.toString() + url.hash);

    var notices = document.querySelectorAll(".i18n-notice");
    for (var i = 0; i < notices.length; i++) notices[i].hidden = code === "en";

    try { localStorage.setItem(STORE, code); } catch (e) { /* private mode */ }
  }

  function load(code, done) {
    if (loaded[code]) return done(true);
    var s = document.createElement("script");
    s.src = "i18n/" + code + ".js";
    s.onload = function () {
      var d = window.GIGZEN_I18N && window.GIGZEN_I18N[code];
      if (d) loaded[code] = d;
      done(!!d);
    };
    // A missing or blocked dictionary must leave the English page intact
    // rather than blanking it.
    s.onerror = function () { done(false); };
    document.head.appendChild(s);
  }

  function select(code) {
    if (code === current) return;
    if (code === "en") return apply("en");
    load(code, function (ok) { apply(ok ? code : "en"); });
  }

  function build() {
    var nav = document.querySelector("#nav .wrap");
    if (!nav) return;

    var wrap = document.createElement("div");
    wrap.className = "langpick";

    var sel = document.createElement("select");
    sel.setAttribute("aria-label", "Choose a language");
    LANGS.forEach(function (l) {
      var o = document.createElement("option");
      o.value = l.code;
      o.textContent = l.label;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { select(sel.value); });

    wrap.appendChild(globe());
    wrap.appendChild(sel);
    nav.appendChild(wrap);

    // hreflang alternates, so a search engine can serve the right one.
    LANGS.forEach(function (l) {
      var link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = l.code === "en" ? "x-default" : l.code;
      var u = new URL(window.location.href);
      u.hash = "";
      if (l.code === "en") u.searchParams.delete("lang");
      else u.searchParams.set("lang", l.code);
      link.href = u.toString();
      document.head.appendChild(link);
    });

    var param = new URL(window.location.href).searchParams.get("lang");
    var saved = null;
    try { saved = localStorage.getItem(STORE); } catch (e) { /* ignore */ }
    var nav0 = (navigator.language || "en").toLowerCase().split("-")[0];
    var known = LANGS.map(function (l) { return l.code; });
    var pick =
      (known.indexOf(param) > -1 && param) ||
      (known.indexOf(saved) > -1 && saved) ||
      (known.indexOf(nav0) > -1 && nav0) ||
      "en";

    sel.value = pick;
    if (pick !== "en") select(pick);
  }

  function globe() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    [
      "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
      "M3 12h18",
      "M12 3c2.5 2.4 3.8 5.5 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.5-3.8-9S9.5 5.4 12 3Z"
    ].forEach(function (d) {
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    });
    return svg;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
