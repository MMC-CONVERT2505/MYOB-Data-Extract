// import ExcelJS from "exceljs";

// const ROWS_PER_SHEET = 50000;

// export async function streamWorkbookToResponse(res, filename, rowSource) {
//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   );
//   res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

//   const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
//     stream: res,
//     useStyles: false,
//     useSharedStrings: false,
//   });

//   let sheet = null;
//   let rowsInSheet = 0;
//   let sheetNum = 1;
//   let headerKeys = null;
//   let totalRows = 0;

//   const newSheet = () => {
//     sheet = workbook.addWorksheet(`Sheet${sheetNum}`);
//     if (headerKeys) {
//       sheet.columns = headerKeys.map((key) => ({ header: key, key }));
//     }
//     rowsInSheet = 0;
//     sheetNum++;
//   };

//   const writeRow = (row) => {
//     if (!headerKeys) headerKeys = Object.keys(row);
//     if (!sheet) newSheet();
//     if (rowsInSheet >= ROWS_PER_SHEET) {
//       sheet.commit();
//       newSheet();
//     }
//     sheet.addRow(row).commit();
//     rowsInSheet++;
//     totalRows++;
//     if (totalRows % 5000 === 0) {
//       console.log(`Fetched: ${totalRows} rows written to workbook`);
//     }
//   };

//   if (Array.isArray(rowSource)) {
//     for (const row of rowSource) writeRow(row);
//   } else {
//     for await (const batch of rowSource) {
//       for (const row of batch) writeRow(row);
//     }
//   }

//   if (sheet) sheet.commit();
//   await workbook.commit();

//   console.log(`📥 Excel streamed: ${filename} (${totalRows} rows)`);
// }




import ExcelJS from "exceljs";

const ROWS_PER_SHEET = 50000;

export async function streamWorkbookToResponse(res, filename, rowSource) {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: false,
    useSharedStrings: false,
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
    if (!headerKeys) headerKeys = Object.keys(row);
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


// ── Multi-sheet variant (MYOB Raw Data) ─────────────────────────
//
// Same underlying ExcelJS streaming writer as streamWorkbookToResponse
// above (still streams directly to `res`, zero disk I/O, one workbook
// per request — no shared state), but takes multiple NAMED sheets
// instead of one flat row array. Used specifically for MYOB Raw Data's
// normalized output (myobRawDataSheets.js), where a parent sheet plus
// one or more child sheets (for large arrays like Lines[]) replace the
// old single flattened sheet that could exceed Excel's column limit.
//
// Each sheet is still paginated at ROWS_PER_SHEET (50,000) into
// additional numbered sheets if it has more rows than that, exactly
// like the single-sheet path — a sheet named "Invoices_Lines" with
// 120,000 rows becomes "Invoices_Lines", "Invoices_Lines_2",
// "Invoices_Lines_3".
export async function streamMultiSheetWorkbookToResponse(res, filename, sheets) {
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: false,
    useSharedStrings: false,
  });

  const usedSheetNames = new Set();
  const uniqueName = (name) => {
    let candidate = name.slice(0, 31);
    let n = 2;
    while (usedSheetNames.has(candidate)) {
      const suffix = `_${n}`;
      candidate = (name.slice(0, 31 - suffix.length) + suffix);
      n++;
    }
    usedSheetNames.add(candidate);
    return candidate;
  };

  let totalRows = 0;

  for (const { name, rows } of sheets) {
    if (!rows.length) continue;

    const headerKeys = Object.keys(rows[0]);
    let sheet = null;
    let rowsInSheet = 0;
    let part = 1;

    const newSheet = () => {
      const sheetName = part === 1 ? name : `${name}_${part}`;
      sheet = workbook.addWorksheet(uniqueName(sheetName));
      sheet.columns = headerKeys.map((key) => ({ header: key, key }));
      rowsInSheet = 0;
      part++;
    };

    newSheet();
    for (const row of rows) {
      if (rowsInSheet >= ROWS_PER_SHEET) {
        sheet.commit();
        newSheet();
      }
      sheet.addRow(row).commit();
      rowsInSheet++;
      totalRows++;
      if (totalRows % 5000 === 0) {
        console.log(`Fetched: ${totalRows} rows written to workbook (multi-sheet)`);
      }
    }
    sheet.commit();
  }

  await workbook.commit();

  console.log(`📥 Multi-sheet Excel streamed: ${filename} (${sheets.length} logical sheet(s), ${totalRows} total rows)`);
}