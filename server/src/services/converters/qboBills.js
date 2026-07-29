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

    // ✅ no tax codes
    const noTaxCodes = ["FRE", "N-T", "NONE"];

    // ✅ taxable transaction lines only
    const taxableLines = lines.filter(
      l =>
        (l.Total ?? l.Amount ?? "") !== "" &&
        !noTaxCodes.includes(l.TaxCode?.Code)
    );

    // ✅ total taxable amount
    const totalLineAmount = taxableLines.reduce((sum, l) => {
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
        bill.TotalTax &&
        totalLineAmount > 0
      ) {
        lineTaxAmt =
          (lineTotal / totalLineAmount) *
          Number(bill.TotalTax);
      }

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
          !isItem ? taxCode : "",

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
          isItem ? taxCode : "",

        "Product/Services Billable Status":
          "",

        "Product/Services Tax Code":
          isItem ? taxCode : "",

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

        "UID":
          bill?.UID,
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

    // ✅ tax free codes
    const noTaxCodes = ["FRE", "N-T", "NONE"];

    // ✅ only taxable transaction lines
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

      const lineTotal = Number(
        line.Total ?? line.Amount ?? 0
      );

      // ❌ skip empty rows
      if (!lineTotal) continue;

      // ✅ tax logic
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
        bill.TotalTax &&
        totalLineAmount > 0 &&
        line.Type === "Transaction"
      ) {
        lineTaxAmt =
          (lineTotal / totalLineAmount) *
          Number(bill.TotalTax);
      }

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
          line.Total,

        "Expense Class":
          line.Category?.Name ||
          line.Job?.Name ||
          "",

        "Expense Tax Code":
          taxCode,

        "Expense Account Tax Amount":
          lineTaxAmt,

        "Total":
          line.TotalAmount,

        "Currency Code":
          bill.ForeignCurrency?.Code || "AUD",

        "Po Number":
          bill.CustomerPurchaseOrderNumber || "",

        "Exchange Rate":
          bill.CurrencyExchangeRate ?? 1,

        "Location":
          "",

        "SupplierInvoiceNumber":
          bill.SupplierInvoiceNumber || "",

        "UID":
          bill?.UID,
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
        "UID": p?.UID
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

// ── QBO Vendor Credits ───────────────────────────────────────
// Endpoint: /Purchase/DebitSettlement
// NOTE: settlement record — one row per Bill this credit was applied to.
export const flattenQBOVendorCredit = (items) => {
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

// ── QBO Debit Refund ─────────────────────────────────────────
// Endpoint: /Purchase/DebitRefund
export const flattenQBODebitRefund = (items) => {
  const rows = [];
  for (const dr of items) {
    rows.push({
      "Refund Date":   fmtDate(dr.Date),
      "Reference No":  safe(dr.Number),
      "Supplier":      cleanNone(dr.Supplier?.Name || dr.Supplier?.CompanyName),
      "Bill No":       safe(dr.Bill?.Number),
      "Bank Account":  safe(dr.Account?.DisplayID),
      "Amount":        safe(dr.Amount),
      "Payment Method": safe(dr.PaymentMethod),
      "Memo":          safe(dr.Memo),
      "Currency Code": dr.ForeignCurrency?.Code || "AUD",
    });
  }
  return rows;
};