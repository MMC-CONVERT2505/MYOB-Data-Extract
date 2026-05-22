import { findUserById } from "../services/userService.js";

// ── Middleware: Ensure user is authenticated ──────────────────
// Session stores only userId. This middleware fetches the full
// user from MongoDB and attaches it to req.dbUser.
// All downstream controllers/services use req.dbUser instead of req.session.

const requireAuth = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      error:   "Unauthorized",
      message: "Not authenticated. Please login first.",
    });
  }

  try {
    const user = await findUserById(req.session.userId);

    if (!user) {
      // Session exists but user was deleted from DB
      req.session.destroy(() => {});
      return res.status(401).json({
        error:   "Unauthorized",
        message: "Session invalid. Please login again.",
      });
    }

    // ✅ Attach full user to request — available in all controllers
    req.dbUser = user;
    next();
  } catch (err) {
    console.error("❌ requireAuth DB error:", err.message);
    res.status(500).json({ error: "Authentication check failed" });
  }
};

export default requireAuth;