import mongoose from "mongoose";

/**
 * Tracks a single async extraction job.
 *
 * statusFlow: queued → pending → successful | failed
 *
 * Design notes:
 *  - "queued"  : job created, waiting for a worker slot (global concurrency gate)
 *  - "pending" : worker has started fetching from MYOB
 *  - "successful": all pages fetched, cache written, ready to download
 *  - "failed"  : unrecoverable error, see errorMessage
 *
 * Stale-job safety: if the Node process crashes while a job is "pending",
 * the job stays stuck. server.js startup runs markStaleJobsFailed() to
 * detect and mark any job that has been "queued"/"pending" for more than
 * STALE_THRESHOLD_MINUTES.
 */

const progressSchema = new mongoose.Schema(
  {
    fetched:  { type: Number, default: 0 },
    total:    { type: Number, default: 0 },   // 0 = unknown yet
    percent:  { type: Number, default: 0 },
  },
  { _id: false }
);

const extractionJobSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    businessId: { type: String, required: true },

    // Extraction params (enough to reconstruct the full request)
    dataType:     { type: String, required: true },
    subType:      { type: String, default: null },
    outputFormat: { type: String, default: "raw" },
    startDate:    { type: String, default: null },
    endDate:      { type: String, default: null },

    status: {
      type: String,
      enum: ["queued", "pending", "successful", "failed"],
      default: "queued",
      index: true,
    },

    progress: { type: progressSchema, default: () => ({}) },

    errorMessage: { type: String, default: null },

    // Points at the ExtractionHistory + ExtractionCache entry that
    // holds the converted rows so the download endpoint can find them.
    resultCacheKey: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // shape: { userId, businessId, dataType, subType, startDate, endDate }
    },
  },
  { timestamps: true }
);

// Compound index for the "one active job per user+dataType" guard.
extractionJobSchema.index(
  { userId: 1, dataType: 1, subType: 1, status: 1 },
  { background: true }
);

// Compound index used by the stale-job startup sweep.
extractionJobSchema.index({ status: 1, updatedAt: 1 }, { background: true });

const ExtractionJob = mongoose.model("ExtractionJob", extractionJobSchema);
export default ExtractionJob;
