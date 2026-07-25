/**
 * asyncExtractionController.js
 *
 * POST /api/extract/async
 *   Validates the request, enforces the one-active-job-per-user+dataType
 *   rule, creates a job record in MongoDB, fires the background worker
 *   (does NOT await it), and returns { jobId } immediately — so the HTTP
 *   response goes back to the client in milliseconds regardless of how
 *   long the actual extraction takes (avoids 502/504 from Nginx).
 *
 * GET  /api/extract/status/:jobId
 *   Lightweight MongoDB read. Returns current status + progress.
 *   Designed to be polled every 15 seconds from the frontend.
 */

import ExtractionJob from "../models/ExtractionJob.model.js";
import { runExtractionJob } from "../services/asyncExtractionService.js";

const REFERENCE_DATA_TYPES = new Set([
  "items", "customers", "suppliers", "accounts", "jobs", "taxcodes",
]);

// ── POST /api/extract/async ───────────────────────────────────
export const startAsyncExtraction = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const dbUser = req.dbUser;
    const {
      dataType, subType, outputFormat = "raw",
      startDate, endDate,
    } = req.body;

    // ── Validation ────────────────────────────────────────────
    if (!dataType) {
      return res.status(400).json({ error: "dataType is required." });
    }
    const isReference = REFERENCE_DATA_TYPES.has(dataType);
    if (!isReference && (!startDate || !endDate)) {
      return res.status(400).json({
        error: "startDate and endDate are required for this dataType.",
      });
    }

    // ── One-active-job-per-user+dataType guard (requirement 7) ──
    // Prevents the same user from hammering MYOB with duplicate
    // overlapping fetches for the same dataset.
    const duplicate = await ExtractionJob.findOne({
      userId,
      dataType,
      subType: subType || null,
      status: { $in: ["queued", "pending"] },
    });
    if (duplicate) {
      return res.status(409).json({
        error: `An extraction for ${dataType}${subType ? "/" + subType : ""} is already running (jobId: ${duplicate._id}). Wait for it to finish or check its status.`,
        jobId: duplicate._id.toString(),
      });
    }

    // ── Create job document ───────────────────────────────────
    const job = await ExtractionJob.create({
      userId,
      businessId:   dbUser.businessId,
      dataType,
      subType:      subType || null,
      outputFormat,
      startDate:    isReference ? null : startDate,
      endDate:      isReference ? null : endDate,
      status:       "queued",
      progress:     { fetched: 0, total: 0, percent: 0 },
    });

    const jobId = job._id.toString();
    console.log(`📋 Async job created: ${jobId} (${dataType}/${subType || "all"}, user=${userId})`);

    // ── Fire-and-forget (requirement 1) ───────────────────────
    // We do NOT await this — the HTTP response returns immediately
    // with { jobId } while the background function keeps running.
    runExtractionJob(job, dbUser).catch((err) => {
      // This catch handles any unexpected throw from runExtractionJob
      // that it didn't handle internally (it shouldn't, but defensive).
      console.error(`❌ Unhandled error in background job ${jobId}:`, err.message);
    });

    return res.status(202).json({
      jobId,
      status: "queued",
      message: `Extraction job queued. Poll /api/extract/status/${jobId} for progress.`,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/extract/status/:jobId ────────────────────────────
export const getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const userId    = req.session.userId;

    const job = await ExtractionJob.findById(jobId).lean();

    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }

    // Prevent users from seeing other users' jobs.
    if (job.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Access denied." });
    }

    return res.json({
      jobId:          job._id.toString(),
      status:         job.status,
      progress:       job.progress,
      errorMessage:   job.errorMessage ?? null,
      resultCacheKey: job.status === "successful" ? job.resultCacheKey : null,
      dataType:       job.dataType,
      subType:        job.subType,
      outputFormat:   job.outputFormat,
      startDate:      job.startDate,
      endDate:        job.endDate,
      createdAt:      job.createdAt,
      updatedAt:      job.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/extract/jobs — list recent jobs for current user ──
export const listJobs = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const jobs = await ExtractionJob.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.json(
      jobs.map((j) => ({
        jobId:     j._id.toString(),
        dataType:  j.dataType,
        subType:   j.subType,
        status:    j.status,
        progress:  j.progress,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
      }))
    );
  } catch (err) {
    next(err);
  }
};
