import { myobRequest } from "./myobService.js";

/**
 * Migration summary for the connected MYOB AccountRight company file
 * (cloud / OAuth connection — ported from the Desktop Pro tool's
 * summaryService.js, which used the local file API).
 *
 * Every value is computed from the correct AccountRight endpoint per the
 * agreed specification:
 *   A. File profile  — FY start month, COA/bank/credit-card counts,
 *      active employees, multi-currency, jobs, tracked inventory.
 *   B. Transaction summary — Bank, Credit Card, Invoice, Credit Memo,
 *      Sales Receipt, Bill, Bill Credit, Manual Journal + Total Lines.
 *   C. Add-ons — bill attachments, sales quotes, purchase orders.
 *
 * Shared endpoints are fetched once and reused; independent calls run in
 * parallel via Promise.all. All calls tolerate empty responses and API
 * failures gracefully. Every helper takes (dbUser, userId, ...) so it can
 * call myobRequest with the right access token / businessId for the
 * signed-in user.
 */

// ── Shared helpers ────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 1-12 → month name (1 = January). */
const monthName = (m) => MONTHS[(Number(m) - 1 + 12) % 12] || null;

/** Inclusive month span between two ISO dates (min 1). */
function monthsBetween(startDate, endDate) {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s) || isNaN(e)) return null;
  return Math.max(
    1,
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1
  );
}

/**
 * Total number of transaction LINE ITEMS across records. A record with a
 * non-empty Lines[] contributes its line count; otherwise it counts as 1.
 */
function lineCount(records) {
  return records.reduce(
    (total, record) =>
      total +
      (
        Array.isArray(record?.Lines) && record.Lines.length > 0
          ? record.Lines.length
          : 1
      ),
    0
  );
}

const dateOnly = (d) => String(d || "").substring(0, 10);

/** Filter records to those whose date field is within [start, end]. */
function withinRange(records, start, end, field = "Date") {
  const s = dateOnly(start);
  const e = dateOnly(end);
  return records.filter((r) => {
    const d = dateOnly(r[field] || r.Date || r.DateOccurred);
    return !d || (d >= s && d <= e);
  });
}

/**
 * GET all pages of a MYOB collection endpoint for the signed-in user's
 * company file, following NextPageLink (same relative-URL trick used in
 * extractionController.js).
 */
async function myobGetAllPaged(dbUser, userId, endpoint) {
  let allItems = [];
  let pageUrl = endpoint;
  const MAX_PAGE_RETRIES = 3;

  while (pageUrl) {
    let data = null;
    let lastErr = null;

    // Retry THIS page a few times before giving up. Large datasets (e.g.
    // JournalTransaction on a file with 10,000+ records) can hit a 504
    // gateway timeout on any single page — without per-page retry, that
    // one failure used to throw and discard every page already collected,
    // silently zeroing out the whole dataset (Total Lines, GL counts, etc.).
    for (let attempt = 0; attempt < MAX_PAGE_RETRIES; attempt++) {
      try {
        data = await myobRequest(dbUser, userId, "GET", pageUrl);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        const status = e.status || (/\[(\d+)\]/.exec(e.message || "")?.[1] && Number(RegExp.$1));
        const isRetryable = status === 504 || status === 503 || status === 429 || status >= 500;
        if (isRetryable && attempt < MAX_PAGE_RETRIES - 1) {
          const delay = 1000 * (attempt + 1);
          console.log(`⚠️ myobGetAllPaged: page failed (${e.message}), retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }

    if (lastErr) {
      // Give up on this endpoint but return everything fetched so far
      // instead of throwing away already-collected pages.
      console.log(`⚠️ myobGetAllPaged: giving up on remaining pages — ${lastErr.message}. Returning ${allItems.length} items collected so far.`);
      return allItems;
    }

    const pageItems = data?.Items || [];
    allItems = allItems.concat(pageItems);

    if (data?.NextPageLink && pageItems.length > 0) {
      const u = new URL(data.NextPageLink);
      const parts = u.pathname.split("/");
      const bizIdx = parts.indexOf(dbUser.businessId);
      pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
    } else {
      pageUrl = null;
    }
  }

  return allItems;
}

/** MYOB collection GET, returning [] on any failure. */
async function safeGetAll(dbUser, userId, endpoint, label) {
  try {
    return await myobGetAllPaged(dbUser, userId, endpoint);
  } catch (e) {
    console.log(`⚠️ summary: ${label || endpoint} failed — ${e.message}`);
    return [];
  }
}

/** MYOB single GET, with one retry on transient failures. Returns null if both attempts fail. */
async function safeGet(dbUser, userId, endpoint, label, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await myobRequest(dbUser, userId, "GET", endpoint);
    } catch (e) {
      const isLastAttempt = attempt === retries;
      const isRateLimited = e.status === 429 || /429/.test(e.message || "");
      console.log(
        `⚠️ summary: ${label || endpoint} failed (attempt ${attempt + 1}/${retries + 1}) — ${e.message}` +
        (isLastAttempt ? ` — endpoint: ${endpoint}` : " — retrying...")
      );
      if (isLastAttempt) return null;
      // Back off longer (and increasingly) on 429s specifically, since a
      // fixed 400ms retry just re-hits the same rate limit immediately.
      const delay = isRateLimited ? 1500 * (attempt + 1) : 400;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

async function fetchInvoiceDetail(dbUser, userId, invoice) {
  if (!invoice?.UID || !invoice?.InvoiceType) return null;
  return safeGet(
    dbUser, userId,
    `/Sale/Invoice/${invoice.InvoiceType}/${invoice.UID}`,
    "Invoice Detail"
  );
}

async function fetchBillDetail(dbUser, userId, bill) {
  if (!bill?.UID || !bill?.BillType) return null;
  return safeGet(
    dbUser, userId,
    `/Purchase/Bill/${bill.BillType}/${bill.UID}`,
    "Bill Detail"
  );
}

/**
 * Fetches full detail (with Lines[]) for a list of records, in limited
 * concurrency batches so we don't flood the MYOB API with 100+ parallel
 * requests on large files.
 */
async function fetchDetailsInBatches(dbUser, userId, records, fetchFn, batchSize = 3) {
  const results = [];
  const failed = [];

  for (let i = 0; i < records.length; i += batchSize) {
    const slice = records.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      slice.map(async (record) => {
        const detail = await fetchFn(dbUser, userId, record);
        if (!detail) failed.push(record?.Number || record?.UID || "unknown");
        return detail;
      })
    );
    results.push(...batchResults.filter(Boolean));

    // MYOB's cloud API enforces a much tighter rate limit than the local
    // desktop API. A short pause between batches keeps us under it instead
    // of hammering the endpoint and cascading into 429s across the whole run.
    if (i + batchSize < records.length) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  if (failed.length > 0) {
    console.log(`⚠️ Failed to fetch detail for ${failed.length} record(s):`, failed);
  }

  return results;
}

/**
 * File profile. Fetches the accounts list once and returns it (as
 * `_accounts`) so getFullSummary can hand it to the transaction summary
 * and avoid a duplicate /GeneralLedger/Account request.
 */
export async function getFileProfile(dbUser, userId) {
  const [accountingProps, accounts, employees, currencies, jobs, items] =
    await Promise.all([
      safeGet(dbUser, userId, `/GeneralLedger/AccountingProperties`, "AccountingProperties"),
      safeGetAll(dbUser, userId, `/GeneralLedger/Account?$top=1000`, "Account"),
      safeGetAll(dbUser, userId, `/Contact/Employee?$top=1000`, "Employee"),
      safeGetAll(dbUser, userId, `/GeneralLedger/Currency?$top=1000`, "Currency"),
      safeGetAll(dbUser, userId, `/GeneralLedger/Job?$top=1000`, "Job"),
      safeGetAll(dbUser, userId, `/Inventory/Item?$top=1000`, "Item"),
    ]);

  const companyName = dbUser?.businessName || null;

  // Financial year: LastMonthInFinancialYear (1-12). FY start month is
  // the month AFTER the last month of the FY.
  const props = accountingProps?.Items?.[0] || accountingProps;

  const lastMonth =
    props?.LastMonthFinancialYear ??
    props?.LastMonthInFinancialYear ??
    props?.CurrentFinancialYearLastMonth ??
    null;
  const fyStartMonth = lastMonth ? monthName((Number(lastMonth) % 12) + 1) : null;
  const fyEndMonth = lastMonth ? monthName(lastMonth) : null;

  const banks = accounts.filter((a) => a.Type === "Bank");
  const creditCards = accounts.filter((a) => a.Type === "CreditCard");

  const profile = {
    companyName,
    financialYear: {
      startMonth: fyStartMonth,
      endMonth: fyEndMonth,
      currentYear: props?.CurrentFinancialYear ?? null,
    },
    chartOfAccounts: {
      total: accounts.length,
      banks: banks.length,
      creditCards: creditCards.length,
      bankAccounts: banks.map((a) => ({
        displayId: a.DisplayID,
        name: a.Name,
        currentBalance: a.CurrentBalance,
      })),
      creditCardAccounts: creditCards.map((a) => ({
        displayId: a.DisplayID,
        name: a.Name,
        currentBalance: a.CurrentBalance,
      })),
    },
    activeEmployees: employees.filter((e) => e.IsActive === true).length,
    flags: {
      multiCurrency: currencies.length > 1,
      jobs: jobs.length > 0,
      jobCount: jobs.length,
      trackedInventory: items.some((i) => i.IsInventoried === true),
    },
  };

  return { profile, _accounts: accounts };
}

// ── Section B: Transaction summary ────────────────────────────────────

/**
 * Transaction counts + total lines for [startDate, endDate].
 *
 * `accounts` may be passed in to avoid re-fetching /GeneralLedger/Account.
 * Bank vs Credit Card is decided by the type of the account a
 * Spend/Receive Money transaction is drawn from.
 */
export async function getTransactionCounts(dbUser, userId, { startDate, endDate, accounts }) {
  const accountList =
    accounts || (await safeGetAll(dbUser, userId, `/GeneralLedger/Account?$top=1000`, "Account"));

  const typeByUid = new Map(accountList.map((a) => [a.UID, a.Type]));
  const isCreditCardTxn = (txn) => {
    const uid =
      txn.Account?.UID ??
      txn.Account?.Uid ??
      txn.AssetAccount?.UID ??
      txn.AssetAccount?.Uid ??
      null;
    return uid ? typeByUid.get(uid) === "CreditCard" : false;
  };

  const [
    spendMoney,
    receiveMoney,
    transferMoney,
    invoicesAll,
    billsAll,
    journals,
    quotes,
    purchaseOrders,
    journalTransactions,
  ] = await Promise.all([
    safeGetAll(dbUser, userId, `/Banking/SpendMoneyTxn?$top=1000`, "SpendMoney"),
    safeGetAll(dbUser, userId, `/Banking/ReceiveMoneyTxn?$top=1000`, "ReceiveMoney"),
    safeGetAll(dbUser, userId, `/Banking/TransferMoneyTxn?$top=1000`, "TransferMoney"),
    safeGetAll(dbUser, userId, `/Sale/Invoice?$top=1000`, "Invoice"),
    safeGetAll(dbUser, userId, `/Purchase/Bill?$top=1000`, "Bill"),
    safeGetAll(dbUser, userId, `/GeneralLedger/GeneralJournal?$top=1000`, "GeneralJournal"),
    safeGetAll(dbUser, userId, `/Sale/Quote?$top=1000`, "Quote"),
    safeGetAll(dbUser, userId, `/Purchase/Order?$top=1000`, "PurchaseOrder"),
    safeGetAll(dbUser, userId, `/GeneralLedger/JournalTransaction?$top=1000`, "JournalTransaction"),
  ]);

  // ── Date-range filtering ──────────────────────────────────────────
  const spend = withinRange(spendMoney, startDate, endDate);
  const receive = withinRange(receiveMoney, startDate, endDate);
  const transfer = withinRange(transferMoney, startDate, endDate);
  const invoices = withinRange(invoicesAll, startDate, endDate);
  const bills = withinRange(billsAll, startDate, endDate);
  const journalsInRange = withinRange(journals, startDate, endDate, "DateOccurred");
  const quotesInRange = withinRange(quotes, startDate, endDate);
  const poInRange = withinRange(purchaseOrders, startDate, endDate);
  const journalTxnInRange = withinRange(journalTransactions, startDate, endDate, "DateOccurred");

  // ── Bank vs Credit Card (Spend + Receive; transfers are bank movements) ──
  const ccSpendReceive = [...spend, ...receive].filter(isCreditCardTxn);
  const creditCardCount = ccSpendReceive.length;
  const bankCount = spend.length + receive.length + transfer.length - creditCardCount;

  // ── Invoice vs Credit Memo (negative sale = credit memo) ──
  const amt = (r) => Number(r.TotalAmount ?? r.Total ?? r.Subtotal ?? 0);
  const invoiceRecords = invoices.filter((i) => amt(i) >= 0);
  const creditMemoRecords = invoices.filter((i) => amt(i) < 0);

  // ── Bill vs Bill Credit (negative bill = vendor credit) ──
  const billRecords = bills.filter((b) => amt(b) >= 0);
  const billCreditRecords = bills.filter((b) => amt(b) < 0);

  // ── GL-posting-level line counts (JournalTransaction-based, matches MYOB desktop report) ──
  const glLineCounts = journalTxnInRange.reduce(
    (acc, jt) => {
      const key = jt.JournalType || "Unknown";
      const lines = Array.isArray(jt.Lines) ? jt.Lines.length : 0;
      acc.byType[key] = (acc.byType[key] || 0) + lines;
      acc.totalGLLines += lines;
      return acc;
    },
    { byType: {}, totalGLLines: 0 }
  );

  // ── Split Sale/Purchase GL-lines into Invoice vs Credit Memo / Bill vs Bill Credit ──
  const invoiceUidSet = new Set(invoiceRecords.map((i) => i.UID));
  const creditMemoUidSet = new Set(creditMemoRecords.map((i) => i.UID));
  const billUidSet = new Set(billRecords.map((b) => b.UID));
  const billCreditUidSet = new Set(billCreditRecords.map((b) => b.UID));

  let invoiceGLLines = 0;
  let creditMemoGLLines = 0;
  let billGLLines = 0;
  let billCreditGLLines = 0;

  journalTxnInRange.forEach((jt) => {
    const srcUid = jt.SourceTransaction?.UID;
    const lineCountForEntry = Array.isArray(jt.Lines) ? jt.Lines.length : 0;

    if (jt.JournalType === "Sale") {
      if (invoiceUidSet.has(srcUid)) invoiceGLLines += lineCountForEntry;
      else if (creditMemoUidSet.has(srcUid)) creditMemoGLLines += lineCountForEntry;
    } else if (jt.JournalType === "Purchase") {
      if (billUidSet.has(srcUid)) billGLLines += lineCountForEntry;
      else if (billCreditUidSet.has(srcUid)) billCreditGLLines += lineCountForEntry;
    }
  });

  // Bank vs Credit Card: count UNIQUE transactions (by DisplayID), not raw
  // GL lines. Each CashPayment/CashReceipt transaction posts multiple Lines
  // (debit + credit sides) that all share the same DisplayID/ID No. — the
  // true distinct transaction count is what's needed here, not the sum of
  // every line.
  const bankTxnIds = new Set();
  const creditCardTxnIds = new Set();

  journalTxnInRange.forEach((jt) => {
    if (jt.JournalType !== "CashPayment" && jt.JournalType !== "CashReceipt") return;
    const lines = Array.isArray(jt.Lines) ? jt.Lines : [];
    const txnId = jt.DisplayID || jt.UID;

    const involvesCreditCard = lines.some(
      (line) => typeByUid.get(line.Account?.UID) === "CreditCard"
    );

    if (involvesCreditCard) creditCardTxnIds.add(txnId);
    else bankTxnIds.add(txnId);
  });

  const bankGLLines = bankTxnIds.size;
  const creditCardGLLines = creditCardTxnIds.size;

  const counts = {
    bank: { transactions: bankCount, lines: bankGLLines },
    creditCard: { transactions: creditCardCount, lines: creditCardGLLines },
    invoice: { transactions: invoiceRecords.length, lines: invoiceGLLines },
    creditMemo: { transactions: creditMemoRecords.length, lines: creditMemoGLLines },
    salesReceipt: { transactions: 0 },
    bill: { transactions: billRecords.length, lines: billGLLines },
    billCredit: { transactions: billCreditRecords.length, lines: billCreditGLLines },
    manualJournal: {
      transactions: lineCount(journalsInRange),
    },
  };

  // ── Invoice/Bill detail fetch (for the older user-entered-lines total) ──
  const invoiceDetails = await fetchDetailsInBatches(dbUser, userId, invoices, fetchInvoiceDetail);
  const billDetails = await fetchDetailsInBatches(dbUser, userId, bills, fetchBillDetail);

  const totalLines =
    lineCount(invoiceDetails) +
    lineCount(billDetails) +
    lineCount(journalsInRange) +
    lineCount(spend) +
    lineCount(receive) +
    lineCount(transfer);

  const totalTransactions =
    bankCount +
    creditCardCount +
    invoiceRecords.length +
    creditMemoRecords.length +
    billRecords.length +
    billCreditRecords.length +
    lineCount(journalsInRange);

  console.log(
    `📊 Summary [${dateOnly(startDate)}..${dateOnly(endDate)}] ` +
      `bank=${bankCount} cc=${creditCardCount} inv=${invoiceRecords.length} ` +
      `cm=${creditMemoRecords.length} bill=${billRecords.length} ` +
      `billCr=${billCreditRecords.length} journal=${journalsInRange.length} ` +
      `lines=${totalLines} glLines=${glLineCounts.totalGLLines}`
  );

  const LINE_BUFFER = 50; // fixed buffer added to the GL line total as a safety margin

  return {
    dateRange: { startDate, endDate },
    timelineMonths: monthsBetween(startDate, endDate),
    totalTransactions,
    totalLines, // user-entered Lines[] based (Invoice/Bill/SpendMoney detail)
    totalGLLines: glLineCounts.totalGLLines + LINE_BUFFER, // GL-posting-level + buffer
    glLinesByType: glLineCounts.byType,
    counts,
    addOns: {
      salesQuotes: quotesInRange.length,
      purchaseOrders: poInRange.length,
    },
    _allBills: bills, // internal: reused for attachment counting
  };
}

// ── Section C: Add-ons — bill attachments ─────────────────────────────

/** Bill layout segment used in the Bill attachment URL path. */
function billTypeSegment(bill) {
  return bill.Layout || bill.BillType || "Service";
}

/**
 * Count attachments across the given bills, in parallel batches to stay
 * responsive on large files. Failures per bill are ignored.
 */
export async function getBillAttachmentCount(dbUser, userId, bills) {
  if (!bills || bills.length === 0) return 0;

  const BATCH = 4; // smaller batches — attachment endpoint is slower/heavier than plain list calls
  let total = 0;

  for (let i = 0; i < bills.length; i += BATCH) {
    const slice = bills.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (b) => {
        const uid = b?.UID;
        if (!uid) return [];
        // safeGet retries on transient failures (504/503/429); safeGetAll
        // previously had zero retries here, so any single timeout on an
        // attachment lookup silently counted as "0 attachments" for that
        // bill even when attachments genuinely existed (confirmed via
        // Postman). safeGet returns the raw response; unwrap .Attachments.
        const resp = await safeGet(
          dbUser, userId,
          `/Purchase/Bill/${billTypeSegment(b)}/${uid}/Attachment`,
          "BillAttachment"
        );
        return resp?.Attachments || (Array.isArray(resp) ? resp : []) || [];
      })
    );
    total += results.reduce((s, items) => s + (items?.length || 0), 0);

    // Brief pause between batches to avoid stacking more 504s on an
    // already-slow cloud endpoint.
    if (i + BATCH < bills.length) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  console.log("Attachments : ", total);

  return total;
}

// ── Full summary ──────────────────────────────────────────────────────

/**
 * Full summary = profile + transactions (+ attachment count). Reuses the
 * accounts list from the profile so /GeneralLedger/Account is fetched
 * only once. `accountingBasis` is user-selected, never fetched from MYOB.
 */
export async function getFullSummary(dbUser, userId, { startDate, endDate, accountingBasis }) {
  const { profile, _accounts } = await getFileProfile(dbUser, userId);

  let transactions = null;
  if (startDate && endDate) {
    transactions = await getTransactionCounts(dbUser, userId, {
      startDate,
      endDate,
      accounts: _accounts,
    });

    const attachments = await getBillAttachmentCount(dbUser, userId, transactions._allBills);
    transactions.addOns.attachments = attachments;
    delete transactions._allBills;
  }

  return {
    profile: {
      ...profile,
      accountingBasis: accountingBasis || "Accrual",
    },
    transactions,
    generatedAt: new Date().toISOString(),
  };
}