// ── Streaming Excel writer ──────────────────────────────────────
//
// BOTTLENECK IDENTIFIED (old code, downloadController.js buildWorkbook):
//   `XLSX.utils.json_to_sheet(rows, ...)` builds the ENTIRE worksheet
//   as in-memory JS objects, then `XLSX.write(wb, { type: "buffer" })`
//   serializes the WHOLE workbook into a single Buffer before anything
//   is sent to the client. For 200k+ rows this means multiple full
//   copies of the dataset alive in memory at once (raw rows + sheet
//   model + final buffer), which is exactly what causes the
//   slow/OOM behaviour described for large extractions.
//
// FIX:
//   ExcelJS's `stream.xlsx.WorkbookWriter` writes each row directly to
//   an output stream (here, the HTTP response) and `.commit()`s it
//   immediately, discarding it from memory. Memory usage stays roughly
//   constant no matter whether we're exporting 1,000 or 2,000,000 rows.
//   ROWS_PER_SHEET is preserved so very large exports still split
//   across multiple sheets, same as before.

import ExcelJS from "exceljs";

const ROWS_PER_SHEET = 50000;

/**
 * Streams rows to `res` as an .xlsx file without ever holding the full
 * workbook in memory.
 *
 * @param {import('express').Response} res
 * @param {string} filename
 * @param {AsyncIterable<any[]> | any[]} rowSource
 *        Either the full rows array (kept for backward compatibility)
 *        or an async iterable of row batches — pass batches when the
 *        data is coming from fetchAllPages(..., { onBatch }) so rows
 *        never all need to exist in memory at once.
 */
export async function streamWorkbookToResponse(res, filename, rowSource) {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: false,
    useSharedStrings: false, // lower memory: don't build a shared-string table
  });

  let sheet = null;
  let rowsInSheet = 0;
  let sheetNum = 1;
  let headerKeys = null;
  let totalRows = 0;

  const newSheet = () => {
    sheet = workbook.addWorksheet(`Sheet${sheetNum}`);
    if (headerKeys) {
      sheet.columns = headerKeys.map((key) => ({ header: key, key }));
    }
    rowsInSheet = 0;
    sheetNum++;
  };

  const writeRow = (row) => {
    if (!headerKeys) {
      headerKeys = Object.keys(row);
    }
    if (!sheet) newSheet();
    if (rowsInSheet >= ROWS_PER_SHEET) {
      sheet.commit();
      newSheet();
    }
    sheet.addRow(row).commit();
    rowsInSheet++;
    totalRows++;
    if (totalRows % 5000 === 0) {
      console.log(`Fetched: ${totalRows} rows written to workbook`);
    }
  };

  // Support both a plain array (small/legacy callers) and an async
  // generator/iterable of row batches (large streaming extractions).
  if (Array.isArray(rowSource)) {
    for (const row of rowSource) writeRow(row);
  } else {
    for await (const batch of rowSource) {
      for (const row of batch) writeRow(row);
    }
  }

  if (sheet) sheet.commit();
  await workbook.commit();

  console.log(`📥 Excel streamed: ${filename} (${totalRows} rows)`);
}
