

import ExtractionHistory from "../models/ExtractionHistory.model.js";
import ExtractionCache   from "../models/ExtractionCache.model.js";

// ── Constants ─────────────────────────────────────────────────
const CACHE_TTL_MS      = 4 * 60 * 60 * 1000;  // 4 hours
const MONGO_SAFE_BYTES  = 12 * 1024 * 1024;     // 12MB safe limit (actual 16MB)
const CHUNK_SIZE        = 1000;                  // rows per chunk document

// ── Estimate payload size from first page ─────────────────────
export const estimatePayloadSize = (firstPageItems, totalCount) => {
  if (!firstPageItems?.length) return 0;
  const sampleBytes  = Buffer.byteLength(JSON.stringify(firstPageItems));
  const avgPerRecord = sampleBytes / firstPageItems.length;
  return Math.ceil(avgPerRecord * totalCount);
};

// ── Build cache key object ────────────────────────────────────
const buildKey = (userId, businessId, dataType, subType, startDate, endDate) => ({
  userId,
  businessId,
  dataType,
  subType:   subType || null,
  startDate,
  endDate,
});

// ── Check if valid cache exists ───────────────────────────────
export const getCacheMetadata = async (userId, businessId, dataType, subType, startDate, endDate) => {
  const record = await ExtractionHistory.findOne({
    ...buildKey(userId, businessId, dataType, subType, startDate, endDate),
    status:         "success",
    cacheStrategy:  { $in: ["single", "chunked"] },
    cacheExpiresAt: { $gt: new Date() },
  })
  .sort({ createdAt: -1 })
  .lean();

  return record || null;
};

// ── Get cached items (reassemble if chunked) ──────────────────
export const getCachedExtraction = async (userId, businessId, dataType, subType, startDate, endDate) => {
  try {
    const meta = await getCacheMetadata(userId, businessId, dataType, subType, startDate, endDate);
    if (!meta) return null;

    const chunks = await ExtractionCache.find({
      extractionId: meta._id,
      expiresAt:    { $gt: new Date() },
    })
    .sort({ chunkNumber: 1 })
    .lean();

    if (!chunks.length) return null;

    // Validate all chunks present
    if (chunks.length !== meta.totalChunks) {
      console.warn(`⚠️ Cache PARTIAL — expected ${meta.totalChunks}, got ${chunks.length}. Skipping.`);
      return null;
    }

    const items = chunks.flatMap(c => c.items);
    console.log(`✅ Cache HIT — ${dataType}/${subType || "all"} — ${items.length} items (${meta.cacheStrategy}, ${chunks.length} chunk(s))`);
    return items;
  } catch (err) {
    console.error("⚠️ Cache GET error:", err.message);
    return null;
  }
};

// ── Save to cache with smart strategy ────────────────────────
export const setCachedExtraction = async ({
  userId, businessId, dataType, subType, startDate, endDate,
  items, estimatedBytes, extractionId,
}) => {
  try {
    const key        = buildKey(userId, businessId, dataType, subType, startDate, endDate);
    const expiresAt  = new Date(Date.now() + CACHE_TTL_MS);
    const totalItems = items.length;

    // ── Decide strategy based on estimated size ───────────────
    const strategy = estimatedBytes <= MONGO_SAFE_BYTES ? "single" : "chunked";

    // ✅ FIX: cache key se delete karo (extractionId se nahi)
    // Pehle extractionId se delete karta tha — lekin har extraction ka
    // naya _id hota hai, isliye kuch delete nahi hota tha aur
    // duplicate key error aata tha.
    await ExtractionCache.deleteMany({ ...key });

    if (strategy === "single") {
      await ExtractionCache.create({
        extractionId,
        ...key,
        chunkNumber: 0,
        totalChunks: 1,
        totalItems,
        items,
        expiresAt,
      });
      console.log(`💾 Cache SET [single] — ${dataType}/${subType || "all"} — ${totalItems} items (~${Math.round(estimatedBytes / 1024)}KB)`);
    } else {
      const chunks      = [];
      const totalChunks = Math.ceil(totalItems / CHUNK_SIZE);

      for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
        chunks.push({
          extractionId,
          ...key,
          chunkNumber: Math.floor(i / CHUNK_SIZE),
          totalChunks,
          totalItems,
          items: items.slice(i, i + CHUNK_SIZE),
          expiresAt,
        });
      }

      await ExtractionCache.insertMany(chunks, { ordered: false });
      console.log(`💾 Cache SET [chunked] — ${dataType}/${subType || "all"} — ${totalItems} items in ${totalChunks} chunks (~${Math.round(estimatedBytes / 1024 / 1024)}MB)`);
    }

    return strategy;
  } catch (err) {
    console.error("⚠️ Cache SET error:", err.message);
    return "none";
  }
};

// ── Save extraction history + trigger cache ───────────────────
export const saveExtractionWithCache = async ({
  userId, businessId, businessName,
  startDate, endDate, dataType, subType, outputFormat,
  status, itemCount, errorMessage,
  items, estimatedBytes,
}) => {
  const expiresAt = status === "success" && items?.length
    ? new Date(Date.now() + CACHE_TTL_MS)
    : null;

  // Save history record first
  const history = await ExtractionHistory.create({
    userId, businessId, businessName,
    startDate, endDate, dataType,
    subType:        subType || null,
    outputFormat:   outputFormat || "raw",
    status:         status || "success",
    itemCount:      itemCount || 0,
    errorMessage:   errorMessage || null,
    estimatedBytes: estimatedBytes || 0,
    cacheExpiresAt: expiresAt,
    cacheStrategy:  "none",
    totalChunks:    0,
    params: { startDate, endDate, dataType, subType, outputFormat },
  });

  // If success, save cache
  if (status === "success" && items?.length) {
    const strategy = await setCachedExtraction({
      userId, businessId, dataType, subType, startDate, endDate,
      items, estimatedBytes, extractionId: history._id,
    });

    // Update history with cache strategy info
    await ExtractionHistory.findByIdAndUpdate(history._id, {
      $set: {
        cacheStrategy: strategy,
        totalChunks:   strategy === "chunked" ? Math.ceil(items.length / CHUNK_SIZE) : 1,
      },
    });
  }

  return history;
};

// ── Invalidate all cache for a user+business ──────────────────
export const invalidateCache = async (userId, businessId) => {
  try {
    const result = await ExtractionCache.deleteMany({ userId, businessId });
    console.log(`🗑️ Cache cleared — ${result.deletedCount} chunks removed`);
  } catch (err) {
    console.error("⚠️ Cache invalidate error:", err.message);
  }
};