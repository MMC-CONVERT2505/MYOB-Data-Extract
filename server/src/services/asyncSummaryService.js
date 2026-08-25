/**
 * asyncSummaryService.js
 *
 * Runs the Migration Summary (profile + transaction counts + attachment
 * count) as a background job instead of inline in the HTTP request.
 *
 * This is what actually fixes the 502/timeout: the controller returns
 * { jobId } in milliseconds, and this function keeps running in the
 * background for as long as it needs — including the attachment N+1
 * loop, which is the slow part on large files (one API call per bill).
 *
 * Reuses getFileProfile / getTransactionCounts / getBillAttachmentCount
 * from summaryService.js completely unchanged — this file only adds
 * job bookkeeping (status + progress updates) around those calls.
 */

import SummaryJob from "../models/SummaryJob.model.js";
import {
  getFileProfile,
  getTransactionCounts,
  getBillAttachmentCount,
} from "./summaryService.js";

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_SUMMARIES ?? 2);
let activeCount = 0;

export async function runSummaryJob(job, dbUser) {
  const jobId = job._id.toString();
  const userId = job.userId;

  if (activeCount >= MAX_CONCURRENT) {
    console.log(`⏳ Summary job ${jobId}: waiting for a slot (active: ${activeCount}/${MAX_CONCURRENT})`);
    await waitForSlot();
  }

  activeCount++;
  console.log(`🚀 Summary job ${jobId}: starting (active: ${activeCount}/${MAX_CONCURRENT})`);

  try {
    await SummaryJob.findByIdAndUpdate(jobId, {
      $set: { status: "pending", "progress.phase": "profile" },
    });

    const { startDate, endDate, accountingBasis, inception } = job;

    // ── Phase 1: file profile ──────────────────────────────────
    const { profile, _accounts } = await getFileProfile(dbUser, userId);
    console.log(`📋 Summary job ${jobId}: profile done`);

    let transactions = null;

    if (startDate && endDate) {
      // ── Phase 2: transaction counts ──────────────────────────
      await SummaryJob.findByIdAndUpdate(jobId, {
        $set: { "progress.phase": "transactions" },
      });

      transactions = await getTransactionCounts(dbUser, userId, {
        startDate,
        endDate,
        accounts: _accounts,
        inception,
      });
      console.log(`📊 Summary job ${jobId}: transaction counts done`);

      // ── Phase 3: bill attachments (the slow one) ─────────────
      const bills = transactions._allBills || [];
      await SummaryJob.findByIdAndUpdate(jobId, {
        $set: {
          "progress.phase": "attachments",
          "progress.billsTotal": bills.length,
          "progress.billsProcessed": 0,
        },
      });

      const attachments = await getBillAttachmentCount(dbUser, userId, bills, {
        // Optional progress callback — see note in summaryService.js
        // patch below. If your getBillAttachmentCount doesn't accept
        // this yet, this phase just won't show incremental numbers;
        // everything else still works.
        onProgress: async (processed, total) => {
          await SummaryJob.findByIdAndUpdate(jobId, {
            $set: { "progress.billsProcessed": processed, "progress.billsTotal": total },
          });
        },
      });

      transactions.addOns.attachments = attachments;
      delete transactions._allBills;
      console.log(`📎 Summary job ${jobId}: attachments done — ${attachments}`);
    }

    const result = {
      profile: { ...profile, accountingBasis: accountingBasis || "Accrual" },
      transactions,
      generatedAt: new Date().toISOString(),
    };

    await SummaryJob.findByIdAndUpdate(jobId, {
      $set: {
        status: "successful",
        "progress.phase": "done",
        result,
      },
    });

    console.log(`✅ Summary job ${jobId}: complete`);
  } catch (err) {
    console.error(`❌ Summary job ${jobId} failed: ${err.message}`);
    await SummaryJob.findByIdAndUpdate(jobId, {
      $set: { status: "failed", errorMessage: err.message || "Unknown error" },
    });
  } finally {
    activeCount--;
    console.log(`🏁 Summary job ${jobId}: slot released (active: ${activeCount}/${MAX_CONCURRENT})`);
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

export async function markStaleSummaryJobsFailed() {
  const STALE_THRESHOLD_MINUTES = Number(process.env.STALE_JOB_THRESHOLD_MINUTES ?? 60);
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  const result = await SummaryJob.updateMany(
    { status: { $in: ["queued", "pending"] }, updatedAt: { $lt: cutoff } },
    { $set: { status: "failed", errorMessage: "Job orphaned — server restarted. Please re-run the summary." } }
  );

  if (result.modifiedCount > 0) {
    console.warn(`⚠️ markStaleSummaryJobsFailed: marked ${result.modifiedCount} orphaned job(s) as failed.`);
  }
}
