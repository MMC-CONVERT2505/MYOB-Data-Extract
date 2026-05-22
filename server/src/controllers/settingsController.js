import { getUserSettings, updateUserSettings } from "../services/userSettingsService.js";

// ── GET /api/settings ────────────────────────────────────────
export const getSettings = async (req, res, next) => {
  try {
    const settings = await getUserSettings(req.session.userId);
    res.json(settings);
  } catch (err) { next(err); }
};

// ── PUT /api/settings ────────────────────────────────────────
export const saveSettings = async (req, res, next) => {
  try {
    const settings = await updateUserSettings(req.session.userId, req.body);
    res.json({ success: true, settings });
  } catch (err) { next(err); }
};