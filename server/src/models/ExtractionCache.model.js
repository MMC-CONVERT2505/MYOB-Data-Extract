import mongoose from "mongoose";

// ── ExtractionCache — actual data storage ─────────────────────
// Supports both single-doc and chunked storage strategies.
// TTL index auto-deletes after 4 hours.

const extractionCacheSchema = new mongoose.Schema(
  {
    // Link to ExtractionHistory
    extractionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "ExtractionHistory",
      required: true,
      index: true,
    },

    // Cache key (for direct lookup without join)
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    businessId: { type: String, required: true },
    dataType:   { type: String, required: true },
    subType:    { type: String, default: null },
    startDate:  { type: String, required: true },
    endDate:    { type: String, required: true },

    // Chunk info
    chunkNumber: { type: Number, default: 0 },   // 0-indexed
    totalChunks: { type: Number, default: 1 },
    totalItems:  { type: Number, default: 0 },

    // Actual data
    items: { type: mongoose.Schema.Types.Mixed, default: [] },

    // TTL — MongoDB auto-deletes at this time
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Fast lookup by cache key + chunk number
extractionCacheSchema.index(
  { userId: 1, businessId: 1, dataType: 1, subType: 1, startDate: 1, endDate: 1, chunkNumber: 1 },
  { unique: true }
);

// TTL index
extractionCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ExtractionCache = mongoose.model("ExtractionCache", extractionCacheSchema);
export default ExtractionCache;