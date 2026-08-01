import { getCachedExtraction } from "../services/extractionCacheService.js";
import ExtractionHistory from "../models/ExtractionHistory.model.js";
import { convertToQBO, convertToMYOBRaw, convertToMYOBRawData, convertToXero, convertToReckon } from "../services/conversionService.js";
import { streamWorkbookToResponse } from "../services/excelStreamService.js";
import ExtractionJob from "../models/ExtractionJob.model.js";

// ── POST /api/download/excel ──────────────────────────────────
export const downloadExcel = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { dataType, subType, outputFormat = "raw", startDate, endDate, jobId } = req.body;

    if (!dataType) {
      return res.status(400).json({ error: "dataType is required" });
    }

  let rawItems;
  let cacheStart, cacheEnd; // used later for the output filename — must be set on both branches

    if (jobId) {
      // ✅ Preferred path (used after async extraction): read the EXACT
      // cache params the worker itself used when it saved the data,
      // instead of the frontend re-guessing dataType/subType/dates —
      // any mismatch there (e.g. "reference" vs an actual date, or
      // subType casing) causes a false cache-miss 404 even though the
      // data is sitting right there in the cache.
     const job = await ExtractionJob.findById(jobId);

      if (!job) {
        return res.status(404).json({ error: "Extraction job not found." });
      }
      if (job.status !== "successful") {
        return res.status(409).json({ error: `Job is not completed yet (status: ${job.status}).` });
      }

     const jobStart = job.startDate || "reference";
      const jobEnd   = job.endDate   || "reference";
      cacheStart = jobStart; // reuse for filename below
      cacheEnd   = jobEnd;

      console.log(`🔍 Cache lookup (via jobId=${jobId}): dataType=${job.dataType} subType=${job.subType} start=${jobStart} end=${jobEnd}`);

      rawItems = await getCachedExtraction(
        userId,
        req.dbUser.businessId,
        job.dataType,
        job.subType || null,
        jobStart,
        jobEnd
      );
    } else {
      // Legacy path — sync extraction, frontend supplies params directly.
      cacheStart = startDate || "reference";
      cacheEnd   = endDate   || "reference";

      console.log(`🔍 Cache lookup: userId=${userId} businessId=${req.dbUser.businessId} dataType=${dataType} subType=${subType} start=${cacheStart} end=${cacheEnd}`);

      rawItems = await getCachedExtraction(
        userId,
        req.dbUser.businessId,
        dataType,
        subType || null,
        cacheStart,
        cacheEnd
      );
    }

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
    } else if (outputFormat === "reckon") {
      rows = convertToReckon(rawItems, dataType, subType || null, businessName);
    } else if (outputFormat === "myobrawdata") {
      rows = convertToMYOBRawData(rawItems);
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