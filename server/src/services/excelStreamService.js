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