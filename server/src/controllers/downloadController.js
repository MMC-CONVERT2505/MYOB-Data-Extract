import XLSX from "xlsx";
import { getCachedExtraction } from "../services/extractionCacheService.js";
import ExtractionHistory from "../models/ExtractionHistory.model.js";
import { convertToQBO, convertToMYOBRaw, convertToXero } from "../services/conversionService.js";

const ROWS_PER_SHEET = 50000;

// ── Helper: build XLSX workbook from rows ─────────────────────
const buildWorkbook = (rows) => {
  const wb   = XLSX.utils.book_new();
  const keys = rows.length ? Object.keys(rows[0]) : [];

  if (rows.length <= ROWS_PER_SHEET) {
    // Single sheet
    const ws = XLSX.utils.json_to_sheet(rows, { header: keys });
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  } else {
    // Split into multiple sheets
    let sheetNum = 1;
    for (let i = 0; i < rows.length; i += ROWS_PER_SHEET) {
      const chunk = rows.slice(i, i + ROWS_PER_SHEET);
      const ws    = XLSX.utils.json_to_sheet(chunk, { header: keys });
      XLSX.utils.book_append_sheet(wb, ws, `Sheet${sheetNum}`);
      sheetNum++;
    }
  }

  return wb;
};

// ── POST /api/download/excel ──────────────────────────────────
export const downloadExcel = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { dataType, subType, outputFormat = "raw", startDate, endDate } = req.body;

    if (!dataType || !startDate || !endDate) {
      return res.status(400).json({ error: "dataType, startDate, endDate are required" });
    }

    // ── Fetch cached data from chunked cache ─────────────────
    const rawItems = await getCachedExtraction(
      userId,
      req.dbUser.businessId,
      dataType,
      subType || null,
      startDate,
      endDate
    );

    if (!rawItems?.length) {
      return res.status(404).json({
        error: "Cache expired or not found. Please extract the data again.",
      });
    }
    const businessName = req.dbUser.businessName || "";

    // ── Convert based on outputFormat ─────────────────────────
    let rows;
    if (outputFormat === "qbo") {
      rows = convertToQBO(rawItems, dataType, subType || null, businessName);
    } else if (outputFormat === "xero") {
      rows = convertToXero(rawItems, dataType, subType || null, businessName);
    } else {
      rows = convertToMYOBRaw(rawItems, dataType, subType || null, businessName);
    }

    if (!rows?.length) {
      return res.status(404).json({ error: "No data to export." });
    }

    // ── Build Excel workbook ──────────────────────────────────
    const wb       = buildWorkbook(rows);
    const buffer   = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `${outputFormat}_${dataType}${subType ? "_" + subType : ""}_${startDate}_${endDate}.xlsx`;

    // ── Stream to frontend ────────────────────────────────────
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);

    console.log(`📥 Excel downloaded: ${filename} (${rows.length} rows, ${buffer.length} bytes)`);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/download/excel/myob ─────────────────────────────
// Separate endpoint for MYOB Raw download
export const downloadMYOBExcel = async (req, res, next) => {
  req.body.outputFormat = "raw";
  return downloadExcel(req, res, next);
};