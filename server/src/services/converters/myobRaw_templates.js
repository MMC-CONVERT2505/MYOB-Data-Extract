import { cleanNone, fmtDate } from "../helpers.js";

// ─────────────────────────────────────────────────────────────────────────────
// MYOB RAW TEMPLATES
// Purpose : Export ALL API fields as flat rows for Excel (MYOB Raw format).
//           These are separate from the QBO-style templates (limited columns).
//           Each function name ends with "Raw" to avoid clashing with the
//           existing QBO variants.
//
// Functions exported:
//   flattenMYOBSpendMoneyRaw      – /Banking/SpendMoneyTxn
//   flattenMYOBReceiveMoneyRaw    – /Banking/ReceiveMoneyTxn
//   flattenMYOBTransferMoneyRaw   – /Banking/TransferMoneyTxn  (no Lines[])
//   flattenMYOBGeneralJournalRaw  – /GeneralLedger/GeneralJournal
// ─────────────────────────────────────────────────────────────────────────────


// ── 1. MYOB Spend Money — ALL fields flat ────────────────────────────────────
// Endpoint : GET /Banking/SpendMoneyTxn
//
// Transaction-level fields (repeated per line row):
//   UID, PaymentNumber, Date, Account (bank), Contact, Memo,
//   AmountPaid, TotalTax, IsTaxInclusive, ChequePrinted, DeliveryStatus,
//   StatementParticulars, StatementCode, StatementReference,
//   Category, ForeignCurrency, CurrencyExchangeRate, URI, RowVersion
//
// Line-level fields (one row per line):
//   RowID, Account, Amount, AmountForeign, TaxAmount, TaxAmountForeign,
//   TaxCode, Job, Memo, UnitCount, IsOverriddenTaxAmount, RowVersion
// ─────────────────────────────────────────────────────────────────────────────
// export const flattenMYOBSpendMoneyRaw = (items) => {

//   const rows = [];

//   for (const txn of items) {

//     const lines = txn.Lines?.length
//       ? txn.Lines
//       : [{}];

//     // ✅ valid lines only
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

//       // ✅ service detection
//       const isService =
//         !line.Item?.Number &&
//         !line.Item?.Name;

//       // ✅ quantity
//       const quantity = isService
//         ? 1
//         : (
//             line.Quantity ??
//             line.UnitCount ??
//             line.ShipQuantity ??
//             1
//           );

//       // ✅ unit amount
//       const unitAmount = isService
//         ? lineAmount
//         : Number(
//             line.UnitPrice ?? 0
//           );

//       // ✅ tax code
//       const taxCode =
//         line.TaxCode?.Code || "";

//       // ✅ no-tax codes
//       const noTaxCodes = [
//         "N-T",
//         "FRE",
//         "NONE"
//       ];

//       // ✅ tax amount fix
//       let taxAmount = 0;

//       if (
//         line.TaxAmount !== undefined &&
//         line.TaxAmount !== null
//       ) {
//         taxAmount = Number(
//           line.TaxAmount
//         );

//       } else if (
//         txn.TotalTax &&
//         totalLineAmount > 0
//       ) {
//         taxAmount =
//           (lineAmount / totalLineAmount) *
//           Number(txn.TotalTax);
//       }

//       // ✅ no tax
//       if (
//         noTaxCodes.includes(taxCode)
//       ) {
//         taxAmount = 0;
//       }

//       // ✅ item name
//       const itemName = [
//         line.Item?.Number,
//         line.Item?.Name
//       ]
//         .filter(Boolean)
//         .join(" ");

//       rows.push({

//         // ───── TEMPLATE FIELDS ─────

//         "Date*":
//           fmtDate(txn.Date),

//         "Bank Account*":
//           txn.Account?.DisplayID || "",

//         "Contact*":
//           cleanNone(
//             txn.Contact?.Name ||
//             txn.Contact?.CompanyName ||
//             txn.Contact?.DisplayID
//           ),

//         "Payable type":
//           txn.Contact?.Type || "",

//         "Payment method":
//           txn.PaymentMethod || "",

//         "Reference":
//           txn.PaymentNumber || "",

//         "Details":
//           txn.Memo || "",

//         "Amount*":
//           txn.IsTaxInclusive
//             ? "Tax Inclusive"
//             : "Tax Exclusive",

//         "Allocation notes":
//           txn.Memo || "",

//         "classification":
//           line.Job?.Name ||
//           line.Job?.Number ||
//           "",

//         // ✅ item/service
//         "Item":
//           itemName,

//         // ✅ fixed item price
//         "Item price":
//           unitAmount,

//         "Account":
//           line.Account?.DisplayID || "",

//         // ✅ line description
//         "Description":
          
//           line.Memo ||
          
//           "",

//         // ✅ fixed qty
//         "Qty":
//           quantity,

//         "Discount":
//           line.DiscountPercent ?? "",

//         "Tax code":
//           taxCode,

//         // ✅ fixed tax amount
//         "Tax Amount":
//           Number(
//             taxAmount
//           ),

//         "Amount":
//           lineAmount,

//       });
//     }
//   }

//   return rows;
// };

export const flattenMYOBSpendMoneyRaw = (items) => {

  const rows = [];

  for (const txn of items) {

    const lines = txn.Lines?.length
      ? txn.Lines
      : [{}];

    // ✅ valid lines only
    const validLines = lines.filter(
      l =>
        l.Amount !== undefined ||
        l.Total !== undefined
    );

    // ✅ total line amount
    const totalLineAmount = validLines.reduce((sum, l) => {

      return sum + Number(
        l.Amount ??
        l.Total ??
        0
      );

    }, 0);

    for (const line of lines) {

      // ✅ FIXED amount logic
      const lineAmount = Number(
        line.Amount ??
        line.Total ??
        txn.AmountPaid ??
        0
      );

      // ❌ skip only invalid
      if (
        lineAmount === null ||
        lineAmount === undefined ||
        Number.isNaN(lineAmount)
      ) {
        continue;
      }

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
        : Number(
            line.UnitPrice ?? 0
          );

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

        taxAmount = Number(
          line.TaxAmount
        );

      } else if (
        txn.TotalTax &&
        totalLineAmount > 0
      ) {

        taxAmount =
          (lineAmount / totalLineAmount) *
          Number(txn.TotalTax);
      }

      // ✅ no tax
      if (
        noTaxCodes.includes(taxCode)
      ) {
        taxAmount = 0;
      }

      // ✅ item name
      const itemName = [
        line.Item?.Number,
        line.Item?.Name
      ]
        .filter(Boolean)
        .join(" ");

      rows.push({

        // ───── TEMPLATE FIELDS ─────

        "Date*":
          txn.Date,

        "Bank Account*":
          txn.Account?.DisplayID || "",

        "Bank Name*":
          txn.Account?.Name || "",

        "Contact*":
          cleanNone(
            txn.Contact?.Name ||
            txn.Contact?.CompanyName ||
            txn.Contact?.DisplayID
          ),

        "Payable type":
          txn.Contact?.Type || "",

        "Payment method":
          txn.PaymentMethod || "",

        "Reference":
          txn.PaymentNumber || "",

        "Details":
          txn.Memo || "",

        "Amount*":
          txn.IsTaxInclusive
            ? "Tax Inclusive"
            : "Tax Exclusive",

        "Allocation notes":
          txn.Memo || "",

        "classification":
          line.Job?.Name ||
          line.Job?.Number ||
          "",

        // ✅ item/service
        "Item":
          itemName,

        // ✅ fixed item price
        "Item price":
          unitAmount,

        "Account":
          line.Account?.DisplayID || "",

        // ✅ line description
        "Description":
          line.Memo || "",

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

        // ✅ UID
        "UID":
          txn.UID || "",
      });
    }
  }

  return rows;
};

// ── 2. MYOB Receive Money — ALL fields flat ──────────────────────────────────
// Endpoint : GET /Banking/ReceiveMoneyTxn
//
// Transaction-level fields (repeated per line row):
//   UID, ReceiptNumber, Date, DepositTo, Account (bank), Contact, Memo,
//   AmountReceived, TotalTax, IsTaxInclusive, PaymentMethod,
//   Category, ForeignCurrency, CurrencyExchangeRate, URI, RowVersion
//
// Line-level fields (one row per line):
//   RowID, Account, Amount, AmountForeign, TaxAmount, TaxAmountForeign,
//   TaxCode, Job, Memo, UnitCount, IsOverriddenTaxAmount, RowVersion
// ─────────────────────────────────────────────────────────────────────────────
export const flattenMYOBReceiveMoneyRaw = (items) => {
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
        txn.TotalTax &&
        totalLineAmount > 0
      ) {
        taxAmount =
          (lineAmount / totalLineAmount) *
          Number(txn.TotalTax);
      }

      // ✅ no tax
      if (
        noTaxCodes.includes(taxCode)
      ) {
        taxAmount = 0;
      }

      // ✅ item name
      const itemName = line.Item?.Number
         
      rows.push({

        // ───── TEMPLATE FIELDS ─────

        "Date":
          fmtDate(txn.Date),

        "Bank Account*":
          txn.Account?.DisplayID
            ,

        "Bank Name":
          txn.Account?.Name
            ,
        "Contact*":
          cleanNone(
            txn.Contact?.Name ||
            txn.Contact?.CompanyName ||
            txn.Contact?.DisplayID
          ),

        "Payment method":
          txn.PaymentMethod || "",

        "Reference":
          txn.ReceiptNumber || "",

        "Details":
          txn.Memo || "",

        "Amount*":
          txn.IsTaxInclusive
            ? "Tax Inclusive"
            : "Tax Exclusive",

        "Allocation notes":
          txn.Memo || "",

        "classification":
          line.Job?.Name ||
          line.Job?.Number ||
          "",

        // ✅ item/service
        "Item":
          itemName,

        // ✅ fixed item price
        "Item price":
          unitAmount,

        "Account":
          line.Account?.DisplayID || "",

        "Description":
         
          line.Memo ||
         
          "",

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

        "UID":
          txn.UID || "",
      });
    }
  }

  return rows;
};


// ── 3. MYOB Transfer Money — ALL fields flat ─────────────────────────────────
// Endpoint : GET /Banking/TransferMoneyTxn
// NOTE     : Transfer Money has NO Lines[] array — each transaction = 1 row.
//
// Fields:
//   UID, TransferNumber, Date, FromAccount, ToAccount,
//   Amount, AmountForeign, Memo,
//   Category, ForeignCurrency, CurrencyExchangeRate,
//   URI, RowVersion
// ─────────────────────────────────────────────────────────────────────────────
export const flattenMYOBTransferMoneyRaw = (items) => {

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

        // ───── TEMPLATE FIELDS ─────

        "Date":
          fmtDate(txn.Date),

        "Amount":
          amount,

        "Transfer from":
          txn.FromAccount?.DisplayID
          ,

        "Transfer to":
          txn.ToAccount?.DisplayID
            ,

        "Description":
          txn.Memo || "",
      };
    });
};


// ── 4. MYOB General Journal — ALL fields flat ────────────────────────────────
// Endpoint : GET /GeneralLedger/GeneralJournal
//
// Transaction-level fields (repeated per line row):
//   UID, DisplayID, DateOccurred, Memo, GSTReportingMethod,
//   IsTaxInclusive, IsYearEndAdjustment,
//   Category, ForeignCurrency, CurrencyExchangeRate,
//   URI, RowVersion
//
// Line-level fields (one row per line):
//   RowID, Account, IsCredit, Amount, AmountForeign,
//   TaxCode, TaxAmount, TaxAmountForeign, IsOverriddenTaxAmount,
//   Job, Memo, UnitCount, RowVersion
//
// Computed convenience column:
//   "Line.Credit/Debit"  →  "Credit" | "Debit"
// ─────────────────────────────────────────────────────────────────────────────
export const flattenMYOBGeneralJournalRaw = (items) => {
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

      const rawAmount = Number(
        line.Amount ?? line.Total ?? 0
      );

      // ❌ skip empty rows
      if (!rawAmount) continue;

      // ✅ credit/debit handling
      const isCredit =
        line.IsCredit === true;

      const debitAmount =
        !isCredit
          ? rawAmount
          : "";

      const creditAmount =
        isCredit
          ? rawAmount
          : "";

      // ✅ signed amount
      const signedAmount =
        isCredit
          ? -rawAmount
          : rawAmount;

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
        txn.TotalTax &&
        totalLineAmount > 0
      ) {
        taxAmount =
          (rawAmount / totalLineAmount) *
          Number(txn.TotalTax);
      }

      // ✅ no tax
      if (
        noTaxCodes.includes(taxCode)
      ) {
        taxAmount = 0;
      }

      rows.push({

        // ───── TEMPLATE FIELDS ─────

        "Journal Date*":
          fmtDate(
            txn.DateOccurred
          ),

        "Amount*":
          signedAmount,

        "Summary":
          txn.DisplayID || "",

        "Narration":
          txn.Memo || "",

        "Description":
          line.Memo || "",

        "Account":
          line.Account?.DisplayID || "",

        "Account Name":
          line.Account?.Name || "",

        // ✅ debit
        "Debit":
          debitAmount,

        // ✅ credit
        "Credit":
          creditAmount,

        "Tax code":
          taxCode,

        "Tax":
          Number(
            taxAmount
          ),

        "Contact":
          "",

        "Trans Type":
          "Journal",

        "classification":
          line.Job?.Name ||
          line.Job?.Number ||
          "",

        "UID":
          txn.UID || "",
      });
    }
  }

  return rows;
};