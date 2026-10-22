// Content manager. Builds every element with createElement, so text from the site is never parsed as HTML.
"use strict";

const state = { user: null, csrf: "", tab: "hero", content: null, media: [], users: [], message: null, errors: [] };
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

function imageOptions(current) {
  const keys = Object.keys(state.content.images || {});
  return select([["", "No photo"], ...keys.map((k) => [k, `${k} (${state.content.images[k].src})`])], current || "");
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

// Buildings and flats: each building lists its flats with the rent per month.
let buildings = null;
function buildingsEditor() {
  if (!buildings) buildings = JSON.parse(JSON.stringify(state.content.buildings || []));
  const blocks = buildings.map((b, i) => h("div", { class: "item", "data-building": i },
    h("h3", null, b.name || `Building ${i + 1}`),
    h("div", { class: "row" },
      field("Name", textInput(b.name, { maxlength: 80, required: true })),
      field("Area", textInput(b.area, { maxlength: 80 })),
      field("Floors", textInput(b.floors, { type: "number", min: 1, max: 60 })),
      field("Units", textInput(b.units, { type: "number", min: 0, max: 5000 })),
      field("Status", textInput(b.status, { maxlength: 40 })),
      field("Photo", imageOptions(b.image)),
    ),
    field("Description", h("textarea", { maxlength: 400 }, b.text || "")),
    h("div", { class: "sub" },
      h("h3", null, "Flats and rent per month"),
      (b.flats || []).map((f, j) => h("div", { class: "row", "data-flat": j },
        field("Type", select([["1 BHK", "1 BHK"], ["2 BHK", "2 BHK"], ["3 BHK", "3 BHK"], ["Studio", "Studio"]], f.type)),
        field("Size (sqm)", textInput(parseInt(f.size, 10) || "", { type: "number", min: 1, max: 2000 })),
        field("Rent (OMR / month)", textInput(parseInt(String(f.rent).replace(/\D/g, ""), 10) || "", { type: "number", min: 0, max: 10000 })),
        field("Photo", imageOptions(f.image)),
        field("Link", textInput(f.href || "contact.html")),
      )),
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
      h("button", { class: "btn ghost", type: "button", on: { click: () => { readBuildings(); buildings.push({ name: "", area: "", floors: 1, units: 0, status: "Available now", text: "", image: "", flats: [] }); render(); } } }, "Add building"),
      h("button", { class: "btn", type: "submit" }, "Save buildings and rents")));
}

function addFlat(i) {
  readBuildings();
  buildings[i].flats = [...(buildings[i].flats || []), { type: "1 BHK", size: "", rent: "", image: "", href: "contact.html" }];
  render();
}

function readBuildings() {
  const blocks = [...document.querySelectorAll("[data-building]")];
  if (!blocks.length) return;
  buildings = blocks.map((block, i) => {
    const top = [...block.querySelectorAll(":scope > .row:first-of-type input, :scope > .row:first-of-type select")].map((el) => el.value);
    const desc = block.querySelector(":scope > label textarea").value;
    const flats = [...block.querySelectorAll("[data-flat]")].map((row) => {
      const v = [...row.querySelectorAll("input, select")].map((el) => el.value);
      return { type: v[0], size: v[1], rent: v[2], image: v[3], href: v[4] };
    });
    return {
      ...(buildings[i] || {}), name: top[0], area: top[1], floors: top[2], units: top[3], status: top[4], image: top[5], text: desc, flats,
    };
  });
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
        flash("ok", r.kind === "video" ? `Film ${r.name} uploaded. Pick it in Hero slides.` : `Photo uploaded and published. Pick it in a building or a slide.`);
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

// ---- layout ----------------------------------------------------------------------------------

const TABS = [
  ["hero", "Home heading and slides"],
  ["buildings", "Buildings and rents"],
  ["contacts", "Phone and WhatsApp"],
  ["media", "Media"],
  ["users", "People"],
  ["account", "My account"],
  ["audit", "Activity"],
];

function shell(body) {
  const adminOnly = state.user.role === "admin";
  const tabs = TABS.filter(([id]) => adminOnly || !["users", "audit"].includes(id));
  return h("div", { class: "wrap" },
    h("div", { class: "top" },
      h("div", null, h("strong", null, "Azaiba Gardens · content"), h("div", { class: "muted" }, `${state.user.name || state.user.email} · ${adminOnly ? "Administrator" : "Editor"}`)),
      h("div", { class: "btn-row" },
        h("button", { class: "btn", type: "button", on: { click: publishSite } }, "Publish site"),
        h("a", { class: "btn ghost", href: "/", target: "_blank", rel: "noopener" }, "View site"),
        h("button", { class: "btn ghost", type: "button", on: { click: logout } }, "Sign out"))),
    h("nav", { class: "tabs" }, tabs.map(([id, label]) => h("button", { type: "button", "aria-current": state.tab === id ? "page" : null, on: { click: () => { state.tab = id; slides = null; buildings = null; state.message = null; loadTab(); } } }, label))),
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
  if (state.tab === "buildings") return buildingsEditor();
  if (state.tab === "contacts") return contactsEditor();
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
