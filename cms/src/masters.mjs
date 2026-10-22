// Master lists behind every dropdown in the CMS. Stored in the database, maintained by administrators.
// A value's code is what the site data stores, so codes never change; labels and order can.
// Deactivating a value hides it from new entries; existing entries keep it and still display.

export const KINDS = {
  area_unit: { label: "Area units", codePattern: /^[a-z]{2,8}$/, decimalsRequired: true },
  currency: { label: "Currencies", codePattern: /^[A-Z]{3}$/, decimalsRequired: true },
  rent_period: { label: "Rent periods", codePattern: /^[a-z]{3,10}$/ },
  bedroom_type: { label: "Flat types", codePattern: /^[0-9A-Za-z ]{1,20}$/ },
  building_status: { label: "Building status", codePattern: /^[A-Za-z ]{1,40}$/ },
};

// Seeds include every unit and currency a Muscat property site is likely to need. Admins add more.
const DEFAULTS = {
  area_unit: [
    ["sqm", "sq m", 1, 2],
    ["sqyd", "sq yd", 2, 2],
    ["sqft", "sq ft", 3, 2],
  ],
  currency: [
    ["OMR", "Omani Rial (OMR)", 1, 3],
    ["AED", "UAE Dirham (AED)", 2, 2],
    ["SAR", "Saudi Riyal (SAR)", 3, 2],
    ["QAR", "Qatari Riyal (QAR)", 4, 2],
    ["KWD", "Kuwaiti Dinar (KWD)", 5, 3],
    ["BHD", "Bahraini Dinar (BHD)", 6, 3],
    ["USD", "US Dollar (USD)", 7, 2],
    ["EUR", "Euro (EUR)", 8, 2],
    ["GBP", "Pound Sterling (GBP)", 9, 2],
    ["INR", "Indian Rupee (INR)", 10, 2],
  ],
  rent_period: [
    ["month", "per month", 1, null],
    ["year", "per year", 2, null],
  ],
  bedroom_type: [
    ["Studio", "Studio", 1, null],
    ["1 BHK", "1 BHK", 2, null],
    ["2 BHK", "2 BHK", 3, null],
    ["3 BHK", "3 BHK", 4, null],
    ["4 BHK", "4 BHK", 5, null],
  ],
  building_status: [
    ["Available now", "Available now", 1, null],
    ["Ready in 2 months", "Ready in 2 months", 2, null],
    ["New listings", "New listings", 3, null],
    ["Coming soon", "Coming soon", 4, null],
    ["Fully let", "Fully let", 5, null],
  ],
};

// Inserts the defaults that are missing. Existing rows (including admin edits) are never overwritten.
export function seedMasters(db) {
  const insert = db.prepare("INSERT OR IGNORE INTO masters (kind, code, label, sort, active, decimals) VALUES (?, ?, ?, ?, 1, ?)");
  for (const [kind, rows] of Object.entries(DEFAULTS)) {
    for (const [code, label, sort, decimals] of rows) insert.run(kind, code, label, sort, decimals);
  }
}

// Adds any value the site data already uses but the lists do not have yet (for example a value typed
// into the JSON by hand). Added as active, so nothing saved is left orphaned.
export function importFromData(db, data) {
  const seen = (kind, code) => code && !masterRow(db, kind, code);
  const add = (kind, code, decimals = null) => {
    if (!seen(kind, code)) return;
    const sort = db.prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM masters WHERE kind = ?").get(kind).n;
    db.prepare("INSERT INTO masters (kind, code, label, sort, active, decimals) VALUES (?, ?, ?, ?, 1, ?)").run(kind, String(code), String(code), sort, decimals);
  };
  for (const b of data.buildings?.items || []) {
    add("building_status", b.status);
    for (const f of b.flats || []) {
      add("bedroom_type", f.type);
      for (const m of [f.measures?.build, f.measures?.carpet]) if (m?.unit) add("area_unit", m.unit, 2);
      if (f.price?.currency) add("currency", f.price.currency, 2);
      if (f.price?.period) add("rent_period", f.price.period);
    }
  }
}

export function listMasters(db, kind = null) {
  const rows = kind
    ? db.prepare("SELECT * FROM masters WHERE kind = ? ORDER BY sort, label").all(kind)
    : db.prepare("SELECT * FROM masters ORDER BY kind, sort, label").all();
  return rows.map((r) => ({ kind: r.kind, code: r.code, label: r.label, sort: r.sort, active: !!r.active, decimals: r.decimals }));
}

export function masterRow(db, kind, code) {
  return db.prepare("SELECT * FROM masters WHERE kind = ? AND code = ?").get(kind, String(code)) || null;
}

// A value is accepted if it is an active master, or if it is already in use (so old entries still save).
export function allowedValue(db, kind, code, currentValue) {
  const row = masterRow(db, kind, code);
  if (!row) return false;
  return row.active === 1 || String(currentValue ?? "") === String(code);
}

export function addMaster(db, kind, { code, label, decimals }) {
  if (!KINDS[kind]) throw Object.assign(new Error("Unknown list."), { status: 404 });
  const cleanCode = String(code ?? "").trim();
  const cleanLabel = String(label ?? "").trim();
  if (!KINDS[kind].codePattern.test(cleanCode)) throw Object.assign(new Error(`That code is not allowed for ${KINDS[kind].label}.`), { status: 400 });
  if (!cleanLabel || cleanLabel.length > 60) throw Object.assign(new Error("Enter a label of up to 60 characters."), { status: 400 });
  if (masterRow(db, kind, cleanCode)) throw Object.assign(new Error("That value already exists."), { status: 409 });
  let dec = null;
  if (KINDS[kind].decimalsRequired) {
    dec = Number(decimals);
    if (!Number.isInteger(dec) || dec < 0 || dec > 4) throw Object.assign(new Error("Decimal places must be 0 to 4."), { status: 400 });
  }
  const sort = db.prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM masters WHERE kind = ?").get(kind).n;
  db.prepare("INSERT INTO masters (kind, code, label, sort, active, decimals) VALUES (?, ?, ?, ?, 1, ?)").run(kind, cleanCode, cleanLabel, sort, dec);
}

// Only label, order and active can change. The code is fixed because the data refers to it.
export function updateMaster(db, kind, code, { label, sort, active }) {
  const row = masterRow(db, kind, code);
  if (!row) throw Object.assign(new Error("No such value."), { status: 404 });
  const newLabel = label === undefined ? row.label : String(label).trim();
  if (!newLabel || newLabel.length > 60) throw Object.assign(new Error("Enter a label of up to 60 characters."), { status: 400 });
  const newSort = sort === undefined ? row.sort : Number(sort);
  if (!Number.isInteger(newSort) || newSort < 0 || newSort > 9999) throw Object.assign(new Error("Order must be a whole number."), { status: 400 });
  const newActive = active === undefined ? row.active : active ? 1 : 0;
  db.prepare("UPDATE masters SET label = ?, sort = ?, active = ? WHERE kind = ? AND code = ?").run(newLabel, newSort, newActive, kind, String(code));
}

// What the content validator needs, bound to this database.
export function masterContext(db) {
  return {
    allowed: (kind, code, currentValue) => allowedValue(db, kind, code, currentValue),
    decimals: (kind, code) => masterRow(db, kind, code)?.decimals ?? 2,
    labels: (kind) => Object.fromEntries(listMasters(db, kind).map((r) => [r.code, r.label])),
  };
}
