// Client-side filter for the flats list. The page works without it: every flat is already in the HTML.
(function () {
  var box = document.querySelector("[data-results]");
  var dataEl = document.getElementById("listings-data");
  if (!box || !dataEl) return;

  var data = JSON.parse(dataEl.textContent);
  var form = box.querySelector("form");
  var results = document.getElementById("results");
  var count = document.getElementById("count");
  var empty = document.getElementById("empty");
  var currency = "OMR";

  function read() {
    var q = new URLSearchParams(location.search);
    ["building", "bhk", "max"].forEach(function (name) {
      if (q.get(name) && form.elements[name]) form.elements[name].value = q.get(name);
    });
  }

  function draw() {
    var building = form.elements.building.value;
    var bhk = form.elements.bhk.value;
    var max = parseInt(form.elements.max.value, 10);
    var rows = data.filter(function (item) {
      return (!building || item.building === building) &&
             (!bhk || item.bhk === bhk) &&
             (isNaN(max) || item.rent <= max);
    });
    results.innerHTML = rows.map(function (item) {
      return '<a class="card" href="' + item.href + '"><img src="' + item.cover + '" alt="" loading="lazy">' +
        '<div class="card-body"><p class="price">' + item.rent_text + ' <small>' + item.period_text + '</small></p>' +
        "<h3>" + item.bhk + " flat</h3><p class=\"muted\">" + item.size + " · " + item.status + "</p></div></a>";
    }).join("");
    count.textContent = rows.length + (rows.length === 1 ? " flat" : " flats");
    empty.hidden = rows.length > 0;
  }

  read();
  form.addEventListener("input", draw);
  form.addEventListener("change", draw);
  draw();
})();

// Card or list view: one choice for the whole site, remembered on this device.
(function () {
  var KEY = "portal-view";
  function read() {
    try { return localStorage.getItem(KEY) === "list" ? "list" : "cards"; } catch (e) { return "cards"; }
  }
  function write(view) {
    try { localStorage.setItem(KEY, view); } catch (e) { /* private window: the choice simply is not kept */ }
  }
  function apply(view) {
    document.querySelectorAll(".view-target").forEach(function (el) { el.classList.toggle("as-list", view === "list"); });
    document.querySelectorAll("[data-view-set]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.viewSet === view)); });
  }
  document.querySelectorAll("[data-view-set]").forEach(function (b) {
    b.addEventListener("click", function () { write(b.dataset.viewSet); apply(b.dataset.viewSet); });
  });
  apply(read());
})();
