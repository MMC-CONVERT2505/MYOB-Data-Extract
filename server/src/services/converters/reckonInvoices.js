// ── Reckon Converters — Invoices / Payments / Banking ──────────
// Covers: invoices, invoicePayments, creditNotes, banking, generalJournal
// Sheets: Invoice, Customer return, Spend Money, Receive Money,
//         Bank Transfer, Journals, Customer payment
// Mirrors: qboInvoices.js / xeroInvoices.js

import { safe, cleanNone, fmtDate } from "../helpers.js";

const noTaxCodes = ["N-T", "FRE", "NONE"];

// ── Shared line-level builder for Invoice template ──────────────
// Works for both regular (Item/Service/Professional/Misc) lines
// and TimeBilling lines (Hours/Activity/Rate instead of Qty/UnitPrice/Item).
const buildInvoiceLines = (doc) => {
  const lines = doc.Lines?.length ? doc.Lines : [{}];
  const totalLineAmount = lines.reduce((sum, l) => sum + Number(l.Total ?? l.Amount ?? 0), 0);
  const out = [];

  for (const line of lines) {
    const lineAmount = Number(line.Total ?? line.Amount ?? 0);
    if (!lineAmount) continue;

    const taxCode = line.TaxCode?.Code || "";
    let taxAmount = 0;
    if (line.TaxAmount != null) {
      taxAmount = Number(line.TaxAmount);
    } else if (doc.TotalTax && totalLineAmount > 0) {
      taxAmount = (lineAmount / totalLineAmount) * Number(doc.TotalTax);
    }
    if (noTaxCodes.includes(taxCode)) taxAmount = 0;

    const qty = line.Quantity ?? line.Hours ?? line.Units ?? 1;
    const unitPrice = line.UnitPrice ?? line.Rate ?? (lineAmount / (qty || 1));

    out.push({
      lineAmount,
      taxAmount,
      taxCode,
      qty,
      unitPrice,
      itemName: line.Item?.Name || line.Item?.Number || line.Activity?.Name || "",
      accountNo: line.Account?.DisplayID || "",
      description: line.Description || "",
      jobNo: line.Job?.Number || "",
      jobName: line.Job?.Name || "",
    });
  }
  return out;
};

// ── 1. Invoices → "Invoice" sheet ───────────────────────────────
// Endpoint(s): /Sale/Invoice/{Item|Service|Professional|Miscellaneous|TimeBilling}
export const flattenReckonInvoice = (invoices) => {
  const rows = [];
  for (const inv of invoices) {
    for (const l of buildInvoiceLines(inv)) {
      rows.push({
        "Invoice number":    inv.Number || "",
        "Customer":          cleanNone(inv.Customer?.Name),
        "Transaction date":  fmtDate(inv.Date),
        "Due date":          fmtDate(inv.Terms?.DueDate || inv.PromisedDate),
        "Customer PO No.":   inv.CustomerPurchaseOrderNumber || "",
        "Amounts are":       inv.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Item":              l.itemName,
        "Description":       l.description,
        "Account No.":       l.accountNo,
        "No. of Unit":       l.qty,
        "Unit Price":        l.unitPrice,
        "Discount %":        "",
        "Amount ($)":        l.lineAmount,
        "Tax code":          l.taxCode,
        "Tax amount ($)":    Number(l.taxAmount.toFixed(2)),
        "Job No.":           l.jobNo,
        "Job name":          l.jobName,
        "UID":               inv?.UID
      });
    }
  }
  return rows;
};

export const flattenMYOBCreditNote = (creditNotes) => {
  const rows = [];
  for (const cn of creditNotes) {
    const lines = cn.Lines?.length ? cn.Lines : [{}];
    for (const line of lines) {
      rows.push({
        "UID":                line.Sale?.UID || "",
        "CreditFromInvoice":  cn.CreditFromInvoice?.Number || "",
        "Customer":           cleanNone(cn.Customer?.Name || cn.Customer?.CompanyName || cn.Customer?.DisplayID),
        "Number":             cn.Number || "",
        "Date":               fmtDate(cn.Date),
        "CreditAmount":       cn.Amount ?? cn.CreditAmount ?? "",
        "Memo":               cn.Memo || "",
        "Invoice Id":         line.Sale?.Number || line.Invoice?.Number || "",
        "AmountApplied":      line.AmountApplied ?? "",
        "ForeignCurrency":    cn.ForeignCurrency?.Code || "",
      });
    }
  }
  return rows;
};


// ── 3. Invoice Payments → "Customer payment" sheet ───────────────
// Endpoint: /Sale/Invoice/Payment
export const flattenReckonCustomerPayment = (payments) => {
  const rows = [];
  for (const p of payments) {
    const invoices = p.Invoices?.length ? p.Invoices : [{}];
    for (const inv of invoices) {
      rows.push({
        "Customer":                   cleanNone(p.Customer?.Name || p.Customer?.CompanyName),
        "Reference number":           p.ReceiptNumber || "",
        "Date":                       fmtDate(p.Date),
        "Bank account":               p.Account?.DisplayID || "",
        "Description of transaction": p.Memo || "",
        "Invoice number":             inv.Number || "",
        "Amount received":            inv.AmountApplied ?? p.AmountReceived ?? "",
        "UID" :                       p?.UID,
      });
    }
  }
  return rows;
};

// ── 4. Spend Money → "Spend Money" sheet ─────────────────────────
// Endpoint: /Banking/SpendMoneyTxn
export const flattenReckonSpendMoney = (items) => {
  const rows = [];
  for (const txn of items) {
    const lines = txn.Lines?.length ? txn.Lines : [{}];
    for (const line of lines) {
      const lineAmount = Number(line.Amount ?? line.Total ?? txn.AmountPaid ?? 0);
      if (!lineAmount) continue;
      rows.push({
        "Bank Account":                txn.Account?.DisplayID || "",
        "Contact":                     cleanNone(txn.Contact?.Name || txn.Contact?.CompanyName || "No Name"),
        "Description of transaction":  txn.Memo || "",
        "Reference number":            txn.PaymentNumber || "",
        "Date":                        fmtDate(txn.Date),
        "Amounts are":                 txn.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Account":                     line.Account?.DisplayID || "",
        "Amount":                      lineAmount,
        "Quantity":                    1,
        "Description":                 line.Memo || "",
        "Job":                         line.Job?.Name || "",
        "Tax Code":                    line.TaxCode?.Code || "",
        "UID":                         txn?.UID,
      });
    }
  }
  return rows;
};

// ── 5. Receive Money → "Receive Money" sheet ─────────────────────
// Endpoint: /Banking/ReceiveMoneyTxn
export const flattenReckonReceiveMoney = (items) => {
  const rows = [];
  for (const txn of items) {
    const lines = txn.Lines?.length ? txn.Lines : [{}];
    for (const line of lines) {
      const lineAmount = Number(line.Amount ?? line.Total ?? txn.AmountReceived ?? 0);
      if (!lineAmount) continue;
      rows.push({
        "Bank Account":       txn.Account?.DisplayID || "",
        "Contact":            cleanNone(txn.Contact?.Name || txn.Contact?.CompanyName || "No Name"),
        "Description":        txn.Memo || "",
        "Reference number":   txn.ReceiptNumber || "",
        "Date":               fmtDate(txn.Date),
        "Amounts are":        txn.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Account":            line.Account?.DisplayID || "",
        "Amount":             lineAmount,
        "Quantity":           1,
        "Line_Description":   line.Memo || "",
        "Job":                line.Job?.Name || "",
        "Tax Code":           line.TaxCode?.Code || "",
        "UID":                txn?.UID,
      });
    }
  }
  return rows;
};

// ── 6. Transfer Money → "Bank Transfer" sheet ────────────────────
// Endpoint: /Banking/TransferMoneyTxn
export const flattenReckonBankTransfer = (items) =>
  items
    .filter((txn) => Number(txn.Amount ?? txn.TotalAmount ?? 0) !== 0)
    .map((txn) => ({
      "Date":                        fmtDate(txn.Date),
      "Reference number":            txn.Number || "",
      "Amount":                      Number(txn.Amount ?? txn.TotalAmount ?? 0),
      "Description of transaction":  txn.Memo || "",
      "Bank account from":           txn.FromAccount?.DisplayID || "",
      "Bank account to":             txn.ToAccount?.DisplayID || "",
    }));

// ── 7. General Journal → "Journals" sheet ─────────────────────────
// Endpoint: /GeneralLedger/GeneralJournal
export const flattenReckonJournal = (items) => {
  const rows = [];
  for (const txn of items) {
    const lines = txn.Lines?.length ? txn.Lines : [{}];
    for (const line of lines) {
      const lineAmount = Number(line.Amount ?? line.Total ?? 0);
      if (!lineAmount) continue;
      rows.push({
        "Date":                       fmtDate(txn.DateOccurred),
        "Reference number":           txn.DisplayID || "",
        "Description of transaction": txn.Memo || "",
        "Account":                    line.Account?.DisplayID || line.Account?.Name || "",
        "Debit Amount":               lineAmount > 0 ? lineAmount : "",
        "Credit Amount":              lineAmount < 0 ? Math.abs(lineAmount) : "",
        "Quantity":                   "",
        "Description":                line.Memo || "",
        "Job":                        line.Job?.Name || "",
        "Tax Code":                   line.TaxCode?.Code || "",
        "Amounts are":                "Tax exclusive",
      });
    }
  }
  return rows;
};