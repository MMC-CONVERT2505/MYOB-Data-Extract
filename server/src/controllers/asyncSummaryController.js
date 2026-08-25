/**
 * asyncSummaryController.js
 *
 * POST /api/summary/async
 *   Creates a job record, fires the background worker (does NOT await
 *   it), and returns { jobId } immediately — the HTTP response goes back
 *   in milliseconds regardless of how long profile+transactions+
 *   attachments actually take, so Nginx/ALB never gets a chance to 502.
 *
 * GET /api/summary/status/:jobId
 *   Lightweight MongoDB read. Returns current status + progress (+ the
 *   full result once status is "successful"). Designed to be polled
 *   every few seconds from the frontend.
 */

import SummaryJob from "../models/SummaryJob.model.js";
import { runSummaryJob } from "../services/asyncSummaryService.js";

// ── POST /api/summary/async ─────────────────────────────────────
export const startAsyncSummary = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const dbUser = req.dbUser;
    const { startDate, endDate, accountingBasis, inception } = req.body || {};

    // ── One-active-job-per-user guard, same pattern as extraction ──
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const duplicate = await SummaryJob.findOne({
      userId,
      status: { $in: ["queued", "pending"] },
      updatedAt: { $gt: twoHoursAgo },
    });
    if (duplicate) {
      return res.status(409).json({
        error: `A summary is already running (jobId: ${duplicate._id}). Wait for it to finish or check its status.`,
        jobId: duplicate._id.toString(),
      });
    }

    const job = await SummaryJob.create({
      userId,
      businessId: dbUser.businessId,
      startDate: startDate || null,
      endDate: endDate || null,
      accountingBasis: accountingBasis || "Accrual",
      inception: !!inception,
      status: "queued",
      progress: { phase: "queued", billsProcessed: 0, billsTotal: 0 },
    });

    const jobId = job._id.toString();
    console.log(`📋 Async summary job created: ${jobId} (user=${userId})`);

    // Fire-and-forget — response returns immediately, work continues
    // in the background regardless of how long it takes.
    runSummaryJob(job, dbUser).catch((err) => {
      console.error(`❌ Unhandled error in background summary job ${jobId}:`, err.message);
    });

    return res.status(202).json({
      jobId,
      status: "queued",
      message: `Summary job queued. Poll /api/summary/status/${jobId} for progress.`,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/summary/status/:jobId ──────────────────────────────
export const getSummaryJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const userId = req.session.userId;

    const job = await SummaryJob.findById(jobId).lean();

    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }
    if (job.userId.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Access denied." });
    }

    return res.json({
      jobId: job._id.toString(),
      status: job.status,
      progress: job.progress,
      errorMessage: job.errorMessage ?? null,
      result: job.status === "successful" ? job.result : null,
      startDate: job.startDate,
      endDate: job.endDate,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (err) {
    next(err);
  }
};
