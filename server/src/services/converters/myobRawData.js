import { fmtDate } from "../helpers.js";

// ── MYOB "Raw Data" flattener ───────────────────────────────────
//
// Purpose: unlike myobRaw.js / myobRaw_templates.js (which pick a
// curated set of fields per dataType/subType to match import
// templates), this file does NOT know or care about dataType at
// all. It takes whatever JSON array MYOB's API returned and turns
// every single field into a flat "Key.Path" -> value Excel column,
// with NOTHING dropped, renamed, or recalculated.
//
// Nested objects   -> dot notation:      Customer.Name, Account.DisplayID
// Arrays of objects -> index + dot:      Lines.0.Account.Name, Lines.1.Total
// Arrays of primitives -> "; " joined string
// null / undefined -> ""
// Everything else (string, number, boolean) -> passed through as-is
//
// Because different records in the same batch can have different
// shapes (different Lines[] lengths, optional nested objects, etc.),
// each row can end up with a different set of keys. normalizeRows()
// below computes the union of every key across the whole batch (in
// first-seen order) and fills any row missing a key with "", so the
// resulting rows are safe to hand straight to the Excel writer
// (which takes its header row from the first row only).

const isPlainObject = (val) =>
  val !== null &&
  typeof val === "object" &&
  !Array.isArray(val) &&
  !(val instanceof Date);

// MYOB returns dates as either an ISO string ("2026-08-01T00:00:00")
// or an OData ticks string ("/Date(1745798400000)/"). Detect both so
// we can convert them to a real Excel date serial via fmtDate()
// instead of leaving them as plain text (which is what "date galat
// aa rahi hai" was — Excel showed the raw ISO/OData string as text).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const ODATA_DATE_RE = /^\/Date\(-?\d+\)\/$/;

const isDateLikeString = (val) =>
  typeof val === "string" &&
  (ISO_DATE_RE.test(val) || ODATA_DATE_RE.test(val));

/**
 * Recursively flattens a single MYOB API record into a flat object.
 * @param {any} value  current value being flattened
 * @param {string} prefix  dotted key path built up so far
 * @param {Record<string, any>} out  accumulator object (mutated)
 */
const flattenValue = (value, prefix, out) => {
  if (value === null || value === undefined) {
    out[prefix] = "";
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      out[prefix] = "";
      return;
    }

    const hasObjects = value.some((v) => isPlainObject(v) || Array.isArray(v));

    if (hasObjects) {
      // Array of objects/arrays → expand each element with its index
      value.forEach((item, idx) => {
        flattenValue(item, `${prefix}.${idx}`, out);
      });
    } else {
      // Array of primitives (strings/numbers/booleans) → join into one cell
      out[prefix] = value.join("; ");
    }
    return;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      out[prefix] = "";
      return;
    }
    for (const key of keys) {
      flattenValue(value[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }

  // primitive (string / number / boolean)
  out[prefix] = isDateLikeString(value) ? fmtDate(value) : value;
};

/**
 * Flattens one raw MYOB record (top-level object) into a single
 * flat row. Every top-level key becomes its own column path.
 */
export const flattenMYOBRecordRaw = (record) => {
  const row = {};
  if (!isPlainObject(record)) return row;

  for (const key of Object.keys(record)) {
    flattenValue(record[key], key, row);
  }
  return row;
};

/**
 * Given rows with possibly different key sets, returns new rows that
 * all share the same key set (union of every key seen, in first-seen
 * order), filling missing values with "". This keeps the Excel
 * header row (taken from row 0 by the streaming writer) consistent
 * across every row in the sheet.
 */
export const normalizeRawRows = (rows) => {
  if (!rows.length) return rows;

  const allKeys = [];
  const seen = new Set();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        allKeys.push(key);
      }
    }
  }

  return rows.map((row) => {
    const normalized = {};
    for (const key of allKeys) {
      normalized[key] = Object.prototype.hasOwnProperty.call(row, key)
        ? row[key]
        : "";
    }
    return normalized;
  });
};

/**
 * Entry point used by conversionService.js — flattens the ENTIRE raw
 * MYOB API response array (regardless of dataType/subType) with no
 * fields dropped, and normalizes headers across all rows.
 */
export const flattenMYOBRawData = (items) => {
  if (!Array.isArray(items) || !items.length) return [];
  const rows = items.map((item) => flattenMYOBRecordRaw(item));
  return normalizeRawRows(rows);
};
