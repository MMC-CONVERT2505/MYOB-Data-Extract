// ── Reference Data — QBO Format Flatteners ───────────────────
// Covers: items, customers, suppliers, accounts, jobs, taxcodes
// Used when outputFormat === "qbo"
// Columns mapped to QBO import-friendly names.

import { safe, cleanNone } from "../helpers.js";

const flatAddr = (addresses) => {
  const a = addresses?.[0] || {};
  return {
    "BillingAddress Line1":   safe(a.Street),
    "BillingAddress City":    safe(a.City),
    "BillingAddress State":   safe(a.State),
    "BillingAddress PostalCode": safe(a.PostCode),
    "BillingAddress Country": safe(a.Country),
    "Phone":                  safe(a.Phone1),
    "Email":                  safe(a.Email),
    "Website":                safe(a.Website),
  };
};

// ── 1. Items ─────────────────────────────────────────────────
export const flattenQBOItems = (items) =>
  items.map((i) => ({

    // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

    "Name *":
      safe(i.Name),

    "Type *":
      i.IsInventoried
        ? "Inventory"
        : i.IsSold
        ? "Service"
        : "NonInventory",

    "Sku":
      safe(
        i.Code ||
        i.SKU ||
        i.Number
      ),

    "UnitPrice":
      safe(
        i.SellingDetails?.BaseSellingPrice ??
        i.BaseSellingPrice
      ),

    "Sales Description":
      safe(
        i.SellingDetails?.Description ||
        i.Description
      ),

    "Purchase Description":
      safe(
        i.BuyingDetails?.Description
      ),

    "Cost":
      safe(
        i.BuyingDetails?.StandardCost
      ),

    "Income AccountRef Name *":
      safe(
        i.IncomeAccount?.Name ||
        i.IncomeAccount?.DisplayID
      ),

    "Expense AccountRef Name":
      safe(
        i.ExpenseAccount?.Name ||
        i.ExpenseAccount?.DisplayID
      ),

    "Parent Ref Name":
      safe(
        i.Parent?.Name
      ),

    "AssetAccountRef Name":
      safe(
        i.AssetAccount?.Name ||
        i.AssetAccount?.DisplayID
      ),

    "Qty On Hand":
      safe(
        i.QuantityOnHand
      ),

    "As Of Date":
      safe(
        i.InventoryDate ||
        i.AsOfDate
      ),

    "Sales TaxCodeRef Name":
      safe(
        i.SellingDetails?.TaxCode?.Code
      ),

    "PurchaseTaxCodeRef Name":
      safe(
        i.BuyingDetails?.TaxCode?.Code
      ),

    "ClassRef Name":
      safe(
        i.Class?.Name
      ),

    "PrefVendorRef Name":
      safe(
        i.BuyingDetails
          ?.RestockingInformation
          ?.Supplier
          ?.Name
      ),
  }));

// ── 2. Customers ─────────────────────────────────────────────
export const flattenQBOCustomers = (items) =>
  items.map((c) => {

    const displayName = c.IsIndividual
      ? `${safe(c.FirstName)} ${safe(c.LastName)}`.trim()
      : safe(c.CompanyName);

    const billAddr =
      c.BillAddress ||
      c.BillingAddress ||
      {};

    const shipAddr =
      c.ShippingAddress ||
      c.ShipAddress ||
      {};

    return {

      // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

      "Title":
        safe(c.Title),

      "Company":
        safe(c.CompanyName),

      "First Name":
        safe(c.FirstName),

      "Middle Name":
        safe(c.MiddleName),

      "Last Name":
        safe(c.LastName),

      "Suffix":
        safe(c.Suffix),

      "Display Name *":
        safe(
          c.DisplayName ||
          displayName
        ),

      "Resale Number":
        safe(c.ResaleNumber),

      "Print On Check Name":
        safe(c.PrintOnCheckName),

      // ───── BILLING ADDRESS ─────

      "BillAddr Line1":
        safe(billAddr.Line1),

      "BillAddr Line2":
        safe(billAddr.Line2),

      "BillAddr Line3":
        safe(billAddr.Line3),

      "BillAddr City":
        safe(billAddr.City),

      "BillAddr PostalCode":
        safe(
          billAddr.PostalCode ||
          billAddr.PostCode
        ),

      "BillAddr Country":
        safe(billAddr.Country),

      "BillAddr CountrySubDivisionCode":
        safe(
          billAddr.CountrySubDivisionCode ||
          billAddr.State
        ),

      // ───── SHIPPING ADDRESS ─────

      "ShipaddrLine1":
        safe(shipAddr.Line1),

      "ShipaddrLine2":
        safe(shipAddr.Line2),

      "ShipaddrLine3":
        safe(shipAddr.Line3),

      "ShipaddrCity":
        safe(shipAddr.City),

      "Shipaddr PostalCode":
        safe(
          shipAddr.PostalCode ||
          shipAddr.PostCode
        ),

      "ShipaddrCountry":
        safe(shipAddr.Country),

      "Shipaddr CountrySubDivisionCode":
        safe(
          shipAddr.CountrySubDivisionCode ||
          shipAddr.State
        ),

      // ───── CONTACT DETAILS ─────

      "Phone":
        safe(
          c.Phones?.find(
            p => p.PhoneType === "DEFAULT"
          )?.PhoneNumber ||
          c.Phone
        ),

      "Mobile":
        safe(
          c.Phones?.find(
            p => p.PhoneType === "MOBILE"
          )?.PhoneNumber ||
          c.Mobile
        ),

      "Fax":
        safe(
          c.Phones?.find(
            p => p.PhoneType === "FAX"
          )?.PhoneNumber ||
          c.Fax
        ),

      "Other":
        safe(c.Other),

      "Website":
        safe(
          c.Website ||
          c.WebsiteAddress
        ),

      "Email":
        safe(
          c.EmailAddress ||
          c.Email
        ),

      // ───── TERMS & PAYMENT ─────

      "Sales TermRef Name":
        safe(
          c.SellingDetails?.Terms?.PaymentIsDue ||
          c.Terms?.Name
        ),

      "Preferred Delivery Method":
        safe(c.PreferredDeliveryMethod),

      "PaymentMethodRef Name":
        safe(
          c.PaymentMethod?.Name
        ),

      "Parent Ref Name":
        safe(
          c.Parent?.Name
        ),

      // ───── OTHER DETAILS ─────

      "Notes":
        safe(c.Notes),

      "DefaultTaxCodeRef Name":
        safe(
          c.SellingDetails?.TaxCode?.Code
        ),

      "CurrencyRef Value":
        safe(
          c.ForeignCurrency?.Code ||
          c.Currency?.Code
        ),

      // ───── CUSTOM FIELDS ─────

      "CustomFiled1":
        safe(c.CustomField1),

      "CustomFiled2":
        safe(c.CustomField2),

      "CustomFiled3":
        safe(c.CustomField3),

      "CustomFiled4":
        safe(c.CustomField4),

      "CustomFiled5":
        safe(c.CustomField5),
    };

  });

// ── 3. Suppliers ─────────────────────────────────────────────
export const flattenQBOSuppliers = (items) =>
  items.map((s) => {

    const displayName = s.IsIndividual
      ? `${safe(s.FirstName)} ${safe(s.LastName)}`.trim()
      : safe(s.CompanyName);

    const billAddr =
      s.BillAddress ||
      s.BillingAddress ||
      {};

    const shipAddr =
      s.ShippingAddress ||
      s.ShipAddress ||
      {};

    return {

      // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

      "Title":
        safe(s.Title),

      "Company":
        safe(s.CompanyName),

      "First Name":
        safe(s.FirstName),

      "Middle Name":
        safe(s.MiddleName),

      "Last Name":
        safe(s.LastName),

      "Suffix":
        safe(s.Suffix),

      "Display Name *":
        safe(
          s.DisplayName ||
          displayName
        ),

      "Resale Number":
        safe(s.ResaleNumber),

      "Print On Check Name":
        safe(s.PrintOnCheckName),

      // ───── BILLING ADDRESS ─────

      "BillAddr Line1":
        safe(billAddr.Line1),

      "BillAddr Line2":
        safe(billAddr.Line2),

      "BillAddr Line3":
        safe(billAddr.Line3),

      "BillAddr City":
        safe(billAddr.City),

      "BillAddr PostalCode":
        safe(
          billAddr.PostalCode ||
          billAddr.PostCode
        ),

      "BillAddr Country":
        safe(billAddr.Country),

      "BillAddr CountrySubDivisionCode":
        safe(
          billAddr.CountrySubDivisionCode ||
          billAddr.State
        ),

      // ───── SHIPPING ADDRESS ─────

      "ShipaddrLine1":
        safe(shipAddr.Line1),

      "ShipaddrLine2":
        safe(shipAddr.Line2),

      "ShipaddrLine3":
        safe(shipAddr.Line3),

      "ShipaddrCity":
        safe(shipAddr.City),

      "Shipaddr PostalCode":
        safe(
          shipAddr.PostalCode ||
          shipAddr.PostCode
        ),

      "ShipaddrCountry":
        safe(shipAddr.Country),

      "Shipaddr CountrySubDivisionCode":
        safe(
          shipAddr.CountrySubDivisionCode ||
          shipAddr.State
        ),

      // ───── CONTACT DETAILS ─────

      "Phone":
        safe(
          s.Phones?.find(
            p => p.PhoneType === "DEFAULT"
          )?.PhoneNumber ||
          s.Phone
        ),

      "Mobile":
        safe(
          s.Phones?.find(
            p => p.PhoneType === "MOBILE"
          )?.PhoneNumber ||
          s.Mobile
        ),

      "Fax":
        safe(
          s.Phones?.find(
            p => p.PhoneType === "FAX"
          )?.PhoneNumber ||
          s.Fax
        ),

      "Other":
        safe(s.Other),

      "Website":
        safe(
          s.Website ||
          s.WebsiteAddress
        ),

      "Email":
        safe(
          s.EmailAddress ||
          s.Email
        ),

      // ───── TERMS & PAYMENT ─────

      "Sales TermRef Name":
        safe(
          s.BuyingDetails?.Terms?.PaymentIsDue ||
          s.Terms?.Name
        ),

      "Preferred Delivery Method":
        safe(s.PreferredDeliveryMethod),

      "PaymentMethodRef Name":
        safe(
          s.PaymentMethod?.Name
        ),

      "Parent Ref Name":
        safe(
          s.Parent?.Name
        ),

      // ───── OTHER DETAILS ─────

      "Notes":
        safe(s.Notes),

      "DefaultTaxCodeRef Name":
        safe(
          s.BuyingDetails?.TaxCode?.Code
        ),

      "CurrencyRef Value":
        safe(
          s.ForeignCurrency?.Code ||
          s.Currency?.Code
        ),

      // ───── CUSTOM FIELDS ─────

      "CustomFiled1":
        safe(s.CustomField1),

      "CustomFiled2":
        safe(s.CustomField2),

      "CustomFiled3":
        safe(s.CustomField3),

      "CustomFiled4":
        safe(s.CustomField4),

      "CustomFiled5":
        safe(s.CustomField5),
    };

  });
// ── 4. Accounts (Chart of Accounts) ──────────────────────────
export const flattenQBOAccounts = (items) =>
  items.map((a) => ({

    // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

    "Account Number":
      safe(
        a.DisplayID ||
        a.AccountNumber
      ),

    "Name *":
      safe(a.Name),

    "Account Type *":
      safe(
        mapQBOAccountType(
          a.Classification,
          a.Type
        )
      ),

    "Account Detail Type *":
      safe(a.Type),

    "Parent Ref Name":
      safe(
        a.ParentAccount?.Name ||
        a.ParentAccount?.DisplayID
      ),

    "Description":
      safe(a.Description),

    "TaxCodeRef Name":
      safe(
        a.TaxCode?.Code
      ),

    "Currency Ref Value":
      safe(
        a.Currency?.Code ||
        a.CurrencyRef?.Value
      ),
  }));

// Map MYOB classification → QBO Account Type
const mapQBOAccountType = (classification, type) => {
  const map = {
    Asset:        "Other Current Assets",
    Liability:    "Other Current Liabilities",
    Equity:       "Equity",
    Income:       "Income",
    CostOfSales:  "Cost of Goods Sold",
    Expense:      "Expenses",
    OtherIncome:  "Other Income",
    OtherExpense: "Other Expense",
  };
  if (type === "Bank")           return "Bank";
  if (type === "AccountsReceivable") return "Accounts Receivable (A/R)";
  if (type === "AccountsPayable")    return "Accounts Payable (A/P)";
  if (type === "CreditCard")     return "Credit Card";
  return map[classification] || safe(classification);
};

// ── 5. Jobs (Classes in QBO) ──────────────────────────────────
export const flattenQBOJobs = (items) =>
  items.map((j) => ({

    // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

    "Name *":
      safe(j.Name),

    "Parent Ref Name":
      safe(
        j.ParentJob?.Name ||
        j.ParentClass?.Name
      ),
  }));

// ── 6. Tax Codes (Tax Rates in QBO) ──────────────────────────
export const flattenQBOTaxCodes = (items) =>
  items.map((t) => ({

    // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

    "TAX NAME *":
      safe(
        t.Code ||
        t.Name
      ),

    "Sales Rate *":
      safe(
        t.Rate
      ),

    "Tax Applicable On *":
      safe(
        t.Type
      ),

    "Taxable":
      safe(
        t.IsTaxable ??
        t.Taxable
      ),

    "Description":
      safe(
        t.Description
      ),

    "Sublevel":
      safe(
        t.Sublevel
      ),
  }));