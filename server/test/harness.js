// Test harness: in-memory Mongo-like models + fake MYOB (axios) + real
// express app wiring (real routes/controllers/middleware/services).
import { mock } from "node:test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import crypto from "node:crypto";

const SRC = path.resolve(process.env.SRC_ROOT || new URL("../src", import.meta.url).pathname);
const u = (rel) => pathToFileURL(path.join(SRC, rel)).href;

process.env.MYOB_CLIENT_ID = "test-client";
process.env.MYOB_CLIENT_SECRET = "test-secret";
process.env.SESSION_SECRET = "x";
process.env.FRONTEND_URL = "http://frontend.test";
process.env.MYOB_REQUEST_POOL_SIZE = "2";

// ── tiny mongoose-like collection ────────────────────────────
const getPath = (o, k) => k.split(".").reduce((a, p) => (a == null ? a : a[p]), o);
const matches = (doc, filter) =>
  Object.entries(filter || {}).every(([k, cond]) => {
    const v = getPath(doc, k);
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      if ("$in" in cond) return cond.$in.map(String).includes(String(v));
      if ("$gt" in cond) return v > cond.$gt;
      if ("$lt" in cond) return v < cond.$lt;
    }
    return String(v) === String(cond) || (v == null && cond == null);
  });
const applySet = (doc, upd) => {
  const set = upd.$set || upd;
  for (const [k, val] of Object.entries(set)) {
    const parts = k.split(".");
    let o = doc;
    while (parts.length > 1) { const p = parts.shift(); o[p] = o[p] || {}; o = o[p]; }
    o[parts[0]] = val;
  }
};
const idStr = () => crypto.randomBytes(12).toString("hex");
function makeModel(defaults = {}) {
  const rows = [];
  const wrap = (d) => d && { ...d, _id: d._id, toString() { return this._id; } };
  const query = (list) => {
    let arr = list;
    const q = {
      sort(s) { const [[k, dir]] = Object.entries(s); arr = [...arr].sort((a, b) => (a[k] > b[k] ? 1 : -1) * dir); return q; },
      limit(n) { arr = arr.slice(0, n); return q; },
      skip(n) { arr = arr.slice(n); return q; },
      lean() { return q; },
      then(res, rej) { return Promise.resolve(arr.map((d) => d)).then(res, rej); },
    };
    return q;
  };
  const one = (list) => {
    let arr = list;
    const q = {
      sort(s) { const [[k, dir]] = Object.entries(s); arr = [...arr].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * dir); return q; },
      lean() { return q; },
      then(res, rej) { return Promise.resolve(arr[0] || null).then(res, rej); },
    };
    return q;
  };
  const M = {
    rows,
    async create(d) { const doc = { ...JSON.parse(JSON.stringify(defaults)), ...d, _id: idStr(), createdAt: new Date(), updatedAt: new Date() }; rows.push(doc); return doc; },
    async insertMany(ds) { for (const d of ds) rows.push({ ...d, _id: idStr(), createdAt: new Date() }); return ds; },
    find(f) { return query(rows.filter((r) => matches(r, f))); },
    findOne(f) { return one(rows.filter((r) => matches(r, f))); },
    findById(id) { return one(rows.filter((r) => r._id === String(id))); },
    findByIdAndUpdate(id, upd) { const d = rows.find((r) => r._id === String(id)); if (d) { applySet(d, upd); d.updatedAt = new Date(); } return one(d ? [d] : []); },
    findOneAndUpdate(f, upd, opts = {}) {
      let d = rows.find((r) => matches(r, f));
      if (!d && opts.upsert) { d = { ...JSON.parse(JSON.stringify(defaults)), _id: idStr(), createdAt: new Date() }; Object.assign(d, f); rows.push(d); }
      if (d) { applySet(d, upd); d.updatedAt = new Date(); }
      return one(d ? [d] : []);
    },
    async updateMany(f, upd) { const hit = rows.filter((r) => matches(r, f)); hit.forEach((d) => applySet(d, upd)); return { modifiedCount: hit.length }; },
    async deleteMany(f) { let n = 0; for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], f)) { rows.splice(i, 1); n++; } return { deletedCount: n }; },
    async countDocuments(f) { return rows.filter((r) => matches(r, f)).length; },
  };
  return M;
}

export const db = {
  User: makeModel({ companyFiles: [], businessId: null, businessName: null, businessUri: null }),
  ExtractionJob: makeModel({ progress: { fetched: 0, total: 0, percent: 0 }, status: "queued" }),
  SummaryJob: makeModel({ progress: { phase: "queued" }, status: "queued" }),
  ExtractionHistory: makeModel(),
  ExtractionCache: makeModel(),
  UserSettings: makeModel(),
};
const modelMock = (rel, M) => mock.module(u(rel), { defaultExport: M });
modelMock("models/User.model.js", db.User);
modelMock("models/ExtractionJob.model.js", db.ExtractionJob);
modelMock("models/SummaryJob.model.js", db.SummaryJob);
modelMock("models/ExtractionHistory.model.js", db.ExtractionHistory);
modelMock("models/ExtractionCache.model.js", db.ExtractionCache);
modelMock("models/UserSettings.model.js", db.UserSettings);

// ── fake MYOB ────────────────────────────────────────────────
export const guid = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const ACCOUNTS = {
  alice: { uid: "uid-alice", files: [{ Id: guid(1), Name: "Company A" }, { Id: guid(2), Name: "Company B" }, { Id: guid(3), Name: "Company C" }] },
  bob:   { uid: "uid-bob",   files: [{ Id: guid(4), Name: "Company D" }] },
};
for (const a of Object.values(ACCOUNTS)) a.files.forEach((f) => (f.Uri = `https://api.myob.com/accountright/${f.Id}`));
export const myobCalls = []; // { companyId, path }
export const myobState = { delayMs: 0, refreshSeq: 0, tokens: new Map(), refreshTokens: new Map() };
const issue = (acct) => {
  const n = ++myobState.refreshSeq;
  const at = `at-${acct}-${n}`, rt = `rt-${acct}-${n}`;
  myobState.tokens.set(at, acct); myobState.refreshTokens.set(rt, acct);
  return { access_token: at, refresh_token: rt, expires_in: 1200, user: { uid: ACCOUNTS[acct].uid } };
};
const authAcct = (cfg) => myobState.tokens.get((cfg.headers?.Authorization || "").replace("Bearer ", ""));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fakeRequest(cfg) {
  const url = new URL(cfg.url);
  const m = url.pathname.match(/^\/accountright\/([0-9a-f-]{36})(\/.*)$/i);
  const acct = authAcct(cfg);
  if (!acct) { const e = new Error("401"); e.response = { status: 401, data: { Message: "bad token" } }; throw e; }
  if (!m) { const e = new Error("404"); e.response = { status: 404, data: {} }; throw e; }
  const [, id, rest] = m;
  const file = ACCOUNTS[acct].files.find((f) => f.Id === id);
  if (!file) { const e = new Error("403 no access"); e.response = { status: 403, data: { Message: "no access" } }; throw e; }
  myobCalls.push({ companyId: id, path: rest, acct });
  if (myobState.delayMs) await sleep(myobState.delayMs);
  const skip = Number(url.searchParams.get("$skip") || 0);
  const mk = (kind, n = 3) => Array.from({ length: n }, (_, i) => ({ UID: `${file.Name}-${kind}-${i}`, CompanyName: `${file.Name} ${kind} ${i}`, Name: `${file.Name} ${kind} ${i}`, Number: `${i}`, __company: file.Name }));
  if (/AccountingProperties/.test(rest)) return { data: { CompanyName: file.Name } };
  const items = skip > 0 ? [] : mk(rest.split("/").pop().split("?")[0]);
  return { data: { Items: items, Count: items.length, NextPageLink: null } };
}
const axiosFake = Object.assign(async (cfg) => fakeRequest(cfg), {
  async post(url, body) {
    const p = new URLSearchParams(body);
    if (p.get("grant_type") === "authorization_code") {
      const code = p.get("code"); // code = "<account>"
      return { data: issue(code) };
    }
    const acct = myobState.refreshTokens.get(p.get("refresh_token"));
    if (!acct) { const e = new Error("invalid_grant"); e.response = { status: 400, data: {} }; throw e; }
    myobState.refreshTokens.delete(p.get("refresh_token")); // MYOB rotates refresh tokens
    const t = issue(acct); delete t.user; return { data: t };
  },
  async get(url, cfg) {
    const acct = authAcct(cfg);
    if (!acct) { const e = new Error("401"); e.response = { status: 401, data: {} }; throw e; }
    return { data: ACCOUNTS[acct].files.map((f) => ({ ...f })) };
  },
});
mock.module("axios", { defaultExport: axiosFake });

// ── real app, real code ───────────────────────────────────────
const express = (await import("express")).default;
const session = (await import("express-session")).default;
const authRoutes = (await import(u("routes/authRoutes.js"))).default;
const extractionRoutes = (await import(u("routes/extractionRoutes.js"))).default;
const summaryRoutes = (await import(u("routes/summaryRoutes.js"))).default;
const downloadRoutes = (await import(u("routes/downloadRoutes.js"))).default;
const invoiceRoutes = (await import(u("routes/invoiceRoutes.js"))).default;

export function startApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "t", resave: false, saveUninitialized: false, cookie: { secure: false } }));
  app.use("/auth", authRoutes);
  app.use("/api/extract", extractionRoutes);
  app.use("/api/summary", summaryRoutes);
  app.use("/api/download", downloadRoutes);
  app.use("/api/invoices", invoiceRoutes);
  app.use((err, req, res, _n) => res.status(err.status || 500).json({ error: err.message, code: err.code }));
  return new Promise((resolve) => { const s = app.listen(0, () => resolve({ server: s, base: `http://127.0.0.1:${s.address().port}` })); });
}

// A "browser": own cookie jar, optional tab-level company header
export class Browser {
  constructor(base) { this.base = base; this.cookie = ""; this.companyHeader = null; }
  async req(method, url, body, headers = {}) {
    const h = { "content-type": "application/json", ...headers };
    if (this.cookie) h.cookie = this.cookie;
    if (this.companyHeader) h["x-company-id"] = this.companyHeader;
    const res = await fetch(this.base + url, { method, headers: h, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    const sc = res.headers.get("set-cookie"); if (sc) this.cookie = sc.split(";")[0];
    const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }
  get(u2, h) { return this.req("GET", u2, null, h); }
  post(u2, b, h) { return this.req("POST", u2, b, h); }
  login(account) { return this.get(`/auth/callback?code=${account}`); }
  async select(id) { const r = await this.post("/auth/select-company", { businessId: id }); if (r.status === 200) this.companyHeader = id; return r; }
  async waitJob(kind, jobId) {
    for (let i = 0; i < 200; i++) {
      const r = await this.get(`/api/${kind}/status/${jobId}`);
      if (["successful", "failed"].includes(r.json?.status)) return r.json;
      await sleep(25);
    }
    throw new Error("job timeout");
  }
}
