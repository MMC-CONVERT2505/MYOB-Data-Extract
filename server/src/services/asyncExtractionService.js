/**
 * asyncExtractionService.js
 */

import ExtractionJob from "../models/ExtractionJob.model.js";
import ExtractionHistory from "../models/ExtractionHistory.model.js";
import ExtractionCache from "../models/ExtractionCache.model.js";
import { fetchAllPages } from "./paginationService.js";
import { convertToQBO, convertToMYOBRaw, convertToXero, convertToReckon } from "./conversionService.js";

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_EXTRACTIONS ?? 2);
let activeCount = 0;

const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const CHUNK_SIZE   = 1000;

const REFERENCE_DATA_TYPES = new Set([
  "items", "customers", "suppliers", "accounts", "jobs", "taxcodes",
]);

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
    const url = buildStartUrl(dataType, subType, start, end);

    await fetchAllPages(dbUser, userId, url, {
      onBatch: async (rawPage, meta) => {
        // First batch — grab total count from MYOB response.
        if (estimatedTotal === 0 && meta?.total > 0) {
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
      },
    });

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