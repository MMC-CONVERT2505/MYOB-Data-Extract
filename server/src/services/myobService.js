import axios from "axios";
import env from "../config/env.js";
import { updateUserTokens } from "./userService.js";
import { incrementApiCount } from "./apiUsageService.js";

// ── Exchange authorization code for tokens ───────────────────
export const exchangeCodeForTokens = async (code) => {
  const params = new URLSearchParams({
    client_id:     env.MYOB_CLIENT_ID,
    client_secret: env.MYOB_CLIENT_SECRET,
    code,
    redirect_uri:  env.MYOB_REDIRECT_URI,
    grant_type:    "authorization_code",
    scope:         env.MYOB_SCOPES,
  });

  const { data } = await axios.post(env.MYOB_TOKEN_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return data;
};

// ── Refresh expired access token ─────────────────────────────
export const refreshAccessToken = async (refreshToken) => {
  const params = new URLSearchParams({
    client_id:     env.MYOB_CLIENT_ID,
    client_secret: env.MYOB_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type:    "refresh_token",
  });

  const { data } = await axios.post(env.MYOB_TOKEN_URL, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return data;
};

// ── Get valid access token (auto-refresh if expired) ─────────
export const getValidToken = async (dbUser, userId) => {
  if (!dbUser?.accessToken) {
    const err = new Error("Not authenticated. Please login first.");
    err.status = 401;
    throw err;
  }

  const now       = Date.now();
  const expiresAt = dbUser.tokenExpiresAt || 0;

  // Refresh 2 minutes before expiry
  if (now >= expiresAt - 2 * 60 * 1000) {
    console.log("🔄 Access token expired — refreshing...");
    try {
      const newTokens      = await refreshAccessToken(dbUser.refreshToken);
      const tokenExpiresAt = Date.now() + (newTokens.expires_in || 1200) * 1000;

      await updateUserTokens(userId, {
        accessToken:  newTokens.access_token,
        refreshToken: newTokens.refresh_token,
        tokenExpiresAt,
      });

      dbUser.accessToken    = newTokens.access_token;
      dbUser.refreshToken   = newTokens.refresh_token;
      dbUser.tokenExpiresAt = tokenExpiresAt;

      console.log("✅ Token refreshed and saved to DB");
    } catch (refreshErr) {
      console.error("❌ Token refresh failed:", refreshErr.message);
      const err = new Error("Session expired. Please login again.");
      err.status = 401;
      throw err;
    }
  }

  return dbUser.accessToken;
};

// ── Get correct API base URL ──────────────────────────────────
const getApiBase = (dbUser) => {
  if (dbUser.businessUri) {
    const match = dbUser.businessUri.match(/^(https:\/\/[^/]+\/accountright)/);
    if (match) return match[1];
  }
  return env.MYOB_API_BASE;
};

// ── Make authenticated MYOB API request ──────────────────────
// ✅ Now increments dailyApiCount in DB on every successful call
export const myobRequest = async (dbUser, userId, method, endpoint, body = null) => {
  const accessToken = await getValidToken(dbUser, userId);

  if (!dbUser.businessId) {
    const err = new Error("No company file selected.");
    err.status = 400;
    throw err;
  }

  const apiBase = getApiBase(dbUser);
  const url     = `${apiBase}/${dbUser.businessId}${endpoint}`;

  const config = {
    method,
    url,
    headers: {
      Authorization:       `Bearer ${accessToken}`,
      "x-myobapi-key":     env.MYOB_CLIENT_ID,
      "x-myobapi-version": "v2",
      "Content-Type":      "application/json",
      Accept:              "application/json",
    },
  };

  if (body) config.data = body;

  try {
    const { data } = await axios(config);

    // ✅ Count every successful MYOB API call
    // Fire-and-forget — don't await to keep response fast
    incrementApiCount(userId).catch(() => {});

    return data;
  } catch (axiosErr) {
    const status  = axiosErr.response?.status || 500;
    const message =
      axiosErr.response?.data?.Message ||
      axiosErr.response?.data?.message ||
      axiosErr.message;
    console.error(`❌ MYOB API [${status}] ${endpoint}:`, message);
    const err = new Error(message);
    err.status = status;
    throw err;
  }
};