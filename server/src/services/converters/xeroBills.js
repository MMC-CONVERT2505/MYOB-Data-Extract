import { cleanNone, fmtDate } from "../helpers.js";

// ── Xero Bills (Item & Service — SAME TEMPLATE) ───────────────
// Same structure as Xero Invoices but for purchase bills (ACCPAY).
export const flattenXeroBills = (bills, subType) => {

  const rows = [];

  for (const bill of bills) {

    const lines = bill.Lines?.length
      ? bill.Lines
      : [{}];

    const contactName = cleanNone(
      bill.Supplier?.CompanyName ||
      bill.Supplier?.Name ||
      bill.Supplier?.DisplayID
    );

    // ✅ valid amount lines
    const transactionLines = lines.filter(
      l => (l.Total ?? l.Amount ?? "") !== ""
    );

    // ✅ total line amount
    const totalLineAmount = transactionLines.reduce((sum, l) => {
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

      const isItemLine =
        !!(
          line.Item?.Number ||
          line.Item?.Name
        );

      // ✅ quantity logic
      const quantity = isService
        ? 1
        : (
            line.Quantity ??
            line.UnitCount ??
            line.BillQuantity ??
            1
          );

      // ✅ unit amount logic
      const unitAmount = isService
        ? lineAmount
        : Number(
            line.UnitPrice ?? 0
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

      // ✅ tax logic fix
      let lineTaxAmt = 0;

      if (
        line.TaxAmount !== undefined &&
        line.TaxAmount !== null
      ) {
        lineTaxAmt = Number(
          line.TaxAmount
        );

      } else if (
        bill.TotalTax &&
        totalLineAmount > 0
      ) {
        lineTaxAmt =
          (lineAmount / totalLineAmount) *
          Number(bill.TotalTax);
      }

      // ✅ no-tax handling
      if (
        noTaxCodes.includes(taxCode)
      ) {
        lineTaxAmt = 0;
      }

      rows.push({

        "*ContactName":
          contactName,

        "*InvoiceNumber":
          bill.SupplierInvoiceNumber ||
          bill.Number ||
          "",

        "*InvoiceDate":
          fmtDate(bill.Date),

        "*DueDate":
          fmtDate(
            bill.Terms?.DueDate
          ),

        "Total":
          bill.TotalAmount ?? "",

        // ✅ only item bills
        "InventoryItemCode": line.Item?.Number,

        "Description":
          line.Description || "",

        // ✅ fixed qty
        "*Quantity":
          quantity,

        // ✅ fixed unit amount
        "*UnitAmount":
          unitAmount,

        "*AccountCode":
          line.Account?.DisplayID || "",

        "*TaxType":
          taxCode,

        // ✅ fixed tax amount
        "TaxAmount":
          Number(
            lineTaxAmt
          ),

        // ✅ fixed line amount
        "Line Amount":
          lineAmount,

        "TrackingName1":
          "",

        "TrackingOption1":
          "",

        "TrackingName2":
          "",

        "TrackingOption2":
          "",

        "Currency":
          bill.ForeignCurrency?.Code || "AUD",

        "LineAmountType":
          bill.IsTaxInclusive
            ? "Inclusive"
            : "Exclusive",

        // ✅ NEW FIELDS

        "PO Number":
          bill.CustomerPurchaseOrderNumber ||
          bill.PurchaseOrderNumber ||
          bill.Order?.Number ||
          "",

        "Exchange Rate":
          bill.CurrencyExchangeRate ?? 1,
      });
    }
  }

  return rows;
};

// ── Xero Bill Payments ────────────────────────────────────────
export const flattenXeroBillPayments = (payments) => {
  const rows = [];

  for (const p of payments) {
    const lines = p.Lines?.length
      ? p.Lines
      : p.Bills?.length
      ? p.Bills
      : [{}];

    // ✅ ONLY DisplayID
    const bankAccount = p.Account?.DisplayID || "";

    // ✅ CONTACT (Vendor)
    const contactName = cleanNone(
      p.Supplier?.CompanyName ||
      p.Supplier?.Name ||
      p.Supplier?.DisplayID
    );

    for (const line of lines) {
      const invoiceNo =
        line.Purchase?.Number ||
        line.Number ||
        line.BillNumber ||
        "";

      const amount =
        line.AmountApplied ??
        line.Amount ??
        p.AmountPaid ??
        "";

      rows.push({
        "ContactName": contactName,

        "Date": fmtDate(p.Date),

        "Invoice No": invoiceNo,

        "Amount": amount,

        // ✅ FIXED
        "Bank": bankAccount,

        "Reference": p.PaymentNumber || p.Memo || "",

        "CurrencyRate": p.CurrencyExchangeRate ?? 1,
      });
    }
  }

  return rows;
};
