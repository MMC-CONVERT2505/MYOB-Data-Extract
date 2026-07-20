// ── Reckon Converters — Quotes & Sales Orders ───────────────────
// Covers: quotes, salesOrders
// Sheets: Sales Quote Item, Sales Quote Service,
//         Sales Order Item, Sales Order Service
// Template: Template_Sales_Quote_and_Purchase.xlsx
// Mirrors: reckonInvoices.js (Sale/-side documents)

import { cleanNone, fmtDate } from "../helpers.js";

const noTaxCodes = ["N-T", "FRE", "NONE"];

// ── Shared line-level builder (Item + Service/Prof/Misc lines) ──
const buildLines = (doc) => {
  const lines = doc.Lines?.length ? doc.Lines : [{}];
  const totalLineAmount = lines.reduce((sum, l) => sum + Number(l.Total ?? 0), 0);
  const out = [];

  for (const line of lines) {
    const lineAmount = Number(line.Total ?? 0);
    if (!lineAmount) continue;

    const taxCode = line.TaxCode?.Code || "";
    let taxAmount = 0;
    if (doc.TotalTax && totalLineAmount > 0) {
      taxAmount = (lineAmount / totalLineAmount) * Number(doc.TotalTax);
    }
    if (noTaxCodes.includes(taxCode)) taxAmount = 0;

    const qty = line.ShipQuantity ?? line.Quantity ?? 1;
    const unitPrice = line.UnitPrice ?? (lineAmount / (qty || 1));

    out.push({
      lineAmount,
      taxAmount,
      taxCode,
      qty,
      unitPrice,
      discountPct: line.DiscountPercent ?? "",
      itemName: line.Item?.Name || line.Item?.Number || "",
      accountNo: line.Account?.DisplayID || "",
      description: line.Description || "",
      jobName: line.Job?.Name || "",
    });
  }
  return out;
};

// ── 1. Quotes — Item lines → "Sales Quote Item" sheet ────────────
// Endpoint: /Sale/Quote/Item
export const flattenReckonQuoteItem = (quotes) => {
  const rows = [];
  for (const q of quotes) {
    for (const l of buildLines(q)) {
      rows.push({
        "Sales quote number": q.Number || "",
        "Customer":           cleanNone(q.Customer?.Name),
        "Transaction date":   fmtDate(q.Date),
        "Promised date":      fmtDate(q.PromisedDate ?? q.ExpiryDate ?? q.Terms?.DueDate),
        "Customer PO No":     q.CustomerPurchaseOrderNumber || "",
        "Amounts are":        q.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Description":        l.description,
        "Item":               l.itemName,
        "No. of Unit":        l.qty,
        "Unit Price":         l.unitPrice,
        "Discount %":         l.discountPct,
        "Tax code":           l.taxCode,
        "Tax amount ($)":     Number(l.taxAmount.toFixed(2)),
        "Job name":           l.jobName,
      });
    }
  }
  return rows;
};

// ── 2. Quotes — Service/Professional/Misc/TimeBilling lines →
//    "Sales Quote Service" sheet ──────────────────────────────
// Endpoint(s): /Sale/Quote/{Service|Professional|Miscellaneous|TimeBilling}
export const flattenReckonQuoteService = (quotes) => {
  const rows = [];
  for (const q of quotes) {
    for (const l of buildLines(q)) {
      rows.push({
        "Sales quote number": q.Number || "",
        "Customer":           cleanNone(q.Customer?.Name),
        "Transaction date":   fmtDate(q.Date),
        "Expiry date":        fmtDate(q.PromisedDate ?? q.ExpiryDate ?? q.Terms?.DueDate),
        "Customer PO No":     q.CustomerPurchaseOrderNumber || "",
        "Amounts are":        q.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Description":        l.description,
        "Account No.":        l.accountNo,
        "Amount ($)":         l.lineAmount,
        "Tax code":           l.taxCode,
        "Tax amount ($)":     Number(l.taxAmount.toFixed(2)),
        "Job name":           l.jobName,
      });
    }
  }
  return rows;
};

// ── 3. Sales Orders — Item lines → "Sales Order Item" sheet ──────
// Endpoint: /Sale/Order/Item
export const flattenReckonSalesOrderItem = (orders) => {
  const rows = [];
  for (const o of orders) {
    for (const l of buildLines(o)) {
      rows.push({
        "Sales order number": o.Number || "",
        "Customer":           cleanNone(o.Customer?.Name),
        "Transaction date":   fmtDate(o.Date),
        "Promised date":      fmtDate(o.PromisedDate),
        "Customer PO No":     o.CustomerPurchaseOrderNumber || "",
        "Amounts are":        o.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Description":        l.description,
        "Item":               l.itemName,
        "No. of Unit":        l.qty,
        "Unit Price":         l.unitPrice,
        "Discount %":         l.discountPct,
        "Tax code":           l.taxCode,
        "Tax amount ($)":     Number(l.taxAmount.toFixed(2)),
        "Job name":           l.jobName,
      });
    }
  }
  return rows;
};

// ── 4. Sales Orders — Service/Professional/Misc lines →
//    "Sales Order Service" sheet ────────────────────────────────
// Endpoint(s): /Sale/Order/{Service|Professional|Miscellaneous}
export const flattenReckonSalesOrderService = (orders) => {
  const rows = [];
  for (const o of orders) {
    for (const l of buildLines(o)) {
      rows.push({
        "Sales order number": o.Number || "",
        "Customer":           cleanNone(o.Customer?.Name),
        "Transaction date":   fmtDate(o.Date),
        "Promised date":      fmtDate(o.PromisedDate),
        "Customer PO No":     o.CustomerPurchaseOrderNumber || "",
        "Amounts are":        o.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Description":        l.description,
        "Account No.":        l.accountNo,
        "Amount ($)":         l.lineAmount,
        "Tax code":           l.taxCode,
        "Tax amount ($)":     Number(l.taxAmount.toFixed(2)),
        "Job name":           l.jobName,
      });
    }
  }
  return rows;
};