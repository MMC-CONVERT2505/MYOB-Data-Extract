

import { cleanNone, fmtDate } from "../helpers.js";

// ── MYOB Invoice Service/Professional/Misc — raw flat ─────────
export const flattenMYOBInvoiceService = (invoices, businessName) => {
  const rows = [];

  for (const inv of invoices) {

    const lines = inv.Lines?.length
      ? inv.Lines
      : [{}];

    const orgName =
      businessName ||
      inv.CompanyFile?.Name ||
      "";

    // ✅ valid lines only
    const validLines = lines.filter(
      l => (l.Total ?? l.Amount ?? "") !== ""
    );

    // ✅ total line amount
    const totalLineAmount = validLines.reduce((sum, l) => {
      return sum + Number(
        l.Total ?? l.Amount ?? 0
      );
    }, 0);

    for (const line of lines) {

      const lineAmount = Number(
        line.Total ?? line.Amount ?? 0
      );

      // ❌ skip empty rows
      if (!lineAmount) continue;

      // ✅ service detection
      const isService =
        !line.Item?.Number &&
        !line.Item?.Name;

      // ✅ quantity
      const quantity = isService
        ? 1
        : (
            line.Quantity ??
            line.UnitCount ??
            line.ShipQuantity ??
            1
          );

      // ✅ unit amount
      const unitAmount = isService
        ? lineAmount
        : Number(line.UnitPrice ?? 0);

      // ✅ tax code
      const taxCode =
        line.TaxCode?.Code || "";

      // ✅ no-tax codes
      const noTaxCodes = [
        "N-T",
        "FRE",
        "NONE"
      ];

      // ✅ tax amount fix
      let taxAmount = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        taxAmount = Number(line.TaxAmount);

      } else if (
        inv.TotalTax &&
        totalLineAmount > 0
      ) {
        taxAmount =
          (lineAmount / totalLineAmount) *
          Number(inv.TotalTax);
      }

      // ✅ no tax
      if (
        noTaxCodes.includes(taxCode)
      ) {
        taxAmount = 0;
      }

      // ✅ item name
      const itemName =
        [
          line.Item?.Number,
          line.Item?.Name
        ]
          .filter(Boolean)
          .join(" ");

      rows.push({

        // ───── TEMPLATE FIELDS ─────

        "Customer":
          cleanNone(
            inv.Customer?.Name
          ),

        "Invoice date":
          fmtDate(inv.Date),

        "Invoice Due date":
          fmtDate(
            inv.Terms?.DueDate
          ),

        "Payment terms":
          inv.Terms?.PaymentIsDue || "",

        "Reference code":
          inv.Number,

        "Amounts*":
          inv.IsTaxInclusive
            ? "Tax Inclusive"
            : "Tax Exclusive",

        "Invoice discount":
          inv.Terms?.Discount ?? "",

        "classification":
          line.Job?.Name ||
          line.Category?.Name ||
          "",

        // ✅ product/service
        "Item":
          itemName,

        // ✅ fixed item price
        "Item price":
          unitAmount,

        "Account":
          line.Account?.DisplayID || "",

        "Account Name":
          line.Account?.Name || "",

        "Description":
          line.Description || "",

        // ✅ fixed qty
        "Qty":
          quantity,

        "Discount":
          line.DiscountPercent ?? "",

        "Tax code":
          taxCode,

        // ✅ fixed tax amount
        "Tax Amount":
          Number(
            taxAmount
          ),

        "Amount":
          lineAmount,

        "Total":
          inv.TotalAmount ?? "",

        "NOTE":
          inv.Comment || "",

        "PAYMENT DETAILS":
          inv.OnlinePaymentMethod || "",

        "UID":
        inv.UID
      });
    }
  }

  return rows;
};

// ── MYOB Bill Raw — Item/Service/Prof/Misc (same columns) ─────

export const flattenMYOBBillRaw = (bills, businessName) => {
  const rows = [];

  for (const bill of bills) {

    const lines = bill.Lines?.length
      ? bill.Lines
      : [{}];

    const orgName =
      businessName ||
      bill.CompanyFile?.Name ||
      "";

    // ✅ valid lines only
    const validLines = lines.filter(
      l => (l.Total ?? l.Amount ?? "") !== ""
    );

    // ✅ total line amount
    const totalLineAmount = validLines.reduce((sum, l) => {
      return sum + Number(
        l.Total ?? l.Amount ?? 0
      );
    }, 0);

    for (const line of lines) {

      const lineAmount = Number(
        line.Total ?? line.Amount ?? 0
      );

      // ❌ skip empty rows
      if (!lineAmount) continue;

      // ✅ service detection
      const isService =
        !line.Item?.Number &&
        !line.Item?.Name;

      // ✅ quantity
      const quantity = isService
        ? 1
        : (
            line.Quantity ??
            line.UnitCount ??
            line.BillCount ??
            1
          );

      // ✅ unit amount
      const unitAmount = isService
        ? lineAmount
        : Number(line.UnitPrice ?? 0);

      // ✅ tax code
      const taxCode =
        line.TaxCode?.Code || "";

      // ✅ no-tax codes
      const noTaxCodes = [
        "N-T",
        "FRE",
        "NONE"
      ];

      // ✅ tax amount fix
      let taxAmount = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        taxAmount = Number(line.TaxAmount);

      } else if (
        bill.TotalTax &&
        totalLineAmount > 0
      ) {
        taxAmount =
          (lineAmount / totalLineAmount) *
          Number(bill.TotalTax);
      }

      // ✅ no tax
      if (
        noTaxCodes.includes(taxCode)
      ) {
        taxAmount = 0;
      }

      // ✅ item name
      const itemName =
        [
          line.Item?.Number,
          line.Item?.Name
        ]
          .filter(Boolean)
          .join(" ");

      rows.push({

        // ───── TEMPLATE FIELDS ─────

        "Supplier":
          cleanNone(
            bill.Supplier?.Name ||
            bill.Supplier?.CompanyName
          ),

        "Bill date":
          fmtDate(bill.Date),

        "Due Date":
          fmtDate(
            bill.Terms?.DueDate
          ),

        "Reference code":
          bill.Number ||
          "",

        "Amounts*":
          bill.IsTaxInclusive
            ? "Tax Inclusive"
            : "Tax Exclusive",

        "Bill discount":
          bill.Terms?.Discount ?? "",

        "classification":
          line.Job?.Name ||
          bill.Category?.Name ||
          "",

        // ✅ product/service
        "Item":
          itemName,

        // ✅ fixed item price
        "Item price":
          unitAmount,

        "Account":
          line.Account?.DisplayID || "",

        "Account Name":
          line.Account?.Name || "",

        "Description":
          line.Description || "",

        // ✅ fixed qty
        "Qty":
          quantity,

        "Discount":
          line.DiscountPercent ?? "",

        "Tax code":
          taxCode,

        // ✅ fixed tax amount
        "Tax Amount":
          Number(
            taxAmount.toFixed(2)
          ),

        "Amount":
          lineAmount,

        "NOTES":
          bill.Comment || "",
        
        "UID":
        bill.UID
      });
    }
  }

  return rows;
};



// ── MYOB Invoice Payment — raw flat ───────────────────────────

export const flattenMYOBInvoicePayment = (payments) => {

  const rows = [];

  for (const p of payments) {

    const invoices = p.Invoices?.length
      ? p.Invoices
      : [{}];

    for (const inv of invoices) {

      rows.push({

        // ───── TEMPLATE FIELDS ─────

        "Date":
          fmtDate(p.Date),

        "Contact":
          cleanNone(
            p.Customer?.Name ||
            p.Customer?.CompanyName
          ),

        "Payment method":
          p.PaymentMethod || "",

        "Reference":
          p.ReceiptNumber || "",

        "Bank account":
          p.Account?.DisplayID || "",

        "Bank account Name":
          p.Account?.Name || "",

        "Amount":
          inv.AmountApplied ||
          p.AmountReceived ||
          "",

        "Invoice Number":
          inv.Number || "",

        "Details":
          p.Memo || "",

        "Allocation notes":
          inv.Description || "",

        // ✅ added invoice UID at last
        "Invoice UID":
          inv.UID || "",
      });
    }
  }

  return rows;
};

// ── MYOB Bill Payment — raw flat ──────────────────────────────
export const flattenMYOBBillPayment = (payments) => {

  const rows = [];

  for (const p of payments) {

    const lines = p.Lines?.length
      ? p.Lines
      : p.Bills?.length
        ? p.Bills
        : [{}];

    for (const line of lines) {

      rows.push({

        // ───── TEMPLATE FIELDS ─────

        "Date":
          fmtDate(p.Date),

        "Contact":
          cleanNone(
            p.Supplier?.Name ||
            p.Supplier?.CompanyName
          ),

        "Reference":
          p.PaymentNumber || "",

        "Bank account":
          p.Account?.DisplayID || "",

        "Bank account Name":
          p.Account?.Name || "",

        "Amount":
          line.AmountApplied ??
          line.Amount ??
          p.AmountPaid ??
          "",

        "Details":
          p.Memo || "",

        "Allocation notes":
          line.Description || "",

        "Bill Number":
          line.Purchase?.Number ||
          line.Number ||
          line.BillNumber ||
          "",

        // ✅ added Bill UID at last
        "Bill UID":
          line.Purchase?.UID ||
          line.UID ||
          "",
      });
    }
  }

  return rows;
};

// ── MYOB Spend Money — QBO Excel Template style ───────────────
// Template columns:
// Ref No | Account | Payee | Payment Date | Global Tax Calculation |
// Expense Account | Expense Description | Expense Line Amount |
// Expense Tax Code | Expense Account Tax Amount | Currency Code | Exchange Rate

// export const flattenMYOBSpendMoneyQBO = (items) => {
//   const rows = [];

//   for (const txn of items) {
//     const lines = txn.Lines?.length ? txn.Lines : [{}];

//     for (const line of lines) {
//       const lineAmount     = line.Amount ?? 0;
//       const lineTaxAmt     = line.TaxAmount ?? 0;
//       const taxExclAmount  = txn.IsTaxInclusive
//         ? Number(lineAmount) - Number(lineTaxAmt)
//         : lineAmount;

//       rows.push({
//         "Ref No":                    txn.PaymentNumber || "",
//         "Account":                   txn.Account?.DisplayID || "",
//         "Payee":                     cleanNone(
//                                        txn.Contact?.Name ||
//                                        txn.Contact?.CompanyName ||
//                                        txn.Contact?.DisplayID
//                                      ),
//         "Payment Date":              fmtDate(txn.Date),
//         "Global Tax Calculation":    txn.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",
//         "Expense Account":           line.Account?.DisplayID
//                                        ? `${line.Account.DisplayID} ${line.Account.Name || ""}`.trim()
//                                        : "",
//         "Expense Description":       line.Memo || txn.Memo || "",
//         "Expense Line Amount":       line.Amount ?? "",
//         "Expense Tax Code":          line.TaxCode?.Code || "",
//         "Expense Account Tax Amount": taxExclAmount !== 0 ? taxExclAmount : "",
//         "Currency Code":             txn.ForeignCurrency?.Code || "AUD",
//         "Exchange Rate":             txn.CurrencyExchangeRate ?? 1,
//       });
//     }
//   }

//   return rows;
// };

export const flattenMYOBSpendMoneyQBO = (items) => {
  const rows = [];

  for (const txn of items) {

    const lines = txn.Lines?.length
      ? txn.Lines
      : [{}];

    // ✅ valid lines only
    const validLines = lines.filter(
      l => (l.Amount ?? l.Total ?? "") !== ""
    );

    // ✅ total line amount
    const totalLineAmount = validLines.reduce((sum, l) => {
      return sum + Number(
        l.Amount ?? l.Total ?? 0
      );
    }, 0);

    for (const line of lines) {

      const lineAmount = Number(
        line.Amount ?? line.Total ?? 0
      );

      // ❌ skip empty rows
      if (!lineAmount) continue;

      // ✅ tax calculation
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(line.TaxAmount);

      } else if (
        txn.TotalTax &&
        totalLineAmount > 0
      ) {
        lineTaxAmt =
          (lineAmount / totalLineAmount) *
          txn.TotalTax;
      }

      // ✅ tax code
      const taxCode =
        line.TaxCode?.Code || "";

      // ✅ no-tax codes
      const noTaxCodes = [
        "N-T",
        "FRE",
        "NONE"
      ];

      // ✅ actual tax amount
      const expenseTaxAmount =
        noTaxCodes.includes(taxCode)
          ? 0
          : lineTaxAmt;

      // ✅ tax exclusive amount
      const taxExclusiveAmount =
        txn.IsTaxInclusive
          ? lineAmount - expenseTaxAmount
          : lineAmount;

      rows.push({

        "Ref No":
          txn.PaymentNumber || "",

        "Account":
          txn.Account?.DisplayID ||
          txn.Account?.Name ||
          "",

        "Payee":
          cleanNone(
            txn.Contact?.Name ||
            txn.Contact?.CompanyName ||
            txn.Contact?.DisplayID ||
            "No Name"
          ),

        "Payment Date":
          fmtDate(txn.Date),

        "Global Tax Calculation":
            txn.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",

        "Expense Account":
          line.Account?.DisplayID,

        "Expense Description":
          line.Memo ||
          txn.Memo ||
          "",

        // ✅ line amount
        "Expense Line Amount":
          lineAmount,

        // ✅ tax code
        "Expense Tax Code":
          taxCode,

        // ✅ fixed actual tax amount
        "Expense Account Tax Amount":
          expenseTaxAmount,

        // ✅ optional useful field
        "Tax Exclusive Amount":
          taxExclusiveAmount,

        "Currency Code":
          txn.ForeignCurrency?.Code || "AUD",

        "Exchange Rate":
          txn.CurrencyExchangeRate ?? 1,
      });
    }
  }

  return rows;
};

// ── MYOB Receive Money — raw flat ─────────────────────────────
// Endpoint: /Banking/ReceiveMoneyTxn
// ── MYOB Receive Money — QBO Excel Template style ─────────────
// Template columns:
// Deposit No | Date | Deposit To Account | Received From |
// Global Tax Calculation | Line Account | Line Description |
// Line Amount | Line Class | Line Tax Code | Line Tax Applicable On |
// Location | Currency Code | Exchange Rate |
// Linked Transaction Type | Linked Transaction Number

// export const flattenMYOBReceiveMoneyQBO = (items) => {
//   const rows = [];

//   for (const txn of items) {

//     const lines = txn.Lines?.length ? txn.Lines : [{}];

//     // ✅ valid lines only
//     const validLines = lines.filter(
//       l => (l.Amount ?? l.Total ?? "") !== ""
//     );

//     // ✅ total line amount
//     const totalLineAmount = validLines.reduce((sum, l) => {
//       return sum + Number(l.Amount ?? l.Total ?? 0);
//     }, 0);

//     for (const line of lines) {

//       const lineAmount = Number(
//         line.Amount ?? line.Total ?? 0
//       );

//       // ❌ skip empty rows
//       if (!lineAmount) continue;

//       // ✅ tax calculation
//       let lineTaxAmt = 0;

//       if (
//         line.TaxAmount !== undefined &&
//         line.TaxAmount !== null
//       ) {
//         lineTaxAmt = Number(line.TaxAmount);

//       } else if (
//         txn.TotalTax &&
//         totalLineAmount > 0
//       ) {
//         lineTaxAmt =
//           (lineAmount / totalLineAmount) *
//           txn.TotalTax;
//       }

//       // ✅ tax code
//       const taxCode = line.TaxCode?.Code || "";

//       // ✅ no-tax codes
//       const noTaxCodes = ["N-T", "FRE", "NONE"];

//       // ✅ tax applicable on
//       const taxApplicableOn =
//         noTaxCodes.includes(taxCode)
//           ? 0
//           : (
//               txn.IsTaxInclusive
//                 ? lineAmount - lineTaxAmt
//                 : lineAmount
//             );

//       rows.push({

//         "Deposit No":
//           txn.ReceiptNumber || "",

//         "Date":
//           fmtDate(txn.Date),

//         "Deposit To Account":
//           txn.Account?.DisplayID || "",

//         "Received From":
//           cleanNone(
//             txn.Contact?.Name || ""
//           ),

//         "Global Tax Calculation":
//           txn.IsTaxInclusive
//             ? "Tax Inclusive"
//             : "Tax Exclusive",

//         "Line Account":
//           line.Account?.DisplayID,

//         "Line Description":
//           line.Memo || txn.Memo || "",

//         // ✅ line amount
//         "Line Amount":
//           lineAmount,

//         "Line Class":
//           line.Job?.Name ||
//           line.Job?.Number ||
//           "",

//         // ✅ tax code
//         "Line Tax Code":
//           taxCode,

//         // ✅ fixed tax applicable
//         "Line Tax Applicable On":
//           taxApplicableOn,

//         "Location":
//           line.Location?.Name || "",

//         "Currency Code":
//           txn.ForeignCurrency?.Code || "AUD",

//         "Exchange Rate":
//           txn.CurrencyExchangeRate ?? 1,

//         "Linked Transaction Type":
//           "",

//         "Linked Transaction Number":
//           "",
//       });
//     }
//   }

//   return rows;
// };

export const flattenMYOBReceiveMoneyQBO = (items) => {
  const rows = [];

  for (const txn of items) {

    const lines = txn.Lines?.length ? txn.Lines : [{}];

    // ✅ valid lines only
    const validLines = lines.filter(
      l => (l.Amount ?? l.Total ?? "") !== ""
    );

    // ✅ total line amount
    const totalLineAmount = validLines.reduce((sum, l) => {
      return sum + Number(l.Amount ?? l.Total ?? 0);
    }, 0);

    for (const line of lines) {

      const lineAmount = Number(
        line.Amount ?? line.Total ?? 0
      );

      // ❌ skip empty rows
      if (!lineAmount) continue;

      // ✅ tax calculation
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(line.TaxAmount);

      } else if (
        txn.TotalTax &&
        totalLineAmount > 0
      ) {
        lineTaxAmt =
          (lineAmount / totalLineAmount) *
          txn.TotalTax;
      }

      // ✅ tax code
      const taxCode =
        line.TaxCode?.Code || "";

      // ✅ no-tax codes
      const noTaxCodes = ["N-T", "FRE", "NONE"];

      // ✅ tax applicable amount
      const taxApplicableOn =
        noTaxCodes.includes(taxCode)
          ? 0
          : (
            txn.IsTaxInclusive
              ? lineAmount - lineTaxAmt
              : lineAmount
          );

      rows.push({

        "Deposit No":
          txn.ReceiptNumber || "",

        "Date":
          fmtDate(txn.Date),

        "Deposit To Account":
          txn.Account?.DisplayID ||
          txn.Account?.Name ||
          "",

        "Received From":
          cleanNone(
            txn.Contact?.Name ||
            txn.Contact?.CompanyName ||
            txn.Contact?.DisplayID ||
            ""
          ),

        "Global Tax Calculation":
           txn.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",

        "Line Account":
          line.Account?.DisplayID,

        "Line Description":
          line.Memo ||
          txn.Memo ||
          "",

        // ✅ amount
        "Line Amount":
          lineAmount,

        "Line Class":
          line.Job?.Name ||
          line.Job?.Number ||
          "",

        // ✅ tax code
        "Line Tax Code":
          taxCode,

        // ✅ fixed tax applicable
        "Line Tax Applicable On":
          taxApplicableOn,

        "Location":
          line.Location?.Name || "",

        "Currency Code":
          txn.ForeignCurrency?.Code || "AUD",

        "Exchange Rate":
          txn.CurrencyExchangeRate ?? 1,

        "Linked Transaction Type":
          "",

        "Linked Transaction Number":
          "",
      });
    }
  }

  return rows;
};

// ── MYOB Transfer Money — QBO Excel Template style ────────────
// Template columns:
// Transfer Funds From | Transfer Funds To | Transfer Amount |
// Memo | Currency Code | Exchange Rate | Date

// export const flattenMYOBTransferMoneyQBO = (items) => {
//   return items.map((txn) => ({
//     "Transfer Funds From": txn.FromAccount?.DisplayID
//                              ? `${txn.FromAccount.DisplayID} ${txn.FromAccount.Name || ""}`.trim()
//                              : "",
//     "Transfer Funds To":   txn.ToAccount?.DisplayID
//                              ? `${txn.ToAccount.DisplayID} ${txn.ToAccount.Name || ""}`.trim()
//                              : "",
//     "Transfer Amount":     txn.Amount ?? "",
//     "Memo":                txn.Memo || "",
//     "Currency Code":       txn.ForeignCurrency?.Code || "AUD",
//     "Exchange Rate":       txn.CurrencyExchangeRate ?? 1,
//     "Date":                fmtDate(txn.Date),
//   }));
// };


export const flattenMYOBTransferMoneyQBO = (items) => {

  return items
    .filter((txn) => {
      const amount = Number(
        txn.Amount ?? txn.TotalAmount ?? 0
      );

      // ❌ skip empty amount rows
      return amount !== 0;
    })

    .map((txn) => {

      const amount = Number(
        txn.Amount ?? txn.TotalAmount ?? 0
      );

      return {

        "Transfer Funds From":
          txn.FromAccount?.DisplayID,

        "Transfer Funds To":
          txn.ToAccount?.DisplayID,

        // ✅ amount fix
        "Transfer Amount":
          amount,

        "Memo":
          txn.Memo || "",

        "Currency Code":
          txn.ForeignCurrency?.Code || "AUD",

        "Exchange Rate":
          txn.CurrencyExchangeRate ?? 1,

        "Date":
          fmtDate(txn.Date),
      };
    });
};
// ── Banking entry point ───────────────────────────────────────
// subType: "spend" | "receive" | "transfer"
export const flattenMYOBBanking = (items, subType) => {
  if (!items?.length) return [];
  switch (subType) {
    case "spend": return flattenMYOBSpendMoneyQBO(items);
    case "receive": return flattenMYOBReceiveMoneyQBO(items);
    case "transfer": return flattenMYOBTransferMoneyQBO(items);   // ← UPDATED
    default: return items;
  }
};

// ── MYOB General Journal — raw flat ──────────────────────────
// Endpoint: /GeneralLedger/GeneralJournal
export const flattenMYOBGeneralJournal = (items) => {
  const rows = [];

  for (const txn of items) {

    const lines = txn.Lines?.length
      ? txn.Lines
      : [{}];

    // ✅ valid lines only
    const validLines = lines.filter(
      l => (l.Amount ?? l.Total ?? "") !== ""
    );

    // ✅ total amount
    const totalLineAmount = validLines.reduce((sum, l) => {
      return sum + Number(
        l.Amount ?? l.Total ?? 0
      );
    }, 0);

    for (const line of lines) {

      const lineAmount = Number(
        line.Amount ?? line.Total ?? 0
      );

      // ❌ skip empty rows
      if (!lineAmount) continue;

      // ✅ tax amount calculation
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(line.TaxAmount);

      } else if (
        txn.TotalTax &&
        totalLineAmount > 0
      ) {
        lineTaxAmt =
          (lineAmount / totalLineAmount) *
          Number(txn.TotalTax);
      }

      // ✅ tax code
      const taxCode =
        line.TaxCode?.Code || "";

      // ✅ no tax codes
      const noTaxCodes = [
        "N-T",
        "FRE",
        "NONE"
      ];

      // ✅ final tax amount
      const finalTaxAmt =
        noTaxCodes.includes(taxCode)
          ? 0
          : lineTaxAmt;

      rows.push({

        // ✅ Template Fields

        "Journal No":
          txn.DisplayID || "",

        "Journal Date":
          fmtDate(txn.DateOccurred),

        "Memo":
          txn.Memo || line.Memo || "",

        "Account":
          line.Account?.DisplayID ||
          line.Account?.Name ||
          "",

        "Amount":
          lineAmount,

        "Description":
          line.Memo || "",

        "Name":
          line.Job?.Name ||
          line.Contact?.Name ||
          "",

        "Tax Code":
          taxCode,

        "Location":
          txn.Category?.Name ||
          line.Location?.Name ||
          "",

        "Class":
          line.Job?.Name ||
          txn.Category?.DisplayID ||
          "",

        "Currency Code":
          txn.ForeignCurrency?.Code || "",

        "Exchange Rate":
          txn.CurrencyExchangeRate ?? 1,

        "Is Adjustment":
          txn.IsYearEndAdjustment
            ? "Yes"
            : "No",
      });
    }
  }

  return rows;
};

// export const flattenMYOBGeneralJournal = (items) => {
//   const rows = [];

//   for (const txn of items) {

//     const lines = txn.Lines?.length
//       ? txn.Lines
//       : [{}];

//     // ✅ valid amount lines only
//     const validLines = lines.filter(
//       l => (l.Amount ?? l.Total ?? "") !== ""
//     );

//     // ✅ total line amount
//     const totalLineAmount = validLines.reduce((sum, l) => {
//       return sum + Number(
//         l.Amount ?? l.Total ?? 0
//       );
//     }, 0);

//     for (const line of lines) {

//       const lineAmount = Number(
//         line.Amount ?? line.Total ?? 0
//       );

//       // ❌ skip empty rows
//       if (!lineAmount) continue;

//       // ✅ tax calculation
//       let lineTaxAmt = 0;

//       if (
//         line.TaxAmount !== undefined &&
//         line.TaxAmount !== null
//       ) {
//         lineTaxAmt = Number(line.TaxAmount);

//       } else if (
//         txn.TotalTax &&
//         totalLineAmount > 0
//       ) {
//         lineTaxAmt =
//           (lineAmount / totalLineAmount) *
//           txn.TotalTax;
//       }

//       // ✅ tax code
//       const taxCode =
//         line.TaxCode?.Code || "";

//       // ✅ no-tax codes
//       const noTaxCodes = [
//         "N-T",
//         "FRE",
//         "NONE"
//       ];

//       // ✅ final tax amount
//       const finalTaxAmt =
//         noTaxCodes.includes(taxCode)
//           ? 0
//           : lineTaxAmt;

//       rows.push({

//         // ── Transaction level ──

//         "DisplayID":
//           txn.DisplayID || "",

//         "DateOccurred":
//           fmtDate(txn.DateOccurred),

//         "IsTaxInclusive":
//           txn.IsTaxInclusive ?? "",

//         "Memo":
//           txn.Memo || "",

//         "GSTReportingMethod":
//           txn.GSTReportingMethod || "",

//         "IsYearEndAdjustment":
//           txn.IsYearEndAdjustment ?? "",

//         "Category.Name":
//           txn.Category?.Name || "",

//         "Category.DisplayID":
//           txn.Category?.DisplayID || "",

//         "ForeignCurrency.Code":
//           txn.ForeignCurrency?.Code || "",

//         "ForeignCurrency.Name":
//           txn.ForeignCurrency?.CurrencyName || "",

//         "CurrencyExchangeRate":
//           txn.CurrencyExchangeRate ?? "",

//         // ── Line level ──

//         "Line.Account.DisplayID":
//           line.Account?.DisplayID || "",

//         "Line.Account.Name":
//           line.Account?.Name || "",

//         "Line.Job.Number":
//           line.Job?.Number || "",

//         "Line.Job.Name":
//           line.Job?.Name || "",

//         "Line.Memo":
//           line.Memo || "",

//         // ✅ tax code
//         "Line.TaxCode.Code":
//           taxCode,

//         // ✅ amount
//         "Line.Amount":
//           lineAmount,

//         "Line.AmountForeign":
//           line.AmountForeign ?? "",

//         // ✅ fixed tax amount
//         "Line.TaxAmount":
//           finalTaxAmt,

//         "Line.Credit/Debit":
//           line.IsCredit
//             ? "Credit"
//             : "Debit",

//         "Line.IsCredit":
//           line.IsCredit,

//         "Line.TaxAmountForeign":
//           line.TaxAmountForeign ?? "",

//         "Line.IsOverriddenTaxAmount":
//           line.IsOverriddenTaxAmount ?? "",

//         "Line.UnitCount":
//           line.UnitCount ?? "",
//       });
//     }
//   }

//   return rows;
// };

// ── MYOB Sale Quote — raw flat ────────────────────────────────
// Endpoint: /Sale/Quote or /Sale/Quote/{subType}
export const flattenMYOBQuote = (quotes, businessName) => {
  const rows = [];

  for (const quote of quotes) {
    const lines = quote.Lines?.length ? quote.Lines : [{}];
    const orgName = businessName || quote.CompanyFile?.Name || "";

    for (const line of lines) {
      rows.push({
        // ───────── QUOTE FIELDS ─────────
        "Organization Name": orgName,
        "UID": quote.UID || "",
        "Number": quote.Number || "",
        "Date": fmtDate(quote.Date),
        "CustomerPurchaseOrderNumber": quote.CustomerPurchaseOrderNumber || "",
        "QuoteType": quote.QuoteType || "",
        "Status": quote.Status || "",

        "IsTaxInclusive": quote.IsTaxInclusive ?? "",
        "Subtotal": quote.Subtotal ?? "",
        "Freight": quote.Freight ?? "",
        "TotalTax": quote.TotalTax ?? "",
        "TotalAmount": quote.TotalAmount ?? "",
        "BalanceDueAmount": quote.BalanceDueAmount ?? "",

        "Category": quote.Category?.Name || "",
        "Salesperson": quote.Salesperson?.Name || "",
        "JournalMemo": quote.JournalMemo || "",
        "ReferralSource": quote.ReferralSource || "",

        "ForeignCurrency": quote.ForeignCurrency?.Code || "",
        "CurrencyExchangeRate": quote.CurrencyExchangeRate ?? "",

        "URI": quote.URI || "",
        "RowVersion": quote.RowVersion || "",

        // ───────── CUSTOMER ─────────
        "Customer.UID": quote.Customer?.UID || "",
        "Customer.Name": cleanNone(quote.Customer?.Name),
        "Customer.DisplayID": quote.Customer?.DisplayID || "",
        "Customer.URI": quote.Customer?.URI || "",

        // ───────── TERMS ─────────
        "Terms.PaymentIsDue": quote.Terms?.PaymentIsDue || "",
        "Terms.DiscountDate": fmtDate(quote.Terms?.DiscountDate),
        "Terms.BalanceDueDate": fmtDate(quote.Terms?.BalanceDueDate),
        "Terms.DiscountForEarlyPayment": quote.Terms?.DiscountForEarlyPayment ?? "",
        "Terms.MonthlyChargeForLatePayment": quote.Terms?.MonthlyChargeForLatePayment ?? "",
        "Terms.DiscountExpiryDate": fmtDate(quote.Terms?.DiscountExpiryDate),
        "Terms.Discount": quote.Terms?.Discount ?? "",
        "Terms.DueDate": fmtDate(quote.Terms?.DueDate),
        "Terms.FinanceCharge": quote.Terms?.FinanceCharge ?? "",

        // ───────── FREIGHT TAX ─────────
        "FreightTaxCode.UID": quote.FreightTaxCode?.UID || "",
        "FreightTaxCode.Code": quote.FreightTaxCode?.Code || "",
        "FreightTaxCode.URI": quote.FreightTaxCode?.URI || "",

        // ───────── LINE FIELDS ─────────
        "Line.RowID": line.RowID || "",
        "Line.Type": line.Type || "",
        "Line.Description": line.Description || "",
        "Line.Quantity": line.ShipQuantity ?? line.Quantity ?? "",
        "Line.UnitOfMeasure": line.UnitOfMeasure || "",
        "Line.UnitPrice": line.UnitPrice ?? "",
        "Line.DiscountPercent": line.DiscountPercent ?? "",
        "Line.Total": line.Total ?? "",

        // Account
        "Line.Account.UID": line.Account?.UID || "",
        "Line.Account.Name": line.Account?.Name || "",
        "Line.Account.DisplayID": line.Account?.DisplayID || "",

        // Item
        "Line.Item.Number": line.Item?.Number || "",
        "Line.Item.Name": line.Item?.Name || "",

        // Job
        "Line.Job.UID": line.Job?.UID || "",
        "Line.Job.Number": line.Job?.Number || "",
        "Line.Job.Name": line.Job?.Name || "",

        // Tax
        "Line.TaxCode.UID": line.TaxCode?.UID || "",
        "Line.TaxCode.Code": line.TaxCode?.Code || "",

        "Line.RowVersion": line.RowVersion || "",
      });
    }
  }

  return rows;
};