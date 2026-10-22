// Structured area and price for flats. The site templates print plain text, so every save also writes
// display strings next to the structured values. Editors never type those strings.

const AREA_MAX = 100000;
const AMOUNT_MAX = 1_000_000_000;

// Reads a number typed in a form field. Accepts "88", "88.5", "1,250.75"; rejects letters and more
// decimal places than the unit or currency allows.
export function parseDecimal(value, { label, min, max, decimals, errors, required = true }) {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) errors.push(`${label} is required.`);
    return null;
  }
  const text = String(value).trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(text)) {
    errors.push(`${label} must be a number, for example 88 or 88.5.`);
    return null;
  }
  const places = (text.split(".")[1] || "").length;
  if (places > decimals) {
    errors.push(decimals === 0 ? `${label} must be a whole number.` : `${label} can have at most ${decimals} decimal places.`);
    return null;
  }
  const n = Number(text);
  if (n < min || n > max) {
    errors.push(`${label} must be between ${min} and ${max.toLocaleString("en-US")}.`);
    return null;
  }
  return n;
}

export function formatNumber(n, decimals = 0) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

// "Build 88 sq m · Carpet 75 sq m". Either part can be missing, but not both.
export function areaText(measures, unitLabels) {
  const parts = [];
  for (const [key, label] of [["build", "Build"], ["carpet", "Carpet"]]) {
    const m = measures?.[key];
    if (typeof m?.value === "number") parts.push(`${label} ${formatNumber(m.value, unitDecimals(m.unit))} ${unitLabels[m.unit] || m.unit}`);
  }
  return parts.join(" · ");
}

export function unitDecimals(unit) {
  return unit ? 2 : 0;
}

export function priceText(price, currencyDecimals) {
  if (typeof price.amount !== "number") return "";
  return `${price.currency} ${formatNumber(price.amount, currencyDecimals)}`;
}

export const PERIOD_TEXT = { month: "/ month", year: "/ year" };

// Converts the text saved by earlier versions ("52 sqm (dummy)", "OMR 265") into structured values.
export function migrateFlat(flat, unitCodes) {
  const out = { ...flat };
  if (!out.measures && typeof flat.size === "string") {
    const m = flat.size.match(/^\s*(\d+(?:\.\d+)?)\s*sqm/i);
    if (m && unitCodes.includes("sqm")) out.measures = { build: { value: Number(m[1]), unit: "sqm" }, carpet: null };
  }
  if (!out.price && typeof flat.rent === "string") {
    const m = flat.rent.match(/^\s*([A-Z]{3})\s+(\d+(?:\.\d+)?)/);
    if (m) out.price = { amount: Number(m[2]), currency: m[1], period: "month" };
  }
  return out;
}
