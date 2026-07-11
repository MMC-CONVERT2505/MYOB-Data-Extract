// ── Reckon Converters — Bills / Payments ────────────────────────
// Covers: bills, billPayments, vendorCredits
// Sheets: Bills, Supplier return, Supplier Payment
// Mirrors: qboBills.js / xeroBills.js

import { safe, cleanNone, fmtDate } from "../helpers.js";

const noTaxCodes = ["N-T", "FRE", "NONE"];

// ── Shared line-level builder for Bills template ─────────────────
const buildBillLines = (doc) => {
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

    const qty = line.Quantity ?? line.UnitCount ?? line.BillCount ?? 1;
    const unitPrice = line.UnitPrice ?? (lineAmount / (qty || 1));

    out.push({
      lineAmount,
      taxAmount,
      taxCode,
      qty,
      unitPrice,
      itemName: line.Item?.Name || line.Item?.Number || "",
      accountNo: line.Account?.DisplayID || "",
      description: line.Description || "",
      jobNo: line.Job?.Number || "",
      jobName: line.Job?.Name || "",
    });
  }
  return out;
};

// ── 1. Bills → "Bills" sheet ─────────────────────────────────────
// Endpoint(s): /Purchase/Bill/{Item|Service|Professional|Miscellaneous}
export const flattenReckonBills = (bills) => {
  const rows = [];
  for (const bill of bills) {
    for (const l of buildBillLines(bill)) {
      rows.push({
        "Bill number":             bill.Number || "",
        "Supplier":                cleanNone(bill.Supplier?.Name || bill.Supplier?.CompanyName),
        "Transaction date":        fmtDate(bill.Date),
        "Due date":                fmtDate(bill.Terms?.DueDate),
        "Supplier invoice number": bill.SupplierInvoiceNumber || "",
        "Amounts are":             bill.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Item":                    l.itemName,
        "Description":             l.description,
        "Account No.":             l.accountNo,
        "No. of Unit":             l.qty,
        "Unit Price":              l.unitPrice,
        "Discount %":              "",
        "Amount ($)":              l.lineAmount,
        "Tax code":                l.taxCode,
        "Tax amount ($)":          Number(l.taxAmount.toFixed(2)),
        "Job No.":                 l.jobNo,
        "Job name":                l.jobName,
      });
    }
  }
  return rows;
};

// ── 2. Vendor Credits → "Supplier return" sheet ──────────────────
// Endpoint: /Purchase/DebitSettlement — a settlement record, NOT a
// line-itemised document, so Item/Account/Qty columns stay blank.
export const flattenReckonSupplierReturn = (items) =>
  items.map((vc) => ({
    "Bill number":             vc.Number || "",
    "Supplier":                cleanNone(vc.Supplier?.Name || vc.Supplier?.CompanyName),
    "Transaction date":        fmtDate(vc.Date),
    "Due date":                "",
    "Supplier invoice number": "",
    "Amounts are":             "Tax exclusive",
    "Item":                    "",
    "Description":             vc.Memo || "",
    "Account No.":             vc.Account?.DisplayID || "",
    "No. of Unit":             -1,
    "Unit Price":              Math.abs(Number(vc.Amount ?? 0)),
    "Discount %":              "",
    "Amount ($)":              -Math.abs(Number(vc.Amount ?? 0)),
    "Tax code":                "",
    "Tax amount ($)":          "",
    "Job No.":                 "",
    "Job name":                "",
  }));

// ── 3. Bill Payments → "Supplier Payment" sheet ──────────────────
// Endpoint: /Purchase/Bill/Payment
export const flattenReckonSupplierPayment = (payments) => {
  const rows = [];
  for (const p of payments) {
    const lines = p.Lines?.length ? p.Lines : (p.Bills?.length ? p.Bills : [{}]);
    for (const line of lines) {
      rows.push({
        "Supplier":                   cleanNone(p.Supplier?.Name || p.Supplier?.CompanyName),
        "Reference number":           p.PaymentNumber || "",
        "Date":                       fmtDate(p.Date),
        "Bank account":               p.Account?.DisplayID || "",
        "Description of transaction": p.Memo || "",
        "Bill Number":                line.Purchase?.Number || line.Number || line.BillNumber || "",
        "Amount Paid":                line.AmountApplied ?? line.Amount ?? p.AmountPaid ?? "",
      });
    }
  }
  return rows;
};