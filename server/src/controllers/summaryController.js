import {
  getFileProfile,
  getTransactionCounts,
  getFullSummary,
} from "../services/summaryService.js";

const getAuth = (req) => ({
  dbUser: req.dbUser,
  userId: req.session.userId,
});

// GET /api/summary/profile — COA counts, banks/credit cards, flags
export const profile = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const { profile } = await getFileProfile(dbUser, userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
};

// POST /api/summary/transactions — { startDate, endDate }
export const transactions = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const { startDate, endDate } = req.body || {};
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "startDate and endDate are required." },
      });
    }
    const data = await getTransactionCounts(dbUser, userId, { startDate, endDate });
    delete data._bills;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// POST /api/summary — full summary { startDate?, endDate?, accountingBasis?, inception? }
export const full = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const { startDate, endDate, accountingBasis, inception } = req.body || {};
    const data = await getFullSummary(dbUser, userId, { startDate, endDate, accountingBasis, inception });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};