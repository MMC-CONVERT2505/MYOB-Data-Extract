import UserSettings from "../models/UserSettings.model.js";

// ── Today's date string "YYYY-MM-DD" ─────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];

// ── Increment API call counter for a user ────────────────────
// Called from myobService on every MYOB API request.
// Auto-resets counter if it's a new day.
export const incrementApiCount = async (userId) => {
  try {
    const today = todayStr();

    // Find existing settings
    const settings = await UserSettings.findOne({ userId });

    if (!settings) {
      // First time — create with count = 1
      await UserSettings.create({
        userId,
        dailyApiCount: 1,
        lastApiDate:   today,
      });
      return;
    }

    // New day → reset counter
    if (settings.lastApiDate !== today) {
      await UserSettings.findOneAndUpdate(
        { userId },
        { $set: { dailyApiCount: 1, lastApiDate: today } }
      );
    } else {
      // Same day → increment
      await UserSettings.findOneAndUpdate(
        { userId },
        { $inc: { dailyApiCount: 1 } }
      );
    }
  } catch (err) {
    // Don't crash the main request if counter fails
    console.error("⚠️ apiUsage increment error:", err.message);
  }
};

// ── Get current usage for a user ─────────────────────────────
export const getApiUsage = async (userId) => {
  try {
    const today    = todayStr();
    let settings   = await UserSettings.findOne({ userId }).lean();

    // No settings yet → defaults
    if (!settings) {
      return {
        used:      0,
        limit:     500,
        remaining: 500,
        percent:   0,
        resetDate: today,
        isNewDay:  true,
      };
    }

    // New day → count is effectively 0
    const isNewDay = settings.lastApiDate !== today;
    const used     = isNewDay ? 0 : (settings.dailyApiCount || 0);
    const limit    = settings.dailyApiLimit || 500;
    const remaining = Math.max(0, limit - used);
    const percent   = Math.min(100, Math.round((used / limit) * 100));

    return {
      used,
      limit,
      remaining,
      percent,
      resetDate: today,
      isNewDay,
      // Warning levels for frontend
      warning:  remaining <= 20 && remaining > 0,   // show yellow warning
      critical: remaining === 0,                     // show red — limit hit
    };
  } catch (err) {
    console.error("⚠️ getApiUsage error:", err.message);
    return { used: 0, limit: 500, remaining: 500, percent: 0 };
  }
};