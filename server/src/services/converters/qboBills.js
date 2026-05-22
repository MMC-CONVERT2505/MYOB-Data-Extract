import { cleanNone, fmtDate, safe } from "../helpers.js";

// ── QBO Bill Item / Service / Prof / Misc — 34 columns ───────
// export const flattenQBOBillItems = (bills, subType) => {
//   const rows = [];
//   const isItem = subType === "Item";
//   for (const bill of bills) {
//     const lines    = bill.Lines?.length ? bill.Lines : [{}];
//     const supplier = cleanNone(bill.Supplier?.CompanyName || bill.Supplier?.Name || bill.Supplier?.DisplayID);
//     const dueDate  = fmtDate(bill.Terms?.DueDate || bill.PromisedDate);

//     for (const line of lines) {
//       const qty          = line.UnitCount ?? line.BillQuantity ?? line.Quantity ?? "";
//       const lineTaxAmt   = line.TaxAmount ?? "";
//       const lineTotal    = line.Total ?? line.Amount ?? "";
//       const taxExclusive = bill.IsTaxInclusive && lineTotal !== ""
//         ? Number(lineTotal) - Number(lineTaxAmt || 0)
//         : lineTotal;
//       const acctStr = [line.Account?.DisplayID, line.Account?.Name].filter(Boolean).join(" ");

//       rows.push({
//         "Organization Name":                 bill.CompanyFile?.Name || "",
//         "Type":                              "Bill",
//         "Date":                              fmtDate(bill.Date),
//         "Bill No":                           bill.SupplierInvoiceNumber || bill.Number || "",
//         "Due Date":                          dueDate,
//         "Supplier":                          supplier,
//         "Terms":                             bill.Terms?.PaymentIsDue || "",
//         "Global Tax calculation":             bill.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",
//         "Expense Account":                   !isItem ? acctStr : "",
//         "Expense Description":               !isItem ? (line.Description || "") : "",
//         "Expense Line Amount":               !isItem ? lineTotal : "",
//         "Expense Class":                     !isItem ? (line.Category?.Name || "") : "",
//         "Expense Tax Code":                  !isItem ? (line.TaxCode?.Code || "") : "",
//         "Expense Account Tax Amount":        !isItem ? lineTaxAmt : "",
//         "Product/Service":                   isItem ? (line.Item?.Number || line.Item?.Name || line.Account?.DisplayID || "") : "",
//         "Product/Services Description":      isItem ? (line.Description || "") : "",
//         "Product/Services Quantity":         isItem ? qty : "",
//         "Product/Services Tax Rate":         isItem ? (line.TaxCode?.Code || "") : "",
//         "Product/Services Billable Status":  "",
//         "Product/Services Tax Code":         isItem ? (line.TaxCode?.Code || "") : "",
//         "Product/Services Tax Amount":       isItem ? lineTaxAmt : "",
//         "Tax Amount":                        lineTaxAmt,
//         "Product/Services Markup Percent":   "",
//         "Billable Customer":                 "",
//         "Product/Services Class":            isItem ? (line.Category?.Name || "") : "",
//         "Location":                          line.Location?.Name || "",
//         "Currency Code":                     bill.ForeignCurrency?.Code || "AUD",
//         "Exchange Rate":                     bill.CurrencyExchangeRate ?? 1,
//         "Quantity":                          qty,
//         "Unit Price":                        line.UnitPrice ?? "",
//         "Tax Rate":                          line.TaxCode?.Code || "",
//         "Tax Exclusive Amount":              taxExclusive,
//         "Amount":                            lineTotal,
//         "Total Bill Amount":                 bill.TotalAmount ?? "",
//         "Status":                            bill.Status || "Open",
//       });
//     }
//   }
//   return rows;
// };

export const flattenQBOBillItems = (bills, subType) => {
  const rows = [];
  const isItem = subType === "Item";

  for (const bill of bills) {

    const lines = bill.Lines?.length ? bill.Lines : [{}];

    const supplier = cleanNone(
      bill.Supplier?.CompanyName ||
      bill.Supplier?.Name ||
      bill.Supplier?.DisplayID
    );

    const dueDate = fmtDate(
      bill.Terms?.DueDate || bill.PromisedDate
    );

    // ✅ valid amount lines only
    const validLines = lines.filter(
      l => (l.Total ?? l.Amount ?? "") !== ""
    );

    // ✅ total amount for tax distribution
    const totalLineAmount = validLines.reduce((sum, l) => {
      return sum + Number(l.Total ?? l.Amount ?? 0);
    }, 0);

    for (const line of lines) {

      const qty =
        line.UnitCount ??
        line.BillQuantity ??
        line.Quantity ??
        "";

      const lineTotal = Number(
        line.Total ?? line.Amount ?? 0
      );

      // ❌ skip empty rows
      if (!lineTotal) continue;

      // ✅ tax fix
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = line.TaxAmount;

      } else if (
        bill.TotalTax &&
        totalLineAmount > 0
      ) {
        lineTaxAmt =
          (lineTotal / totalLineAmount) *
          bill.TotalTax;
      }

      const taxExclusive =
        bill.IsTaxInclusive
          ? lineTotal - lineTaxAmt
          : lineTotal;

      const acctStr = [
        line.Account?.DisplayID,
        line.Account?.Name
      ]
        .filter(Boolean)
        .join(" ");

      rows.push({

        "Date":
          fmtDate(bill.Date),

        "Bill No":
          bill.Number ||
          "",

        "Due Date":
          dueDate,

        "Supplier":
          supplier,

        "Terms":
          bill.Terms?.PaymentIsDue || "",

        "Global Tax calculation":
          bill.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",

        // Expense fields
        "Expense Account":
          !isItem ? acctStr : "",

        "Expense Description":
          !isItem
            ? (line.Description || "")
            : "",

        "Expense Line Amount":
          !isItem ? lineTotal : "",

        "Expense Class":
          !isItem
            ? (line.Category?.Name || "")
            : "",

        "Expense Tax Code":
          !isItem
            ? (line.TaxCode?.Code || "")
            : "",

        "Expense Account Tax Amount":
          !isItem ? lineTaxAmt : "",

        // Product/Service fields
        "Product/Service":
          isItem
            ? (
              line.Item?.Number ||
              line.Item?.Name ||
              line.Account?.DisplayID ||
              ""
            )
            : "",

        "Product/Services Description":
          isItem
            ? (line.Description || "")
            : "",

        "Product/Services Quantity":
          isItem ? qty : "",

        "Product/Services Tax Rate":
          isItem
            ? (line.TaxCode?.Code || "")
            : "",

        "Product/Services Billable Status":
          "",

        "Product/Services Tax Code":
          isItem
            ? (line.TaxCode?.Code || "")
            : "",

        "Product/Services Tax Amount":
          isItem ? lineTaxAmt : "",

        "Tax Amount":
          lineTaxAmt,

        "Product/Services Markup Percent":
          "",

        "Billable Customer":
          "",

        "Product/Services Class":
          isItem
            ? (line.Category?.Name || "")
            : "",

        "Location":
          line.Location?.Name || "",

        "Currency Code":
          bill.ForeignCurrency?.Code || "AUD",

        "Exchange Rate":
          bill.CurrencyExchangeRate ?? 1,

        "Quantity":
          qty,

        "Unit Price":
          line.UnitPrice ?? "",

        "Tax Rate":
          line.TaxCode?.Code || "",

        "Tax Exclusive Amount":
          taxExclusive,

        "Amount":
          lineTotal,

        "Total Bill Amount":
          bill.TotalAmount ?? "",

        "Status":
          bill.Status || "Open",
        "SupplierInvoiceNumber":
          bill.SupplierInvoiceNumber || "",
        "Po Number":
          bill.CustomerPurchaseOrderNumber || "",
        "Location":
           "",
      });
    }
  }

  return rows;
};

export const flattenQBOBillService = (bills) => {
  const rows = [];

  for (const bill of bills) {

    const lines = bill.Lines?.length ? bill.Lines : [{}];

    const supplier = cleanNone(
      bill.Supplier?.CompanyName ||
      bill.Supplier?.Name ||
      bill.Supplier?.DisplayID
    );

    const dueDate = fmtDate(
      bill.Terms?.DueDate || bill.PromisedDate
    );

    // ✅ only transaction lines
    const transactionLines = lines.filter(
      l => l.Type === "Transaction"
    );

    // ✅ total amount
    const totalLineAmount = transactionLines.reduce((sum, l) => {
      return sum + Number(l.Total ?? l.Amount ?? 0);
    }, 0);

    for (const line of lines) {

      const lineTotal = Number(
        line.Total ?? line.Amount ?? 0
      );

      // ❌ skip empty rows
      if (!lineTotal) continue;

      // ✅ tax logic
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(line.TaxAmount);

      } else if (
        bill.TotalTax &&
        totalLineAmount > 0 &&
        line.Type === "Transaction"
      ) {
        lineTaxAmt =
          (lineTotal / totalLineAmount) *
          Number(bill.TotalTax);
      }

      const taxExclusive = bill.IsTaxInclusive
        ? lineTotal - lineTaxAmt
        : lineTotal;

      const acctStr =
        line.Account?.DisplayID || "";

      rows.push({

        "Date":
          fmtDate(bill.Date),

        "Bill No":
          bill.Number || "",

        "Due Date":
          dueDate,

        "Supplier":
          supplier,

        "Terms":
          bill.Terms?.PaymentIsDue || "",

        "Global Tax calculation":
          bill.IsTaxInclusive
            ? "Tax Inclusive"
            : "Tax Exclusive",

        "Expense Account":
          acctStr,

        "Expense Description":
          line.Description || "",

        "Expense Line Amount":
          taxExclusive,

        "Expense Class":
          line.Category?.Name ||
          line.Job?.Name ||
          "",

        "Expense Tax Code":
          line.TaxCode?.Code || "",

        "Expense Account Tax Amount":
          lineTaxAmt,

        "Total":
          lineTotal,

        "Currency Code":
          bill.ForeignCurrency?.Code || "AUD",

        "Po Number":
          bill.CustomerPurchaseOrderNumber || "",

        "Exchange Rate":
          bill.CurrencyExchangeRate ?? 1,

        // ✅ FIXED LOCATION
        "Location":
          
          "",
          

        "SupplierInvoiceNumber":
          bill.SupplierInvoiceNumber || "",
      });
    }
  }

  return rows;
};

// ── QBO Bill Payments — 10 columns ───────────────────────────
export const flattenQBOBillPayments = (payments) => {
  const rows = [];
  for (const p of payments) {
    const lines = p.Lines?.length ? p.Lines : p.Bills?.length ? p.Bills : [{}];
    const vendor = cleanNone(
      p.Supplier?.CompanyName || p.Supplier?.Name ||
      p.Supplier?.DisplayID || p.PayeeAddress?.split("\n")?.[0]
    );
    const accountName = safe(p.Account?.DisplayID);

    for (const line of lines) {
      const billNo = line.Purchase?.Number || line.Number || line.BillNumber || "";
      const amount = line.AmountApplied ?? line.Amount ?? p.AmountPaid ?? "";
      rows.push({
        "Ref No": safe(p.PaymentNumber),
        "Vendor": vendor,
        "Payment Date": fmtDate(p.Date),
        "Account": accountName,
        "Memo": safe(p.Memo),
        "Bill No": safe(billNo),
        "Amount": safe(amount),
        "Currency Code": p.ForeignCurrency?.Code || "AUD",
        "Exchange Rate": p.CurrencyExchangeRate ?? 1,
        "Print Status": safe(p.DeliveryStatus),
      });
    }
  }
  return rows;
};

// ── QBO Credit Notes — 19 columns ────────────────────────────
export const flattenQBOCreditNotes = (creditNotes) => {
  const rows = [];
  for (const cn of creditNotes) {
    const lines = cn.Lines?.length ? cn.Lines : [{}];
    for (const line of lines) {
      rows.push({
        "Adjustment Note No": cn.Number || "",
        "Invoice Date": fmtDate(cn.Date),
        "Invoice No": cn.AppliedToInvoice?.Number || "",
        "Customer": cleanNone(cn.Customer?.CompanyName || cn.Customer?.DisplayID || cn.Customer?.Name),
        "Adjustment Note Date": fmtDate(cn.Date),
        "Global Tax calculation": "Tax Exclusive",
        "Product/Service": line.Item?.Number || line.Item?.Name || "",
        "Product/Service Description": line.Description || "",
        "Product/Service Quantity": line.Quantity ?? "",
        "Product/Service Unit Price": line.UnitPrice ?? "",
        "Product/Service Tax Rate": line.TaxCode?.Code || "",
        "Product/Service Tax Amount": line.TaxAmount ?? "",
        "Tax Amount": line.TaxAmount ?? "",
        "Product/Service Class": line.Category?.Name || "",
        "Currency Code": cn.ForeignCurrency?.Code || "AUD",
        "Exchange Rate": cn.CurrencyExchangeRate ?? 1,
        "Location": "",
        "Print Status": cn.InvoiceDeliveryStatus || "",
        "Email Status": cn.InvoiceDeliveryStatus || "",
      });
    }
  }
  return rows;
};

// ── QBO Vendor Credits — 11 columns ──────────────────────────
export const convertVendorCreditToQBO = (vc) => {
  const lines = vc.Lines?.length ? vc.Lines : [{}];
  return lines.map(line => ({
    "Ref No": vc.SupplierInvoiceNumber || vc.Number || "",
    "Vendor": cleanNone(vc.Supplier?.CompanyName || vc.Supplier?.Name || vc.Supplier?.DisplayID),
    "Payment Date": fmtDate(vc.Date),
    "Global Tax Calculation": vc.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",
    "Expense Account": [line.Account?.DisplayID, line.Account?.Name].filter(Boolean).join(" "),
    "Expense Description": line.Description || "",
    "Expense Line Amount": line.Total ?? line.Amount ?? "",
    "Expense Tax Code": line.TaxCode?.Code || "",
    "Location": line.Location?.Name || "",
    "Currency Code": vc.ForeignCurrency?.Code || "AUD",
    "Exchange Rate": vc.CurrencyExchangeRate ?? 1,
  }));
};