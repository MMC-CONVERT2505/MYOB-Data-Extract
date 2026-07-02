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

    // ✅ valid lines only
    const validLines = lines.filter(
      l =>
        (l.Quantity ?? "") !== "" ||
        (l.UnitPrice ?? "") !== ""
    );

    // ✅ total line amount (Qty * UnitPrice)
    const totalLineAmount = validLines.reduce((sum, l) => {
      const qty = Number(l.ShipQuantity ?? l.Quantity ?? 1);
      const unitPrice = Number(l.UnitPrice ?? 0);

      return sum + (qty * unitPrice);
    }, 0);

    for (const line of lines) {

      const quantity = Number(
        line.ShipQuantity ?? line.Quantity ?? 1
      );

      const unitPrice = Number(line.UnitPrice ?? 0);

      // ✅ Qty * UnitPrice
      const lineAmount = quantity * unitPrice;

      // ❌ skip empty rows
      if (!lineAmount) continue;

      // ✅ tax calculation
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(line.TaxAmount);
      } else if (inv.TotalTax && totalLineAmount > 0) {
        lineTaxAmt =
          (lineAmount / totalLineAmount) * Number(inv.TotalTax);
      }

      rows.push({
        "Invoice Date":
          fmtDate(inv.Date),

        "Invoice No":
          inv.Number || "",

        "Due Date":
          fmtDate(inv.PromisedDate || inv.Terms?.DueDate),

        "Customer":
          cleanNone(inv.Customer?.Name),

        "Po Number":
          inv.CustomerPurchaseOrderNumber || "",

        "Global Tax calculation":
          inv.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",

        "Product/Service":
          line.Item?.Number || line.Item?.Name || "",

        "DiscountPercent":
          line?.DiscountPercent,

        "Product/Service Description":
          line.Description || "",

        "Product/Service Quantity":
          quantity,

        "Product/Service Unit Price":
          unitPrice,

        // ✅ Qty * UnitPrice
        "Line Amount":
          lineAmount,

        "Product/Service Tax Rate":
          line.TaxCode?.Code || "",

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

        "Freight ($)":                 inv.Freight ?? "",
      });
    }
  }

  return rows;
};

export const flattenQBOInvoiceService = (invoices) => {
  const rows = [];

  for (const inv of invoices) {
    const lines = inv.Lines?.length ? inv.Lines : [{}];

    for (const line of lines) {

      const amount = line.Total ?? line.Amount ?? "";

      // ❌ Skip row if Amount empty
      if (amount === "" || amount === null || amount === undefined) {
        continue;
      }

      rows.push({
        "Invoice Date":                fmtDate(inv.Date),
        "Invoice No":                  inv.Number || "",
        "Due Date":                    fmtDate(inv.PromisedDate || inv.Terms?.DueDate),
        "Customer":                    inv.Customer?.Name,
        "Global Tax calculation":      inv.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",
        "Product/Service":             line.Account?.DisplayID || line.Account?.Name || "",
        "Product/Service Description": line.Description || "",
        "Product/Service Quantity":    line.UnitCount ?? 1,
        "Product/Service Unit Price":  line.UnitPrice || line.Total || "",
        "Product/Service Tax Rate":    line.TaxCode?.Code || "",
        "Product/Service Tax Amount":  line.TaxAmount ?? "",
        "Tax Amount":                  line.TaxAmount ?? inv.TotalTax ?? 0,
        "Product/Service Class":       line.Category?.Name || line.Job?.Name || "",
        "Currency Code":               inv.ForeignCurrency?.Code || "AUD",
        "Exchange Rate":               inv.CurrencyExchangeRate ?? 1,
        "LineAmount":                      amount,
        "Total Invoice Amount":        inv.TotalAmount ?? "",
         "Po Number":
          inv.CustomerPurchaseOrderNumber || "",
        "Freight ($)":                 inv.Freight ?? "",
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