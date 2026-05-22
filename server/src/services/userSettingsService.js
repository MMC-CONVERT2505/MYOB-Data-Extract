import UserSettings from "../models/UserSettings.model.js";

// ── Get settings for a user (create defaults if not exists) ──
export const getUserSettings = async (userId) => {
  let settings = await UserSettings.findOne({ userId }).lean();

  // Auto-create default settings on first access
  if (!settings) {
    settings = await UserSettings.create({ userId });
    settings = settings.toObject();
  }

  return settings;
};

// ── Update settings (partial update supported) ───────────────
export const updateUserSettings = async (userId, updates) => {
  // Whitelist allowed fields
  const allowed = ["defaultOutputFormat", "defaultDateRange", "defaultDataType", "defaultSubType"];
  const safeUpdates = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }

  const settings = await UserSettings.findOneAndUpdate(
    { userId },
    { $set: safeUpdates },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return settings;
};