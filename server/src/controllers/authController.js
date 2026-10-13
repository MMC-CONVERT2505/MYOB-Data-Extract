import env from "../config/env.js";
import { exchangeCodeForTokens, getValidToken } from "../services/myobService.js";
import { upsertUser, updateCompanyFiles, findUserById } from "../services/userService.js";
import {
  findCompanyInList,
  resolveSessionCompany,
  isValidCompanyId,
} from "../services/companyContext.js";
import axios from "axios";

const saveSession = (req) =>
  new Promise((resolve, reject) => req.session.save((e) => (e ? reject(e) : resolve())));

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
    // The selected company is NOT part of the stored user: it belongs to
    // this browser session only (see companyContext.js).
    const userPayload = {
      myobUserId,
      accessToken:    tokens.access_token,
      refreshToken:   tokens.refresh_token,
      tokenExpiresAt,
      companyFiles:   null,
    };

    let candidateCompany = null; // company handed to us directly by MYOB

    if (businessId) {
      // New API key — company info came in query params
      if (isValidCompanyId(businessId)) {
        candidateCompany = {
          businessId,
          businessName: decodeURIComponent(businessName || ""),
          businessUri:  null,
        };
        // New-style keys never list files; clear any stale list so the
        // session company (taken from MYOB's own redirect) is trusted.
        userPayload.companyFiles = [];
        console.log(`✅ Auth success! Company: ${candidateCompany.businessName} (${businessId})`);
      } else {
        console.warn("⚠️ OAuth callback returned a malformed businessId; ignoring it");
      }
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

        const files = Array.isArray(filesRes.data) ? filesRes.data : [];
        console.log("📁 Company files found:", files.length);
        userPayload.companyFiles = files.map((f) => ({ Id: f.Id, Name: f.Name, Uri: f.Uri || null }));
      } catch (fileErr) {
        console.error("❌ Failed to fetch company files:", fileErr.message);
      }
    }

    // ── Save / update user in MongoDB ─────────────────────────
    const user = await upsertUser(userPayload);
    console.log(`💾 User saved to DB: ${user._id}`);

    // ── Decide this SESSION's company (no silent "first file" fallback) ──
    //  1. company handed over by MYOB in the redirect (new API keys)
    //  2. the company this same user already had selected in this session
    //     (re-connect / token re-auth must not change the intended company)
    //  3. the only company file, if the account has exactly one
    //  4. otherwise nothing: the user must pick explicitly
    const sameUserAsBefore = req.session.userId === user._id.toString();
    let company = null;
    if (candidateCompany) {
      company = candidateCompany;
    } else if (sameUserAsBefore && req.session.company?.businessId) {
      company = findCompanyInList(user.companyFiles, req.session.company.businessId);
    }
    if (!company && Array.isArray(user.companyFiles) && user.companyFiles.length === 1) {
      company = findCompanyInList(user.companyFiles, user.companyFiles[0].Id);
    }

    // ── Store ONLY the user's DB _id + this session's company ──
    req.session.userId  = user._id.toString();
    req.session.company = company;
    await saveSession(req);
    console.log(
      `🔗 Session connected: user=${user._id} company=${company ? `${company.businessName} (${company.businessId})` : "none selected"}`
    );

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

    const company = resolveSessionCompany(user, req.session.company);
    res.json({
      authenticated: true,
      businessId:    company?.businessId   || null,
      businessName:  company?.businessName || null,
      businessUri:   company?.businessUri  || null,
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

    // Refreshes the access token if needed (the old code sent a possibly
    // expired token here) and refreshes the stored authoritative list.
    const accessToken = await getValidToken(user, req.session.userId);
    const filesRes = await axios.get(`${env.MYOB_API_BASE}/`, {
      headers: {
        Authorization:       `Bearer ${accessToken}`,
        "x-myobapi-key":     env.MYOB_CLIENT_ID,
        "x-myobapi-version": "v2",
        Accept:              "application/json",
      },
    });
    const files = Array.isArray(filesRes.data) ? filesRes.data : [];
    await updateCompanyFiles(
      req.session.userId,
      files.map((f) => ({ Id: f.Id, Name: f.Name, Uri: f.Uri || null }))
    );
    res.json(files);
  } catch (err) {
    next(err);
  }
};

// ── POST /auth/select-company ────────────────────────────────
export const selectCompany = async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Only the id is trusted from the client. Name and Uri are taken from the
  // company list MYOB returned for this account, so id / name / uri can
  // never disagree and an arbitrary id can never be selected.
  const { businessId } = req.body || {};
  if (!businessId || !isValidCompanyId(businessId)) {
    return res.status(400).json({ error: "A valid businessId is required" });
  }

  try {
    const user = await findUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "User not found" });

    const company = findCompanyInList(user.companyFiles, businessId);
    if (!company) {
      return res.status(404).json({
        error: "That company file is not available for this MYOB account. Reload the company list and try again.",
      });
    }

    req.session.company = company;
    await saveSession(req);
    console.log(`✅ Company selected: user=${user._id} company=${company.businessName} (${company.businessId})`);
    res.json({ success: true, ...company });
  } catch (err) {
    console.error("❌ selectCompany error:", err.message);
    res.status(500).json({ error: "Failed to update company" });
  }
};
