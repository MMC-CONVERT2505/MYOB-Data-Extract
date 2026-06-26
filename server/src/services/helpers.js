
// ── Shared Helpers ────────────────────────────────────────────
 
/**
 * Clean "*None" / "None" values returned by MYOB API
 */
export const cleanNone = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  return s === "*None" || s === "None" ? "" : s;
};
 
/**
 * Parse MYOB date string → JavaScript Date object
 * Handles:
 *   - ISO string:  "2025-04-28T00:00:00"
 *   - OData ticks: "/Date(1745798400000)/"
 */
const parseDate = (s) => {
  if (!s) return null;
  try {
    const odataMatch = String(s).match(/\/Date\((-?\d+)\)\//);
    const d = odataMatch
      ? new Date(parseInt(odataMatch[1], 10))
      : new Date(s);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};
 
 
/**
 * fmtDate — Returns a real JS Date object (normalized to midnight, local time)
 *
 * IMPORTANT: We deliberately return a Date object, NOT a pre-computed
 * Excel serial number. SheetJS (the xlsx library) only attaches a date
 * number-format (so Excel renders it as a date instead of a raw integer)
 * when the cell value is `instanceof Date`. A plain number — even if it
 * is numerically the correct Excel serial — gets written as a generic
 * "General" formatted number, which is exactly why dates were showing up
 * as raw integers (45792, 46150, ...) even after this function was called.
 *
 * Used in all converter functions (qboInvoices, xeroBills, myobRaw etc.)
 */
export const fmtDate = (s) => {
  const d = parseDate(s);
  if (!d) return "";
  // Rebuild using UTC calendar fields so the displayed day doesn't shift
  // depending on the server's local timezone.
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
 
/**
 * fmtDateStr — Returns "DD/MM/YYYY" string (for CSV and JSON)
 * Used when data is sent to frontend for CSV/JSON download.
 */
export const fmtDateStr = (s) => {
  const d = parseDate(s);
  if (!d) return "";
  const dd   = String(d.getUTCDate()).padStart(2, "0");
  const mm   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
 
/**
 * Format account as "DisplayID - Name"
 */
export const formatAccount = (account) => {
  if (!account) return "";
  return [account.DisplayID, account.Name].filter(Boolean).join(" - ");
};
 
/**
 * Safe value — returns "" for null/undefined
 */
export const safe = (val) => (val === null || val === undefined ? "" : val);









// // ── Shared Helpers ────────────────────────────────────────────

// /**
//  * Clean "*None" / "None" values returned by MYOB API
//  */
// export const cleanNone = (v) => {
//   if (!v) return "";
//   const s = String(v).trim();
//   return s === "*None" || s === "None" ? "" : s;
// };

// /**
//  * Parse MYOB date string → JavaScript Date object
//  * Handles:
//  *   - ISO string:  "2025-04-28T00:00:00"
//  *   - OData ticks: "/Date(1745798400000)/"
//  */
// const parseDate = (s) => {
//   if (!s) return null;
//   try {
//     const odataMatch = String(s).match(/\/Date\((-?\d+)\)\//);
//     const d = odataMatch
//       ? new Date(parseInt(odataMatch[1], 10))
//       : new Date(s);
//     return isNaN(d.getTime()) ? null : d;
//   } catch {
//     return null;
//   }
// };


// /**
//  * fmtDate — Returns Excel serial number (for .xlsx cells)
//  * Excel renders this as a date when cell format is set to date.
//  * Used in all converter functions (qboInvoices, xeroBills, myobRaw etc.)
//  */
// export const fmtDate = (s) => {
//   const d = parseDate(s);
//   if (!d) return "";
//   const epoch  = new Date(Date.UTC(1899, 11, 30));
//   const serial = Math.round((d.getTime() - epoch.getTime()) / 86400000);
//   return serial;
// };

// /**
//  * fmtDateStr — Returns "DD/MM/YYYY" string (for CSV and JSON)
//  * Used when data is sent to frontend for CSV/JSON download.
//  */
// export const fmtDateStr = (s) => {
//   const d = parseDate(s);
//   if (!d) return "";
//   const dd   = String(d.getUTCDate()).padStart(2, "0");
//   const mm   = String(d.getUTCMonth() + 1).padStart(2, "0");
//   const yyyy = d.getUTCFullYear();
//   return `${dd}/${mm}/${yyyy}`;
// };

// /**
//  * Format account as "DisplayID - Name"
//  */
// export const formatAccount = (account) => {
//   if (!account) return "";
//   return [account.DisplayID, account.Name].filter(Boolean).join(" - ");
// };

// /**
//  * Safe value — returns "" for null/undefined
//  */
// export const safe = (val) => (val === null || val === undefined ? "" : val);