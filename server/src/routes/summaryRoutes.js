import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { profile, transactions, full } from "../controllers/summaryController.js";
import {
  startAsyncSummary,
  getSummaryJobStatus,
} from "../controllers/asyncSummaryController.js";

const router = Router();

router.use(requireAuth);

// GET  /api/summary/profile       — file profile only
// POST /api/summary/transactions  — { startDate, endDate }
// POST /api/summary               — full summary { startDate?, endDate?, accountingBasis? }
//                                    (still synchronous — kept for backward compatibility;
//                                    prefer /api/summary/async for anything but small files)
router.get("/profile", profile);
router.post("/transactions", transactions);
router.post("/", full);

// ── Async summary (502-safe, use this for anything but tiny files) ──
// POST /api/summary/async          → start a background job, returns { jobId }
// GET  /api/summary/status/:jobId  → poll for progress / status / result
router.post("/async", startAsyncSummary);
router.get("/status/:jobId", getSummaryJobStatus);

export default router;