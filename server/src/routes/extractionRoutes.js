import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import {
  extractData,
  getCreditNotes,
  getVendorCredits,
  getCreditRefunds,
  getDebitRefunds,
} from "../controllers/extractionController.js";

const router = Router();

router.use(requireAuth);

// Main extraction endpoint (handles ALL data types including reference data)
router.post("/",              extractData);

// Legacy individual endpoints
router.get("/credit-notes",   getCreditNotes);
router.get("/vendor-credits", getVendorCredits);
router.get("/credit-refunds", getCreditRefunds);
router.get("/debit-refunds",  getDebitRefunds);

export default router;