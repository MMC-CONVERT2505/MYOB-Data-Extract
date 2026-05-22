import { getApiUsage } from "../services/apiUsageService.js";

// ── GET /api/usage ────────────────────────────────────────────
// Returns today's API usage stats for the logged-in user.
// Frontend polls this to show usage bar + warning messages.
// export const getUsage = async (req, res, next) => {
//   try {
//     const usage = await getApiUsage(req.session.userId);
//     res.json(usage);
//   } catch (err) {
//     next(err);
//   }
// };


export const getUsage = async(req, res, next) => {
  try {
    const usage = await getApiUsage(req.session.userId);
    res.json(usage)
  } catch (error) {
    next( error)
  }
}