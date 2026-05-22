import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import {
  listHistory,
  getHistory,
  deleteHistory,
  clearAllHistory,
} from "../controllers/historyController.js";

const router = Router();

router.use(requireAuth);

router.get("/",        listHistory);     // GET  /api/history?page=1&limit=20&dataType=invoices
router.get("/:id",     getHistory);      // GET  /api/history/:id
router.delete("/",     clearAllHistory); // DELETE /api/history  (clear all)
router.delete("/:id",  deleteHistory);   // DELETE /api/history/:id

export default router;