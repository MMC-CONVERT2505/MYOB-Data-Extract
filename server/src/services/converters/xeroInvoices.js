
import { cleanNone, fmtDate } from "../helpers.js";

export const flattenXeroInvoices = (invoices) => {

  const rows = [];

  for (const inv of invoices) {

    const lines = inv.Lines?.length
      ? inv.Lines
      : [{}];

    const contactName = cleanNone(
      inv.Customer?.CompanyName ||
      inv.Customer?.Name ||
      inv.Customer?.DisplayID
    );

    // ✅ valid amount lines only
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

      // ✅ item/service detection
      const isService =
        !line.Item?.Number &&
        !line.Item?.Name;

      // ✅ quantity logic
      const quantity = isService
        ? 1
        : (
            line.Quantity ??
            line.ShipQuantity ??
            line.UnitCount ??
            1
          );

      // ✅ tax code
      const taxCode =
        line.TaxCode?.Code || "NONE";

      // ✅ no-tax codes
      const noTaxCodes = [
        "N-T",
        "FRE",
        "NONE"
      ];

      // ✅ tax fix FIRST
      let lineTaxAmt = 0;

      if (
        line.Tax !== undefined &&
        line.Tax !== null
      ) {
        lineTaxAmt = Number(line.Tax);

      } else if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(line.TaxAmount);

      } else if (
        inv.TotalTax &&
        totalLineAmount > 0
      ) {
        lineTaxAmt =
          (lineAmount / totalLineAmount) *
          Number(inv.TotalTax);
      }

      // ✅ no-tax handling
      if (
        noTaxCodes.includes(taxCode)
      ) {
        lineTaxAmt = 0;
      }

      // ✅ unit amount logic
      const unitAmount = isService
        ? lineAmount
        : Number(
            line.UnitPrice ?? 0
          );

      // ✅ item code + name concat
      const itemName =
        [
          line.Item?.Number,
          line.Item?.Name
        ]
          .filter(Boolean)
          .join(" ");

      rows.push({

        "*ContactName":
          contactName,

        "EmailAddress":
          inv.Customer?.Email || "",

        "*InvoiceNumber":
          inv.Number || "",

        "Reference":
          inv.CustomerPurchaseOrderNumber || "",

        "Invoice Date":
          fmtDate(inv.Date),

        "Due Date":
          fmtDate(
            inv.Terms?.DueDate
          ),

        "Total":
          inv.TotalAmount ?? "",

        // ✅ item code/name
        "InventoryItemCode":
          itemName,

        "*Description":
          line.Description || "",

        // ✅ fixed qty
        "*Quantity":
          quantity,

        // ✅ fixed unit amount
        "*UnitAmount":
          unitAmount,

        "Discount":
          line.DiscountPercent ?? "",

        "*lineAmount":
          lineAmount,

        "*AccountCode":
          line.Account?.DisplayID || "",

        "*TaxType":
          taxCode,

        // ✅ fixed tax amount
        "TaxAmount":
          Number(
            lineTaxAmt.toFixed(2)
          ),

        "TrackingName1":
          "",

        "TrackingOption1":
          "",

        "TrackingName2":
          "",

        "TrackingOption2":
          "",

        "Currency":
          inv.ForeignCurrency?.Code || "AUD",

        "BrandingTheme":
          "",

        "LineAmountType":
          inv.IsTaxInclusive
            ? "Inclusive"
            : "Exclusive",

        // ✅ NEW FIELDS

        "PO Number":
          inv.CustomerPurchaseOrderNumber ||
          inv.Order?.Number ||
          "",

        "Exchange Rate":
          inv.CurrencyExchangeRate ?? 1,
      });
    }
  }

  return rows;
};

// ── Xero Invoice Payments ─────────────────────────────────────
// export const flattenXeroInvoicePayments = (payments) => {
//   const rows = [];

//   for (const p of payments) {
//     const invoices   = p.Invoices?.length ? p.Invoices : [{}];
//     const bankAccount = [p.Account?.DisplayID, p.Account?.Name].filter(Boolean).join(" - ");

//     for (const inv of invoices) {
//       const invoiceNo = inv.Number || inv.InvoiceNumber || "";
//       const amount    = inv.AmountApplied ?? inv.Amount ?? p.AmountReceived ?? "";

//       rows.push({
//         "Date":         fmtDate(p.Date),          // ✅ Fixed
//         "Invoice No":   invoiceNo,
//         "Amount":       amount,
//         "Bank":         bankAccount,
//         "Reference":    p.ReceiptNumber || p.PaymentNumber || p.Memo || "",
//         "CurrencyRate": p.CurrencyExchangeRate ?? 1,
//       });
//     }
//   }

//   return rows;
// };


export const flattenXeroInvoicePayments = (payments) => {
  const rows = [];

  for (const p of payments) {
    const invoices = p.Invoices?.length ? p.Invoices : [{}];

    const bankAccount = p.Account?.DisplayID;

    // ✅ CONTACT (Customer)
    const contactName = cleanNone(
      p.Customer?.CompanyName ||
      p.Customer?.Name ||
      p.Customer?.DisplayID
    );

    for (const inv of invoices) {
      const invoiceNo =
        inv.Number ||
        inv.InvoiceNumber ||
        "";

      const amount =
        inv.AmountApplied ??
        inv.Amount ??
        p.AmountReceived ??
        "";

      rows.push({
        // ✅ NEW FIELD
        "ContactName": contactName,

        "Date": fmtDate(p.Date),

        "Invoice No": invoiceNo,

        "Amount": amount,

        "Bank": bankAccount,

        "Reference":
          p.ReceiptNumber ||
          p.PaymentNumber ||
          p.Memo ||
          "",

        "CurrencyRate": p.CurrencyExchangeRate ?? 1,
      });
    }
  }

  return rows;
};
// ═══════════════════════════════════════════════════════════════
// Xero Banking — Spend Money & Receive Money (SAME TEMPLATE)
// Date | Amount | Description | Payee | Reference |
// Transaction type | Account Code | Tax | Bank |
// Item Code | Currency rate | Tname | Toption |
// Tname1 | Toption1 | Line Amount Type
// ═══════════════════════════════════════════════════════════════
// export const flattenXeroSpendReceive = (items, subType) => {
//   const rows = [];
//   const txnType = subType === "spend" ? "SPEND" : "RECEIVE";

//   for (const txn of items) {
//     const lines = txn.Lines?.length ? txn.Lines : [{}];

//     // Bank account — the main account for spend/receive
//     const bank = txn.Account?.DisplayID || txn.Account?.Name || "";

//     // Payee — Contact/Supplier/Customer
//     const payee = cleanNone(
//       txn.Contact?.CompanyName || txn.Contact?.Name ||
//       txn.Supplier?.CompanyName || txn.Supplier?.Name ||
//       txn.Customer?.CompanyName || txn.Customer?.Name || ""
//     );

//     for (const line of lines) {
//       const lineAmount = Number(line.Amount ?? line.Total ?? 0);
//       if (!lineAmount) continue;

//       rows.push({
//         "Date":              fmtDate(txn.Date),
//         "Amount":            lineAmount,
//         "Description":       line.Description || txn.Memo || txn.Description || "",
//         "Payee":             payee,
//         "Reference":         txn.PaymentNumber || txn.ReceiptNumber || txn.Memo || "",
//         "Transaction type":  txnType,
//         "Account Code":      line.Account?.DisplayID || "",
//         "Tax":               line.TaxCode?.Code || line.TaxType || "",
//         "Bank":              bank,
//         "Item Code":         line.Item?.Number || line.Item?.Name || "",
//         "Currency rate":     txn.CurrencyExchangeRate ?? 1,
//         "Tname":             "",
//         "Toption":           "",
//         "Tname1":            "",
//         "Toption1":          "",
//         "Line Amount Type":  txn.IsTaxInclusive ? "Inclusive" : "Exclusive",
//       });
//     }
//   }
//   return rows;
// };

export const flattenXeroSpendReceive = (items, subType) => {
  const rows = [];
  const txnType = subType === "spend" ? "SPEND" : "RECEIVE";

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

    // ✅ bank account
    const bank =
      txn.Account?.DisplayID ||
      txn.Account?.Name ||
      "";

    // ✅ payee
    const payee = cleanNone(
      txn.Contact?.CompanyName ||
      txn.Contact?.Name ||

      txn.Supplier?.CompanyName ||
      txn.Supplier?.Name ||

      txn.Customer?.CompanyName ||
      txn.Customer?.Name ||

      ""
    );

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
        line.TaxCode?.Code ||
        line.TaxType ||
        "";

      // ✅ no-tax codes
      const noTaxCodes = ["N-T", "FRE", "NONE"];

      // ✅ tax value
      const taxValue =
        noTaxCodes.includes(taxCode)
          ? 0
          : lineTaxAmt;

      rows.push({

        "Date":
          fmtDate(txn.Date),

        "Amount":
          lineAmount,

        "Description":
          line.Description ||
          txn.Memo ||
          txn.Description ||
          "",

        "Payee":
          payee || "No Name",

        "Reference":
          txn.PaymentNumber ||
          txn.ReceiptNumber ||
          txn.Memo ||
          "",

        "Line Amount":
          lineAmount,

        "Transaction type":
          txnType,

        "Account Code":
          line.Account?.DisplayID || "",

        // ✅ fixed tax
        "Tax":
          taxCode,

        "Tax Amount":
          taxValue,

        "Bank":
          bank,

        "Item Code":
          line.Item?.Number ||
          line.Item?.Name ||
          "",

        "Currency rate":
          txn.CurrencyExchangeRate ?? 1,

        "Tname":
          "",

        "Toption":
          "",

        "Tname1":
          "",

        "Toption1":
          "",

        "Line Amount Type":
          txn.IsTaxInclusive ? "Tax Inclusive" : "Tax Exclusive",
      });
    }
  }

  return rows;
};

// ═══════════════════════════════════════════════════════════════
// Xero Transfer Money
// Date | Amount | From Account | To Account
// ═══════════════════════════════════════════════════════════════
// export const flattenXeroTransfer = (items) => {
//   const rows = [];

//   for (const txn of items) {
//     rows.push({
//       "Date":         fmtDate(txn.Date),
//       "Amount":       txn.Amount ?? txn.TotalAmount ?? "",
//       "From Account": txn.FromAccount?.DisplayID || txn.FromAccount?.Name || "",
//       "To Account":   txn.ToAccount?.DisplayID   || txn.ToAccount?.Name   || "",
//     });
//   }
//   return rows;
// };

export const flattenXeroTransfer = (items) => {
  const rows = [];

  for (const txn of items) {

    // ✅ amount fix
    const amount = Number(
      txn.Amount ?? txn.TotalAmount ?? 0
    );

    // ❌ skip empty amount rows
    if (!amount) continue;

    rows.push({

      "Date":
        fmtDate(txn.Date),

      "Amount":
        amount,

      "From Account":
        txn.FromAccount?.DisplayID ||
        txn.FromAccount?.Name ||
        "",

      "To Account":
        txn.ToAccount?.DisplayID ||
        txn.ToAccount?.Name ||
        "",
    });
  }

  return rows;
};
// ═══════════════════════════════════════════════════════════════
// Xero General Journal
// Narration | Date | Description | AccountCode | TaxRate |
// Amount | TrackingName1 | TrackingOption1 |
// TrackingName2 | TrackingOption2 | LineAmountType | Status
// ═══════════════════════════════════════════════════════════════
// export const flattenXeroJournal = (items) => {
//   const rows = [];

//   for (const jnl of items) {
//     const lines = jnl.Lines?.length ? jnl.Lines : [{}];

//     // Narration — journal-level memo/description
//     const narration = jnl.Memo || jnl.Description || jnl.Narration || jnl.JournalMemo || "";

//     for (const line of lines) {
//       const lineAmount = Number(line.Amount ?? line.Total ?? 0);
//       if (!lineAmount) continue;

//       rows.push({
//         "Narration":        narration,
//         "Date":             fmtDate(jnl.Date || jnl.DateOccurred),
//         "Description":      line.Description || "",
//         "AccountCode":      line.Account?.DisplayID || "",
//         "TaxRate":          line.TaxCode?.Code || "",
//         "Amount":           lineAmount,
//         "TrackingName1":    "",
//         "TrackingOption1":  "",
//         "TrackingName2":    "",
//         "TrackingOption2":  "",
//         "LineAmountType":   jnl.IsTaxInclusive ? "Inclusive" : "Exclusive",
//         "Status":           jnl.Status || "",
//       });
//     }
//   }
//   return rows;
// };


export const flattenXeroJournal = (items) => {
  const rows = [];

  for (const jnl of items) {

    const lines = jnl.Lines?.length
      ? jnl.Lines
      : [{}];

    // ✅ narration
    const narration =
      jnl.Memo ||
      jnl.Description ||
      jnl.Narration ||
      jnl.JournalMemo ||
      "";

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

      // ✅ signed amount
      const signedAmount = line.IsCredit
        ? -Math.abs(lineAmount)
        : Math.abs(lineAmount);

      // ✅ tax calculation
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(line.TaxAmount);

      } else if (
        jnl.TotalTax &&
        totalLineAmount > 0
      ) {
        lineTaxAmt =
          (lineAmount / totalLineAmount) *
          jnl.TotalTax;
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

      // ✅ final tax amount
      const finalTaxAmt =
        noTaxCodes.includes(taxCode)
          ? 0
          : lineTaxAmt;

      rows.push({

        "Narration":
          narration,

        "Date":
          fmtDate(
            jnl.Date ||
            jnl.DateOccurred
          ),

        "Description":
          line.Description || "",

        "AccountCode":
          line.Account?.DisplayID || "",

        // ✅ tax code
        "TaxRate":
          taxCode,

        // ✅ signed amount
        "Amount":
          signedAmount,

        // ✅ tax amount
        "TaxAmount":
          finalTaxAmt,

        "TrackingName1":
          "",

        "TrackingOption1":
          "",

        "TrackingName2":
          "",

        "TrackingOption2":
          "",

        "LineAmountType":
          jnl.IsTaxInclusive
            ? "Inclusive"
            : "Exclusive",

        "Status":
          jnl.Status || "",
      });
    }
  }

  return rows;
};

