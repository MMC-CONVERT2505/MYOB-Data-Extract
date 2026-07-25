import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import {
  extractData,
  getCreditNotes,
  getVendorCredits,
  getCreditRefunds,
  getDebitRefunds,
} from "../controllers/extractionController.js";
import {
  startAsyncExtraction,
  getJobStatus,
  listJobs,
} from "../controllers/asyncExtractionController.js";

const router = Router();

router.use(requireAuth);

// ── Sync extraction (existing — untouched) ───────────────────
router.post("/",              extractData);
router.get("/credit-notes",   getCreditNotes);
router.get("/vendor-credits", getVendorCredits);
router.get("/credit-refunds", getCreditRefunds);
router.get("/debit-refunds",  getDebitRefunds);

// ── Async extraction (new) ────────────────────────────────────
// POST  /api/extract/async          → start a background job, returns { jobId }
// GET   /api/extract/status/:jobId  → poll for progress / status
// GET   /api/extract/jobs           → list recent jobs for current user
router.post("/async",           startAsyncExtraction);
router.get("/status/:jobId",    getJobStatus);
router.get("/jobs",             listJobs);

export default router;