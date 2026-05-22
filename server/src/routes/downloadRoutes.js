import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { downloadExcel } from "../controllers/downloadController.js";

const router = Router();

router.use(requireAuth);

// POST /api/download/excel
// Body: { dataType, subType, outputFormat, startDate, endDate }
// Returns: Excel file stream
router.post("/excel", downloadExcel);

export default router;