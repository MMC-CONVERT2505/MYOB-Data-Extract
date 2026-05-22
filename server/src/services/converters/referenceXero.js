// ── Reference Data — Xero Format Flatteners ──────────────────
// Covers: items, customers, suppliers, accounts, jobs, taxcodes
// Used when outputFormat === "xero"
// Columns mapped to Xero CSV import format.

import { safe, cleanNone } from "../helpers.js";


const flatAddr = (addresses) => {
  const a = addresses?.[0] || {};
  return {
    "Address Street":     safe(a.Street),
    "Address City":       safe(a.City),
    "Address Region":     safe(a.State),
    "Address PostCode":   safe(a.PostCode),
    "Address Country":    safe(a.Country),
    "Phone":              safe(a.Phone1),
    "Email":              safe(a.Email),
    "Website":            safe(a.Website),
  };
};

// ── 1. Items (Xero Inventory) ─────────────────────────────────
export const flattenXeroItems = (items) =>

  items.map((i) => ({

    // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

    "Code":
      safe(i.Number),

    "Name":
      safe(i.Name),

    "Purchase Description":
      safe(
        i.BuyingDetails?.Description ||
        i.Description
      ),

    "Purchase Unit Price":
      safe(
        i.BuyingDetails?.StandardCost
      ),

    "Purchase Account Code":
      safe(
        i.CostOfSalesAccount?.DisplayID ??
        i.ExpenseAccount?.DisplayID
      ),

    "Purchase Tax Rate":
      safe(
        i.BuyingDetails?.TaxCode?.Code
      ),

    "Sale Description":
      safe(
        i.SellingDetails?.Description ||
        i.Description
      ),

    "Sales Unit Price":
      safe(
        i.SellingDetails?.BaseSellingPrice ??
        i.BaseSellingPrice
      ),

    "Sales Account Code":
      safe(
        i.IncomeAccount?.DisplayID
      ),

    "sales Tax Rate":
      safe(
        i.SellingDetails?.TaxCode?.Code
      ),

    "Inventory Asset Account Code":
      safe(
        i.AssetAccount?.DisplayID
      ),

    "Quantity On Hand":
      safe(
        i.QuantityOnHand
      ),

    "Total Value on Hand":
      safe(
        i.CurrentValue
      ),
  }));


// ── 2. Customers (Xero Contacts) ─────────────────────────────
export const flattenXeroCustomers = (items) =>
  items.map((c) => {

    const contactName = c.IsIndividual
      ? `${safe(c.FirstName)} ${safe(c.LastName)}`.trim()
      : safe(c.CompanyName);

    const businessAddress =
      c.Addresses?.find(
        a => a.Location === "Business"
      ) ||
      c.Addresses?.[0] ||
      {};

    const shippingAddress =
      c.Addresses?.find(
        a => a.Location === "Postal"
      ) ||
      {};

    const contactPersons = c.ContactPersons || [];

    return {

      // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

      "Contact Name":
        contactName,

      "Account Number":
        safe(c.DisplayID),

      "Contact Status":
        c.IsActive
          ? "Active"
          : "Inactive",

      "first Name":
        safe(c.FirstName),

      "Last Name":
        safe(c.LastName),

      "Email Address":
        safe(
          c.EmailAddress ||
          businessAddress.Email
        ),

      // ───── PO ADDRESS ─────

      "Po Attention To":
        safe(businessAddress.AttentionTo),

      "Po Address Line1":
        safe(
          businessAddress.Line1 ||
          businessAddress.Street
        ),

      "Po Address Line2":
        safe(businessAddress.Line2),

      "Po Address Line3":
        safe(businessAddress.Line3),

      "Po Address Line4":
        safe(businessAddress.Line4),

      "Po City":
        safe(businessAddress.City),

      "Po Region":
        safe(businessAddress.State),

      "Po Postal/Zip Code":
        safe(businessAddress.PostCode),

      "Po Country":
        safe(businessAddress.Country),

      // ───── SA ADDRESS ─────

      "Sa Attention To":
        safe(shippingAddress.AttentionTo),

      "Sa Address Line1":
        safe(
          shippingAddress.Line1 ||
          shippingAddress.Street
        ),

      "Sa Address Line2":
        safe(shippingAddress.Line2),

      "Sa Address Line3":
        safe(shippingAddress.Line3),

      "Sa Address Line4":
        safe(shippingAddress.Line4),

      "Sa City":
        safe(shippingAddress.City),

      "Sa Region":
        safe(shippingAddress.State),

      "Sa Postal/Zip Code":
        safe(shippingAddress.PostCode),

      "Sa Country":
        safe(shippingAddress.Country),

      // ───── CONTACT DETAILS ─────

      "Phone Number":
        safe(
          c.Phones?.find(p => p.PhoneType === "DEFAULT")?.PhoneNumber ||
          c.Phone1
        ),

      "FAX Number":
        safe(
          c.Phones?.find(p => p.PhoneType === "FAX")?.PhoneNumber ||
          c.Fax
        ),

      "Mobile Number":
        safe(
          c.Phones?.find(p => p.PhoneType === "MOBILE")?.PhoneNumber ||
          c.Mobile
        ),

      "DDI Number":
        safe(
          c.Phones?.find(p => p.PhoneType === "DDI")?.PhoneNumber ||
          c.DDI
        ),

      // ───── BANK DETAILS ─────

      "Bank Account Name":
        safe(c.BankAccountName),

      "Bank Account Number":
        safe(c.BankAccountDetails),

      "Tax Number":
        safe(
          c.TaxNumber ||
          c.SellingDetails?.ABN
        ),

      "web site":
        safe(
          c.Website ||
          c.WebsiteAddress
        ),

      "Discount":
        safe(
          c.SellingDetails?.Discount ||
          c.SellingDetails?.Terms?.Discount
        ),

      "Company Number":
        safe(c.CompanyNumber),

      "Default Currency":
        safe(
          c.DefaultCurrency ||
          c.ForeignCurrency?.Code ||
          "AUD"
        ),

      // ───── DUE DATES ─────

      "DueDate Bill Day":
        safe(
          c.BuyingDetails?.Terms?.Day
        ),

      "DueDate Bill Term":
        safe(
          c.BuyingDetails?.Terms?.Type
        ),

      "DueDate Sales Day":
        safe(
          c.SellingDetails?.Terms?.Day
        ),

      "DueDate Sales Term":
        safe(
          c.SellingDetails?.Terms?.Type
        ),

      // ───── ACCOUNT CODES ─────

      "Sales Default Account Code":
        safe(
          c.SellingDetails?.IncomeAccount?.Code ||
          c.SellingDetails?.IncomeAccount?.DisplayID
        ),

      "purchases Default Account Code":
        safe(
          c.BuyingDetails?.ExpenseAccount?.Code ||
          c.BuyingDetails?.ExpenseAccount?.DisplayID
        ),

      // ───── TRACKING ─────

      "Tracking Category Name":
        safe(c.TrackingName1),

      "tracking Category Option":
        safe(c.TrackingOption1),

      "Sales Tracking Categories Name":
        safe(c.SalesTrackingCategoriesName),

      "Sales Tracking Categories Option":
        safe(c.SalesTrackingCategoriesOption),

      "Purchases Tracking Categories Name":
        safe(c.PurchasesTrackingCategoriesName),

      "Purchases Tracking Categories Option":
        safe(c.PurchasesTrackingCategoriesOption),

      // ───── EXTRA DETAILS ─────

      "Branding Theme Name":
        safe(c.BrandingThemeName),

      "Batch Payment code":
        safe(c.BatchPaymentCode),

      "Batch Payment Details":
        safe(c.BatchPaymentDetails),

      "Batch Payment Reference":
        safe(c.BatchPaymentReference),

      "Batch Payment Tax Number":
        safe(c.BatchPaymentTaxNumber),

      "Is Customer":
        c.IsCustomer === true
          ? "Yes"
          : "No",

      "Is Supplier":
        c.IsSupplier === true
          ? "Yes"
          : "No",

      // ───── CONTACT PERSON 1 ─────

      "Contact Persons 1 First Name":
        safe(contactPersons?.[0]?.FirstName),

      "Contact Persons 1 Last Name":
        safe(contactPersons?.[0]?.LastName),

      "Contact Persons 1 Email Address":
        safe(contactPersons?.[0]?.EmailAddress),

      // ───── CONTACT PERSON 2 ─────

      "Contact Persons 2 First Name":
        safe(contactPersons?.[1]?.FirstName),

      "Contact Persons 2 Last Name":
        safe(contactPersons?.[1]?.LastName),

      "Contact Persons 2 Email Address":
        safe(contactPersons?.[1]?.EmailAddress),

      // ───── CONTACT PERSON 3 ─────

      "Contact Persons 3 First Name":
        safe(contactPersons?.[2]?.FirstName),

      "Contact Persons 3 Last Name":
        safe(contactPersons?.[2]?.LastName),

      "Contact Persons 3 Email Address":
        safe(contactPersons?.[2]?.EmailAddress),

      // ───── CONTACT PERSON 4 ─────

      "Contact Persons 4 First Name":
        safe(contactPersons?.[3]?.FirstName),

      "Contact Persons 4 Last Name":
        safe(contactPersons?.[3]?.LastName),

      "Contact Persons 4 Email Address":
        safe(contactPersons?.[3]?.EmailAddress),

      // ───── CONTACT PERSON 5 ─────

      "Contact Persons 5 First Name":
        safe(contactPersons?.[4]?.FirstName),

      "Contact Persons 5 Last Name":
        safe(contactPersons?.[4]?.LastName),

      "Contact Persons 5 Email Address":
        safe(contactPersons?.[4]?.EmailAddress),
    };

  });

// ── 3. Suppliers (Xero Contacts — Supplier type) ──────────────
export const flattenXeroSuppliers = (items) =>

  items.map((s) => {

    const contactName = s.IsIndividual
      ? `${safe(s.FirstName)} ${safe(s.LastName)}`.trim()
      : safe(s.CompanyName);

    const businessAddress =
      s.Addresses?.find(
        a => a.Location === "Business"
      ) ||
      s.Addresses?.[0] ||
      {};

    const shippingAddress =
      s.Addresses?.find(
        a => a.Location === "Postal"
      ) ||
      {};

    const contactPersons = s.ContactPersons || [];

    return {

      // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

      "Contact Name":
        contactName,

      "Account Number":
        safe(s.DisplayID),

      "Contact Status":
        s.IsActive
          ? "Active"
          : "Inactive",

      "first Name":
        safe(s.FirstName),

      "Last Name":
        safe(s.LastName),

      "Email Address":
        safe(
          s.EmailAddress ||
          businessAddress.Email
        ),

      // ───── PO ADDRESS ─────

      "Po Attention To":
        safe(businessAddress.AttentionTo),

      "Po Address Line1":
        safe(
          businessAddress.Line1 ||
          businessAddress.Street
        ),

      "Po Address Line2":
        safe(businessAddress.Line2),

      "Po Address Line3":
        safe(businessAddress.Line3),

      "Po Address Line4":
        safe(businessAddress.Line4),

      "Po City":
        safe(businessAddress.City),

      "Po Region":
        safe(businessAddress.State),

      "Po Postal/Zip Code":
        safe(businessAddress.PostCode),

      "Po Country":
        safe(businessAddress.Country),

      // ───── SA ADDRESS ─────

      "Sa Attention To":
        safe(shippingAddress.AttentionTo),

      "Sa Address Line1":
        safe(
          shippingAddress.Line1 ||
          shippingAddress.Street
        ),

      "Sa Address Line2":
        safe(shippingAddress.Line2),

      "Sa Address Line3":
        safe(shippingAddress.Line3),

      "Sa Address Line4":
        safe(shippingAddress.Line4),

      "Sa City":
        safe(shippingAddress.City),

      "Sa Region":
        safe(shippingAddress.State),

      "Sa Postal/Zip Code":
        safe(shippingAddress.PostCode),

      "Sa Country":
        safe(shippingAddress.Country),

      // ───── CONTACT DETAILS ─────

      "Phone Number":
        safe(
          s.Phones?.find(p => p.PhoneType === "DEFAULT")?.PhoneNumber ||
          s.Phone1
        ),

      "FAX Number":
        safe(
          s.Phones?.find(p => p.PhoneType === "FAX")?.PhoneNumber ||
          s.Fax
        ),

      "Mobile Number":
        safe(
          s.Phones?.find(p => p.PhoneType === "MOBILE")?.PhoneNumber ||
          s.Mobile
        ),

      "DDI Number":
        safe(
          s.Phones?.find(p => p.PhoneType === "DDI")?.PhoneNumber ||
          s.DDI
        ),

      // ───── BANK DETAILS ─────

      "Bank Account Name":
        safe(s.BankAccountName),

      "Bank Account Number":
        safe(s.BankAccountDetails),

      "Tax Number":
        safe(
          s.TaxNumber ||
          s.BuyingDetails?.ABN
        ),

      "web site":
        safe(
          s.Website ||
          s.WebsiteAddress
        ),

      "Discount":
        safe(
          s.BuyingDetails?.Discount ||
          s.BuyingDetails?.Terms?.Discount
        ),

      "Company Number":
        safe(s.CompanyNumber),

      "Default Currency":
        safe(
          s.DefaultCurrency ||
          s.ForeignCurrency?.Code ||
          "AUD"
        ),

      // ───── DUE DATES ─────

      "DueDate Bill Day":
        safe(
          s.BuyingDetails?.Terms?.Day
        ),

      "DueDate Bill Term":
        safe(
          s.BuyingDetails?.Terms?.Type
        ),

      "DueDate Sales Day":
        safe(
          s.SellingDetails?.Terms?.Day
        ),

      "DueDate Sales Term":
        safe(
          s.SellingDetails?.Terms?.Type
        ),

      // ───── ACCOUNT CODES ─────

      "Sales Default Account Code":
        safe(
          s.SellingDetails?.IncomeAccount?.Code ||
          s.SellingDetails?.IncomeAccount?.DisplayID
        ),

      "purchases Default Account Code":
        safe(
          s.BuyingDetails?.ExpenseAccount?.Code ||
          s.BuyingDetails?.ExpenseAccount?.DisplayID
        ),

      // ───── TRACKING ─────

      "Tracking Category Name":
        safe(s.TrackingName1),

      "tracking Category Option":
        safe(s.TrackingOption1),

      "Sales Tracking Categories Name":
        safe(s.SalesTrackingCategoriesName),

      "Sales Tracking Categories Option":
        safe(s.SalesTrackingCategoriesOption),

      "Purchases Tracking Categories Name":
        safe(s.PurchasesTrackingCategoriesName),

      "Purchases Tracking Categories Option":
        safe(s.PurchasesTrackingCategoriesOption),

      // ───── EXTRA DETAILS ─────

      "Branding Theme Name":
        safe(s.BrandingThemeName),

      "Batch Payment code":
        safe(s.BatchPaymentCode),

      "Batch Payment Details":
        safe(s.BatchPaymentDetails),

      "Batch Payment Reference":
        safe(s.BatchPaymentReference),

      "Batch Payment Tax Number":
        safe(s.BatchPaymentTaxNumber),

      "Is Customer":
        s.IsCustomer === true
          ? "Yes"
          : "No",

      "Is Supplier":
        s.IsSupplier === true
          ? "Yes"
          : "No",

      // ───── CONTACT PERSON 1 ─────

      "Contact Persons 1 First Name":
        safe(contactPersons?.[0]?.FirstName),

      "Contact Persons 1 Last Name":
        safe(contactPersons?.[0]?.LastName),

      "Contact Persons 1 Email Address":
        safe(contactPersons?.[0]?.EmailAddress),

      // ───── CONTACT PERSON 2 ─────

      "Contact Persons 2 First Name":
        safe(contactPersons?.[1]?.FirstName),

      "Contact Persons 2 Last Name":
        safe(contactPersons?.[1]?.LastName),

      "Contact Persons 2 Email Address":
        safe(contactPersons?.[1]?.EmailAddress),

      // ───── CONTACT PERSON 3 ─────

      "Contact Persons 3 First Name":
        safe(contactPersons?.[2]?.FirstName),

      "Contact Persons 3 Last Name":
        safe(contactPersons?.[2]?.LastName),

      "Contact Persons 3 Email Address":
        safe(contactPersons?.[2]?.EmailAddress),

      // ───── CONTACT PERSON 4 ─────

      "Contact Persons 4 First Name":
        safe(contactPersons?.[3]?.FirstName),

      "Contact Persons 4 Last Name":
        safe(contactPersons?.[3]?.LastName),

      "Contact Persons 4 Email Address":
        safe(contactPersons?.[3]?.EmailAddress),

      // ───── CONTACT PERSON 5 ─────

      "Contact Persons 5 First Name":
        safe(contactPersons?.[4]?.FirstName),

      "Contact Persons 5 Last Name":
        safe(contactPersons?.[4]?.LastName),

      "Contact Persons 5 Email Address":
        safe(contactPersons?.[4]?.EmailAddress),
    };

  });

// ── 4. Accounts (Xero Chart of Accounts) ─────────────────────


export const flattenXeroAccounts = (items) =>

  items.map((a) => ({

    // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

    "Code":
      safe(
        a.DisplayID ||
        a.Number
      ),

    "Name":
      safe(a.Name),

    "Bank Account Number":
      safe(
        a.BankingDetails?.BankAccountNumber
      ),

    "Bank Account Type":
      safe(
        a.BankingDetails?.BankAccountType
      ),

    "Type":
      safe(
        a.Type ||
        a.Classification
      ),

    "Description":
      safe(a.Description),

    "Tax":
      safe(
        a.TaxCode?.Code
      ),

    "Show on Dashboard":
      a.IsHeader
        ? "No"
        : "Yes",

    "Enable Payments To Account":
      a.IsActive
        ? "Yes"
        : "No",

    "Expense Claims":
      safe(
        a.AllowExpenseClaims
      ),

    "Currency Code":
      safe(
        a.ForeignCurrency?.Code
      ),
  }));



// Map MYOB classification/type → Xero Account Type
const mapXeroAccountType = (classification, type) => {
  if (type === "Bank")               return "BANK";
  if (type === "AccountsReceivable") return "DEBTOR";
  if (type === "AccountsPayable")    return "CREDITOR";
  if (type === "CreditCard")         return "CREDITCARD";
  const map = {
    Asset:        "CURRENT",
    Liability:    "CURRLIAB",
    Equity:       "EQUITY",
    Income:       "REVENUE",
    CostOfSales:  "DIRECTCOSTS",
    Expense:      "OVERHEADS",
    OtherIncome:  "OTHERINCOME",
    OtherExpense: "OTHEREXPENSE",
  };
  return map[classification] || safe(classification);
};

// ── 5. Jobs (Xero Tracking Categories) ───────────────────────
export const flattenXeroJobs = (items) =>

  items.map((j) => ({

    // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

    "Tracking Category Name":
      safe(
        j.ParentJob?.Name ||
        j.ParentJob?.Number ||
        "Jobs"
      ),

    "Category Option":
      safe(
        j.Name
      ),

    "Status":
      j.IsActive
        ? "Active"
        : "Inactive",
  }));

// ── 6. Tax Codes (Xero Tax Rates) ────────────────────────────
export const flattenXeroTaxCodes = (items) =>

  items.map((t) => ({

    // ───── TEMPLATE FIELDS IN SAME SEQUENCE ─────

    "Tax Name":
      safe(
        t.Description ||
        t.Code
      ),

    "Tax Rate":
      safe(
        t.Rate
      ),

    "Tax Component Name":
      safe(
        t.Code
      ),

    "Tax Component Rate":
      safe(
        t.Rate
      ),

    "Tax Component Is Compound":
      t.IsCompound
        ? "Yes"
        : "No",

    "Report Tax Type":
      safe(
        t.Type
      ),
  }));

// ── Payment Terms Mapper ──────────────────────────────────────
const mapXeroTerms = (myobTerm) => {
  const map = {
    CashOnDelivery:        "DAYSAFTERBILLDATE",
    PrePaid:               "DAYSAFTERBILLDATE",
    InAGivenNumberOfDays:  "DAYSAFTERBILLDATE",
    OnADayOfTheMonth:      "OFCURRENTMONTH",
    NumberOfDaysAfterEOM:  "DAYSAFTERBILLMONTH",
    DayOfMonthAfterEOM:    "OFCURRENTMONTH",
  };
  return map[myobTerm] || safe(myobTerm);
};