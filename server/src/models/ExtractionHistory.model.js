import mongoose from "mongoose";

// ── ExtractionHistory — metadata only, no items ───────────────
const extractionHistorySchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    businessId: { type: String, required: true },
    businessName: { type: String, default: "" },

    // Extraction params
    startDate:    { type: String, required: false },
    endDate:      { type: String, required: false },
    dataType:     { type: String, required: true },
    subType:      { type: String, default: null },
    outputFormat: { type: String, default: "raw" },

    // Result metadata
    status:       { type: String, enum: ["success", "failed"], default: "success" },
    itemCount:    { type: Number, default: 0 },
    errorMessage: { type: String, default: null },

    // Cache metadata (no items stored here)
    cacheStrategy:  { type: String, enum: ["single", "chunked", "none"], default: "none" },
    totalChunks:    { type: Number, default: 0 },
    estimatedBytes: { type: Number, default: 0 },
    cacheExpiresAt: { type: Date, default: null },

    // Re-run params
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

extractionHistorySchema.index({ userId: 1, createdAt: -1 });
extractionHistorySchema.index(
  { userId: 1, businessId: 1, dataType: 1, subType: 1, startDate: 1, endDate: 1 }
);

const ExtractionHistory = mongoose.model("ExtractionHistory", extractionHistorySchema);
export default ExtractionHistory;