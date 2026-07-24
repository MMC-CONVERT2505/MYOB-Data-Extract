import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { profile, transactions, full } from "../controllers/summaryController.js";

const router = Router();

router.use(requireAuth);

// GET  /api/summary/profile       — file profile only
// POST /api/summary/transactions  — { startDate, endDate }
// POST /api/summary               — full summary { startDate?, endDate?, accountingBasis? }
router.get("/profile", profile);
router.post("/transactions", transactions);
router.post("/", full);

export default router;