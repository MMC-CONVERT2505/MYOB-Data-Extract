import {
  flattenReckonCOA,
  flattenReckonCustomer,
  flattenReckonSupplier,
  flattenReckonItem,
  flattenReckonJob,
} from "./converters/referenceReckon.js";

import {
  flattenReckonInvoice,
  flattenReckonCustomerReturn,
  flattenReckonCustomerPayment,
  flattenReckonSpendMoney,
  flattenReckonReceiveMoney,
  flattenReckonBankTransfer,
  flattenReckonJournal,
} from "./converters/reckonInvoices.js";

import {
  flattenReckonBills,
  flattenReckonSupplierReturn,
  flattenReckonSupplierPayment,
} from "./converters/reckonBills.js";

import {
  flattenReckonQuoteItem,
  flattenReckonQuoteService,
  flattenReckonSalesOrderItem,
  flattenReckonSalesOrderService,
} from "./converters/reckonQuotes.js";

import {
  flattenReckonPurchaseOrderItem,
  flattenReckonPurchaseOrderService,
} from "./converters/reckonPurchaseOrders.js";


import {
  flattenQBOInvoiceItems,
  flattenQBOProfMiscInvoice,
  flattenQBOInvoicePayments,
  flattenQBOInvoiceService,
  flattenQBOCreditRefund,
  flattenQBOInvoiceTimeBilling,
} from "./converters/qboInvoices.js";

import {
  flattenQBOBillItems,
  flattenQBOBillPayments,
  flattenQBOBillService,
  flattenQBOVendorCredit,
  flattenQBODebitRefund,
} from "./converters/qboBills.js";

import {
  flattenXeroInvoices,
  flattenXeroInvoicePayments,
  flattenXeroSpendReceive,
  flattenXeroTransfer,
  flattenXeroJournal,
  flattenXeroCreditRefund,
  flattenXeroInvoiceTimeBilling,
} from "./converters/xeroInvoices.js";

import {
  flattenXeroBills,
  flattenXeroBillPayments,
  flattenXeroVendorCredit,
  flattenXeroDebitRefund,
} from "./converters/xeroBills.js";

import {
  flattenMYOBInvoiceService,
  flattenMYOBBillRaw,
  flattenMYOBInvoicePayment,
  flattenMYOBBillPayment,
  flattenMYOBBanking,
  flattenMYOBSpendMoneyQBO,
  flattenMYOBReceiveMoneyQBO,
  flattenMYOBTransferMoneyQBO,
  flattenMYOBGeneralJournal,
  flattenMYOBQuote,
  flattenMYOBCreditRefund,
  flattenMYOBInvoiceTimeBilling,
  flattenMYOBVendorCredit,
  flattenMYOBDebitRefund,
} from "./converters/myobRaw.js";

import {
  flattenMYOBSpendMoneyRaw,
  flattenMYOBReceiveMoneyRaw,
  flattenMYOBTransferMoneyRaw,
  flattenMYOBGeneralJournalRaw,
} from "./converters/myobRaw_templates.js";

import {
  flattenMYOBItems,
  flattenMYOBCustomers,
  flattenMYOBSuppliers,
  flattenMYOBAccounts,
  flattenMYOBJobs,
  flattenMYOBTaxCodes,
} from "./converters/referenceRaw.js";

import {
  flattenQBOItems,
  flattenQBOCustomers,
  flattenQBOSuppliers,
  flattenQBOAccounts,
  flattenQBOJobs,
  flattenQBOTaxCodes,
} from "./converters/referenceQBO.js";

import {
  flattenXeroItems,
  flattenXeroCustomers,
  flattenXeroSuppliers,
  flattenXeroAccounts,
  flattenXeroJobs,
  flattenXeroTaxCodes,
} from "./converters/referenceXero.js";



// ── QBO Converter ─────────────────────────────────────────────────────────────
export const convertToQBO = (items, dataType, subType = null, businessName = "") => {
  if (!items?.length) return [];

  switch (dataType) {
    case "invoices":
      if (subType === "Item") return flattenQBOInvoiceItems(items, businessName);
      if (subType === "Service") return flattenQBOInvoiceService(items, businessName);
      if (subType === "Professional") return flattenQBOProfMiscInvoice(items, businessName);
      if (subType === "Miscellaneous") return flattenQBOProfMiscInvoice(items, businessName);
      if (subType === "TimeBilling") return flattenQBOInvoiceTimeBilling(items);
      return flattenMYOBInvoiceService(items, businessName);

    case "bills":
      if (subType === "Service") return flattenQBOBillService(items);
      return flattenQBOBillItems(items, subType, businessName);

    case "invoicePayments":
      return flattenQBOInvoicePayments(items, businessName);

    case "billPayments":
      return flattenQBOBillPayments(items, businessName);

    case "creditRefunds":
      return flattenQBOCreditRefund(items);

       case "vendorCredits":
      return flattenQBOVendorCredit(items);

    case "debitRefunds":
      return flattenQBODebitRefund(items);

    case "banking":
      if (subType === "spend") return flattenMYOBSpendMoneyQBO(items);
      if (subType === "receive") return flattenMYOBReceiveMoneyQBO(items);
      if (subType === "transfer") return flattenMYOBTransferMoneyQBO(items);
      return flattenMYOBBanking(items, subType);

    case "generalJournal":
      return flattenMYOBGeneralJournal(items);

    case "quotes":
      return flattenMYOBQuote(items, businessName);

    case "items":
      return flattenQBOItems(items);
    case "customers":
      return flattenQBOCustomers(items);
    case "suppliers":
      return flattenQBOSuppliers(items);
    case "accounts":
      return flattenQBOAccounts(items);
    case "jobs":
      return flattenQBOJobs(items);
    case "taxcodes":
      return flattenQBOTaxCodes(items);

    default:
      return items;
  }
};


// ── Xero Converter ────────────────────────────────────────────────────────────
export const convertToXero = (items, dataType, subType = null, businessName = "") => {
  if (!items?.length) return [];

  switch (dataType) {
    case "invoices":
      if (subType === "TimeBilling") return flattenXeroInvoiceTimeBilling(items);
      return flattenXeroInvoices(items, subType, businessName);

    case "bills":
      return flattenXeroBills(items, subType, businessName);

    case "invoicePayments":
      return flattenXeroInvoicePayments(items, businessName);

    case "billPayments":
      return flattenXeroBillPayments(items, businessName);

    case "creditRefunds":
      return flattenXeroCreditRefund(items);

         case "vendorCredits":
      return flattenXeroVendorCredit(items);

    case "debitRefunds":
      return flattenXeroDebitRefund(items);

    case "banking":
      if (subType === "spend" || subType === "receive") return flattenXeroSpendReceive(items, subType);
      if (subType === "transfer") return flattenXeroTransfer(items);
      return flattenMYOBBanking(items, subType);

    case "generalJournal":
      return flattenXeroJournal(items);

    case "quotes":
      return flattenMYOBQuote(items, businessName);

    case "items":
      return flattenXeroItems(items);
    case "customers":
      return flattenXeroCustomers(items);
    case "suppliers":
      return flattenXeroSuppliers(items);
    case "accounts":
      return flattenXeroAccounts(items);
    case "jobs":
      return flattenXeroJobs(items);
    case "taxcodes":
      return flattenXeroTaxCodes(items);

    default:
      return items;
  }
};


// ── MYOB Raw Converter ────────────────────────────────────────────────────────
export const convertToMYOBRaw = (items, dataType, subType = null, businessName = "") => {
  if (!items?.length) return [];

  switch (dataType) {
    case "invoices":
      if (subType === "TimeBilling") return flattenMYOBInvoiceTimeBilling(items, businessName);
      return flattenMYOBInvoiceService(items, businessName);

    case "bills":
      return flattenMYOBBillRaw(items, businessName);

    case "invoicePayments":
      return flattenMYOBInvoicePayment(items);

    case "billPayments":
      return flattenMYOBBillPayment(items);

    case "creditRefunds":
      return flattenMYOBCreditRefund(items);

          case "vendorCredits":
      return flattenMYOBVendorCredit(items);

    case "debitRefunds":
      return flattenMYOBDebitRefund(items);

    case "banking":
      if (subType === "spend") return flattenMYOBSpendMoneyRaw(items);
      if (subType === "receive") return flattenMYOBReceiveMoneyRaw(items);
      if (subType === "transfer") return flattenMYOBTransferMoneyRaw(items);
      return flattenMYOBBanking(items, subType);

    case "generalJournal":
      return flattenMYOBGeneralJournalRaw(items);

    case "quotes":
      return flattenMYOBQuote(items, businessName);

    case "items":
      return flattenMYOBItems(items);
    case "customers":
      return flattenMYOBCustomers(items);
    case "suppliers":
      return flattenMYOBSuppliers(items);
    case "accounts":
      return flattenMYOBAccounts(items);
    case "jobs":
      return flattenMYOBJobs(items);
    case "taxcodes":
      return flattenMYOBTaxCodes(items);



    default:
      return items;
  }
};


// ── Reckon Converter ────────────────────────────────────────────────────────
export const convertToReckon = (items, dataType, subType = null, businessName = "") => {
  if (!items?.length) return [];

  switch (dataType) {
    case "invoices":
      return flattenReckonInvoice(items);
    case "bills":
      return flattenReckonBills(items);

    case "quotes":
      if (subType === "Item") return flattenReckonQuoteItem(items);
      return flattenReckonQuoteService(items); // Service | Professional | Miscellaneous | TimeBilling

    case "salesOrders":
      if (subType === "Item") return flattenReckonSalesOrderItem(items);
      return flattenReckonSalesOrderService(items); // Service | Professional | Miscellaneous

    case "purchaseOrders":
      if (subType === "Item") return flattenReckonPurchaseOrderItem(items);
      return flattenReckonPurchaseOrderService(items); // Service | Professional | Miscellaneous

    case "creditNotes":
      return flattenReckonCustomerReturn(items);
    case "vendorCredits":
      return flattenReckonSupplierReturn(items);
    case "invoicePayments":
      return flattenReckonCustomerPayment(items);
    case "billPayments":
      return flattenReckonSupplierPayment(items);
    case "banking":
      if (subType === "spend") return flattenReckonSpendMoney(items);
      if (subType === "receive") return flattenReckonReceiveMoney(items);
      if (subType === "transfer") return flattenReckonBankTransfer(items);
      return items;
    case "generalJournal":
      return flattenReckonJournal(items);
    case "items":
      return flattenReckonItem(items);
    case "customers":
      return flattenReckonCustomer(items);
    case "suppliers":
      return flattenReckonSupplier(items);
    case "accounts":
      return flattenReckonCOA(items);
    case "jobs":
      return flattenReckonJob(items);
    default:
      return items;
  }
};