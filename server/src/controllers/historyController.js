import {
  getExtractionHistory,
  getExtractionById,
  deleteExtractionById,
  deleteAllHistory,
} from "../services/extractionHistoryService.js";

// ── GET /api/history ─────────────────────────────────────────
export const listHistory = async (req, res, next) => {
  try {
    const userId   = req.session.userId;
    const { page = 1, limit = 20, dataType } = req.query;

    const result = await getExtractionHistory(userId, {
      page:     parseInt(page),
      limit:    parseInt(limit),
      dataType: dataType || null,
    });

    res.json(result);
  } catch (err) { next(err); }
};

// ── GET /api/history/:id ─────────────────────────────────────
export const getHistory = async (req, res, next) => {
  try {
    const record = await getExtractionById(req.params.id, req.session.userId);
    if (!record) return res.status(404).json({ error: "Record not found" });
    res.json(record);
  } catch (err) { next(err); }
};

// ── DELETE /api/history/:id ──────────────────────────────────
export const deleteHistory = async (req, res, next) => {
  try {
    const deleted = await deleteExtractionById(req.params.id, req.session.userId);
    if (!deleted) return res.status(404).json({ error: "Record not found" });
    res.json({ success: true, message: "Record deleted" });
  } catch (err) { next(err); }
};

// ── DELETE /api/history ──────────────────────────────────────
export const clearAllHistory = async (req, res, next) => {
  try {
    await deleteAllHistory(req.session.userId);
    res.json({ success: true, message: "All history cleared" });
  } catch (err) { next(err); }
};