/**
 * asyncExtractionService.js
 *
 * Provides:
 *  - runExtractionJob(job, dbUser)
 *      Fire-and-forget background worker. Fetches all pages from MYOB
 *      using the existing paginationService (with its adaptive retry /
 *      page-size shrink), writes each batch straight to the cache via
 *      extractionCacheService (never accumulates a full array in memory),
 *      and updates the job's progress in MongoDB after every page.
 *
 *  - Global concurrency gate (MAX_CONCURRENT)
 *      Prevents multiple large extractions from stacking up and OOM-ing
 *      the server. New requests are kept "queued" until a slot opens.
 *
 * Stale-job recovery is handled at server startup (see server.js).
 */

import ExtractionJob from "../models/ExtractionJob.model.js";
import ExtractionHistory from "../models/ExtractionHistory.model.js";
import ExtractionCache from "../models/ExtractionCache.model.js";
import { fetchAllPages } from "./paginationService.js";
import { convertToQBO, convertToMYOBRaw, convertToXero, convertToReckon } from "./conversionService.js";

// ── Global concurrency gate ───────────────────────────────────
// Max simultaneous background extractions across ALL users.
// Keeps memory pressure bounded even when different users kick off
// large jobs at the same time.
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_EXTRACTIONS ?? 2);
let activeCount = 0;

// ── Cache constants (mirrors extractionCacheService) ─────────
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;   // 4 h
const CHUNK_SIZE   = 1000;                   // raw rows per Mongo doc

// ── Reference types (no date filtering) ──────────────────────
const REFERENCE_DATA_TYPES = new Set([
  "items", "customers", "suppliers", "accounts", "jobs", "taxcodes",
]);

/**
 * Build the first-page URL for each data type — exactly the same logic
 * as extractionController.js, centralised here so it is shared between
 * the sync and async paths without duplication.
 */
function buildStartUrl(dataType, subType, start, end) {
  const dateFilter = start && end
    ? `Date ge datetime'${start}' and Date le datetime'${end}'`
    : null;

  switch (dataType) {
    case "invoices":
      return subType
        ? `/Sale/Invoice/${subType}?$top=1000&$orderby=Date desc`
        : `/Sale/Invoice?$top=1000&$orderby=Date desc`;

    case "salesOrders":
      return subType
        ? `/Sale/Order/${subType}?$top=1000&$orderby=Date desc`
        : `/Sale/Order?$top=1000&$orderby=Date desc`;

    case "bills":
      return subType
        ? `/Purchase/Bill/${subType}?$top=1000&$orderby=Date desc`
        : `/Purchase/Bill?$top=1000&$orderby=Date desc`;

    case "purchaseOrders":
      return subType
        ? `/Purchase/Order/${subType}?$top=1000&$orderby=Date desc`
        : `/Purchase/Order?$top=1000&$orderby=Date desc`;

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
      return `/Sale/CustomerPayment?$top=1000&$orderby=Date desc`;

    case "billPayments":
      return `/Purchase/SupplierPayment?$top=1000&$orderby=Date desc`;

    case "banking": {
      const BANKING_EPS = {
        spend:     "/Banking/SpendMoneyTxn",
        receive:   "/Banking/ReceiveMoneyTxn",
        transfer:  "/Banking/TransferMoneyTxn",
        creditNote:"/Sale/CreditSettlement",
        billCredit:"/Purchase/DebitSettlement",
      };
      return `${BANKING_EPS[subType]}?$top=1000&$orderby=Date desc`;
    }

    case "generalJournal":
      return `/GeneralLedger/GeneralJournal?$top=1000&$orderby=DateOccurred desc`;

    case "quotes":
      return subType
        ? `/Sale/Quote/${subType}?$top=1000&$orderby=Date desc`
        : `/Sale/Quote?$top=1000&$orderby=Date desc`;

    // Reference types
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

/** Apply date-range filter on records that don't support $filter server-side. */
function applyDateFilter(records, start, end) {
  if (!start || !end) return records;
  return records.filter((r) => {
    const d = (r.Date || r.DateOccurred || "").substring(0, 10);
    return !d || (d >= start && d <= end);
  });
}

/**
 * Update the job progress in MongoDB. Called after every page/batch so
 * the frontend polling sees granular progress.
 *
 * @param {string} jobId
 * @param {number} fetched - cumulative records fetched so far
 * @param {number|null} total - total expected (null if unknown)
 */
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

/**
 * Persist a batch of raw (unconverted) records to MongoDB cache.
 *
 * Each batch is stored as one or more ExtractionCache documents
 * (max CHUNK_SIZE rows each). The ExtractionHistory record is updated
 * (upserted) at the end of the job, not per-batch, to avoid too many
 * writes.
 *
 * Returns the total chunk count so far.
 */
async function persistBatch(rawBatch, { extractionId, chunkOffset, expiresAt }) {
  const docs = [];
  for (let i = 0; i < rawBatch.length; i += CHUNK_SIZE) {
    const slice = rawBatch.slice(i, i + CHUNK_SIZE);
    docs.push({
      extractionId,
      chunkNumber: chunkOffset + Math.floor(i / CHUNK_SIZE),
      items:       slice,
      expiresAt,
    });
  }
  if (docs.length) {
    await ExtractionCache.insertMany(docs, { ordered: false });
  }
  return docs.length;
}

// ── Main background worker ────────────────────────────────────

/**
 * runExtractionJob — fires in the background (NOT awaited by the HTTP
 * handler). Manages the full lifecycle: slot acquisition → fetch →
 * persist batches → mark job successful/failed.
 *
 * @param {Document} job - saved ExtractionJob document
 * @param {Object}   dbUser - the authenticated user record (from session)
 */
export async function runExtractionJob(job, dbUser) {
  const jobId = job._id.toString();

  // ── Wait for a concurrency slot ───────────────────────────
  if (activeCount >= MAX_CONCURRENT) {
    console.log(`⏳ Job ${jobId}: waiting for a slot (active: ${activeCount}/${MAX_CONCURRENT})`);
    await waitForSlot();
  }

  activeCount++;
  console.log(`🚀 Job ${jobId}: starting (active: ${activeCount}/${MAX_CONCURRENT})`);

  try {
    await ExtractionJob.findByIdAndUpdate(jobId, {
      $set: { status: "pending" },
    });

    const {
      userId, businessId, dataType, subType,
      outputFormat, startDate, endDate,
    } = job;

    const isReference = REFERENCE_DATA_TYPES.has(dataType);
    const start = isReference ? null : startDate;
    const end   = isReference ? null : endDate;

    const cacheStart = isReference ? "reference" : start;
    const cacheEnd   = isReference ? "reference" : end;

    // Create the ExtractionHistory record upfront so we have an ID for
    // the cache chunks, even though itemCount is unknown yet.
    const historyDoc = await ExtractionHistory.create({
      userId,
      businessId,
      businessName:  dbUser.businessName || "",
      startDate:     cacheStart,
      endDate:       cacheEnd,
      dataType,
      subType:       subType || null,
      outputFormat,
      status:        "success",   // optimistic; corrected on failure below
      itemCount:     0,
      cacheStrategy: "chunked",
      totalChunks:   0,
      estimatedBytes:0,
      cacheExpiresAt: new Date(Date.now() + CACHE_TTL_MS),
      params: { startDate, endDate, dataType, subType, outputFormat },
    });

    const extractionId = historyDoc._id;
    const expiresAt    = historyDoc.cacheExpiresAt;

    // ── Fetch all pages using existing paginationService ──────
    // The onBatch callback is called after every page. We:
    //   1. Apply client-side date filter (for endpoints that don't
    //      support $filter server-side).
    //   2. Convert each page immediately (not the full array).
    //   3. Write the chunk to MongoDB.
    //   4. Update progress.
    //   5. Discard the page from memory.

    let totalFetched  = 0;
    let totalChunks   = 0;
    const url = buildStartUrl(dataType, subType, start, end);

    await fetchAllPages(dbUser, userId, url, {
      onBatch: async (rawPage) => {
        const filtered = applyDateFilter(rawPage, start, end);
        if (!filtered.length) return;

        totalFetched += filtered.length;

        const chunkCount = await persistBatch(filtered, {
          extractionId,
          chunkOffset: totalChunks,
          expiresAt,
        });
        totalChunks += chunkCount;

        // Progress update — total unknown at start, grows as we fetch.
        await updateProgress(jobId, totalFetched, null);
      },
    });

    // ── Finalize history record ───────────────────────────────
    await ExtractionHistory.findByIdAndUpdate(extractionId, {
      $set: {
        itemCount:   totalFetched,
        totalChunks,
        cacheStrategy: "chunked",
      },
    });

    // ── Mark job successful ───────────────────────────────────
    await ExtractionJob.findByIdAndUpdate(jobId, {
      $set: {
        status:  "successful",
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
      $set: {
        status:       "failed",
        errorMessage: err.message || "Unknown error",
      },
    });
  } finally {
    activeCount--;
    console.log(`🏁 Job ${jobId}: slot released (active: ${activeCount}/${MAX_CONCURRENT})`);
  }
}

/**
 * Poll until an active slot is available. Simple 2-second back-off;
 * no need for anything fancier in a fire-and-forget model.
 */
function waitForSlot() {
  return new Promise((resolve) => {
    const check = () => {
      if (activeCount < MAX_CONCURRENT) return resolve();
      setTimeout(check, 2000);
    };
    check();
  });
}

/**
 * Startup sweep — called once when the server starts.
 * Any job that has been "queued" or "pending" for more than
 * STALE_THRESHOLD_MINUTES is assumed to have been orphaned by a
 * crash/PM2 restart and is marked "failed" with a clear message.
 */
export async function markStaleJobsFailed() {
  const STALE_THRESHOLD_MINUTES = Number(
    process.env.STALE_JOB_THRESHOLD_MINUTES ?? 60
  );
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  const result = await ExtractionJob.updateMany(
    {
      status:    { $in: ["queued", "pending"] },
      updatedAt: { $lt: cutoff },
    },
    {
      $set: {
        status:       "failed",
        errorMessage: `Job orphaned — server restarted while this job was running. Please re-extract.`,
      },
    }
  );

  if (result.modifiedCount > 0) {
    console.warn(
      `⚠️  markStaleJobsFailed: marked ${result.modifiedCount} orphaned job(s) as failed.`
    );
  }
}
