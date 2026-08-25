import mongoose from "mongoose";

/**
 * Tracks a single async "Migration Summary" job.
 *
 * statusFlow: queued → pending → successful | failed
 *
 * Mirrors ExtractionJob.model.js's pattern (see that file for the full
 * design rationale), with one difference: a summary's *result* is small
 * (profile + counts, a few KB of JSON) so it's stored directly on this
 * document instead of going through ExtractionCache's chunking — no
 * chunking is needed for something this size.
 *
 * `progress.phase` gives the frontend something better than a blind
 * spinner to show: "profile" → "transactions" → "attachments" → "done".
 * Attachment counting is by far the slowest phase on large files (one
 * MYOB API call per bill), so `progress.billsProcessed`/`billsTotal`
 * let the frontend show real numeric progress during that phase
 * specifically, instead of a phase label sitting still for minutes.
 */

const progressSchema = new mongoose.Schema(
  {
    phase: {
      type: String,
      enum: ["queued", "profile", "transactions", "attachments", "done"],
      default: "queued",
    },
    billsProcessed: { type: Number, default: 0 },
    billsTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const summaryJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    businessId: { type: String, required: true },

    // Request params (enough to reconstruct the request / show in a job list).
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    accountingBasis: { type: String, default: "Accrual" },
    // "Inception" feature — when true, the job ignores the passed-in
    // startDate and computes the file's real earliest transaction date
    // from the fetched records instead (see summaryService.js).
    inception: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["queued", "pending", "successful", "failed"],
      default: "queued",
      index: true,
    },

    progress: { type: progressSchema, default: () => ({}) },

    errorMessage: { type: String, default: null },

    // The full summary payload — { profile, transactions, generatedAt } —
    // written once the job finishes successfully.
    result: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// One-active-job-per-user guard + stale-job sweep, same pattern as
// ExtractionJob.
summaryJobSchema.index({ userId: 1, status: 1 }, { background: true });
summaryJobSchema.index({ status: 1, updatedAt: 1 }, { background: true });

const SummaryJob = mongoose.model("SummaryJob", summaryJobSchema);
export default SummaryJob;
