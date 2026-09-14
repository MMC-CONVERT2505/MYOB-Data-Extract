import { fmtDate } from "../helpers.js";
import { isPlainObject, isDateLikeString, normalizeRawRows } from "./myobRawData.js";

// ── MYOB "Raw Data" — multi-sheet normalizer ────────────────────
//
// Purpose: fixes the root cause of the MYOB Raw Data Excel-corruption
// bug (flattenMYOBRawData's single-sheet union-of-columns could exceed
// Excel's 16,384-column limit whenever a record contained an unusually
// large array — e.g. an invoice with 900+ Lines).
//
// This is a GENERIC, dataType-agnostic replacement for that single-sheet
// approach — it does not know or hardcode what "Lines", "Invoices",
// "Bills" etc. are called for any given dataType. Instead it detects,
// structurally, which array-of-object fields are "small" (bounded,
// platform-capped — e.g. a Contact's Addresses[], which MYOB caps at 5)
// vs "large" (unbounded, user-data-driven — e.g. an Invoice's Lines[]),
// purely by measuring the actual max length observed in the batch being
// exported right now. Small arrays stay flattened inline exactly as
// before (Addresses.0.*, Addresses.1.*, ...) — nothing changes for
// those. Large arrays move to their own child sheet, joined back to
// their parent row via ParentUID + LineIndex, which is what actually
// removes the column-count risk (a child sheet's column count no longer
// depends on how many lines ANY record in the batch has — only on how
// many distinct fields ONE line has).
//
// This recurses: if an array that itself got promoted to a child sheet
// contains elements that THEMSELVES have a large nested array, that
// nested array gets its own grandchild sheet, joined back to the child
// sheet the same way. Also: arrays that stay inline are still checked
// for large nested arrays inside their own elements, so a large array
// buried inside a small one is not missed.

// Arrays with at most this many elements stay flattened inline as
// today (Field.0.X, Field.1.X, ...). This comfortably covers MYOB's
// known platform-bounded arrays (e.g. Contact.Addresses, capped at 5
// locations) while reliably catching genuinely unbounded, user-data
// arrays (Lines, Invoices, Bills on payments, etc.) — in practice any
// non-trivial transaction has more than 5 lines, so this threshold
// promotes exactly the fields that were causing the corruption.
const INLINE_ARRAY_MAX_LENGTH = 5;

// Hard safety ceiling, independent of the heuristic above. Even if some
// future/unseen data shape defeats the heuristic, no sheet this module
// produces is ever allowed to reach Excel's actual 16,384-column limit
// — normalizeSheetRows() below throws a clear, actionable error instead
// of handing an oversized sheet to the Excel writer, which is what
// previously caused a silent/mid-stream corruption instead of a clear
// failure.
const MAX_SAFE_COLUMNS = 16000;

const lastPathSegment = (path) => path.split(".").pop();

const getByPath = (obj, path) => {
  let cur = obj;
  for (const part of path.split(".")) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
};

/**
 * Discovers array-of-object field paths reachable from `records`
 * (without descending into already-large arrays, which get their own
 * independent pass later), and the maximum length seen for each path
 * across this specific batch of records.
 */
const collectArrayStats = (records) => {
  const stats = new Map(); // path -> max length seen

  const visit = (val, path) => {
    if (val === null || val === undefined) return;

    if (Array.isArray(val)) {
      if (!val.some(isPlainObject)) return; // array of primitives — stays a joined string, nothing to discover
      const maxLen = Math.max(stats.get(path) || 0, val.length);
      stats.set(path, maxLen);
      // Only keep exploring inside a SMALL array's elements (to catch a
      // large array nested inside a small one). A large array gets its
      // own independent stats pass once it's promoted to a sheet.
      if (maxLen <= INLINE_ARRAY_MAX_LENGTH) {
        for (const el of val) {
          if (isPlainObject(el)) {
            for (const key of Object.keys(el)) visit(el[key], `${path}.${key}`);
          }
        }
      }
      return;
    }

    if (isPlainObject(val)) {
      for (const key of Object.keys(val)) visit(val[key], path ? `${path}.${key}` : key);
    }
  };

  for (const record of records) {
    if (!isPlainObject(record)) continue;
    for (const key of Object.keys(record)) visit(record[key], key);
  }

  return stats;
};

const deriveChildPaths = (stats) =>
  new Set([...stats.entries()].filter(([, len]) => len > INLINE_ARRAY_MAX_LENGTH).map(([path]) => path));

/**
 * A record's own stable identifier, for use as the ParentUID that child
 * rows join back to. Falls back through the fields MYOB most commonly
 * uses, then to a synthetic key derived from this row's own prefix
 * (e.g. its own ParentUID + LineIndex, for a grandchild sheet) so even
 * an element with no natural identifier of its own still gets a stable,
 * reproducible key.
 */
const deriveOwnKey = (record, prefix, fallbackIndex) => {
  if (record?.UID) return String(record.UID);
  if (record?.ID !== undefined && record?.ID !== null && record?.ID !== "") return String(record.ID);
  if (record?.Number) return String(record.Number);
  if (prefix && prefix.ParentUID !== undefined && prefix.LineIndex !== undefined) {
    return `${prefix.ParentUID}::${prefix.LineIndex}`;
  }
  return `row-${fallbackIndex}`;
};

const sanitizeSheetName = (name) => {
  // Excel sheet name rules: max 31 chars, no : \ / ? * [ ]
  let s = String(name).replace(/[:\\/?*[\]]/g, "_");
  if (s.length > 31) s = s.slice(0, 31);
  return s || "Sheet";
};

const uniqueSheetName = (baseName, usedNames) => {
  let name = sanitizeSheetName(baseName);
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }
  // Extremely unlikely (two different paths sanitizing to the same
  // 31-char name) — disambiguate rather than silently overwrite.
  let n = 2;
  let candidate;
  do {
    const suffix = `_${n}`;
    candidate = sanitizeSheetName(name.slice(0, 31 - suffix.length) + suffix);
    n++;
  } while (usedNames.has(candidate));
  usedNames.add(candidate);
  return candidate;
};

const assertSafeColumnCount = (sheetName, rows) => {
  const colCount = rows.length ? Object.keys(rows[0]).length : 0;
  if (colCount > MAX_SAFE_COLUMNS) {
    const err = new Error(
      `MYOB Raw Data: sheet "${sheetName}" would need ${colCount} columns, ` +
      `which exceeds the safe limit of ${MAX_SAFE_COLUMNS} (Excel's hard limit is 16,384). ` +
      `This means a field in this data has a deeply nested structure this export ` +
      `could not safely flatten. Please contact support with this dataType/date range.`
    );
    err.status = 422;
    throw err;
  }
};

/**
 * Recursively builds one sheet for `entries` (each `{ prefix, data }`,
 * where `prefix` holds any ParentUID/LineIndex columns to prepend), and
 * as many child/grandchild sheets as needed for any large nested arrays
 * found, appending everything into `sheets` (an array of
 * `{ name, rows }`, in generation order — parent sheets always appear
 * before their children).
 */
const buildSheet = (entries, sheetBaseName, sheets, usedNames) => {
  const records = entries.map((e) => e.data);
  const childPaths = deriveChildPaths(collectArrayStats(records));

  const rows = [];
  const childEntriesByPath = new Map([...childPaths].map((p) => [p, []]));

  entries.forEach(({ prefix, data }, idx) => {
    const row = { ...prefix };

    const flattenInto = (val, path, out) => {
      if (childPaths.has(path)) return; // promoted — handled below, not inline
      if (val === null || val === undefined) { out[path] = ""; return; }

      if (Array.isArray(val)) {
        if (val.some(isPlainObject)) {
          val.forEach((el, i) => flattenInto(el, `${path}.${i}`, out));
        } else {
          out[path] = val.join("; ");
        }
        return;
      }

      if (isPlainObject(val)) {
        for (const key of Object.keys(val)) flattenInto(val[key], path ? `${path}.${key}` : key, out);
        return;
      }

      out[path] = isDateLikeString(val) ? fmtDate(val) : val;
    };

    if (isPlainObject(data)) {
      for (const key of Object.keys(data)) flattenInto(data[key], key, row);
    }
    rows.push(row);

    if (childPaths.size) {
      const ownKey = deriveOwnKey(data, prefix, idx);
      for (const path of childPaths) {
        const arr = getByPath(data, path);
        if (Array.isArray(arr)) {
          const bucket = childEntriesByPath.get(path);
          arr.forEach((el, lineIndex) => {
            bucket.push({ prefix: { ParentUID: ownKey, LineIndex: lineIndex }, data: el });
          });
        }
      }
    }
  });

  const normalizedRows = normalizeRawRows(rows);
  const thisSheetName = uniqueSheetName(sheetBaseName, usedNames);
  assertSafeColumnCount(thisSheetName, normalizedRows);
  sheets.push({ name: thisSheetName, rows: normalizedRows });

  for (const [path, childEntries] of childEntriesByPath.entries()) {
    if (!childEntries.length) continue;
    const childSheetName = `${sheetBaseName}_${lastPathSegment(path)}`;
    buildSheet(childEntries, childSheetName, sheets, usedNames);
  }
};

/**
 * Entry point. Takes the raw MYOB API response array (regardless of
 * dataType/subType) and a base name for the root sheet (derived by the
 * caller from dataType/subType — this module itself stays dataType-
 * agnostic), and returns `{ sheets: [{ name, rows }, ...] }` — one
 * parent sheet plus one child sheet per array field that needed to be
 * promoted (recursively, for nested large arrays).
 *
 * Every sheet's rows are independently normalized (normalizeRawRows) so
 * each sheet has a single consistent header row, exactly as the
 * original single-sheet flattenMYOBRawData did — just scoped per sheet
 * instead of across the whole export.
 */
export const flattenMYOBRawDataToSheets = (items, rootSheetName = "Data") => {
  if (!Array.isArray(items) || !items.length) {
    return { sheets: [{ name: sanitizeSheetName(rootSheetName), rows: [] }] };
  }

  const sheets = [];
  const usedNames = new Set();
  const rootEntries = items.map((item) => ({ prefix: {}, data: item }));
  buildSheet(rootEntries, rootSheetName, sheets, usedNames);
  return { sheets };
};