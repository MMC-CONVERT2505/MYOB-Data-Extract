import { findUserById } from "../services/userService.js";
import { resolveSessionCompany, buildRequestUser, isValidCompanyId } from "../services/companyContext.js";

// ── Middleware: Ensure user is authenticated ──────────────────
// Session stores the user's DB _id AND this browser session's selected
// company file. req.dbUser = DB user (tokens) + the session's validated
// company. The company is NEVER read from the shared User document, so
// two sessions of the same MYOB account cannot affect each other.
//
// Clients send X-Company-Id (the company they believe they are looking
// at). If it differs from the session's company (e.g. another tab
// switched it) the request is rejected instead of silently running
// against a different company.

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
      req.session.destroy(() => {});
      return res.status(401).json({
        error:   "Unauthorized",
        message: "Session invalid. Please login again.",
      });
    }

    const company = resolveSessionCompany(user, req.session.company);
    req.dbUser = buildRequestUser(user, company);

    const claimed = req.get("x-company-id");
    if (claimed && isValidCompanyId(claimed)) {
      if (!company || claimed.toLowerCase() !== company.businessId.toLowerCase()) {
        console.warn(
          `⚠️ Company mismatch ${req.method} ${req.path}: client=${claimed} session=${company?.businessId || "none"} user=${req.session.userId}`
        );
        return res.status(409).json({
          error: "The selected company file changed in another tab or session. Please reload the page.",
          code:  "COMPANY_MISMATCH",
          activeBusinessId: company?.businessId || null,
        });
      }
    }

    next();
  } catch (err) {
    console.error("❌ requireAuth DB error:", err.message);
    res.status(500).json({ error: "Authentication check failed" });
  }
};

export default requireAuth;
