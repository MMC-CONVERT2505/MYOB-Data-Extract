// /**
//  * asyncExtractionService.js
//  */

// import ExtractionJob from "../models/ExtractionJob.model.js";
// import ExtractionHistory from "../models/ExtractionHistory.model.js";
// import ExtractionCache from "../models/ExtractionCache.model.js";
// import { fetchAllPages } from "./paginationService.js";
// import { convertToQBO, convertToMYOBRaw, convertToXero, convertToReckon } from "./conversionService.js";

// const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_EXTRACTIONS ?? 2);
// let activeCount = 0;

// const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
// const CHUNK_SIZE   = 1000;

// const REFERENCE_DATA_TYPES = new Set([
//   "items", "customers", "suppliers", "accounts", "jobs", "taxcodes",
// ]);

// function buildStartUrl(dataType, subType, start, end) {
//   const dateFilter = start && end
//     ? `Date ge datetime'${start}' and Date le datetime'${end}'`
//     : null;

//   switch (dataType) {
//     case "invoices":
//       return subType
//         ? `/Sale/Invoice/${subType}?$top=1000&$orderby=Date desc`
//         : `/Sale/Invoice?$top=1000&$orderby=Date desc`;
//     case "salesOrders":
//       return subType
//         ? `/Sale/Order/${subType}?$top=1000&$orderby=Date desc`
//         : `/Sale/Order?$top=1000&$orderby=Date desc`;
//     case "bills":
//       return subType
//         ? `/Purchase/Bill/${subType}?$top=1000&$orderby=Date desc`
//         : `/Purchase/Bill?$top=1000&$orderby=Date desc`;
//     case "purchaseOrders":
//       return subType
//         ? `/Purchase/Order/${subType}?$top=1000&$orderby=Date desc`
//         : `/Purchase/Order?$top=1000&$orderby=Date desc`;
//     case "creditNotes":
//       return dateFilter
//         ? `/Sale/CreditSettlement?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`
//         : `/Sale/CreditSettlement?$top=1000&$orderby=Date desc`;
//     case "creditRefunds":
//       return dateFilter
//         ? `/Sale/CreditRefund?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`
//         : `/Sale/CreditRefund?$top=1000&$orderby=Date desc`;
//     case "debitRefunds":
//       return dateFilter
//         ? `/Purchase/DebitRefund?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`
//         : `/Purchase/DebitRefund?$top=1000&$orderby=Date desc`;
//     case "vendorCredits":
//       return dateFilter
//         ? `/Purchase/DebitSettlement?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`
//         : `/Purchase/DebitSettlement?$top=1000&$orderby=Date desc`;
//     case "invoicePayments":
//       return `/Sale/CustomerPayment?$top=1000&$orderby=Date desc`;
//     case "billPayments":
//       return `/Purchase/SupplierPayment?$top=1000&$orderby=Date desc`;
//     case "banking": {
//       const BANKING_EPS = {
//         spend:     "/Banking/SpendMoneyTxn",
//         receive:   "/Banking/ReceiveMoneyTxn",
//         transfer:  "/Banking/TransferMoneyTxn",
//         creditNote:"/Sale/CreditSettlement",
//         billCredit:"/Purchase/DebitSettlement",
//       };
//       return `${BANKING_EPS[subType]}?$top=1000&$orderby=Date desc`;
//     }
//     case "generalJournal":
//       return `/GeneralLedger/GeneralJournal?$top=1000&$orderby=DateOccurred desc`;
//     case "quotes":
//       return subType
//         ? `/Sale/Quote/${subType}?$top=1000&$orderby=Date desc`
//         : `/Sale/Quote?$top=1000&$orderby=Date desc`;
//     case "items":      return `/Inventory/Item?$top=1000`;
//     case "customers":  return `/Contact/Customer?$top=1000`;
//     case "suppliers":  return `/Contact/Supplier?$top=1000`;
//     case "accounts":   return `/GeneralLedger/Account?$top=1000`;
//     case "jobs":       return `/GeneralLedger/Job?$top=1000`;
//     case "taxcodes":   return `/GeneralLedger/TaxCode?$top=1000`;
//     default:
//       throw Object.assign(new Error(`Unknown dataType: ${dataType}`), { status: 400 });
//   }
// }

// function applyDateFilter(records, start, end) {
//   if (!start || !end) return records;
//   return records.filter((r) => {
//     const d = (r.Date || r.DateOccurred || "").substring(0, 10);
//     return !d || (d >= start && d <= end);
//   });
// }

// async function updateProgress(jobId, fetched, total) {
//   const percent = total > 0 ? Math.min(99, Math.round((fetched / total) * 100)) : 0;
//   const logTotal = total > 0 ? `/${total}` : "";
//   console.log(`📊 Job ${jobId}: Fetched ${fetched}${logTotal} (${percent}%)`);
//   await ExtractionJob.findByIdAndUpdate(jobId, {
//     $set: {
//       "progress.fetched": fetched,
//       "progress.total":   total ?? 0,
//       "progress.percent": percent,
//     },
//   });
// }

// async function persistBatch(rawBatch, { extractionId, chunkOffset, expiresAt, cacheKey }) {
//   const docs = [];
//   for (let i = 0; i < rawBatch.length; i += CHUNK_SIZE) {
//     const slice = rawBatch.slice(i, i + CHUNK_SIZE);
//     docs.push({
//       extractionId,
//       ...cacheKey, // ✅ userId, businessId, dataType, subType, startDate, endDate
//       chunkNumber: chunkOffset + Math.floor(i / CHUNK_SIZE),
//       totalChunks: 0,
//       totalItems:  rawBatch.length,
//       items:       slice,
//       expiresAt,
//     });
//   }
//   if (docs.length) {
//     await ExtractionCache.insertMany(docs, { ordered: false });
//   }
//   return docs.length;
// }

// export async function runExtractionJob(job, dbUser) {
//   const jobId = job._id.toString();

//   if (activeCount >= MAX_CONCURRENT) {
//     console.log(`⏳ Job ${jobId}: waiting for a slot (active: ${activeCount}/${MAX_CONCURRENT})`);
//     await waitForSlot();
//   }

//   activeCount++;
//   console.log(`🚀 Job ${jobId}: starting (active: ${activeCount}/${MAX_CONCURRENT})`);

//   try {
//     await ExtractionJob.findByIdAndUpdate(jobId, { $set: { status: "pending" } });

//     const { userId, businessId, dataType, subType, outputFormat, startDate, endDate } = job;

//     const isReference = REFERENCE_DATA_TYPES.has(dataType);
//     const start = isReference ? null : startDate;
//     const end   = isReference ? null : endDate;
//     const cacheStart = isReference ? "reference" : start;
//     const cacheEnd   = isReference ? "reference" : end;

//     const historyDoc = await ExtractionHistory.create({
//       userId,
//       businessId,
//       businessName:   dbUser.businessName || "",
//       startDate:      cacheStart,
//       endDate:        cacheEnd,
//       dataType,
//       subType:        subType || null,
//       outputFormat,
//       status:         "success",
//       itemCount:      0,
//       cacheStrategy:  "chunked",
//       totalChunks:    0,
//       estimatedBytes: 0,
//       cacheExpiresAt: new Date(Date.now() + CACHE_TTL_MS),
//       params: { startDate, endDate, dataType, subType, outputFormat },
//     });

//     const extractionId = historyDoc._id;
//     const expiresAt    = historyDoc.cacheExpiresAt;

//     // ✅ Clear any stale cache chunks for this exact same key (same
//     // user+business+dataType+subType+dates) BEFORE inserting new ones —
//     // otherwise the unique index (userId+businessId+dataType+subType+
//     // startDate+endDate+chunkNumber) collides with leftover docs from a
//     // previous extraction of the same params, causing E11000 errors.
//     await ExtractionCache.deleteMany({
//       userId,
//       businessId,
//       dataType,
//       subType: subType || null,
//       startDate: cacheStart,
//       endDate:   cacheEnd,
//     });


//     let totalFetched   = 0;
//     let totalChunks    = 0;
//     let estimatedTotal = 0;
//     const url = buildStartUrl(dataType, subType, start, end);

//     await fetchAllPages(dbUser, userId, url, {
//       onBatch: async (rawPage, meta) => {
//         // First batch — grab total count from MYOB response.
//         if (estimatedTotal === 0 && meta?.total > 0) {
//           estimatedTotal = meta.total;
//           console.log(`📐 Job ${jobId}: estimated total from MYOB = ${estimatedTotal}`);
//           await ExtractionJob.findByIdAndUpdate(jobId, {
//             $set: { "progress.total": estimatedTotal },
//           });
//         }

//         const filtered = applyDateFilter(rawPage, start, end);
//         if (!filtered.length) return;

//         totalFetched += filtered.length;

//        const chunkCount = await persistBatch(filtered, {
//           extractionId,
//           chunkOffset: totalChunks,
//           expiresAt,
//           cacheKey: {
//             userId,
//             businessId,
//             dataType,
//             subType: subType || null,
//             startDate: cacheStart,
//             endDate:   cacheEnd,
//           },
//         });
//         totalChunks += chunkCount;

//         // Always update progress, even if total is unknown
//         await updateProgress(jobId, totalFetched, estimatedTotal > 0 ? estimatedTotal : null);
//         console.log(`📊 Job ${jobId}: batch saved — ${totalFetched} fetched so far`);
//       },
//     });

//     await ExtractionHistory.findByIdAndUpdate(extractionId, {
//       $set: { itemCount: totalFetched, totalChunks, cacheStrategy: "chunked" },
//     });

//     await ExtractionJob.findByIdAndUpdate(jobId, {
//       $set: {
//         status:              "successful",
//         "progress.fetched":  totalFetched,
//         "progress.total":    totalFetched,
//         "progress.percent":  100,
//         resultCacheKey: {
//           userId:    userId.toString(),
//           businessId,
//           dataType,
//           subType:   subType || null,
//           startDate: cacheStart,
//           endDate:   cacheEnd,
//         },
//       },
//     });

//     console.log(`✅ Job ${jobId}: complete — ${totalFetched} records, ${totalChunks} cache chunks`);
//   } catch (err) {
//     console.error(`❌ Job ${jobId} failed: ${err.message}`);
//     await ExtractionJob.findByIdAndUpdate(jobId, {
//       $set: { status: "failed", errorMessage: err.message || "Unknown error" },
//     });
//   } finally {
//     activeCount--;
//     console.log(`🏁 Job ${jobId}: slot released (active: ${activeCount}/${MAX_CONCURRENT})`);
//   }
// }

// function waitForSlot() {
//   return new Promise((resolve) => {
//     const check = () => {
//       if (activeCount < MAX_CONCURRENT) return resolve();
//       setTimeout(check, 2000);
//     };
//     check();
//   });
// }

// export async function markStaleJobsFailed() {
//   const STALE_THRESHOLD_MINUTES = Number(process.env.STALE_JOB_THRESHOLD_MINUTES ?? 60);
//   const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

//   const result = await ExtractionJob.updateMany(
//     { status: { $in: ["queued", "pending"] }, updatedAt: { $lt: cutoff } },
//     { $set: { status: "failed", errorMessage: "Job orphaned — server restarted. Please re-extract." } }
//   );

//   if (result.modifiedCount > 0) {
//     console.warn(`⚠️ markStaleJobsFailed: marked ${result.modifiedCount} orphaned job(s) as failed.`);
//   }
// }


/**
 * asyncExtractionService.js
 */

import ExtractionJob from "../models/ExtractionJob.model.js";
import ExtractionHistory from "../models/ExtractionHistory.model.js";
import ExtractionCache from "../models/ExtractionCache.model.js";
import { fetchAllPages, splitDateRange } from "./paginationService.js";
import { convertToQBO, convertToMYOBRaw, convertToXero, convertToReckon } from "./conversionService.js";

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_EXTRACTIONS ?? 2);
let activeCount = 0;

const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const CHUNK_SIZE   = 1000;

const REFERENCE_DATA_TYPES = new Set([
  "items", "customers", "suppliers", "accounts", "jobs", "taxcodes",
]);

// Deep-join "/Item"-style endpoints - same endpoints the sync
// extractionController.js chunks via fetchAllPagesChunked. MYOB's server
// has a documented complexity/volume ceiling on these when the join is
// computed over a wide/unbounded date range (confirmed via direct
// Postman testing - a genuine server-side 500, not something client
// retries fix). These are fetched one ~2-month-chunk at a time instead
// of one request covering the whole requested range.
const HEAVY_CHUNKED_TYPES = new Set(["invoices", "bills"]);
const CHUNK_MONTHS = 2;

// Builds a fully-qualified MYOB endpoint (including $filter, when a date
// range applies) for one data type + one [rangeStart, rangeEnd] window.
// For HEAVY_CHUNKED_TYPES that window is a single ~2-month chunk; for
// every other transactional type it's the whole requested range in one
// shot (mirrors the non-chunked cases in extractionController.js).
function buildFilteredUrl(dataType, subType, rangeStart, rangeEnd) {
  const dateFilter = rangeStart && rangeEnd
    ? `Date ge datetime'${rangeStart}' and Date le datetime'${rangeEnd}'`
    : null;
  const dateOccurredFilter = rangeStart && rangeEnd
    ? `DateOccurred ge datetime'${rangeStart}' and DateOccurred le datetime'${rangeEnd}'`
    : null;

  switch (dataType) {
    case "invoices": {
      const baseEp = subType ? `/Sale/Invoice/${subType}` : `/Sale/Invoice`;
      return dateFilter
        ? `${baseEp}?$filter=${encodeURIComponent(dateFilter)}&$top=1000&$orderby=Date desc`
        : `${baseEp}?$top=1000&$orderby=Date desc`;
    }
    case "salesOrders": {
      const baseEp = subType ? `/Sale/Order/${subType}` : `/Sale/Order`;
      return dateFilter
        ? `${baseEp}?$filter=${encodeURIComponent(dateFilter)}&$top=1000&$orderby=Date desc`
        : `${baseEp}?$top=1000&$orderby=Date desc`;
    }
    case "bills": {
      const baseEp = subType ? `/Purchase/Bill/${subType}` : `/Purchase/Bill`;
      return dateFilter
        ? `${baseEp}?$filter=${encodeURIComponent(dateFilter)}&$top=1000&$orderby=Date desc`
        : `${baseEp}?$top=1000&$orderby=Date desc`;
    }
    case "purchaseOrders": {
      const baseEp = subType ? `/Purchase/Order/${subType}` : `/Purchase/Order`;
      return dateFilter
        ? `${baseEp}?$filter=${encodeURIComponent(dateFilter)}&$top=1000&$orderby=Date desc`
        : `${baseEp}?$top=1000&$orderby=Date desc`;
    }
    case "creditNotes":
      return dateFilter
        ? `/Sale/CreditSettlement?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`
        : `/Sale/CreditSettlement?$top=1000&$orderby=Date desc`;
    case "creditRefunds":
      return dateFilter
        ? `/Sale/CreditRefund?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`
        : `/Sale/CreditRefund?$top=1000&$orderby=Date desc`;
    case "debitRefunds":
      return dateFilter
        ? `/Purchase/DebitRefund?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`
        : `/Purchase/DebitRefund?$top=1000&$orderby=Date desc`;
    case "vendorCredits":
      return dateFilter
        ? `/Purchase/DebitSettlement?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`
        : `/Purchase/DebitSettlement?$top=1000&$orderby=Date desc`;
    case "invoicePayments":
      return dateFilter
        ? `/Sale/CustomerPayment?$filter=${encodeURIComponent(dateFilter)}&$top=1000&$orderby=Date desc`
        : `/Sale/CustomerPayment?$top=1000&$orderby=Date desc`;
    case "billPayments":
      return dateFilter
        ? `/Purchase/SupplierPayment?$filter=${encodeURIComponent(dateFilter)}&$top=1000&$orderby=Date desc`
        : `/Purchase/SupplierPayment?$top=1000&$orderby=Date desc`;
    case "banking": {
      const BANKING_EPS = {
        spend:     "/Banking/SpendMoneyTxn",
        receive:   "/Banking/ReceiveMoneyTxn",
        transfer:  "/Banking/TransferMoneyTxn",
        creditNote:"/Sale/CreditSettlement",
        billCredit:"/Purchase/DebitSettlement",
      };
      const bankEp = BANKING_EPS[subType];
      return dateFilter
        ? `${bankEp}?$filter=${encodeURIComponent(dateFilter)}&$top=1000&$orderby=Date desc`
        : `${bankEp}?$top=1000&$orderby=Date desc`;
    }
    case "generalJournal":
      // Uses DateOccurred, not Date - see dateOccurredFilter above.
      return dateOccurredFilter
        ? `/GeneralLedger/GeneralJournal?$filter=${encodeURIComponent(dateOccurredFilter)}&$top=1000&$orderby=DateOccurred desc`
        : `/GeneralLedger/GeneralJournal?$top=1000&$orderby=DateOccurred desc`;
    case "quotes": {
      const baseEp = subType ? `/Sale/Quote/${subType}` : `/Sale/Quote`;
      return dateFilter
        ? `${baseEp}?$filter=${encodeURIComponent(dateFilter)}&$top=1000&$orderby=Date desc`
        : `${baseEp}?$top=1000&$orderby=Date desc`;
    }
    case "items":      return `/Inventory/Item?$top=1000`;
    case "customers":  return `/Contact/Customer?$top=1000`;
    case "suppliers":  return `/Contact/Supplier?$top=1000`;
    case "accounts":   return `/GeneralLedger/Account?$top=1000`;
    case "jobs":       return `/GeneralLedger/Job?$top=1000`;
    case "taxcodes":   return `/GeneralLedger/TaxCode?$top=1000`;
    default:
      throw Object.assign(new Error(`Unknown dataType: ${dataType}`), { status: 400 });
  }
}

function applyDateFilter(records, start, end) {
  if (!start || !end) return records;
  return records.filter((r) => {
    const d = (r.Date || r.DateOccurred || "").substring(0, 10);
    return !d || (d >= start && d <= end);
  });
}

async function updateProgress(jobId, fetched, total) {
  const percent = total > 0 ? Math.min(99, Math.round((fetched / total) * 100)) : 0;
  const logTotal = total > 0 ? `/${total}` : "";
  console.log(`📊 Job ${jobId}: Fetched ${fetched}${logTotal} (${percent}%)`);
  await ExtractionJob.findByIdAndUpdate(jobId, {
    $set: {
      "progress.fetched": fetched,
      "progress.total":   total ?? 0,
      "progress.percent": percent,
    },
  });
}

async function persistBatch(rawBatch, { extractionId, chunkOffset, expiresAt, cacheKey }) {
  const docs = [];
  for (let i = 0; i < rawBatch.length; i += CHUNK_SIZE) {
    const slice = rawBatch.slice(i, i + CHUNK_SIZE);
    docs.push({
      extractionId,
      ...cacheKey, // ✅ userId, businessId, dataType, subType, startDate, endDate
      chunkNumber: chunkOffset + Math.floor(i / CHUNK_SIZE),
      totalChunks: 0,
      totalItems:  rawBatch.length,
      items:       slice,
      expiresAt,
    });
  }
  if (docs.length) {
    await ExtractionCache.insertMany(docs, { ordered: false });
  }
  return docs.length;
}

export async function runExtractionJob(job, dbUser) {
  const jobId = job._id.toString();

  if (activeCount >= MAX_CONCURRENT) {
    console.log(`⏳ Job ${jobId}: waiting for a slot (active: ${activeCount}/${MAX_CONCURRENT})`);
    await waitForSlot();
  }

  activeCount++;
  console.log(`🚀 Job ${jobId}: starting (active: ${activeCount}/${MAX_CONCURRENT})`);

  try {
    await ExtractionJob.findByIdAndUpdate(jobId, { $set: { status: "pending" } });

    const { userId, businessId, dataType, subType, outputFormat, startDate, endDate } = job;

    const isReference = REFERENCE_DATA_TYPES.has(dataType);
    const start = isReference ? null : startDate;
    const end   = isReference ? null : endDate;
    const cacheStart = isReference ? "reference" : start;
    const cacheEnd   = isReference ? "reference" : end;

    const historyDoc = await ExtractionHistory.create({
      userId,
      businessId,
      businessName:   dbUser.businessName || "",
      startDate:      cacheStart,
      endDate:        cacheEnd,
      dataType,
      subType:        subType || null,
      outputFormat,
      status:         "success",
      itemCount:      0,
      cacheStrategy:  "chunked",
      totalChunks:    0,
      estimatedBytes: 0,
      cacheExpiresAt: new Date(Date.now() + CACHE_TTL_MS),
      params: { startDate, endDate, dataType, subType, outputFormat },
    });

    const extractionId = historyDoc._id;
    const expiresAt    = historyDoc.cacheExpiresAt;

    // ✅ Clear any stale cache chunks for this exact same key (same
    // user+business+dataType+subType+dates) BEFORE inserting new ones —
    // otherwise the unique index (userId+businessId+dataType+subType+
    // startDate+endDate+chunkNumber) collides with leftover docs from a
    // previous extraction of the same params, causing E11000 errors.
    await ExtractionCache.deleteMany({
      userId,
      businessId,
      dataType,
      subType: subType || null,
      startDate: cacheStart,
      endDate:   cacheEnd,
    });


    let totalFetched   = 0;
    let totalChunks    = 0;
    let estimatedTotal = 0;

    // FIX: dates are now sent to MYOB as a server-side $filter instead of
    // fetching the entire unfiltered company history and filtering in
    // Node. Deep-join endpoints (invoices/bills) are additionally split
    // into ~2-month date chunks — same reasoning and same chunk size as
    // extractionController.js's fetchAllPagesChunked — since MYOB's
    // server has shown it can't reliably join+sort+paginate a wide
    // unbounded range in one request for those endpoints.
    const isChunked = HEAVY_CHUNKED_TYPES.has(dataType) && start && end;
    const ranges = isChunked
      ? splitDateRange(start, end, CHUNK_MONTHS)
      : [[start, end]];

    // onBatch runs once per MYOB page, for every chunk in `ranges`, and
    // accumulates totalFetched/totalChunks across ALL of them — nothing
    // is reset between chunks, so results from every chunk are combined
    // rather than the later chunk overwriting the earlier one.
    const onBatch = async (rawPage, meta) => {
      // Only trust MYOB's returned Count as the job's overall total when
      // we're NOT chunking — when chunked, `meta.total` reflects just
      // that one date window's count, not the whole requested range, so
      // using it would under/over-report progress.
      if (!isChunked && estimatedTotal === 0 && meta?.total > 0) {
        estimatedTotal = meta.total;
        console.log(`📐 Job ${jobId}: estimated total from MYOB = ${estimatedTotal}`);
        await ExtractionJob.findByIdAndUpdate(jobId, {
          $set: { "progress.total": estimatedTotal },
        });
      }

      const filtered = applyDateFilter(rawPage, start, end);
      if (!filtered.length) return;

      totalFetched += filtered.length;

      const chunkCount = await persistBatch(filtered, {
        extractionId,
        chunkOffset: totalChunks,
        expiresAt,
        cacheKey: {
          userId,
          businessId,
          dataType,
          subType: subType || null,
          startDate: cacheStart,
          endDate:   cacheEnd,
        },
      });
      totalChunks += chunkCount;

      // Always update progress, even if total is unknown
      await updateProgress(jobId, totalFetched, estimatedTotal > 0 ? estimatedTotal : null);
      console.log(`📊 Job ${jobId}: batch saved — ${totalFetched} fetched so far`);
    };

    for (const [rangeStart, rangeEnd] of ranges) {
      if (isChunked) {
        console.log(`📦 Job ${jobId}: fetching chunk ${rangeStart} → ${rangeEnd} (${ranges.length} chunk(s) total)`);
      }
      const url = buildFilteredUrl(dataType, subType, rangeStart, rangeEnd);
      await fetchAllPages(dbUser, userId, url, { onBatch });
    }

    console.log(`[MYOB] module=${dataType} extraction complete total=${totalFetched}`);

    await ExtractionHistory.findByIdAndUpdate(extractionId, {
      $set: { itemCount: totalFetched, totalChunks, cacheStrategy: "chunked" },
    });

    await ExtractionJob.findByIdAndUpdate(jobId, {
      $set: {
        status:              "successful",
        "progress.fetched":  totalFetched,
        "progress.total":    totalFetched,
        "progress.percent":  100,
        resultCacheKey: {
          userId:    userId.toString(),
          businessId,
          dataType,
          subType:   subType || null,
          startDate: cacheStart,
          endDate:   cacheEnd,
        },
      },
    });

    console.log(`✅ Job ${jobId}: complete — ${totalFetched} records, ${totalChunks} cache chunks`);
  } catch (err) {
    console.error(`❌ Job ${jobId} failed: ${err.message}`);
    await ExtractionJob.findByIdAndUpdate(jobId, {
      $set: { status: "failed", errorMessage: err.message || "Unknown error" },
    });
  } finally {
    activeCount--;
    console.log(`🏁 Job ${jobId}: slot released (active: ${activeCount}/${MAX_CONCURRENT})`);
  }
}

function waitForSlot() {
  return new Promise((resolve) => {
    const check = () => {
      if (activeCount < MAX_CONCURRENT) return resolve();
      setTimeout(check, 2000);
    };
    check();
  });
}

export async function markStaleJobsFailed() {
  const STALE_THRESHOLD_MINUTES = Number(process.env.STALE_JOB_THRESHOLD_MINUTES ?? 60);
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  const result = await ExtractionJob.updateMany(
    { status: { $in: ["queued", "pending"] }, updatedAt: { $lt: cutoff } },
    { $set: { status: "failed", errorMessage: "Job orphaned — server restarted. Please re-extract." } }
  );

  if (result.modifiedCount > 0) {
    console.warn(`⚠️ markStaleJobsFailed: marked ${result.modifiedCount} orphaned job(s) as failed.`);
  }
}