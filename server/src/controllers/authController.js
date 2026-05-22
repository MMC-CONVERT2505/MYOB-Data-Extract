import env from "../config/env.js";
import { exchangeCodeForTokens } from "../services/myobService.js";
import { upsertUser, updateUserCompany, findUserById } from "../services/userService.js";
import axios from "axios";

// ── GET /auth/login ──────────────────────────────────────────
export const login = (req, res) => {
  const authUrl = new URL(env.MYOB_AUTH_URL);
  authUrl.searchParams.set("client_id",     env.MYOB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri",  env.MYOB_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope",         env.MYOB_SCOPES);
  authUrl.searchParams.set("prompt",        "consent");

  console.log("🔐 Redirecting to MYOB login...");
  res.redirect(authUrl.toString());
};

// ── GET /auth/callback ───────────────────────────────────────
export const callback = async (req, res) => {
  const { code, businessId, businessName, error } = req.query;

  if (error) {
    console.error("❌ OAuth error:", error);
    return res.redirect(`${env.FRONTEND_URL}/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(
      `${env.FRONTEND_URL}/?auth_error=${encodeURIComponent("No authorization code received")}`
    );
  }

  try {
    console.log("🔄 Exchanging code for tokens...");
    const tokens = await exchangeCodeForTokens(code);

    const tokenExpiresAt = Date.now() + (tokens.expires_in || 1200) * 1000;

    // ── Extract MYOB user ID from token if available ─────────
    // Some MYOB token responses include a `user` object or `uid`
    const myobUserId =
      tokens.user?.uid ||
      tokens.uid       ||
      tokens.user_id   ||
      null;

    // ── Base user payload ─────────────────────────────────────
    let userPayload = {
      myobUserId,
      accessToken:    tokens.access_token,
      refreshToken:   tokens.refresh_token,
      tokenExpiresAt,
    };

    if (businessId) {
      // New API key — company info came in query params
      userPayload.businessId   = businessId;
      userPayload.businessName = decodeURIComponent(businessName || "");
      console.log(`✅ Auth success! Company: ${userPayload.businessName}`);
    } else {
      // Old API key — fetch company files from MYOB
      console.log("🔄 Old API key — fetching company files...");
      try {
        const filesRes = await axios.get(`${env.MYOB_API_BASE}/`, {
          headers: {
            Authorization:       `Bearer ${tokens.access_token}`,
            "x-myobapi-key":     env.MYOB_CLIENT_ID,
            "x-myobapi-version": "v2",
            Accept:              "application/json",
          },
        });

        const files = filesRes.data;
        console.log("📁 Company files found:", files?.length || 0);

        if (files && files.length > 0) {
          userPayload.businessId   = files[0].Id;
          userPayload.businessName = files[0].Name;
          userPayload.businessUri  = files[0].Uri || null;
          userPayload.companyFiles = files;
          console.log(`✅ Auto-selected company: ${files[0].Name} (${files[0].Id})`);
        } else {
          console.warn("⚠️ No company files found");
        }
      } catch (fileErr) {
        console.error("❌ Failed to fetch company files:", fileErr.message);
      }
    }

    // ── Save / update user in MongoDB ─────────────────────────
    const user = await upsertUser(userPayload);
    console.log(`💾 User saved to DB: ${user._id}`);

    // ── Store ONLY the user's DB _id in session ───────────────
    req.session.userId = user._id.toString();

    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error("❌ Token exchange failed:", err.message);
    res.redirect(`${env.FRONTEND_URL}/?auth_error=${encodeURIComponent(err.message)}`);
  }
};

// ── GET /auth/status ─────────────────────────────────────────
export const status = async (req, res) => {
  if (!req.session?.userId) {
    return res.json({ authenticated: false });
  }

  try {
    const user = await findUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      businessId:    user.businessId,
      businessName:  user.businessName,
      businessUri:   user.businessUri || null,
      companyFiles:  user.companyFiles || null,
      tokenExpiresAt: user.tokenExpiresAt,
    });
  } catch (err) {
    console.error("❌ /auth/status DB error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── GET /auth/logout ─────────────────────────────────────────
export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.json({ success: true, message: "Logged out successfully" });
  });
};

// ── GET /auth/company-files ──────────────────────────────────
export const getCompanyFiles = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const user = await findUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const filesRes = await axios.get(`${env.MYOB_API_BASE}/`, {
      headers: {
        Authorization:       `Bearer ${user.accessToken}`,
        "x-myobapi-key":     env.MYOB_CLIENT_ID,
        "x-myobapi-version": "v2",
        Accept:              "application/json",
      },
    });
    res.json(filesRes.data);
  } catch (err) {
    next(err);
  }
};

// ── POST /auth/select-company ────────────────────────────────
export const selectCompany = async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { businessId, businessName, businessUri } = req.body;
  if (!businessId) {
    return res.status(400).json({ error: "businessId is required" });
  }

  try {
    await updateUserCompany(req.session.userId, { businessId, businessName, businessUri });
    console.log(`✅ Company selected: ${businessName} (${businessId})`);
    res.json({ success: true, businessId, businessName, businessUri });
  } catch (err) {
    console.error("❌ selectCompany DB error:", err.message);
    res.status(500).json({ error: "Failed to update company" });
  }
};