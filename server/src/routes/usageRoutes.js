import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { getUsage } from "../controllers/usageController.js";

const router = Router();

router.use(requireAuth);
router.get("/", getUsage); // GET /api/usage

export default router;