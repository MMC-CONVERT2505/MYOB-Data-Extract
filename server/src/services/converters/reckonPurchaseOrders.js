// ── Reckon Converters — Purchase Orders ─────────────────────────
// Covers: purchaseOrders
// Sheets: Purchase Order Item, Purchase Order Service
// Template: Template_Sales_Quote_and_Purchase.xlsx
// Endpoint: /Purchase/Order/{Item|Service|Professional|Miscellaneous}
// Mirrors: reckonBills.js (Purchase/-side documents)

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

    const qty = line.Quantity ?? 1;
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

// ── 1. Purchase Orders — Item lines → "Purchase Order Item" sheet ─
// Endpoint: /Purchase/Order/Item
export const flattenReckonPurchaseOrderItem = (orders) => {
  const rows = [];
  for (const o of orders) {
    for (const l of buildLines(o)) {
      rows.push({
        "Purchase order number":    o.Number || "",
        "Supplier":                 cleanNone(o.Supplier?.Name || o.Supplier?.CompanyName),
        "Supplier Invoice Number":  o.SupplierInvoiceNumber || "",
        "Transaction date":         fmtDate(o.Date),
        "Promised date":            fmtDate(o.PromisedDate),
        "Customer PO No":           o.CustomerPurchaseOrderNumber || "",
        "Amounts are":              o.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Description":              l.description,
        "Item":                     l.itemName,
        "No. of Unit":              l.qty,
        "Unit Price":               l.unitPrice,
        "Discount %":               l.discountPct,
        "Tax code":                 l.taxCode,
        "Tax amount ($)":           Number(l.taxAmount.toFixed(2)),
        "Job name":                 l.jobName,
      });
    }
  }
  return rows;
};

// ── 2. Purchase Orders — Service/Professional/Misc lines →
//    "Purchase Order Service" sheet ─────────────────────────────
// Endpoint(s): /Purchase/Order/{Service|Professional|Miscellaneous}
export const flattenReckonPurchaseOrderService = (orders) => {
  const rows = [];
  for (const o of orders) {
    for (const l of buildLines(o)) {
      rows.push({
        "Purchase order number":    o.Number || "",
        "Supplier":                 cleanNone(o.Supplier?.Name || o.Supplier?.CompanyName),
        "Supplier Invoice Number":  o.SupplierInvoiceNumber || "",
        "Transaction date":         fmtDate(o.Date),
        "Promised date":            fmtDate(o.PromisedDate),
        "Customer PO No":           o.CustomerPurchaseOrderNumber || "",
        "Amounts are":              o.IsTaxInclusive ? "Tax inclusive" : "Tax exclusive",
        "Description":              l.description,
        "Account No.":              l.accountNo,
        "Amount ($)":               l.lineAmount,
        "Tax code":                 l.taxCode,
        "Tax amount ($)":           Number(l.taxAmount.toFixed(2)),
        "Job name":                 l.jobName,
      });
    }
  }
  return rows;
};