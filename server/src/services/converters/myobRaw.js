

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
    const validLines = lines.filter(l => {
      const amount = Number(
        l.Total ?? l.Amount ?? 0
      );

      return amount !== 0;
    });

    // ✅ total line amount
    const totalLineAmount = validLines.reduce((sum, l) => {
      return sum + Number(
        l.Total ?? l.Amount ?? 0
      );
    }, 0);

    const taxableLines = validLines.filter(l => {
      const taxCode =
        l.TaxCode?.Code || "";

      return ![
        "N-T",
        "FRE",
        "NONE"
      ].includes(taxCode);
    });

    const taxableAmount =
      taxableLines.reduce(
        (sum, l) =>
          sum + Number(
            l.Total ?? l.Amount ?? 0
          ),
        0
      );

    let distributedTax = 0;

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

        // ✅ fixed item price
        "Item price":
          unitAmount,

        "Account":
          line.Account?.DisplayID || "",

        "Account Name":
          line.Account?.Name || "",

        // ✅ MOVE HERE FOR TESTING
        "Item Name":
          line.Item?.Name || "",

        "Item Code":
          line.Item?.Number || "",

        "Description":
          line.Description || "",

        // ✅ fixed qty
        "Qty":
          quantity,

        "Discount":
          line.DiscountPercent ?? "",

        "Tax code":
          taxCode,

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

        "Freight Amount":
          inv.Freight ??
          inv.FreightAmount ??
          "",

        "Freight Tax Code":
          inv.FreightTaxCode?.Code ||
          "",

        "Freight Tax Amount":
          inv.FreightTaxAmount ??
          "",

        "UID":
          inv.UID
      });
    }
  }

  return rows;
};


export const flattenMYOBBillRaw = (bills, businessName) => {

  const rows = [];



  for (const bill of bills) {

    const lines =
      bill.Lines?.length
        ? bill.Lines
        : [{}];

    const noTaxCodes = [
      "N-T",
      "FRE",
      "NONE"
    ];

    // Taxable lines only
    const taxableLines = lines.filter(l => {
      const taxCode = l.TaxCode?.Code || "";

      const amount = Number(
        l.Total ?? l.Amount ?? 0
      );

      return (
        amount !== 0 &&
        !noTaxCodes.includes(taxCode)
      );
    });

    const taxableAmount =
      taxableLines.reduce(
        (sum, l) =>
          sum +
          Number(
            l.Total ??
            l.Amount ??
            0
          ),
        0
      );

    let distributedTax = 0;

    for (let index = 0; index < lines.length; index++) {

      const line = lines[index];

      const lineAmount = Number(
        line.Total ??
        line.Amount ??
        0
      );

      if (!lineAmount) continue;

      const taxCode =
        line.TaxCode?.Code || "";

      const isService =
        !line.Item?.Number &&
        !line.Item?.Name;

      const quantity =
        isService
          ? 1
          : (
            line.Quantity ??
            line.UnitCount ??
            line.BillCount ??
            1
          );

      const unitAmount =
        isService
          ? lineAmount
          : Number(
            line.UnitPrice ?? 0
          );

      let taxAmount = 0;

      // =================================================
      // TAX EXCLUSIVE
      // =================================================
      if (!bill.IsTaxInclusive) {

        if (
          !noTaxCodes.includes(
            taxCode
          )
        ) {

          if (
            line.TaxAmount !== undefined &&
            line.TaxAmount !== null
          ) {

            taxAmount =
              Number(
                line.TaxAmount
              );

          } else {

            taxAmount =
              Number(
                (
                  lineAmount * 0.10
                ).toFixed(2)
              );
          }
        }
      }

      // =================================================
      // TAX INCLUSIVE
      // =================================================
      else {

        if (
          !noTaxCodes.includes(
            taxCode
          )
        ) {

          if (
            line.TaxAmount !== undefined &&
            line.TaxAmount !== null
          ) {

            taxAmount =
              Number(
                line.TaxAmount
              );

          } else if (
            bill.TotalTax &&
            taxableAmount > 0
          ) {

            const taxableIndexes =
              lines
                .map((l, i) => ({
                  line: l,
                  index: i
                }))
                .filter(
                  x =>
                    !noTaxCodes.includes(
                      x.line.TaxCode?.Code || ""
                    ) &&
                    Number(
                      x.line.Total ??
                      x.line.Amount ??
                      0
                    ) !== 0
                )

            const isLastTaxableLine =
              index ===
              taxableIndexes[
                taxableIndexes.length - 1
              ]?.index;

            if (
              isLastTaxableLine
            ) {

              taxAmount =
                Number(
                  (
                    Number(
                      bill.TotalTax
                    ) -
                    distributedTax
                  ).toFixed(2)
                );

            } else {

              taxAmount =
                Number(
                  (
                    (
                      lineAmount /
                      taxableAmount
                    ) *
                    Number(
                      bill.TotalTax
                    )
                  ).toFixed(2)
                );

              distributedTax +=
                taxAmount;
            }
          }
        }
      }


      rows.push({

        "Supplier":
          cleanNone(
            bill.Supplier?.Name ||
            bill.Supplier?.CompanyName
          ),

        "Bill Date":
          fmtDate(
            bill.Date
          ),

        "Due Date":
          fmtDate(
            bill.Terms?.DueDate
          ),

        "Reference code":
          bill.Number || "",

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

        "Item Name":
          line.Item?.Name || "",

        "Item Code":
          line.Item?.Number || "",
        "Item price":
          unitAmount,

        "Account":
          line.Account?.DisplayID || "",

        "Account Name":
          line.Account?.Name || "",

        "Description":
          line.Description || "",

        "Qty":
          quantity,

        "Discount":
          line.DiscountPercent ?? "",

        "Tax code":
          taxCode,

        "Tax Amount":
          taxAmount,

        "Amount":
          lineAmount,

        "NOTES":
          bill.Comment || "",

        "Freight Amount":
          bill.Freight ??
          bill.FreightAmount ??
          "",

        "Freight Tax Code":
          bill.FreightTaxCode?.Code ||
          "",

        "Freight Tax Amount":
          bill.FreightTaxAmount ??
          "",

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


export const flattenMYOBSpendMoneyQBO = (items) => {

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

      // ❌ skip only invalid rows
      if (
        lineAmount === null ||
        lineAmount === undefined ||
        Number.isNaN(lineAmount)
      ) {
        continue;
      }

      // ✅ tax calculation
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {

        lineTaxAmt = Number(
          line.TaxAmount
        );

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
          : Number(
            lineTaxAmt.toFixed(2)
          );

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
          txn.IsTaxInclusive
            ? "Tax Inclusive"
            : "Tax Exclusive",

        "Expense Account":
          line.Account?.DisplayID || "",

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

        // ✅ tax exclusive amount
        "Tax Exclusive Amount":
          Number(
            taxExclusiveAmount.toFixed(2)
          ),

        "Currency Code":
          txn.ForeignCurrency?.Code || "AUD",

        "Exchange Rate":
          txn.CurrencyExchangeRate ?? 1,

        // ✅ UID
        "UID":
          txn.UID || "",
      });
    }
  }

  return rows;
};


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