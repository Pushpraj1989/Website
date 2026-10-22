// Content manager. Builds every element with createElement, so text from the site is never parsed as HTML.
"use strict";

const state = { user: null, csrf: "", tab: "hero", content: null, media: [], users: [], masters: [], kinds: {}, message: null, errors: [] };
const app = document.getElementById("app");

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "on") for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === "class") el.className = v;
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

async function api(method, path, body, raw = null) {
  const headers = {};
  if (state.csrf && method !== "GET") headers["X-CSRF-Token"] = state.csrf;
  let payload = null;
  if (raw) {
    headers["Content-Type"] = raw.type;
    payload = raw;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(path, { method, headers, body: payload, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.user) {
    state.user = null;
    route();
  }
  return { status: res.status, ...data };
}

function flash(kind, text, list = []) {
  state.message = { kind, text, list };
  render();
}

function messageBox() {
  if (!state.message) return null;
  const m = state.message;
  return h("div", { class: `msg ${m.kind}`, role: m.kind === "error" ? "alert" : "status" },
    m.text, m.list.length ? h("ul", null, m.list.map((x) => h("li", null, x))) : null);
}

function field(label, input) {
  return h("label", null, label, input);
}

function textInput(value, attrs = {}) {
  return h("input", { value: value ?? "", type: "text", ...attrs });
}

function select(options, value, attrs = {}) {
  return h("select", attrs, options.map(([v, t]) => h("option", { value: v, selected: v === value ? "selected" : null }, t)));
}

function imageOptions(current, dataK) {
  const keys = Object.keys(state.content.images || {});
  return select([["", "No photo"], ...keys.map((k) => [k, `${k} (${state.content.images[k].src})`])], current || "", dataK ? { "data-k": dataK } : {});
}

// The slide's current film is always listed, even if it is not in Media, so saving never drops it.
function videoOptions(current) {
  const files = state.media.filter((f) => f.kind === "video").map((f) => f.name);
  if (current && !files.includes(current)) files.unshift(current);
  return select([["", "No video"], ...files.map((n) => [n, n])], current || "");
}

// ---- auth screens --------------------------------------------------------------------------

function authShell(title, ...children) {
  return h("main", { class: "auth" },
    h("p", { class: "brandline" }, "Azaiba Gardens · Content manager"),
    h("h1", null, title),
    messageBox(),
    ...children);
}

function loginView() {
  const email = textInput("", { type: "email", autocomplete: "username", required: true, id: "email" });
  const password = h("input", { type: "password", autocomplete: "current-password", required: true, id: "password" });
  const code = h("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", pattern: "[0-9]{6}", id: "code" });
  const needsCode = state.needsCode;
  return authShell("Sign in",
    h("form", {
      class: "card",
      on: {
        submit: async (e) => {
          e.preventDefault();
          const body = { email: email.value, password: password.value, code: needsCode ? code.value : undefined };
          const r = await api("POST", "/api/auth/login", body);
          if (r.needs_code) { state.needsCode = true; flash("ok", "Enter the 6-digit code from your authenticator app."); return; }
          if (!r.ok) { flash("error", r.error || "Sign-in failed."); return; }
          state.needsCode = false;
          state.csrf = r.csrf;
          state.user = r.user;
          state.message = null;
          location.hash = "#/";
          route();
        },
      },
    },
      field("Email", email),
      field("Password", password),
      needsCode ? field("Authenticator code", code) : null,
      h("div", { class: "btn-row" }, h("button", { class: "btn", type: "submit" }, "Sign in")),
    ),
    h("div", { class: "btn-row" },
      h("a", { class: "link", href: "#/forgot" }, "Forgot password?"),
      h("span", { class: "muted" }, "·"),
      h("span", { class: "muted" }, "New here? Open the invitation link from your email. Accounts are created by invitation only.")),
  );
}

function forgotView() {
  const email = textInput("", { type: "email", required: true });
  return authShell("Reset your password",
    h("form", {
      class: "card",
      on: {
        submit: async (e) => {
          e.preventDefault();
          const r = await api("POST", "/api/auth/forgot", { email: email.value });
          flash(r.ok ? "ok" : "error", r.ok ? r.message : r.error);
        },
      },
    }, field("Email", email), h("button", { class: "btn", type: "submit" }, "Send reset link")),
    h("a", { class: "link", href: "#/login" }, "Back to sign in"));
}

function tokenFromHash() {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  return q.get("token") || "";
}

function acceptView() {
  const name = textInput("", { required: true, autocomplete: "name" });
  const password = h("input", { type: "password", required: true, minlength: 12, autocomplete: "new-password" });
  return authShell("Accept your invitation",
    h("p", { class: "muted" }, "Choose your name and a password of at least 12 characters. Use a password manager."),
    h("form", {
      class: "card",
      on: {
        submit: async (e) => {
          e.preventDefault();
          const r = await api("POST", "/api/auth/accept-invite", { token: tokenFromHash(), name: name.value, password: password.value });
          if (!r.ok && r.error) return flash("error", r.error);
          location.hash = "#/login";
          flash("ok", "Account created. Sign in with your email and password.");
        },
      },
    }, field("Your name", name), field("Password", password), h("button", { class: "btn", type: "submit" }, "Create account")));
}

function resetView() {
  const password = h("input", { type: "password", required: true, minlength: 12, autocomplete: "new-password" });
  return authShell("Choose a new password",
    h("form", {
      class: "card",
      on: {
        submit: async (e) => {
          e.preventDefault();
          const r = await api("POST", "/api/auth/reset", { token: tokenFromHash(), password: password.value });
          if (!r.ok) return flash("error", r.error);
          location.hash = "#/login";
          flash("ok", "Password changed. Sign in again.");
        },
      },
    }, field("New password", password), h("button", { class: "btn", type: "submit" }, "Save password")));
}

// ---- editors --------------------------------------------------------------------------------

function heroEditor() {
  const hero = state.content.hero;
  const f = {
    eyebrow: textInput(hero.eyebrow, { maxlength: 60 }),
    title: textInput(hero.title, { maxlength: 140, required: true }),
    lede: h("textarea", { maxlength: 400 }, hero.lede || ""),
    pl: textInput(hero.primary?.label, { maxlength: 40 }),
    ph: textInput(hero.primary?.href),
    sl: textInput(hero.secondary?.label, { maxlength: 40 }),
    sh: textInput(hero.secondary?.href),
  };
  return h("form", {
    on: {
      submit: async (e) => {
        e.preventDefault();
        readSlides();
        const value = {
          eyebrow: f.eyebrow.value, title: f.title.value, lede: f.lede.value,
          primary: { label: f.pl.value, href: f.ph.value }, secondary: { label: f.sl.value, href: f.sh.value },
        };
        save("hero", value, "Home heading saved and published.");
      },
    },
  },
    h("div", { class: "card" },
      h("h2", null, "Home heading"),
      h("div", { class: "row" }, field("Small label above the title", f.eyebrow), field("Title", f.title)),
      field("Lead text", f.lede),
      h("div", { class: "row" }, field("Button 1 label", f.pl), field("Button 1 link", f.ph), field("Button 2 label", f.sl), field("Button 2 link", f.sh)),
    ),
    slidesEditor(),
    h("div", { class: "btn-row" }, h("button", { class: "btn", type: "submit" }, "Save heading")));
}

// The hero slider: each slide is a photo or a film. Slides are edited as a list and saved together.
let slides = null;
function slidesEditor() {
  if (!slides) slides = JSON.parse(JSON.stringify(state.content.promos || []));
  const rows = slides.map((s, i) => h("div", { class: "item", key: i },
    h("h3", null, `Slide ${i + 1}${s.video ? " · film" : " · photo"}`),
    h("div", { class: "row" },
      field("Photo", imageOptions(s.image)),
      field("Film (optional, from Media)", videoOptions(s.video)),
    ),
    h("div", { class: "row" },
      field("Tag", textInput(s.tag, { maxlength: 20, placeholder: "Video" })),
      field("Kicker", textInput(s.kicker, { maxlength: 60 })),
      field("Title", textInput(s.title, { maxlength: 120, required: true })),
    ),
    field("Text", h("textarea", { maxlength: 300, on: { input: (e) => (s.text = e.target.value) } }, s.text || "")),
    h("div", { class: "row" },
      field("Button label", textInput(s.cta?.label, { maxlength: 40 })),
      field("Button link", textInput(s.cta?.href)),
    ),
    h("div", { class: "btn-row" },
      h("button", { class: "btn ghost", type: "button", on: { click: () => moveSlide(i, -1) } }, "Up"),
      h("button", { class: "btn ghost", type: "button", on: { click: () => moveSlide(i, 1) } }, "Down"),
      h("button", { class: "btn danger", type: "button", on: { click: () => { slides.splice(i, 1); render(); } } }, "Remove slide"),
    ),
  ));
  // Field values are read back from the DOM on save, so the rows above are the source of truth.
  return h("div", { class: "card", id: "slides" },
    h("h2", null, "Hero slides"),
    h("p", { class: "muted" }, "These slides run across the top of the home page. Each one is a photo or a film from Media."),
    rows,
    h("div", { class: "btn-row" },
      h("button", { class: "btn ghost", type: "button", on: { click: () => { readSlides(); slides.push({ tag: "", kicker: "", title: "", text: "", cta: {}, cta2: {}, image: "", video: "" }); render(); } } }, "Add slide"),
      h("button", { class: "btn", type: "button", on: { click: saveSlides } }, "Save slides")));
}

function readSlides() {
  const box = document.getElementById("slides");
  if (!box) return;
  const items = [...box.querySelectorAll(".item")];
  slides = items.map((item, i) => {
    const v = [...item.querySelectorAll("input, select, textarea")].map((el) => el.value);
    return {
      image: v[0], video: v[1], tag: v[2], kicker: v[3], title: v[4], text: v[5], cta: { label: v[6], href: v[7] }, cta2: slides[i]?.cta2 || {},
    };
  });
}

function moveSlide(i, dir) {
  readSlides();
  const j = i + dir;
  if (j < 0 || j >= slides.length) return;
  [slides[i], slides[j]] = [slides[j], slides[i]];
  render();
}

function saveSlides() {
  readSlides();
  save("promos", slides, "Slides saved and published.", () => { slides = null; });
}

// Lists come from the master tables. Only active values are offered, plus the value already saved.
function masterOptions(kind, current) {
  return state.masters
    .filter((r) => r.kind === kind && (r.active || r.code === current))
    .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
    .map((r) => [r.code, r.active ? r.label : `${r.label} (not in use)`]);
}

function masterSelect(kind, current, attrs = {}) {
  return select(masterOptions(kind, current), current ?? "", attrs);
}

function numberInput(value, attrs = {}) {
  return h("input", { type: "number", inputmode: "decimal", step: "any", min: 0, value: value ?? "", ...attrs });
}

// Buildings and flats. Every flat has a type from the list, a build area and/or carpet area each with
// its own unit, and a rent amount with its currency and period. Values are read back by data-k name.
let buildings = null;
function buildingsEditor() {
  if (!buildings) buildings = JSON.parse(JSON.stringify(state.content.buildings || []));
  const blocks = buildings.map((b, i) => h("div", { class: "item", "data-building": i },
    h("h3", null, b.name || `Building ${i + 1}`),
    h("div", { class: "row" },
      field("Name", textInput(b.name, { maxlength: 80, required: true, "data-k": "name" })),
      field("Area (location)", textInput(b.area, { maxlength: 80, "data-k": "area" })),
      field("Floors", numberInput(b.floors, { min: 1, max: 60, step: 1, "data-k": "floors" })),
      field("Units", numberInput(b.units, { min: 0, max: 5000, step: 1, "data-k": "units" })),
      field("Status", masterSelect("building_status", b.status, { "data-k": "status" })),
      field("Photo", imageOptions(b.image, "bimage")),
    ),
    field("Description", h("textarea", { maxlength: 400, "data-k": "text" }, b.text || "")),
    h("div", { class: "sub" },
      h("h3", null, "Flats"),
      (b.flats || []).map((f) => flatRow(f)),
      h("div", { class: "btn-row" },
        h("button", { class: "btn ghost", type: "button", on: { click: () => addFlat(i) } }, "Add flat"),
        h("button", { class: "btn danger", type: "button", on: { click: () => { readBuildings(); buildings.splice(i, 1); render(); } } }, "Remove building"),
      ),
    ),
  ));
  return h("form", {
    on: {
      submit: (e) => {
        e.preventDefault();
        readBuildings();
        save("buildings", buildings, "Buildings and rents saved and published.", () => { buildings = null; });
      },
    },
  },
    blocks,
    h("div", { class: "btn-row" },
      h("button", { class: "btn ghost", type: "button", on: { click: () => { readBuildings(); buildings.push({ name: "", area: "", floors: 1, units: 0, status: masterOptions("building_status")[0]?.[0] || "", text: "", image: "", flats: [] }); render(); } } }, "Add building"),
      h("button", { class: "btn", type: "submit" }, "Save buildings and rents")));
}

function flatRow(f) {
  const build = f.measures?.build || {};
  const carpet = f.measures?.carpet || {};
  const price = f.price || {};
  return h("div", { class: "item", "data-flat": "" },
    h("div", { class: "row" },
      field("Flat type", masterSelect("bedroom_type", f.type, { "data-k": "type" })),
      field("Build area", numberInput(build.value, { "data-k": "build-value" })),
      field("Build area unit", masterSelect("area_unit", build.unit || "sqm", { "data-k": "build-unit" })),
      field("Carpet area", numberInput(carpet.value, { "data-k": "carpet-value" })),
      field("Carpet area unit", masterSelect("area_unit", carpet.unit || "sqm", { "data-k": "carpet-unit" })),
    ),
    h("div", { class: "row" },
      field("Rent amount", numberInput(price.amount, { "data-k": "amount" })),
      field("Currency", masterSelect("currency", price.currency || "OMR", { "data-k": "currency" })),
      field("Rent period", masterSelect("rent_period", price.period || "month", { "data-k": "period" })),
      field("Photo", imageOptions(f.image, "fimage")),
      field("Link", textInput(f.href || "contact.html", { "data-k": "href" })),
    ),
  );
}

function addFlat(i) {
  readBuildings();
  const type = masterOptions("bedroom_type")[0]?.[0] || "";
  const currency = masterOptions("currency").find(([c]) => c === "OMR")?.[0] || masterOptions("currency")[0]?.[0] || "";
  buildings[i].flats = [...(buildings[i].flats || []), {
    type, measures: { build: { value: "", unit: "sqm" }, carpet: { value: "", unit: "sqm" } },
    price: { amount: "", currency, period: "month" }, image: "", href: "contact.html",
  }];
  render();
}

function readBuildings() {
  const blocks = [...document.querySelectorAll("[data-building]")];
  if (!blocks.length) return;
  const val = (root, k) => {
    const el = root.querySelector(`[data-k="${k}"]`);
    return el ? el.value : "";
  };
  buildings = blocks.map((block, i) => ({
    ...(buildings[i] || {}),
    name: val(block, "name"), area: val(block, "area"), floors: val(block, "floors"), units: val(block, "units"),
    status: val(block, "status"), image: val(block, "bimage"), text: val(block, "text"),
    flats: [...block.querySelectorAll("[data-flat]")].map((row) => ({
      type: val(row, "type"),
      measures: {
        build: { value: val(row, "build-value"), unit: val(row, "build-unit") },
        carpet: { value: val(row, "carpet-value"), unit: val(row, "carpet-unit") },
      },
      price: { amount: val(row, "amount"), currency: val(row, "currency"), period: val(row, "period") },
      image: val(row, "fimage"), href: val(row, "href"),
    })),
  }));
}

// Lists tab: admins maintain the values; editors can see them.
function listsView() {
  const admin = state.user.role === "admin";
  return h("div", null,
    h("div", { class: "card" },
      h("h2", null, "Lists"),
      h("p", { class: "muted" }, "These lists feed every dropdown in the CMS. Codes are fixed once created, because the site data refers to them. Hide a value you no longer use rather than deleting it."),
    ),
    Object.entries(state.kinds).map(([kind, meta]) => listCard(kind, meta, admin)));
}

function listCard(kind, meta, admin) {
  const rows = state.masters.filter((r) => r.kind === kind).sort((a, b) => a.sort - b.sort);
  const addCode = textInput("", { maxlength: 20, placeholder: kind === "currency" ? "e.g. CNY" : "code" });
  const addLabel = textInput("", { maxlength: 60, placeholder: "Shown in the dropdown" });
  const addDec = numberInput("", { min: 0, max: 4, step: 1, placeholder: "Decimals" });
  return h("div", { class: "card" },
    h("h3", null, meta.label),
    h("table", null,
      h("thead", null, h("tr", null, h("th", null, "Code"), h("th", null, "Label"), h("th", null, "Order"), h("th", null, "Decimals"), h("th", null, "Offered in dropdowns"), admin ? h("th", null, "") : null)),
      h("tbody", null, rows.map((r) => {
        const label = textInput(r.label, { maxlength: 60, disabled: admin ? null : "disabled" });
        const sort = numberInput(r.sort, { min: 0, max: 9999, step: 1, disabled: admin ? null : "disabled" });
        const active = h("input", { type: "checkbox", checked: r.active ? "checked" : null, disabled: admin ? null : "disabled" });
        return h("tr", null,
          h("td", null, h("code", null, r.code)),
          h("td", null, label),
          h("td", null, sort),
          h("td", null, r.decimals ?? "—"),
          h("td", null, active, " ", h("span", { class: "muted" }, r.active ? "shown" : "hidden")),
          admin ? h("td", null, h("button", { class: "btn ghost", type: "button", on: { click: () => saveMaster(kind, r.code, { label: label.value, sort: sort.value, active: active.checked }) } }, "Save")) : null,
        );
      })),
    ),
    admin ? h("form", { class: "sub", on: { submit: (e) => { e.preventDefault(); addMasterValue(kind, meta, { code: addCode.value, label: addLabel.value, decimals: addDec.value }); } } },
      h("div", { class: "row" },
        field("New code", addCode),
        field("Label", addLabel),
        meta.decimalsRequired ? field("Decimal places", addDec) : null),
      h("button", { class: "btn", type: "submit" }, "Add value")) : null,
  );
}

async function saveMaster(kind, code, body) {
  const r = await api("PUT", `/api/masters/${kind}/${encodeURIComponent(code)}`, body);
  if (!r.ok) return flash("error", r.error);
  await loadContent();
  flash("ok", "List value saved.");
}

async function addMasterValue(kind, meta, body) {
  const r = await api("POST", `/api/masters/${kind}`, body);
  if (!r.ok) return flash("error", r.error);
  await loadContent();
  flash("ok", "List value added.");
}

function contactsEditor() {
  const phones = state.content.contacts.length ? state.content.contacts : [{ label: "", number: "", tel: "", whatsapp: true }];
  const rows = phones.map((p, i) => h("div", { class: "item", "data-phone": i },
    h("div", { class: "row" },
      field("Label", textInput(p.label, { maxlength: 40 })),
      field("Shown as", textInput(p.number, { maxlength: 40, required: true })),
      field("Dialling number (+ and country code)", textInput(p.tel, { required: true, placeholder: "+96812345678" })),
    ),
    h("label", { class: "row" }, h("span", null, "WhatsApp chat button uses this number"),
      h("input", { type: "radio", name: "wa", value: i, checked: p.whatsapp ? "checked" : null })),
  ));
  return h("form", {
    on: {
      submit: (e) => {
        e.preventDefault();
        const items = [...document.querySelectorAll("[data-phone]")].map((row, i) => {
          const v = [...row.querySelectorAll("input[type=text], input:not([type])")].map((el) => el.value);
          const wa = row.querySelector("input[type=radio]").checked;
          return { label: v[0], number: v[1], tel: v[2].replace(/\s+/g, ""), whatsapp: wa };
        });
        save("contacts", items, "Phone numbers and WhatsApp saved and published.");
      },
    },
  },
    h("div", { class: "card" },
      h("h2", null, "Phone and WhatsApp"),
      h("p", { class: "muted" }, "The WhatsApp number is used by the floating chat button and the WhatsApp links on every page. Use the international format, for example +968 2271 7171."),
    ),
    rows,
    h("div", { class: "btn-row" }, h("button", { class: "btn", type: "submit" }, "Save contacts")));
}

async function save(section, value, okText, after) {
  const r = await api("PUT", `/api/content/${section}`, { value });
  if (!r.ok) return flash("error", "Not saved. Fix these and try again:", r.errors || [r.error]);
  if (after) after();
  await loadContent();
  flash("ok", okText);
}

function mediaView() {
  const input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp,video/mp4,video/webm", id: "file" });
  const status = h("p", { class: "muted", role: "status" });
  const uploadBtn = h("button", {
    class: "btn", type: "button",
    on: {
      click: async () => {
        const file = input.files[0];
        if (!file) return flash("error", "Choose a photo or a film first.");
        uploadBtn.disabled = true;
        status.textContent = `Uploading ${file.name} (${Math.round(file.size / 1024)} KB)…`;
        const r = await api("POST", "/api/media", undefined, file);
        uploadBtn.disabled = false;
        if (!r.ok) return flash("error", r.error || "Upload failed.", r.errors || []);
        await loadContent();
        await loadMedia();
        flash("ok", r.kind === "video" ? `Film ${r.name} uploaded. Pick it in its building, flat or home page.` : (r.published ? "Photo uploaded and published. Pick it in a building, flat or slide." : "Photo uploaded. Pick it in a building or flat."));
      },
    },
  }, "Upload");
  return h("div", null,
    h("div", { class: "card" },
      h("h2", null, "Upload photos and films"),
      h("p", { class: "muted" }, "Photos: JPEG, PNG or WebP, up to 10 MB. Films: MP4 or WebM, up to 200 MB. Files are checked by their contents, not only by name."),
      input, h("div", { class: "btn-row" }, uploadBtn), status),
    h("div", { class: "card" },
      h("h2", null, "Files"),
      h("div", { class: "thumbs" }, state.media.map((f) => h("div", { class: "thumb" },
        f.kind === "video"
          ? h("video", { src: `/api/media/file/${encodeURIComponent(f.name)}`, muted: true, controls: true, preload: "metadata" })
          : h("img", { src: `/api/media/file/${encodeURIComponent(f.name)}`, alt: f.name, loading: "lazy" }),
        h("div", null, f.name),
        h("div", { class: "muted" }, f.inUse ? "In use" : "Not used yet"),
      )))));
}

function usersView() {
  const email = textInput("", { type: "email", required: true });
  const role = select([["editor", "Editor: edits content"], ["admin", "Administrator: also manages people"]], "editor");
  const rows = state.users.map((u) => h("tr", null,
    h("td", null, u.name || "(no name yet)", h("br"), h("span", { class: "muted" }, u.email)),
    h("td", null, u.role === "admin" ? "Administrator" : "Editor"),
    h("td", null, h("span", { class: `pill ${u.totp_enabled ? "on" : ""}` }, u.totp_enabled ? "2FA on" : "2FA off")),
    h("td", null, u.disabled ? h("span", { class: "pill" }, "Disabled") : h("span", { class: "pill on" }, "Active")),
    h("td", null, u.id === state.user.id ? h("span", { class: "muted" }, "You") : h("div", { class: "btn-row" },
      h("button", { class: "btn ghost", type: "button", on: { click: () => userAction(u.id, "reset", {}) } }, "Send reset link"),
      h("button", { class: "btn ghost", type: "button", on: { click: () => userAction(u.id, "role", { role: u.role === "admin" ? "editor" : "admin" }) } }, u.role === "admin" ? "Make editor" : "Make admin"),
      h("button", { class: "btn ghost", type: "button", on: { click: () => userAction(u.id, "disable", { disabled: !u.disabled }) } }, u.disabled ? "Enable" : "Disable"),
      h("button", { class: "btn danger", type: "button", on: { click: () => confirm(`Remove ${u.email}?`) && userAction(u.id, "delete", {}) } }, "Remove"),
    )),
  ));
  return h("div", null,
    h("div", { class: "card" },
      h("h2", null, "Invite someone"),
      h("p", { class: "muted" }, "They get an email with a one-time link. Accounts are never created without an invitation."),
      h("form", {
        on: {
          submit: async (e) => {
            e.preventDefault();
            const r = await api("POST", "/api/users/invite", { email: email.value, role: role.value });
            if (!r.ok) return flash("error", r.error);
            email.value = "";
            flash("ok", r.sent === "outbox" ? "Invitation saved to the server outbox (no email server is set up)." : "Invitation sent.");
            await loadUsers();
          },
        },
      }, h("div", { class: "row" }, field("Email", email), field("Role", role)), h("button", { class: "btn", type: "submit" }, "Send invitation"))),
    h("div", { class: "card" },
      h("h2", null, "People with access"),
      h("table", null, h("thead", null, h("tr", null, h("th", null, "Person"), h("th", null, "Role"), h("th", null, "2FA"), h("th", null, "Status"), h("th", null, ""))), h("tbody", null, rows))));
}

async function userAction(id, action, body) {
  const r = await api("POST", `/api/users/${id}/${action}`, body);
  if (!r.ok) return flash("error", r.error);
  await loadUsers();
  flash("ok", action === "reset" ? "Reset link sent." : "Saved.");
}

function accountView() {
  const cur = h("input", { type: "password", autocomplete: "current-password", required: true });
  const next = h("input", { type: "password", autocomplete: "new-password", required: true, minlength: 12 });
  const code = h("input", { type: "text", inputmode: "numeric", pattern: "[0-9]{6}", autocomplete: "one-time-code", placeholder: "6-digit code" });
  const pw = h("input", { type: "password", autocomplete: "current-password", placeholder: "Your password" });
  const twoFactor = state.user.totp_enabled
    ? h("form", { on: { submit: async (e) => { e.preventDefault(); const r = await api("POST", "/api/auth/totp/disable", { password: pw.value }); if (!r.ok) return flash("error", r.error); state.user.totp_enabled = false; flash("ok", "Two-step sign-in is off."); } } },
      h("p", { class: "muted" }, "Two-step sign-in is on. Turn it off with your password."),
      field("Password", pw), h("button", { class: "btn danger", type: "submit" }, "Turn off 2FA"))
    : h("div", null,
      h("p", { class: "muted" }, "Add a second step: a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy)."),
      h("div", { class: "btn-row" }, h("button", { class: "btn ghost", type: "button", on: { click: setupTotp } }, "Set up 2FA")),
      state.totp ? h("div", { class: "item" },
        h("p", null, "Add this key to your app, or open the link on your phone:"),
        h("p", null, h("code", null, state.totp.secret)),
        h("p", null, h("a", { class: "link", href: state.totp.uri }, "Open in authenticator app")),
        field("Code from the app", code),
        h("button", { class: "btn", type: "button", on: { click: async () => { const r = await api("POST", "/api/auth/totp/enable", { code: code.value }); if (!r.ok) return flash("error", r.error); state.totp = null; state.user.totp_enabled = true; flash("ok", "Two-step sign-in is on."); } } }, "Turn on 2FA")) : null);
  return h("div", null,
    h("div", { class: "card" },
      h("h2", null, "Change password"),
      h("form", { on: { submit: async (e) => { e.preventDefault(); const r = await api("POST", "/api/account/password", { current: cur.value, password: next.value }); if (!r.ok) return flash("error", r.error); cur.value = ""; next.value = ""; flash("ok", "Password changed. Other devices were signed out."); } } },
        field("Current password", cur), field("New password (12+ characters)", next), h("button", { class: "btn", type: "submit" }, "Change password"))),
    h("div", { class: "card" }, h("h2", null, "Two-step sign-in"), twoFactor));
}

async function setupTotp() {
  const r = await api("POST", "/api/auth/totp/setup", {});
  if (!r.ok) return flash("error", r.error);
  state.totp = r;
  render();
}

function auditView() {
  return h("div", { class: "card" }, h("h2", null, "Activity"),
    h("p", { class: "muted" }, "Who signed in, what changed and when. Newest first."),
    h("table", null, h("thead", null, h("tr", null, h("th", null, "When"), h("th", null, "Who"), h("th", null, "What"), h("th", null, "Detail"))),
      h("tbody", null, (state.audit || []).map((r) => h("tr", null, h("td", null, new Date(r.at).toLocaleString()), h("td", null, r.actor), h("td", null, r.action), h("td", null, r.detail))))));
}

// ---- listing portal (target "portal") ----------------------------------------------------------

let pSite = null, pBuildings = null, pListings = null;
const SITE_TEXT = ["group", "name", "location", "tagline", "hero_title", "about_title", "phone", "whatsapp", "email", "address"];

function readVal(root, k) {
  const el = root.querySelector(`[data-k="${k}"]`);
  return el ? el.value : "";
}

function mediaSelect(kind, current, attrs = {}) {
  const files = state.media.filter((f) => f.kind === kind).map((f) => f.name);
  if (current && !files.includes(current)) files.unshift(current);
  return select([["", kind === "video" ? "No film" : "No photo"], ...files.map((n) => [n, n])], current || "", attrs);
}

// Gallery: tick the photos to show. Read back with readGallery.
function galleryBoxes(selected, dataK) {
  const chosen = selected || [];
  const files = state.media.filter((f) => f.kind === "image").map((f) => f.name);
  for (const c of chosen) if (!files.includes(c)) files.push(c);
  return h("div", { class: "thumbs", "data-k": dataK },
    files.map((name) => h("label", { class: "thumb" },
      h("input", { type: "checkbox", value: name, checked: chosen.includes(name) ? "checked" : null }), " ", name)));
}

function readGallery(root, dataK) {
  return [...root.querySelectorAll(`[data-k="${dataK}"] input:checked`)].map((i) => i.value);
}

function portalBody() {
  if (state.tab === "site") return portalSiteView();
  if (state.tab === "buildings") return portalBuildingsView();
  if (state.tab === "listings") return portalListingsView();
  if (state.tab === "media") return mediaView();
  if (state.tab === "lists") return listsView();
  if (state.tab === "users") return usersView();
  if (state.tab === "account") return accountView();
  if (state.tab === "audit") return auditView();
  return portalSiteView();
}

function portalSiteView() {
  const s = pSite || (pSite = JSON.parse(JSON.stringify(state.content.site)));
  const t = (k, label, attrs = {}) => field(label, textInput(s[k], { maxlength: 200, "data-k": k, ...attrs }));
  return h("form", {
    on: {
      submit: (e) => {
        e.preventDefault();
        const v = { ...s };
        for (const k of SITE_TEXT) v[k] = readVal(e.target, k);
        v.hero_lede = readVal(e.target, "hero_lede");
        v.about_text = readVal(e.target, "about_text");
        v.video = readVal(e.target, "video");
        v.hero_video = readVal(e.target, "hero_video");
        v.currency = readVal(e.target, "currency");
        save("site", v, "Site settings saved and published.", () => { pSite = null; });
      },
    },
  },
    h("div", { class: "card" }, h("h2", null, "Company and contact"),
      h("div", { class: "row" }, t("group", "Group name"), t("name", "Site name"), t("location", "Location"), t("tagline", "Tagline")),
      h("div", { class: "row" }, t("phone", "Phone"), t("whatsapp", "WhatsApp (digits, with country code)"), t("email", "Enquiries email"), t("address", "Office address"))),
    h("div", { class: "card" }, h("h2", null, "Home page"),
      t("hero_title", "Home title"),
      field("Home lead text", h("textarea", { "data-k": "hero_lede", maxlength: 400 }, s.hero_lede || "")),
      h("div", { class: "row" }, field("Home film (below the hero)", mediaSelect("video", s.video, { "data-k": "video" })), field("Hero background film (plays behind the heading)", mediaSelect("video", s.hero_video, { "data-k": "hero_video" }))),
      field("Currency", masterSelect("currency", s.currency, { "data-k": "currency" }))),
    h("div", { class: "card" }, h("h2", null, "About page"),
      t("about_title", "About title"),
      field("About text", h("textarea", { "data-k": "about_text", maxlength: 2000 }, s.about_text || ""))),
    h("div", { class: "btn-row" }, h("button", { class: "btn", type: "submit" }, "Save site settings")));
}

function portalBuildingsView() {
  const list = pBuildings || (pBuildings = JSON.parse(JSON.stringify(state.content.buildings)));
  const blocks = list.map((b, i) => h("div", { class: "item", "data-pbuilding": i },
    h("h3", null, b.name || `Building ${i + 1}`),
    h("div", { class: "row" },
      field("ID (lowercase, dashes)", textInput(b.id, { maxlength: 60, "data-k": "id" })),
      field("Name", textInput(b.name, { maxlength: 80, "data-k": "name" })),
      field("Area (location)", textInput(b.area, { maxlength: 80, "data-k": "area" })),
      field("Floors", numberInput(b.floors, { min: 1, max: 60, step: 1, "data-k": "floors" })),
      field("Units", numberInput(b.units, { min: 0, max: 5000, step: 1, "data-k": "units" })),
      field("Status", masterSelect("building_status", b.status, { "data-k": "status" }))),
    field("Description", h("textarea", { maxlength: 400, "data-k": "description" }, b.description || "")),
    h("div", { class: "row" },
      field("Cover photo", mediaSelect("image", b.cover, { "data-k": "cover" })),
      field("Film", mediaSelect("video", b.video, { "data-k": "video" }))),
    field("Gallery (tick the photos to show)", galleryBoxes(b.gallery, "gallery")),
    h("div", { class: "btn-row" }, h("button", { class: "btn danger", type: "button", on: { click: () => { readPortalBuildings(); pBuildings.splice(i, 1); render(); } } }, "Remove building"))));
  return h("form", {
    on: { submit: (e) => { e.preventDefault(); readPortalBuildings(); save("buildings", pBuildings, "Buildings saved and published.", () => { pBuildings = null; }); } },
  },
    blocks,
    h("div", { class: "btn-row" },
      h("button", { class: "btn ghost", type: "button", on: { click: () => { readPortalBuildings(); pBuildings.push({ id: "", name: "", area: "", floors: 1, units: 0, status: masterOptions("building_status")[0]?.[0] || "", description: "", cover: "", gallery: [], video: "" }); render(); } } }, "Add building"),
      h("button", { class: "btn", type: "submit" }, "Save buildings")));
}

function readPortalBuildings() {
  const blocks = [...document.querySelectorAll("[data-pbuilding]")];
  if (!blocks.length) return;
  pBuildings = blocks.map((b) => ({
    id: readVal(b, "id"), name: readVal(b, "name"), area: readVal(b, "area"), floors: readVal(b, "floors"), units: readVal(b, "units"),
    status: readVal(b, "status"), description: readVal(b, "description"), cover: readVal(b, "cover"), video: readVal(b, "video"),
    gallery: readGallery(b, "gallery"),
  }));
}

function portalListingsView() {
  const list = pListings || (pListings = JSON.parse(JSON.stringify(state.content.listings)));
  const buildings = state.content.buildings;
  const blocks = list.map((l, i) => h("div", { class: "item", "data-plisting": i },
    h("h3", null, l.title || `Flat ${i + 1}`),
    h("div", { class: "row" },
      field("ID (lowercase, dashes)", textInput(l.id, { maxlength: 60, "data-k": "id" })),
      field("Title", textInput(l.title, { maxlength: 120, "data-k": "title" })),
      field("Building", select(buildings.map((b) => [b.id, b.name]), l.building, { "data-k": "building" })),
      field("Flat type", masterSelect("bedroom_type", l.bhk, { "data-k": "bhk" })),
      field("Status", masterSelect("flat_status", l.status, { "data-k": "status" }))),
    h("div", { class: "row" },
      field("Build area", numberInput(l.measures?.build?.value, { "data-k": "build-value" })),
      field("Build area unit", masterSelect("area_unit", l.measures?.build?.unit || "sqm", { "data-k": "build-unit" })),
      field("Carpet area", numberInput(l.measures?.carpet?.value, { "data-k": "carpet-value" })),
      field("Carpet area unit", masterSelect("area_unit", l.measures?.carpet?.unit || "sqm", { "data-k": "carpet-unit" }))),
    h("div", { class: "row" },
      field("Rent amount", numberInput(l.price?.amount, { "data-k": "amount" })),
      field("Currency", masterSelect("currency", l.price?.currency || "OMR", { "data-k": "currency" })),
      field("Rent period", masterSelect("rent_period", l.price?.period || "month", { "data-k": "period" })),
      field("Available from", textInput(l.available_from, { maxlength: 40, "data-k": "available_from", placeholder: "e.g. 1 Jan 2027" }))),
    h("div", { class: "row" },
      field("Cover photo", mediaSelect("image", l.cover, { "data-k": "cover" })),
      field("Film", mediaSelect("video", l.video, { "data-k": "video" }))),
    field("Gallery (tick the photos to show)", galleryBoxes(l.gallery, "gallery")),
    field("Description", h("textarea", { maxlength: 400, "data-k": "description" }, l.description || "")),
    h("label", { class: "row" }, h("span", null, "Show on the home page"), h("input", { type: "checkbox", "data-k": "featured", checked: l.featured ? "checked" : null })),
    h("div", { class: "btn-row" }, h("button", { class: "btn danger", type: "button", on: { click: () => { readPortalListings(); pListings.splice(i, 1); render(); } } }, "Remove flat"))));
  return h("form", {
    on: { submit: (e) => { e.preventDefault(); readPortalListings(); save("listings", pListings, "Flats saved and published.", () => { pListings = null; }); } },
  },
    blocks,
    h("div", { class: "btn-row" },
      h("button", { class: "btn ghost", type: "button", on: { click: () => {
        readPortalListings();
        pListings.push({ id: "", title: "", building: buildings[0]?.id || "", bhk: masterOptions("bedroom_type")[0]?.[0] || "", measures: { build: { value: "", unit: "sqm" }, carpet: { value: "", unit: "sqm" } }, price: { amount: "", currency: "OMR", period: "month" }, status: masterOptions("flat_status")[0]?.[0] || "", available_from: "", cover: "", gallery: [], video: "", description: "", featured: false });
        render();
      } } }, "Add flat"),
      h("button", { class: "btn", type: "submit" }, "Save flats")));
}

function readPortalListings() {
  const blocks = [...document.querySelectorAll("[data-plisting]")];
  if (!blocks.length) return;
  pListings = blocks.map((b) => ({
    id: readVal(b, "id"), title: readVal(b, "title"), building: readVal(b, "building"), bhk: readVal(b, "bhk"), status: readVal(b, "status"),
    measures: {
      build: { value: readVal(b, "build-value"), unit: readVal(b, "build-unit") },
      carpet: { value: readVal(b, "carpet-value"), unit: readVal(b, "carpet-unit") },
    },
    price: { amount: readVal(b, "amount"), currency: readVal(b, "currency"), period: readVal(b, "period") },
    available_from: readVal(b, "available_from"), cover: readVal(b, "cover"), video: readVal(b, "video"),
    gallery: readGallery(b, "gallery"), description: readVal(b, "description"),
    featured: !!b.querySelector('[data-k="featured"]')?.checked,
  }));
}

// ---- layout ----------------------------------------------------------------------------------

const TABS = [
  ["hero", "Home heading and slides"],
  ["buildings", "Buildings and rents"],
  ["contacts", "Phone and WhatsApp"],
  ["lists", "Lists"],
  ["media", "Media"],
  ["users", "People"],
  ["account", "My account"],
  ["audit", "Activity"],
];

const PORTAL_TABS = [
  ["site", "Site and contacts"],
  ["buildings", "Buildings"],
  ["listings", "Flats to rent"],
  ["media", "Media"],
  ["lists", "Lists"],
  ["users", "People"],
  ["account", "My account"],
  ["audit", "Activity"],
];

function shell(body) {
  const adminOnly = state.user.role === "admin";
  const list = state.content?.target === "portal" ? PORTAL_TABS : TABS;
  const tabs = list.filter(([id]) => adminOnly || !["users", "audit"].includes(id));
  return h("div", { class: "wrap" },
    h("div", { class: "top" },
      h("div", null, h("strong", null, "Azaiba Gardens · content"), h("div", { class: "muted" }, `${state.user.name || state.user.email} · ${adminOnly ? "Administrator" : "Editor"}`)),
      h("div", { class: "btn-row" },
        h("button", { class: "btn", type: "button", on: { click: publishSite } }, "Publish site"),
        h("a", { class: "btn ghost", href: "/", target: "_blank", rel: "noopener" }, "View site"),
        h("button", { class: "btn ghost", type: "button", on: { click: logout } }, "Sign out"))),
    h("nav", { class: "tabs" }, tabs.map(([id, label]) => h("button", { type: "button", "aria-current": state.tab === id ? "page" : null, on: { click: () => { state.tab = id; slides = null; buildings = null; pSite = pBuildings = pListings = null; state.message = null; loadTab(); } } }, label))),
    messageBox(),
    body);
}

async function publishSite() {
  const r = await api("POST", "/api/publish", {});
  if (!r.ok) return flash("error", r.error || "Publish failed.", r.log ? [r.log] : []);
  flash("ok", "Site published.");
}

async function logout() {
  await api("POST", "/api/auth/logout", {});
  state.user = null;
  state.csrf = "";
  location.hash = "#/login";
  render();
}

async function loadContent() {
  const r = await api("GET", "/api/content");
  if (r.ok) state.content = r;
  if (r.ok && r.target === "portal" && state.tab === "hero") state.tab = "site";
  const mv = await api("GET", "/api/masters");
  if (mv.ok) { state.masters = mv.values; state.kinds = mv.kinds; }
  const m = await api("GET", "/api/media");
  if (m.ok) state.media = m.files;
}

async function loadMedia() {
  const m = await api("GET", "/api/media");
  if (m.ok) state.media = m.files;
}

async function loadUsers() {
  const r = await api("GET", "/api/users");
  if (r.ok) state.users = r.users;
}

async function loadAudit() {
  const r = await api("GET", "/api/audit");
  if (r.ok) state.audit = r.rows;
}

async function loadTab() {
  if (state.tab === "users") await loadUsers();
  if (state.tab === "audit") await loadAudit();
  render();
}

function tabBody() {
  if (state.content?.target === "portal") return portalBody();
  if (state.tab === "buildings") return buildingsEditor();
  if (state.tab === "contacts") return contactsEditor();
  if (state.tab === "lists") return listsView();
  if (state.tab === "media") return mediaView();
  if (state.tab === "users") return usersView();
  if (state.tab === "account") return accountView();
  if (state.tab === "audit") return auditView();
  return heroEditor();
}

// ---- routing ---------------------------------------------------------------------------------

function render() {
  const route = location.hash.replace(/\?.*$/, "");
  let view;
  if (route === "#/forgot") view = forgotView();
  else if (route === "#/accept") view = acceptView();
  else if (route === "#/reset") view = resetView();
  else if (route === "#/login" || !state.user) view = loginView();
  else view = shell(tabBody());
  app.replaceChildren(view);
}

async function route() {
  const hash = location.hash.replace(/\?.*$/, "");
  if (["#/forgot", "#/accept", "#/reset"].includes(hash)) return render();
  if (!state.user) {
    const me = await api("GET", "/api/me");
    if (me.ok) {
      state.user = me.user;
      state.csrf = me.csrf;
    }
  }
  if (!state.user) {
    if (hash !== "#/login") location.hash = "#/login";
    return render();
  }
  if (!state.content) await loadContent();
  if (hash === "#/login" || hash === "" || hash === "#") location.hash = "#/";
  render();
}

window.addEventListener("hashchange", route);
route();
