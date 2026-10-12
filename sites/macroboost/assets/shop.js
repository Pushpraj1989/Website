/* Shop: cart drawer, checkout, order status and meal-plan builder.
   Reads window.T1SHOP (assets/shop-data.js). The cart lives in localStorage;
   prices are display only, the order service re-prices every line. */
(() => {
  const S = window.T1SHOP;
  if (!S) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const KEY = "t1cart-" + S.slug;
  const money = (n) => S.currency + " " + (Math.round(n * 1000) / 1000).toFixed(3);
  const api = (path, opts) => fetch(S.api + path, opts).then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(new Error(j.error || "Something went wrong")))));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY) || "[]").filter((l) => S.items[l.sku] && S.items[l.sku].a); } catch (e) { cart = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} paint(); };
  const subtotal = () => cart.reduce((t, l) => t + S.items[l.sku].a * l.qty, 0);
  const count = () => cart.reduce((t, l) => t + l.qty, 0);

  function add(sku, qty, opt) {
    const line = cart.find((l) => l.sku === sku && (l.opt || "") === (opt || ""));
    if (line) line.qty = Math.min(50, line.qty + qty); else cart.push({ sku, qty, opt: opt || "" });
    save();
  }

  /* ---------- toast and badge ---------- */
  const toastEl = $("[data-toast]");
  let toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add("is-on");
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("is-on"), 2200);
  }
  function fly(from) {
    const img = from && (from.closest(".pc, .pd-hero") || document).querySelector("img");
    const to = $("[data-cart-open]");
    if (reduce || !img || !to) return;
    const a = img.getBoundingClientRect(), b = to.getBoundingClientRect();
    const c = img.cloneNode(); c.className = "cart-fly";
    Object.assign(c.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
    document.body.appendChild(c);
    c.animate([{ transform: "none", opacity: 1, borderRadius: "16px" },
      { transform: `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px) scale(${24 / a.width})`, opacity: 0.6, borderRadius: "50%" }],
      { duration: 700, easing: "cubic-bezier(.6,-0.1,.3,1)" }).onfinish = () => c.remove();
  }

  /* ---------- drawer ---------- */
  const drawer = $("[data-cart]");
  function open() {
    if (!drawer) return;
    drawer.hidden = false; requestAnimationFrame(() => drawer.classList.add("is-open"));
    document.documentElement.classList.add("cart-lock");
    const x = $(".cart-x", drawer); x && x.focus();
  }
  function close() {
    if (!drawer) return;
    drawer.classList.remove("is-open"); document.documentElement.classList.remove("cart-lock");
    setTimeout(() => { drawer.hidden = true; }, reduce ? 0 : 450);
  }
  $$("[data-cart-open]").forEach((b) => b.addEventListener("click", open));
  $$("[data-cart-close]").forEach((b) => b.addEventListener("click", close));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer && !drawer.hidden) close(); });

  function lineHTML(l, i, small) {
    const it = S.items[l.sku];
    return `<div class="cl">
      <a class="cl-img" href="${it.url}">${it.img ? `<img src="${it.img}" alt="" loading="lazy">` : ""}</a>
      <div class="cl-t"><a href="${it.url}">${it.t}</a>${l.opt ? `<small>${l.opt}</small>` : ""}<span>${money(it.a)}</span></div>
      ${small ? `<b class="cl-q">× ${l.qty}</b>` : `<div class="qty qty-sm"><button type="button" data-line="${i}" data-d="-1" aria-label="One less">&minus;</button><output>${l.qty}</output><button type="button" data-line="${i}" data-d="1" aria-label="One more">+</button></div>`}
    </div>`;
  }

  function paint() {
    const n = count(), sub = subtotal();
    $$("[data-cart-count]").forEach((el) => {
      el.hidden = !n; if (el.textContent !== String(n)) { el.textContent = n; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    });
    const lines = $("[data-cart-lines]");
    if (lines) {
      lines.innerHTML = cart.map((l, i) => lineHTML(l, i)).join("");
      $("[data-cart-empty]").hidden = !!n; $("[data-cart-foot]").hidden = !n;
      $("[data-cart-total]").textContent = money(sub);
    }
    paintCheckout();
  }
  document.addEventListener("click", (e) => {
    const d = e.target.closest("[data-line]");
    if (d) {
      const l = cart[+d.dataset.line]; if (!l) return;
      l.qty += +d.dataset.d; if (l.qty < 1) cart.splice(+d.dataset.line, 1);
      save(); return;
    }
    const b = e.target.closest("[data-add]");
    if (!b) return;
    e.preventDefault();
    if (b.dataset.go) { location.href = b.dataset.go; return; }
    let qty = 1, opt = "";
    if (b.hasAttribute("data-from-page")) {
      const q = $("[data-qty] output"); qty = q ? +q.textContent || 1 : 1;
      opt = $$(".pd-opt").map((o) => { const on = $(".pd-chip.is-on", o); return on ? on.textContent.trim() : ""; }).filter(Boolean).join(" · ");
    }
    add(b.dataset.add, qty, opt); fly(b);
    b.classList.remove("is-added"); void b.offsetWidth; b.classList.add("is-added");
    toast(`Added ${qty > 1 ? qty + " × " : ""}${S.items[b.dataset.add].t}`);
  });
  $$("[data-qty]").forEach((q) => q.addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]"); if (!b) return;
    const o = $("output", q); o.textContent = Math.max(1, Math.min(50, (+o.textContent || 1) + +b.dataset.step));
  }));

  /* ---------- checkout ---------- */
  const co = $("[data-checkout]");
  let cardOn = false;
  function paintCheckout() {
    if (!co) return;
    const sub = subtotal(), n = count();
    $("[data-co-lines]").innerHTML = cart.map((l, i) => lineHTML(l, i, true)).join("");
    $("[data-co-empty]").hidden = !!n;
    $("[data-co-sub]").textContent = money(sub);
    const fee = fulfil() === "delivery" && typeof S.delivery.fee === "number" ? S.delivery.fee : 0;
    $("[data-co-grand]").textContent = money(sub + fee);
    $("[data-co-total]").textContent = money(sub + fee);
    $("[data-co-submit]").disabled = !n;
  }
  const fulfil = () => { const r = co && $("input[name=fulfilment]:checked", co); return r ? r.value : "pickup"; };
  function syncFulfil() {
    const f = fulfil();
    $$("[data-show-for]", co).forEach((el) => { el.hidden = el.dataset.showFor !== f; });
    const pay = $("input[name=payment]:checked", co);
    if (!pay || pay.closest("[hidden]") || pay.disabled) {
      const first = $$(".pay", co).find((p) => !p.hidden && !$("input", p).disabled);
      if (first) $("input", first).checked = true;
    }
    paintCheckout();
  }
  if (co) {
    const form = $("[data-co-form]", co), err = $("[data-co-error]", co);
    const card = $("[data-pay=card] input", co);
    if (card) {
      card.disabled = true; $("[data-card-off]", co).hidden = false;
      api("/health").then((h) => { cardOn = !!h.card; card.disabled = !cardOn; $("[data-card-off]", co).hidden = cardOn; syncFulfil(); }).catch(() => {});
    }
    $$("input[name=fulfilment]", co).forEach((r) => r.addEventListener("change", syncFulfil));
    syncFulfil();
    form.addEventListener("submit", (e) => {
      e.preventDefault(); err.hidden = true;
      const fd = new FormData(form), pay = fd.get("payment");
      const body = { site: S.slug, base: location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, ""), cart: cart.map((l) => ({ sku: l.sku, qty: l.qty, opt: l.opt })), fulfilment: fulfil(), payment: pay,
        customer: { name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email") },
        area: fd.get("area") || "", address: fd.get("address") || "", when: fd.get("when"), notes: fd.get("notes") };
      if (!String(body.customer.name || "").trim() || String(body.customer.phone || "").replace(/\D/g, "").length < 8) {
        err.textContent = "Please add your name and a mobile number."; err.hidden = false; return;
      }
      if (fulfil() === "delivery" && !String(body.address || "").trim()) { err.textContent = "Please add the delivery address."; err.hidden = false; return; }
      if (pay === "whatsapp") {
        const text = [`Hello ${S.name}, I would like to order:`, ...cart.map((l) => `${l.qty} × ${S.items[l.sku].t}${l.opt ? " (" + l.opt + ")" : ""}`),
          `Subtotal: ${money(subtotal())}`, fulfil() === "delivery" ? `Delivery to: ${body.area}, ${body.address}` : "Pickup",
          `When: ${body.when}`, body.notes ? `Notes: ${body.notes}` : "", `Name: ${body.customer.name} · ${body.customer.phone}`].filter(Boolean).join("\n");
        window.open(`https://wa.me/${S.wa.replace("+", "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        cart = []; save(); location.href = "order.html?status=whatsapp"; return;
      }
      const btn = $("[data-co-submit]", co); btn.disabled = true; btn.classList.add("is-busy");
      api("/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => {
          if (r.redirect) { location.href = r.redirect; return; }
          cart = []; save(); location.href = `order.html?status=placed&order=${encodeURIComponent(r.order)}`;
        })
        .catch((x) => {
          err.textContent = x.message === "Failed to fetch" || x instanceof SyntaxError ? "The order service is not reachable right now. Please call us or try again." : x.message;
          err.hidden = false; btn.disabled = false; btn.classList.remove("is-busy");
        });
    });
  }

  /* ---------- order status ---------- */
  const op = $("[data-order-page]");
  if (op) {
    const q = new URLSearchParams(location.search), st = q.get("status"), id = q.get("order");
    const set = (k, t, x, ok) => { $("[data-o-kicker]").textContent = k; $("[data-o-title]").textContent = t; $("[data-o-text]").textContent = x; op.classList.toggle("is-bad", !ok); $("[data-o-retry]").hidden = ok; };
    const facts = (o) => { const f = $("[data-o-facts]"); f.hidden = false;
      f.innerHTML = [["Order", o.order], ["Total", money(o.total)], ["How", o.fulfilment], ["Items", o.lines.map((l) => l.qty + " × " + l.name).join(", ")]]
        .map(([a, b]) => `<div><dt>${a}</dt><dd>${String(b).replace(/</g, "&lt;")}</dd></div>`).join(""); };
    if (st === "whatsapp") set("Sent to WhatsApp", "Send the message to confirm", "Your order is written out in WhatsApp. Press send and we reply to confirm the time.", true);
    else if (st === "cancel") set("Payment cancelled", "No payment was taken", "Your card was not charged. Try again or choose cash.", false);
    else if (id) {
      let tries = 0;
      const check = () => api(`/order/${encodeURIComponent(id)}?site=${S.slug}`).then((o) => {
        facts(o);
        if (o.status === "paid") { cart = []; save(); set("Paid", "Thank you, your order is in", "Payment received. The kitchen has your order and we will call if anything changes.", true); }
        else if (o.status === "awaiting_payment" && tries++ < 6) { set("Checking payment", "One moment…", "Confirming your payment with the bank.", true); setTimeout(check, 2500); }
        else if (o.status === "awaiting_payment" || o.status === "payment_cancelled") set("Payment not completed", "Your order is not paid yet", "If money left your account, call us with your order number.", false);
        else set(o.status === "plan_request" ? "Plan request" : "Order placed", "Thank you, your order is in", "We will call you to confirm. Keep your order number.", true);
      }).catch(() => set("Order", "We could not check this order", "Please call us with your order number: " + id, false));
      check();
    } else set("Your order", "Nothing to show yet", "Add something from the menu to start an order.", false);
  }

  /* ---------- meal plans ---------- */
  const plan = $("[data-plan]");
  if (plan && plan.hasAttribute("data-sub")) {
    // priced subscription: period x meals a day, each option a cart item at its listed price
    const form = $("[data-plan-form]", plan), err = $("[data-co-error]", plan);
    const tiers = JSON.parse($("[data-sub-tiers]", plan).textContent);
    const start = $("[data-sub-start]", form);
    const d = new Date(); d.setDate(d.getDate() + 1);
    start.min = start.value = d.toISOString().slice(0, 10);
    const pick = () => { const p = $("input[name=period]:checked", form), n = +$("input[name=meals]:checked", form).value; return { p, n, key: p.value + n, days: +p.dataset.days }; };
    const calc = () => {
      const { p, n, key, days } = pick(), a = tiers[key];
      $("[data-sub-price]").textContent = money(a);
      $("[data-sub-meals]").textContent = `${days * n} (${days} days × ${n})`;
      $("[data-sub-per]").textContent = money(a / (days * n));
      // the same meals bought as weekly plans
      const wk = $$("input[name=period]", form).find((i) => +i.dataset.days < days);
      const row = $("[data-sub-save-row]");
      if (wk && tiers[wk.value + n]) { const save = tiers[wk.value + n] * (days / +wk.dataset.days) - a; row.hidden = save <= 0; $("[data-sub-save]").textContent = money(save); } else row.hidden = true;
      $$("[data-sub-from]", form).forEach((el) => { const v = tiers[p.value + el.dataset.subFrom]; el.textContent = v ? money(v) : ""; });
      $$("[data-sub-img]", plan).forEach((im) => im.classList.toggle("is-on", +im.dataset.subImg === n));
      $("[data-sub-n]", plan).textContent = n;
      $("[data-sub-n]", plan).nextElementSibling.textContent = n === 1 ? "meal a day" : "meals a day";
    };
    form.addEventListener("change", calc); calc();
    form.addEventListener("submit", (e) => {
      e.preventDefault(); err.hidden = true;
      const { key } = pick();
      if (!start.value || start.value < start.min) { err.textContent = "Please choose a start date from tomorrow."; err.hidden = false; return; }
      const fd = new FormData(form);
      const opt = [`Start ${start.value}`, ...fd.getAll("addon"), String(fd.get("notes") || "").trim()].filter(Boolean).join(" · ").slice(0, 80);
      add("meal-sub-" + key, 1, opt);
      toast("Subscription added to your cart");
      open();
    });
  } else if (plan) {
    const form = $("[data-plan-form]", plan), err = $("[data-co-error]", plan);
    const val = (n) => +(($(`input[name=${n}]:checked`, form) || {}).value || 0);
    const calc = () => {
      const picks = $$("input[name=pick]:checked", form).map((i) => S.items[i.value]).filter(Boolean);
      const m = val("meals"), meals = m * val("days") * val("weeks");
      $("[data-plan-meals]").textContent = meals;
      $("[data-plan-n]").textContent = picks.length ? `${picks.length} chosen` : "";
      if (!picks.length) { ["kcal", "protein", "est"].forEach((k) => { $(`[data-plan-${k}]`).textContent = "–"; }); return; }
      const avg = (k) => picks.reduce((t, p) => t + (p[k] || 0), 0) / picks.length;
      $("[data-plan-kcal]").textContent = Math.round(avg("k") * m) + " kcal";
      $("[data-plan-protein]").textContent = Math.round(avg("p") * m) + " g";
      $("[data-plan-est]").textContent = "≈ " + money(avg("a") * meals);
    };
    form.addEventListener("change", calc); calc();
    form.addEventListener("submit", (e) => {
      e.preventDefault(); err.hidden = true;
      const fd = new FormData(form);
      const body = { site: S.slug, kind: "plan", customer: { name: fd.get("name"), phone: fd.get("phone") }, notes: fd.get("notes"),
        plan: { goal: fd.get("goal"), meals: fd.get("meals"), days: fd.get("days"), weeks: fd.get("weeks"), picks: fd.getAll("pick") } };
      if (!String(body.customer.name || "").trim() || String(body.customer.phone || "").replace(/\D/g, "").length < 8) { err.textContent = "Please add your name and a mobile number."; err.hidden = false; return; }
      const viaWa = () => {
        const text = [`Hello ${S.name}, I would like a meal plan:`, `Goal: ${body.plan.goal}`, `${body.plan.meals} meals a day, ${body.plan.days} days a week, ${body.plan.weeks} week(s)`,
          "Meals I like: " + body.plan.picks.map((k) => S.items[k].t).join(", "), body.notes ? "Notes: " + body.notes : "", `Name: ${body.customer.name} · ${body.customer.phone}`].filter(Boolean).join("\n");
        window.open(`https://wa.me/${S.wa.replace("+", "")}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      };
      api("/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => { location.href = `order.html?status=placed&order=${encodeURIComponent(r.order)}`; })
        .catch(() => { if (S.wa) viaWa(); else { err.textContent = "The request service is not reachable right now. Please call us."; err.hidden = false; } });
    });
  }

  // subscription teaser: weekly / monthly price toggle
  $$("[data-msub]").forEach((sec) => sec.addEventListener("click", (e) => {
    const b = e.target.closest("[data-msub-p]");
    if (!b) return;
    $$("[data-msub-p]", sec).forEach((x) => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
    $$("[data-msub-v]", sec).forEach((v) => (v.hidden = v.dataset.msubV !== b.dataset.msubP));
  }));

  paint();
})();
