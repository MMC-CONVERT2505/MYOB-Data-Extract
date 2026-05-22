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
//  * Format MYOB date string → "DD/MM/YYYY" string
//  *
//  * MYOB stores dates as:
//  *   - ISO string:  "2025-04-28T00:00:00"
//  *   - OData ticks: "/Date(1745798400000)/"
//  *
//  * Previously fmtDate returned an Excel serial number (e.g. 45792)
//  * which caused the raw-number bug.  Now it always returns a
//  * human-readable DD/MM/YYYY string — Excel auto-detects this as a date.
//  */
// export const fmtDate = (s) => {
//   if (!s) return "";
//   try {
//     let d;

//     // Handle OData /Date(ticks)/ format
//     const odataMatch = String(s).match(/\/Date\((-?\d+)\)\//);
//     if (odataMatch) {
//       d = new Date(parseInt(odataMatch[1], 10));
//     } else {
//       d = new Date(s);
//     }

//     if (isNaN(d.getTime())) return "";

//     // Excel epoch (IMPORTANT)
//     const epoch = new Date(Date.UTC(1899, 11, 30));

//     // Convert to Excel serial number
//     const serial = Math.round((d.getTime() - epoch.getTime()) / 86400000);

//     return serial;
//   } catch {
//     return "";
//   }
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
 * fmtDate — Returns Excel serial number (for .xlsx cells)
 * Excel renders this as a date when cell format is set to date.
 * Used in all converter functions (qboInvoices, xeroBills, myobRaw etc.)
 */
export const fmtDate = (s) => {
  const d = parseDate(s);
  if (!d) return "";
  const epoch  = new Date(Date.UTC(1899, 11, 30));
  const serial = Math.round((d.getTime() - epoch.getTime()) / 86400000);
  return serial;
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