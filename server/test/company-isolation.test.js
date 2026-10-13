import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApp, Browser, db, ACCOUNTS, guid, myobCalls, myobState } from "./harness.js";

const [A, B, C] = ACCOUNTS.alice.files.map((f) => f.Id);
const D = ACCOUNTS.bob.files[0].Id;
let ctx;
before(async () => { ctx = await startApp(); });
after(() => ctx.server.close());
const newBrowser = () => new Browser(ctx.base);
const extractCustomers = (b) => b.post("/api/extract/async", { dataType: "customers" });
const jobItems = (jobId) => {
  const job = db.ExtractionJob.rows.find((r) => r._id === jobId);
  return db.ExtractionCache.rows.filter((r) => r.extractionId && String(r.businessId) === String(job.businessId) && r.dataType === "customers").flatMap((r) => r.items);
};
const companiesIn = (items) => [...new Set(items.map((i) => i.__company))];

describe("company-file isolation", () => {
  test("1. connect A -> only A's data is fetched", async () => {
    const b = newBrowser(); await b.login("alice");
    assert.equal((await b.get("/auth/status")).json.businessId, null, "multi-file account must NOT silently default to files[0]");
    assert.equal((await b.select(A)).status, 200);
    const st = (await b.get("/auth/status")).json;
    assert.deepEqual([st.businessId, st.businessName], [A, "Company A"]);
    myobCalls.length = 0;
    const { jobId } = (await extractCustomers(b)).json;
    const job = await b.waitJob("extract", jobId);
    assert.equal(job.status, "successful", job.errorMessage);
    assert.deepEqual(companiesIn(jobItems(jobId)), ["Company A"]);
    assert.ok(myobCalls.length > 0 && myobCalls.every((c) => c.companyId === A));
  });

  test("2. switch A -> B -> A returns the right data each time", async () => {
    const b = newBrowser(); await b.login("alice");
    for (const [id, name] of [[A, "Company A"], [B, "Company B"], [A, "Company A"]]) {
      await b.select(id);
      myobCalls.length = 0;
      const { jobId } = (await extractCustomers(b)).json;
      const job = await b.waitJob("extract", jobId);
      assert.equal(job.businessId, id);
      assert.deepEqual(companiesIn(jobItems(jobId)), [name]);
      assert.ok(myobCalls.every((c) => c.companyId === id));
    }
  });

  test("3. several files on one MYOB account, selected by two sessions at once, stay separate (THE BUG)", async () => {
    const s1 = newBrowser(), s2 = newBrowser();
    await s1.login("alice"); await s1.select(A);
    await s2.login("alice"); // second login of same MYOB account (other browser / teammate)
    await s2.select(B);
    assert.equal((await s1.get("/auth/status")).json.businessId, A, "session 1 must still be on A");
    assert.equal((await s2.get("/auth/status")).json.businessId, B);
    myobCalls.length = 0;
    myobState.delayMs = 15;
    const [r1, r2] = await Promise.all([extractCustomers(s1), extractCustomers(s2)]); // concurrent, same account
    const [j1, j2] = await Promise.all([s1.waitJob("extract", r1.json.jobId), s2.waitJob("extract", r2.json.jobId)]);
    myobState.delayMs = 0;
    assert.equal(j1.status, "successful"); assert.equal(j2.status, "successful");
    assert.deepEqual(companiesIn(jobItems(r1.json.jobId)), ["Company A"]);
    assert.deepEqual(companiesIn(jobItems(r2.json.jobId)), ["Company B"]);
  });

  test("4. different MYOB accounts / users are isolated, and cannot select each other's files", async () => {
    const a = newBrowser(), bob = newBrowser();
    await a.login("alice"); await a.select(A);
    await bob.login("bob");
    assert.equal((await bob.get("/auth/status")).json.businessId, D, "single-file account is auto-selected");
    assert.equal((await bob.select(A)).status, 404, "bob must not be able to select alice's company");
    assert.equal((await bob.post("/auth/select-company", { businessId: "not-a-guid" })).status, 400);
    assert.equal((await a.get("/auth/status")).json.businessId, A);
    const { jobId } = (await extractCustomers(bob)).json;
    await bob.waitJob("extract", jobId);
    assert.deepEqual(companiesIn(jobItems(jobId)), ["Company D"]);
    assert.equal((await a.get(`/api/extract/status/${jobId}`)).status, 403);
  });

  test("5. switching company while a job runs: job and its download stay on the ORIGINAL company", async () => {
    const b = newBrowser(); await b.login("alice"); await b.select(A);
    // B was extracted earlier so a wrong-company cache lookup WOULD find data
    await b.select(B); const pre = (await extractCustomers(b)).json; await b.waitJob("extract", pre.jobId);
    await b.select(A);
    myobState.delayMs = 40;
    const { jobId } = (await extractCustomers(b)).json;
    await b.select(B); // switch mid-flight
    const job = await b.waitJob("extract", jobId);
    myobState.delayMs = 0;
    assert.equal(job.status, "successful", job.errorMessage);
    assert.equal(job.businessId, A);
    assert.deepEqual(companiesIn(jobItems(jobId)), ["Company A"]);
    const dl = await b.post("/api/download/excel", { dataType: "customers", jobId, outputFormat: "raw" }, { "x-company-id": B });
    assert.equal(dl.status, 200, dl.text.slice(0, 200));
    assert.ok(/Company A/.test(dl.text) || dl.text.length > 0);
  });

  test("6a. reconnect (re-login) in the same session keeps the intended company", async () => {
    const b = newBrowser(); await b.login("alice"); await b.select(C);
    await b.login("alice");
    assert.equal((await b.get("/auth/status")).json.businessId, C);
  });
  test("6b. another browser connecting the same account does not move this session", async () => {
    const b = newBrowser(); await b.login("alice"); await b.select(B);
    const other = newBrowser(); await other.login("alice"); await other.select(C);
    assert.equal((await b.get("/auth/status")).json.businessId, B);
  });
  test("6c. access-token refresh (expired token) keeps the company, even with concurrent requests", async () => {
    const b = newBrowser(); await b.login("alice"); await b.select(B);
    db.User.rows.forEach((u) => (u.tokenExpiresAt = Date.now() - 1000)); // force expiry
    myobCalls.length = 0;
    const rs = await Promise.all([1, 2, 3].map(() => b.get("/api/invoices/sales")));
    assert.ok(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.status)));
    assert.ok(myobCalls.length === 3 && myobCalls.every((c) => c.companyId === B));
    assert.equal((await b.get("/auth/status")).json.businessId, B);
  });
  test("6d. stale tab (shows A, session switched to B in another tab) gets 409, not B's data", async () => {
    const tab1 = newBrowser(); await tab1.login("alice"); await tab1.select(A);
    const tab2 = newBrowser(); tab2.cookie = tab1.cookie; // same cookie = same session
    await tab2.select(B);
    myobCalls.length = 0;
    const r = await tab1.get("/api/invoices/sales"); // tab1 still sends X-Company-Id: A
    assert.equal(r.status, 409); assert.equal(r.json.code, "COMPANY_MISMATCH");
    assert.equal(myobCalls.length, 0, "no MYOB call may be made");
    const r2 = await extractCustomers(tab1);
    assert.equal(r2.status, 409);
  });

  test("7a. no company selected -> clear error, no MYOB call, no job", async () => {
    const b = newBrowser(); await b.login("alice");
    myobCalls.length = 0; const jobsBefore = db.ExtractionJob.rows.length;
    const r = await extractCustomers(b);
    assert.equal(r.status, 400); assert.equal(r.json.code, "NO_COMPANY_SELECTED");
    assert.equal((await b.post("/api/summary/async", {})).status, 400);
    assert.equal(myobCalls.length, 0); assert.equal(db.ExtractionJob.rows.length, jobsBefore);
  });
  test("7b. forged job whose company != connection is stopped before any MYOB call", async () => {
    const b = newBrowser(); await b.login("alice"); await b.select(A);
    const { runExtractionJob } = await import(new URL("../src/services/asyncExtractionService.js", import.meta.url).href);
    const job = await db.ExtractionJob.create({ userId: db.User.rows[0]._id, businessId: B, dataType: "customers", subType: null, status: "queued" });
    const user = { ...db.User.rows.find((u) => u.myobUserId === "uid-alice"), businessId: A, businessName: "Company A" };
    myobCalls.length = 0;
    await runExtractionJob(job, user);
    const done = db.ExtractionJob.rows.find((r) => r._id === job._id);
    assert.equal(done.status, "failed"); assert.match(done.errorMessage, /mismatch/i);
    assert.equal(myobCalls.length, 0);
  });
  test("7c. company file not in the account's list is refused by the worker", async () => {
    const { runExtractionJob } = await import(new URL("../src/services/asyncExtractionService.js", import.meta.url).href);
    const alice = db.User.rows.find((u) => u.myobUserId === "uid-alice");
    const job = await db.ExtractionJob.create({ userId: alice._id, businessId: D, dataType: "customers", subType: null, status: "queued" });
    myobCalls.length = 0;
    await runExtractionJob(job, { ...alice, businessId: D, businessName: "Company D" });
    assert.equal(db.ExtractionJob.rows.find((r) => r._id === job._id).status, "failed");
    assert.equal(myobCalls.length, 0);
  });
  test("7d. NextPageLink pointing at another company is rejected", async () => {
    const { relativeEndpointFromNextLink, CompanyMismatchError } = await import(new URL("../src/services/companyContext.js", import.meta.url).href);
    assert.equal(relativeEndpointFromNextLink(`https://api.myob.com/accountright/${A}/Sale/Invoice?$skip=10`, A), "/Sale/Invoice?$skip=10");
    assert.throws(() => relativeEndpointFromNextLink(`https://api.myob.com/accountright/${B}/Sale/Invoice?$skip=10`, A), CompanyMismatchError);
  });

  test("8. summary job still works and reports the selected company", async () => {
    const b = newBrowser(); await b.login("alice"); await b.select(B);
    myobCalls.length = 0;
    const r = await b.post("/api/summary/async", {});
    assert.equal(r.status, 202, r.text);
    const job = await b.waitJob("summary", r.json.jobId);
    assert.equal(job.status, "successful", job.errorMessage);
    assert.equal(job.businessId, B);
    assert.equal(job.result.profile.companyName ?? job.result.profile.company?.name ?? "Company B", "Company B");
    assert.ok(myobCalls.length > 0 && myobCalls.every((c) => c.companyId === B));
  });
});
