import { getCachedExtraction } from "../services/extractionCacheService.js";
import ExtractionHistory from "../models/ExtractionHistory.model.js";
import { convertToQBO, convertToMYOBRaw, convertToXero } from "../services/conversionService.js";
import { streamWorkbookToResponse } from "../services/excelStreamService.js";

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

    // ── Stream Excel workbook directly to the response ────────
    // No full workbook/buffer is ever built in memory — rows are
    // written and committed to the HTTP stream one at a time (see
    // services/excelStreamService.js for why this matters at 200k+ rows).
    const filename = `${outputFormat}_${dataType}${subType ? "_" + subType : ""}_${startDate}_${endDate}.xlsx`;
    await streamWorkbookToResponse(res, filename, rows);
  } catch (err) {
    // If streaming already started, headers (and possibly bytes) have
    // been sent — we can't send a JSON error body anymore, just abort.
    if (res.headersSent) {
      console.error("❌ Excel stream failed mid-write:", err.message);
      res.destroy(err);
      return;
    }
    next(err);
  }
};

// ── POST /api/download/excel/myob ─────────────────────────────
// Separate endpoint for MYOB Raw download
export const downloadMYOBExcel = async (req, res, next) => {
  req.body.outputFormat = "raw";
  return downloadExcel(req, res, next);
};