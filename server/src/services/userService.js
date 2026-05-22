import User from "../models/User.model.js";

// ── Upsert user after successful OAuth login ──────────────────
// Called from authController after token exchange.
// Returns the saved User document.
export const upsertUser = async ({
  myobUserId,
  accessToken,
  refreshToken,
  tokenExpiresAt,
  businessId   = null,
  businessName = null,
  businessUri  = null,
  companyFiles = [],
}) => {
  // If MYOB gives us a stable user ID, use it as the unique key.
  // Otherwise fall back to refreshToken (stable across access token refreshes).
  const filter = myobUserId
    ? { myobUserId }
    : { refreshToken };

  const update = {
    $set: {
      accessToken,
      refreshToken,
      tokenExpiresAt,
      lastLoginAt: new Date(),
      ...(myobUserId   && { myobUserId }),
      ...(businessId   && { businessId }),
      ...(businessName && { businessName }),
      ...(businessUri  && { businessUri }),
      ...(companyFiles.length && { companyFiles }),
    },
  };

  const user = await User.findOneAndUpdate(filter, update, {
    new:    true,  // return updated doc
    upsert: true,  // create if not found
    setDefaultsOnInsert: true,
  });

  return user;
};

// ── Find user by MongoDB _id ──────────────────────────────────
export const findUserById = async (userId) => {
  return User.findById(userId).lean();
};

// ── Update tokens after refresh ──────────────────────────────
export const updateUserTokens = async (userId, { accessToken, refreshToken, tokenExpiresAt }) => {
  return User.findByIdAndUpdate(
    userId,
    { $set: { accessToken, refreshToken, tokenExpiresAt } },
    { new: true }
  ).lean();
};

// ── Update selected company ───────────────────────────────────
export const updateUserCompany = async (userId, { businessId, businessName, businessUri }) => {
  return User.findByIdAndUpdate(
    userId,
    { $set: { businessId, businessName, businessUri } },
    { new: true }
  ).lean();
};

// ── Update company files list ─────────────────────────────────
export const updateCompanyFiles = async (userId, companyFiles) => {
  return User.findByIdAndUpdate(
    userId,
    { $set: { companyFiles } },
    { new: true }
  ).lean();
};

// ── Delete user (logout cleanup — optional) ───────────────────
export const deleteUser = async (userId) => {
  return User.findByIdAndDelete(userId);
};