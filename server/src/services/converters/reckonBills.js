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
        "UID":                     bill?.UID,
      });
    }
  }
  return rows;
};

// ── 2. Vendor Credits → "Supplier return" sheet ──────────────────
// Endpoint: /Purchase/DebitSettlement — a settlement record: each
// credit is applied against one or more bills via Lines[].Purchase +
// AmountApplied. There is no Item/Account/Qty/Tax detail on this
// endpoint, so those columns stay blank; one row is produced per
// applied bill (a credit split across multiple bills → multiple rows).
// export const flattenReckonSupplierReturn = (items) => {
//   const rows = [];
//   for (const vc of items) {
//     const lines = vc.Lines?.length ? vc.Lines : [{}];
//     for (const line of lines) {
//       const appliedAmount = Number(line.AmountApplied ?? vc.Amount ?? vc.DebitAmount ?? 0);
//       rows.push({
//         "Bill number":             line.Purchase?.Number || vc.Bill?.Number || "",
//         "Supplier":                cleanNone(vc.Supplier?.Name || vc.Supplier?.CompanyName),
//         "Transaction date":        fmtDate(vc.Date),
//         "Due date":                "",
//         "Supplier invoice number": vc.Number || "",
//         "Amounts are":             "Tax exclusive",
//         "Item":                    "",
//         "Description":             vc.Memo || "",
//         "Account No.":             "",
//         "No. of Unit":             -1,
//         "Unit Price":              Math.abs(appliedAmount),
//         "Discount %":              "",
//         "Amount ($)":              -Math.abs(appliedAmount),
//         "Tax code":                "",
//         "Tax amount ($)":          "",
//         "Job No.":                 "",
//         "Job name":                "",
//       });
//     }
//   }
//   return rows;
// };

export const flattenReckonVendorCredit = (items) => {
  // remove this line — was only for debugging, and had args backwards anyway
  // console.log(JSON.stringify(items, 2, null))
  const rows = [];
  for (const vc of items) {
    const lines = vc.Lines?.length ? vc.Lines : [{}];
    for (const line of lines) {
      rows.push({
        "UID":                 vc.UID || "",
        "DebitFromBill_Credit": vc?.DebitFromBill?.Number || "",   // ✅ confirmed correct
        "Supplier":            cleanNone(vc.Supplier?.Name || vc.Supplier?.CompanyName || vc.Supplier?.DisplayID),
        "Number":              vc.Number || "",
        "Date":                fmtDate(vc.Date),
        "DebitAmount":         vc.Amount ?? vc.DebitAmount ?? "",   // ✅ correct — header total, one per credit
        "Memo":                vc.Memo || "",
        "Bill Id":             line.Purchase?.Number || "",        // ✅ correct — per-line bill reference
        "AmountApplied":       line.AmountApplied ?? "",           // ✅ correct — per-line applied amount
        "ForeignCurrency":     vc.ForeignCurrency?.Code || "",
      });
    }
  }
  return rows;
};

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
        "UID":                        p?.UID,
      });
    }
  }
  return rows;
};