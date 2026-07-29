import { getCachedExtraction } from "../services/extractionCacheService.js";
import ExtractionHistory from "../models/ExtractionHistory.model.js";
import { convertToQBO, convertToMYOBRaw, convertToXero } from "../services/conversionService.js";
import { streamWorkbookToResponse } from "../services/excelStreamService.js";

// ── POST /api/download/excel ──────────────────────────────────
export const downloadExcel = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { dataType, subType, outputFormat = "raw", startDate, endDate, jobId } = req.body;

    if (!dataType) {
      return res.status(400).json({ error: "dataType is required" });
    }

    // startDate/endDate may be "reference" (for reference data types like
    // items/customers) or actual dates. Both are valid cache keys.
    const cacheStart = startDate || "reference";
    const cacheEnd   = endDate   || "reference";

  console.log(`🔍 Cache lookup: userId=${userId} businessId=${req.dbUser.businessId} dataType=${dataType} subType=${subType} start=${cacheStart} end=${cacheEnd}`);
    const rawItems = await getCachedExtraction(
      userId,
      req.dbUser.businessId,
      dataType,
      subType || null,
      cacheStart,
      cacheEnd
    );
    console.log(`🔍 Cache result: ${rawItems?.length ?? 0} items`);
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
    const filename = `${outputFormat}_${dataType}${subType ? "_" + subType : ""}_${cacheStart}_${cacheEnd}.xlsx`;
    await streamWorkbookToResponse(res, filename, rows);
  } catch (err) {
    if (res.headersSent) {
      console.error("❌ Excel stream failed mid-write:", err.message);
      res.destroy(err);
      return;
    }
    next(err);
  }
};

// ── POST /api/download/excel/myob ─────────────────────────────
export const downloadMYOBExcel = async (req, res, next) => {
  req.body.outputFormat = "raw";
  return downloadExcel(req, res, next);
};