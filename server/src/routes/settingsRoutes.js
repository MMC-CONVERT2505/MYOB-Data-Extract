import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { getSettings, saveSettings } from "../controllers/settingsController.js";

const router = Router();

router.use(requireAuth);

router.get("/",  getSettings);  // GET /api/settings
router.put("/",  saveSettings); // PUT /api/settings

export default router;