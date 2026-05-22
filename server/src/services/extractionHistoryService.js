import ExtractionHistory from "../models/ExtractionHistory.model.js";

// ── Get history for a user (paginated) ───────────────────────
export const getExtractionHistory = async (userId, { page = 1, limit = 20, dataType } = {}) => {
  const filter = { userId };
  if (dataType) filter.dataType = dataType;

  const skip  = (page - 1) * limit;
  const total = await ExtractionHistory.countDocuments(filter);
  const items = await ExtractionHistory.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return { items, total, page, totalPages: Math.ceil(total / limit), hasMore: page * limit < total };
};

// ── Get single extraction record ─────────────────────────────
export const getExtractionById = async (id, userId) =>
  ExtractionHistory.findOne({ _id: id, userId }).lean();

// ── Delete a single extraction record ────────────────────────
export const deleteExtractionById = async (id, userId) =>
  ExtractionHistory.findOneAndDelete({ _id: id, userId });

// ── Delete all history for a user ────────────────────────────
export const deleteAllHistory = async (userId) =>
  ExtractionHistory.deleteMany({ userId });