import {
  flattenQBOInvoiceItems,
  flattenQBOProfMiscInvoice,
  flattenQBOInvoicePayments,
  flattenQBOInvoiceService,
} from "./converters/qboInvoices.js";

import {
  flattenQBOBillItems,
  flattenQBOBillPayments,
  flattenQBOBillService,
} from "./converters/qboBills.js";

import {
  flattenXeroInvoices,
  flattenXeroInvoicePayments,
  flattenXeroSpendReceive,
  flattenXeroTransfer,
  flattenXeroJournal,
} from "./converters/xeroInvoices.js";

import {
  flattenXeroBills,
  flattenXeroBillPayments,
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
      return flattenMYOBInvoiceService(items, businessName);

    case "bills":
      if (subType === "Service") return flattenQBOBillService(items);
      return flattenQBOBillItems(items, subType, businessName);

    case "invoicePayments":
      return flattenQBOInvoicePayments(items, businessName);

    case "billPayments":
      return flattenQBOBillPayments(items, businessName);

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
      return flattenXeroInvoices(items, subType, businessName);

    case "bills":
      return flattenXeroBills(items, subType, businessName);

    case "invoicePayments":
      return flattenXeroInvoicePayments(items, businessName);

    case "billPayments":
      return flattenXeroBillPayments(items, businessName);

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
      return flattenMYOBInvoiceService(items, businessName);

    case "bills":
      return flattenMYOBBillRaw(items, businessName);

    case "invoicePayments":
      return flattenMYOBInvoicePayment(items);

    case "billPayments":
      return flattenMYOBBillPayment(items);

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