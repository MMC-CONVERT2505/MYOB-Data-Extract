

import dotenv from "dotenv";
dotenv.config();

// ── API Key Type ─────────────────────────────────────────────
// OLD key (registered before March 2025) → scope = "CompanyFile"
//   These keys get full access with just "CompanyFile" scope.
//   BUT Purchase/Bill, Sale/Invoice etc. may need the key to have
//   those permissions enabled in the MYOB developer portal.
//
// NEW key (registered after March 2025) → scope = granular scopes
//   e.g. "sme-company-file sme-purchase sme-sale sme-customer ..."
//
// Set MYOB_API_KEY_TYPE=old or MYOB_API_KEY_TYPE=new in your .env file

const API_KEY_TYPE = process.env.MYOB_API_KEY_TYPE || "old";

// Old key: single scope (MYOB gives full access)
const OLD_SCOPES = "CompanyFile";

// New key: all granular scopes needed for full access
const NEW_SCOPES = [
  "sme-company-file",
  "sme-sale",
  "sme-purchase",
  "sme-customer",
  "sme-supplier",
  "sme-inventory",
  "sme-payroll",
  "sme-banking",
  "sme-journal",
  "sme-tax",
].join(" ");

const env = {
  PORT:           process.env.PORT || 3001,
  SESSION_SECRET: process.env.SESSION_SECRET || "myob-secret-change-this",
  FRONTEND_URL:   process.env.FRONTEND_URL || "http://localhost:1152",

  MYOB_CLIENT_ID:     process.env.MYOB_CLIENT_ID,
  MYOB_CLIENT_SECRET: process.env.MYOB_CLIENT_SECRET,
  MYOB_REDIRECT_URI:  process.env.MYOB_REDIRECT_URI || "http://localhost:3001/auth/callback",

  MYOB_AUTH_URL:  "https://secure.myob.com/oauth2/account/authorize",
  MYOB_TOKEN_URL: "https://secure.myob.com/oauth2/v1/authorize",
  MYOB_API_BASE:  "https://api.myob.com/accountright",

  MYOB_SCOPES: API_KEY_TYPE === "new" ? NEW_SCOPES : OLD_SCOPES,
};

const required = ["MYOB_CLIENT_ID", "MYOB_CLIENT_SECRET"];
const missing  = required.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing env variables: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`🔑 API Key Type: ${API_KEY_TYPE} | Scopes: ${env.MYOB_SCOPES}`);

export default env;