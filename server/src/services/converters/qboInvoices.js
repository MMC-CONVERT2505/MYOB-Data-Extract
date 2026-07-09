import { cleanNone, fmtDate, safe } from "../helpers.js";

// ── QBO Invoice Item — 19 columns ────────────────────────────
// export const flattenQBOInvoiceItems = (invoices) => {
//   const rows = [];
//   for (const inv of invoices) {
//     const lines = inv.Lines?.length ? inv.Lines : [{}];
//     for (const line of lines) {
//       rows.push({
//         "Invoice Date":                fmtDate(inv.Date),
//         "Invoice No":                  inv.Number || "",
//         "Due Date":                    fmtDate(inv.PromisedDate || inv.Terms?.DueDate),
//         "Customer":                    cleanNone(inv.Customer?.Name),
//         "Global Tax calculation":      inv.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",
//         "Product/Service":             line.Item?.Number || line.Item?.Name || "",
//         "Product/Service Description": line.Description || "",
//         "Product/Service Quantity":    line.ShipQuantity ?? "",
//         "Product/Service Unit Price":  line.UnitPrice ?? "",
//         "Product/Service Tax Rate":    line.TaxCode?.Code || "",
//         "Product/Service Tax Amount":  line.TaxAmount ?? "",
//         "Tax Amount":                  line.TaxAmount ?? "",
//         "Product/Service Class":       line.Category?.Name || "",
//         "Currency Code":               inv.ForeignCurrency?.Code || "AUD",
//         "Exchange Rate":               inv.CurrencyExchangeRate ?? 1,
//         "Amount":                      line.Total ?? line.Amount ?? "",
//         "Tax Exclusive Amount":        inv.IsTaxInclusive
//                                          ? ((line.Total ?? line.Amount ?? 0) - (line.TaxAmount ?? 0))
//                                          : (line.Total ?? line.Amount ?? ""),
//         "Total Invoice Amount":        inv.TotalAmount ?? "",
//         "Freight ($)":                 inv.Freight ?? "",
//       });
//     }
//   }
//   return rows;
// };

export const flattenQBOInvoiceItems = (invoices) => {
  const rows = [];

  for (const inv of invoices) {

    const lines = inv.Lines?.length ? inv.Lines : [{}];

    // ✅ no tax codes
    const noTaxCodes = ["FRE", "N-T", "NONE"];

    // ✅ taxable lines only
    const taxableLines = lines.filter(l => {
      const qty = Number(l.ShipQuantity ?? l.Quantity ?? 1);
      const unitPrice = Number(l.UnitPrice ?? 0);

      return (
        qty * unitPrice !== 0 &&
        !noTaxCodes.includes(l.TaxCode?.Code)
      );
    });

    // ✅ total taxable amount
    const totalLineAmount = taxableLines.reduce((sum, l) => {
      const qty = Number(l.ShipQuantity ?? l.Quantity ?? 1);
      const unitPrice = Number(l.UnitPrice ?? 0);

      return sum + (qty * unitPrice);
    }, 0);

    for (const line of lines) {

      const quantity = Number(
        line.ShipQuantity ??
        line.Quantity ??
        1
      );

      const unitPrice = Number(
        line.UnitPrice ?? 0
      );

      // ✅ Qty × Unit Price
      const lineAmount = quantity * unitPrice;

      // ❌ skip empty rows
      if (!lineAmount) continue;

      // ✅ tax calculation
      const taxCode = line.TaxCode?.Code || "";
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(line.TaxAmount);

      } else if (noTaxCodes.includes(taxCode)) {
        // Tax free line
        lineTaxAmt = 0;

      } else if (
        inv.TotalTax &&
        totalLineAmount > 0
      ) {
        lineTaxAmt =
          (lineAmount / totalLineAmount) *
          Number(inv.TotalTax);
      }

      rows.push({
        "Invoice Date":
          fmtDate(inv.Date),

        "Invoice No":
          inv.Number || "",

        "Due Date":
          fmtDate(
            inv.PromisedDate ||
            inv.Terms?.DueDate
          ),

        "Customer":
          cleanNone(inv.Customer?.Name),

        "Po Number":
          inv.CustomerPurchaseOrderNumber || "",

        "Global Tax calculation":
          inv.IsTaxInclusive
            ? "Tax Inclusive"
            : "Tax Exclusive",

        "Product/Service":
          line.Item?.Number ||
          line.Item?.Name ||
          "",

        "Product/Service Description":
          line.Description || "",

        "Product/Service Quantity":
          quantity,

        "Product/Service Unit Price":
          unitPrice,

        // ✅ Qty × Unit Price
        "Line Amount":
          lineAmount,

        "Product/Service Tax Rate":
          taxCode,

        "DiscountPercent":
          line?.DiscountPercent,

        "Product/Service Tax Amount":
          lineTaxAmt,

        "Product/Service Class":
          line.Category?.Name || "",

        "Currency Code":
          inv.ForeignCurrency?.Code || "AUD",

        "Exchange Rate":
          inv.CurrencyExchangeRate ?? 1,

        "Location":
          "",

        "Freight ($)":
          inv.Freight ?? "",
      });
    }
  }

  return rows;
};

export const flattenQBOInvoiceService = (invoices) => {
  const rows = [];

  for (const inv of invoices) {

    const lines = inv.Lines?.length ? inv.Lines : [{}];

    // ✅ no tax codes
    const noTaxCodes = ["FRE", "N-T", "NONE"];

    // ✅ taxable transaction lines only
    const taxableLines = lines.filter(
      l =>
        l.Type === "Transaction" &&
        !noTaxCodes.includes(l.TaxCode?.Code)
    );

    // ✅ total taxable amount
    const totalLineAmount = taxableLines.reduce((sum, l) => {
      return sum + Number(l.Total ?? l.Amount ?? 0);
    }, 0);

    for (const line of lines) {

      const lineAmount = Number(
        line.Total ?? line.Amount ?? 0
      );

      // ❌ skip empty rows
      if (!lineAmount) continue;

      // ✅ tax calculation
      const taxCode = line.TaxCode?.Code || "";
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(line.TaxAmount);

      } else if (noTaxCodes.includes(taxCode)) {
        // Tax free line
        lineTaxAmt = 0;

      } else if (
        inv.TotalTax &&
        totalLineAmount > 0 &&
        line.Type === "Transaction"
      ) {
        lineTaxAmt =
          (lineAmount / totalLineAmount) *
          Number(inv.TotalTax);
      }

      rows.push({
        "Invoice Date":
          fmtDate(inv.Date),

        "Invoice No":
          inv.Number || "",

        "Due Date":
          fmtDate(
            inv.PromisedDate ||
            inv.Terms?.DueDate
          ),

        "Customer":
          inv.Customer?.Name,

        "Global Tax calculation":
          inv.IsTaxInclusive
            ? "Tax Inclusive"
            : "Tax Exclusive",

        "Product/Service":
          line.Account?.DisplayID ||
          line.Account?.Name ||
          "",

        "Product/Service Description":
          line.Description || "",

        "Product/Service Quantity":
          line.UnitCount ?? 1,

        "Product/Service Unit Price":
          line.UnitPrice ||
          line.Total ||
          "",

        "Product/Service Tax Rate":
          taxCode,

        "Product/Service Tax Amount":
          lineTaxAmt,

        "Tax Amount":
          lineTaxAmt,

        "Product/Service Class":
          line.Category?.Name ||
          line.Job?.Name ||
          "",

        "Currency Code":
          inv.ForeignCurrency?.Code || "AUD",

        "Exchange Rate":
          inv.CurrencyExchangeRate ?? 1,

        "LineAmount":
          lineAmount,

        "Total Invoice Amount":
          inv.TotalAmount ?? "",

        "Po Number":
          inv.CustomerPurchaseOrderNumber || "",

        "Freight ($)":
          inv.Freight ?? "",

        "Location":
          "",
      });
    }
  }

  return rows;
};

// ── QBO Professional / Miscellaneous Invoice — 17 columns ────
export const flattenQBOProfMiscInvoice = (invoices) => {
  const rows = [];
  for (const inv of invoices) {
    const lines = inv.Lines?.length ? inv.Lines : [{}];
    for (const line of lines) {
      const accountStr = line.Account?.DisplayID
        ? `${line.Account.DisplayID} ${line.Account.Name || ""}`.trim()
        : "";
      rows.push({
        "Name":                     line.Item?.Name || line.Description || "",
        "Type":                     line.Item ? "Inventory" : "Service",
        "SKU":                      line.Item?.Number || "",
        "Price/Rate":               line.UnitPrice ?? line.Total ?? "",
        "Sales Description":        line.Description || "",
        "Purchase Description":     line.Description || "",
        "Cost":                     line.UnitPrice ?? "",
        "Income Account":           accountStr,
        "Expense Account":          accountStr,
        "Category":                 line.Category?.Name || inv.Category?.Name || "",
        "Inventory Asset Account":  "",
        "Initial Quantity On Hand": line.Quantity ?? "",
        "As Of Date":               fmtDate(inv.Date),
        "Sales Tax Included":       inv.IsTaxInclusive ? "Yes" : "No",
        "Sales Tax Code":           line.TaxCode?.Code || "",
        "Purchase Tax Included":    inv.IsTaxInclusive ? "Yes" : "No",
        "Purchase Tax Code":        line.TaxCode?.Code || "",
      });
    }
  }
  return rows;
};

// ── QBO Invoice Payments — 12 columns ────────────────────────
export const flattenQBOInvoicePayments = (payments) => {
  const rows = [];
  for (const p of payments) {
    const invoices = p.Invoices?.length ? p.Invoices : [{}];
    const accountName = safe(p.Account?.DisplayID);
    for (const inv of invoices) {
      rows.push({
        "Payment Date":       fmtDate(p.Date),
        "Reference No":       safe(p.ReceiptNumber || p.PaymentNumber),
        "Journal No":         safe(p.TransactionUID),
        "Customer / Vendor": cleanNone(
  p.Customer?.Name && p.Customer.Name !== "*None"
    ? p.Customer.Name
    : (p.Customer?.DisplayID && p.Customer.DisplayID !== "*None"
        ? p.Customer.DisplayID
        : p.Memo?.replace("Payment; ", "") || ""
      )
),
        "Account Name":       accountName,
        "Invoice No":         safe(inv.Number || inv.InvoiceNumber),
        "Amount Applied ($)": safe(inv.AmountApplied ?? inv.Amount ?? p.AmountReceived),
        "Total Amount Paid":  safe(p.AmountReceived ?? p.Amount),
        "Payment Method":     safe(p.PaymentMethod),
        "Memo":               safe(p.Memo),
        "Currency Code":      p.ForeignCurrency?.Code || "AUD",
        "Exchange Rate":      p.CurrencyExchangeRate ?? 1,
      });
    }
  }
  return rows;
};

// ── QBO Credit Refund ────────────────────────────────────────
// Endpoint: /Sale/CreditRefund
export const flattenQBOCreditRefund = (items) => {
  const rows = [];
  for (const cr of items) {
    rows.push({
      "Refund Date":   fmtDate(cr.Date),
      "Reference No":  safe(cr.Number),
      "Customer":      cleanNone(cr.Customer?.Name || cr.Customer?.DisplayID),
      "Invoice No":    safe(cr.Invoice?.Number),
      "Bank Account":  safe(cr.Account?.DisplayID),
      "Amount":        safe(cr.Amount),
      "Payee":         safe(cr.Payee),
      "Memo":          safe(cr.Memo),
      "Currency Code": cr.ForeignCurrency?.Code || "AUD",
    });
  }
  return rows;
};