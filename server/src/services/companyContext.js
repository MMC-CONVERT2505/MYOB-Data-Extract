/**
 * companyContext.js
 *
 * Single source of truth for "which MYOB company file is this request /
 * job working on?".
 *
 * Background (root cause of the wrong-company bug): the selected company
 * used to be stored on the shared User document (one per MYOB account),
 * so every browser/tab/session logged in with the same MYOB account read
 * and wrote the SAME selection, and every OAuth login silently reset it
 * to files[0]. The selection now lives on the express-session (one per
 * browser login), is validated against the company files MYOB actually
 * returned for that account, and is copied onto each background job when
 * the job is created.
 */

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidCompanyId = (id) => typeof id === "string" && GUID_RE.test(id);

export class CompanyMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = "CompanyMismatchError";
    this.status = 409;
    this.code = "COMPANY_MISMATCH";
  }
}

const sameId = (a, b) =>
  typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

/**
 * Find a company file in the account's authoritative list (as returned by
 * MYOB). Returns { businessId, businessName, businessUri } or null.
 * Name / Uri always come from the list, never from the client.
 */
export function findCompanyInList(companyFiles, businessId) {
  if (!Array.isArray(companyFiles) || !businessId) return null;
  const f = companyFiles.find((c) => sameId(c?.Id, businessId));
  if (!f) return null;
  return { businessId: f.Id, businessName: f.Name || "", businessUri: f.Uri || null };
}

/**
 * Resolve the company a session has selected, validated against the
 * user's known company files. Returns null when nothing valid is
 * selected - callers must NOT fall back to another file.
 *
 * When the account has no stored list (new-style API keys hand back the
 * business id in the OAuth redirect and never list files) the session
 * value, which was set from MYOB's own redirect, is trusted as-is.
 */
export function resolveSessionCompany(user, sessionCompany) {
  if (!sessionCompany?.businessId || !isValidCompanyId(sessionCompany.businessId)) return null;
  if (Array.isArray(user?.companyFiles) && user.companyFiles.length > 0) {
    return findCompanyInList(user.companyFiles, sessionCompany.businessId);
  }
  return {
    businessId: sessionCompany.businessId,
    businessName: sessionCompany.businessName || "",
    businessUri: sessionCompany.businessUri || null,
  };
}

/** Per-request user object: DB user (tokens, ids) + THIS session's company. */
export function buildRequestUser(user, company) {
  return {
    ...user,
    businessId: company?.businessId || null,
    businessName: company?.businessName || null,
    businessUri: company?.businessUri || null,
  };
}

/**
 * Bind a background job to the company it was created for.
 *  - verifies the user snapshot handed to the worker is for that company
 *  - returns a private copy of the user whose company fields come from the
 *    JOB document, so nothing that happens to the session/user later
 *    (switching company, re-login) can change what the job talks to.
 */
export function bindJobToCompany(job, dbUser) {
  if (!job?.businessId || !isValidCompanyId(job.businessId)) {
    throw new CompanyMismatchError("Job has no valid company file id; refusing to run.");
  }
  if (!sameId(job.businessId, dbUser?.businessId)) {
    throw new CompanyMismatchError(
      `Company mismatch: job targets ${job.businessId} but the connection resolved ${dbUser?.businessId || "none"}. Processing stopped.`
    );
  }
  return {
    ...dbUser,
    businessId: job.businessId,
    businessName: job.businessName || dbUser.businessName || "",
    businessUri: job.businessUri || dbUser.businessUri || null,
  };
}

/**
 * Turn a MYOB NextPageLink into a company-relative endpoint, verifying the
 * link really belongs to the expected company file.
 */
export function relativeEndpointFromNextLink(nextPageLink, businessId) {
  const u = new URL(nextPageLink);
  const parts = u.pathname.split("/");
  const idx = parts.findIndex((p) => sameId(p, businessId));
  if (idx === -1) {
    throw new CompanyMismatchError(
      `MYOB NextPageLink does not belong to company ${businessId}; pagination stopped.`
    );
  }
  return "/" + parts.slice(idx + 1).join("/") + u.search;
}

/** Safe log tag: ids and names only - never tokens or secrets. */
export const companyTag = (obj) =>
  `company=${obj?.businessName || "?"} companyFileId=${obj?.businessId || "none"}`;

/**
 * Pre-flight check run by every background worker before it touches MYOB:
 *  1. job/user company ids must agree (bindJobToCompany)
 *  2. the company must still be one of the files MYOB lists for the
 *     account that owns the connection (when a list is known)
 * Returns the job-bound user copy; throws CompanyMismatchError otherwise.
 */
export function verifyJobCompany(job, dbUser, latestUser) {
  const bound = bindJobToCompany(job, dbUser);
  const list = latestUser?.companyFiles;
  if (Array.isArray(list) && list.length > 0 && !findCompanyInList(list, job.businessId)) {
    throw new CompanyMismatchError(
      `Company file ${job.businessId} is not available for the connected MYOB account. Processing stopped.`
    );
  }
  return bound;
}
