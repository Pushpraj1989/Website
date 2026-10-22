// Site behaviour. Every feature works without JavaScript on the flat pages: the flats are in the HTML.
(function () {
  "use strict";
  var SAVE_KEY = "azb-shortlist";
  var VIEW_KEY = "portal-view";

  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* private window: the choice is simply not kept */ }
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function saved() {
    try { return JSON.parse(read(SAVE_KEY, "[]")) || []; } catch (e) { return []; }
  }
  function setSaved(list) { write(SAVE_KEY, JSON.stringify(list)); }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  // ---- card or list view ----
  function applyView(view) {
    document.querySelectorAll(".view-target").forEach(function (el) { el.classList.toggle("as-list", view === "list"); });
    document.querySelectorAll("[data-view-set]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.viewSet === view)); });
  }
  document.querySelectorAll("[data-view-set]").forEach(function (b) {
    b.addEventListener("click", function () { write(VIEW_KEY, b.dataset.viewSet); applyView(b.dataset.viewSet); });
  });
  applyView(read(VIEW_KEY, "cards"));

  // ---- shortlist: save buttons everywhere, a live count in the menu ----
  function refreshSaves() {
    var list = saved();
    document.querySelectorAll("[data-save]").forEach(function (b) {
      var on = list.indexOf(b.dataset.save) >= 0;
      b.setAttribute("aria-pressed", String(on));
      if (!b.hasAttribute("data-keep-label")) b.textContent = on ? "Saved" : "Save";
    });
    document.querySelectorAll("[data-shortcount]").forEach(function (el) { el.textContent = list.length; });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-save]");
    if (!b) return;
    e.preventDefault();
    var id = b.dataset.save, list = saved();
    var at = list.indexOf(id);
    if (at >= 0) list.splice(at, 1); else list.push(id);
    setSaved(list);
    refreshSaves();
    if (window.renderShortlist) window.renderShortlist();
  });

  var dataEl = document.getElementById("listings-data");
  var data = dataEl ? JSON.parse(dataEl.textContent) : [];

  // ---- flats to rent: filters, sort, URL, empty states ----
  var form = document.getElementById("filters");
  var results = document.getElementById("results");
  if (form && results) {
    var count = document.getElementById("count");
    var empty = document.getElementById("empty");
    var FIELDS = ["transaction", "building", "bhk", "min", "max", "amin", "amax", "sort"];

    function fromUrl() {
      var q = new URLSearchParams(location.search);
      FIELDS.forEach(function (k) { if (q.get(k) !== null && form.elements[k]) form.elements[k].value = q.get(k); });
    }
    function current() {
      var f = form.elements;
      return {
        transaction: (form.querySelector('input[name="transaction"]:checked') || { value: "rent" }).value,
        building: f.building.value, bhk: f.bhk.value,
        min: num(f.min.value), max: num(f.max.value), amin: num(f.amin.value), amax: num(f.amax.value),
        sort: f.sort.value,
      };
    }
    function toUrl(f) {
      var q = new URLSearchParams();
      Object.keys(f).forEach(function (k) {
        if (f[k] === "" || f[k] === null) return;
        if (k === "transaction" && f[k] === "rent") return;
        if (k === "sort" && f[k] === "rent-asc") return;
        q.set(k, f[k]);
      });
      var s = q.toString();
      history.replaceState(null, "", s ? "?" + s : location.pathname);
    }
    function sortRows(rows, sort) {
      var by = {
        "rent-asc": function (a, b) { return a.rent - b.rent || (a.id < b.id ? -1 : 1); },
        "rent-desc": function (a, b) { return b.rent - a.rent || (a.id < b.id ? -1 : 1); },
        "area-asc": function (a, b) { return a.area - b.area || (a.id < b.id ? -1 : 1); },
        "area-desc": function (a, b) { return b.area - a.area || (a.id < b.id ? -1 : 1); },
      };
      return rows.slice().sort(by[sort] || by["rent-asc"]);
    }
    function draw() {
      var f = current();
      toUrl(f);
      var rows = [];
      if (f.transaction === "rent") {
        rows = data.filter(function (i) {
          return (!f.building || i.building === f.building) && (!f.bhk || i.bhk === f.bhk) &&
            (f.min === null || i.rent >= f.min) && (f.max === null || i.rent <= f.max) &&
            (f.amin === null || i.area >= f.amin) && (f.amax === null || i.area <= f.amax);
        });
      }
      rows = sortRows(rows, f.sort);
      var list = saved();
      results.innerHTML = rows.map(function (item) {
        var on = list.indexOf(item.id) >= 0;
        return '<div class="fcard">' +
          '<a class="card" href="' + esc(item.href) + '"><img src="' + esc(item.cover) + '" alt="" loading="lazy">' +
          '<div class="card-body"><p class="price">' + esc(item.rent_text) + ' <small>' + esc(item.period_text) + '</small></p>' +
          '<h3>' + esc(item.bhk) + ' flat</h3><p class="muted">' + esc(item.building_name) + ' · ' + esc(item.size) + ' · ' + esc(item.status) + '</p></div></a>' +
          '<button type="button" class="save" data-save="' + esc(item.id) + '" aria-pressed="' + on + '">' + (on ? "Saved" : "Save") + '</button></div>';
      }).join("");
      count.textContent = f.transaction === "sale" ? "0 flats" : rows.length + (rows.length === 1 ? " flat" : " flats");
      if (f.transaction === "sale") {
        empty.textContent = "No flats for sale are listed yet. Choose Rent to see flats to rent.";
      } else {
        empty.textContent = "No flats match these filters. Widen the rent or area range, or clear a filter.";
      }
      empty.hidden = rows.length > 0;
      refreshSaves();
    }
    fromUrl();
    form.addEventListener("input", draw);
    form.addEventListener("change", draw);
    document.getElementById("clear-filters").addEventListener("click", function () {
      setTimeout(function () { form.elements.sort.value = "rent-asc"; draw(); }, 0);
    });
    draw();
  }

  // ---- shortlist page: a comparison table of the saved flats ----
  var compare = document.getElementById("compare");
  if (compare) {
    window.renderShortlist = function () {
      var ids = saved();
      var rows = ids.map(function (id) { return data.filter(function (i) { return i.id === id; })[0]; }).filter(Boolean);
      document.getElementById("short-empty").hidden = rows.length > 0;
      if (!rows.length) { compare.innerHTML = ""; return; }
      var head = "<tr><th scope=\"col\">Flat</th><th scope=\"col\">Building</th><th scope=\"col\">Bedrooms</th><th scope=\"col\">Rent</th><th scope=\"col\">Size</th><th scope=\"col\">Status</th><th scope=\"col\"><span class=\"sr-only\">Remove</span></th></tr>";
      var body = rows.map(function (r) {
        return "<tr><td><a href=\"" + esc(r.href) + "\">" + esc(r.title) + "</a></td><td>" + esc(r.building_name) + "</td><td>" + esc(r.bhk) +
          "</td><td>" + esc(r.rent_text) + " " + esc(r.period_text) + "</td><td>" + esc(r.size) + "</td><td>" + esc(r.status) +
          "</td><td><button type=\"button\" class=\"btn ghost small\" data-keep-label data-save=\"" + esc(r.id) + "\">Remove</button></td></tr>";
      }).join("");
      compare.innerHTML = "<div class=\"table-scroll\"><table class=\"compare\"><thead>" + head + "</thead><tbody>" + body + "</tbody></table></div>";
      refreshSaves();
    };
    window.renderShortlist();
  }

  refreshSaves();
})();
