// ── Reference Data — MYOB Raw Flatteners ─────────────────────
// Covers: items, customers, suppliers, accounts, jobs, taxcodes
// Used when outputFormat === "raw"
// All nested objects are flattened with dot-notation column names.

import { safe, cleanNone } from "../helpers.js";

// ── Helper: flatten address array → first address fields ──────
const flatAddr = (addresses) => {
  const a = addresses?.[0] || {};
  return {
    "Address Street":  safe(a.Street),
    "Address City":    safe(a.City),
    "Address State":   safe(a.State),
    "Address PostCode": safe(a.PostCode),
    "Address Country": safe(a.Country),
    "Phone1":          safe(a.Phone1),
    "Phone2":          safe(a.Phone2),
    "Fax":             safe(a.Fax),
    "Email":           safe(a.Email),
    "Website":         safe(a.Website),
  };
};

export const flattenMYOBItems = (items) =>
  items.map((i) => ({

    // ───── TEMPLATE FIELDS ─────

    "NAME":
      safe(i.Name),

    "CODE":
      safe(
        i.Number
      ),

    "TYPE":
      i.IsInventoried
        ? "Inventory"
        : (
            i.IsSold && i.IsBought
              ? "Bought & Sold"
              : (
                  i.IsSold
                    ? "Sold"
                    : (
                        i.IsBought
                          ? "Bought"
                          : "Service"
                      )
                )
          ),

    "Status":
      i.IsActive
        ? "Active"
        : "Inactive",

    // ───── SALES ─────

    "SALE ACCOUNT":
      i.IncomeAccount?.DisplayID,

    "SALE DESCRIPTION":
      safe(
        i.Description ||
        i.SellingDetails?.Description
      ),

    "SALE PRICE":
      safe(
        i.SellingDetails?.BaseSellingPrice ??
        i.BaseSellingPrice
      ),

    "SALE TAX":
      safe(
        i.SellingDetails?.TaxCode?.Code
      ),

     "Amounts include tax":
      i.SellingDetails?.IsTaxInclusive
        ? "Yes"
        : "No",

    // ───── PURCHASE ─────

    "PURCHASE ACCOUNT":
      i.ExpenseAccount?.DisplayID || i.CostOfSalesAccount?.DisplayID,

    "PURCHASE DESCRIPTION":
      safe(
        i.Description
      ),

    "PURCHASE PRICE":
      safe(
        i.BuyingDetails?.StandardCost ??
        i.BuyingDetails?.LastPurchasePrice
      ),

    "PURCHASE TAX":
      safe(
        i.BuyingDetails?.TaxCode?.Code
      ),
    
  }));

// ── 2. Customers (/Contact/Customer) ─────────────────────────
export const flattenMYOBCustomers = (items) =>
  items.map((c) => ({

    // ───── TEMPLATE FIELDS ─────

    "Display name":
      cleanNone(
        c.CompanyName ||
        `${c.FirstName || ""} ${c.LastName || ""}`.trim()
      ),

    "Customer name":
      cleanNone(
        `${c.FirstName || ""} ${c.LastName || ""}`.trim()
      ),

    "Is_Customer":
      "Yes",

    "Is_Supplier":
      "No",

    "Status":
      c.IsActive
        ? "Active"
        : "Inactive",

    // ───── BUSINESS ADDRESS ─────

    "BUSINESS ADDRESS Line 1":
      safe(c.Addresses?.[0]?.Street || ""),

    "BUSINESS ADDRESS line 2":
      safe(c.Addresses?.[0]?.City || ""),

    "BUSINESS ADDRESS line 3":
      safe(c.Addresses?.[0]?.Region || ""),

    "BUSINESS ADDRESS Suburb":
      safe(c.Addresses?.[0]?.City || ""),

    "BUSINESS ADDRESS State":
      safe(c.Addresses?.[0]?.State || ""),

    "BUSINESS ADDRESS Postcode":
      safe(c.Addresses?.[0]?.PostCode || ""),

    "BUSINESS ADDRESS Country":
      safe(c.Addresses?.[0]?.Country || ""),

    // ───── SHIPPING ADDRESS ─────

    "SHIPPING ADDRESS Line 1":
      safe(c.Addresses?.[1]?.Street || ""),

    "SHIPPING ADDRESS Line 2":
      safe(c.Addresses?.[1]?.City || ""),

    "SHIPPING ADDRESS Line 3":
      safe(c.Addresses?.[1]?.Region || ""),

    "SHIPPING ADDRESS Suburb":
      safe(c.Addresses?.[1]?.City || ""),

    "SHIPPING ADDRESS State":
      safe(c.Addresses?.[1]?.State || ""),

    "SHIPPING ADDRESS Postcode":
      safe(c.Addresses?.[1]?.PostCode || ""),

    "SHIPPING ADDRESS Country":
      safe(c.Addresses?.[1]?.Country || ""),

    // ───── POSTAL ADDRESS ─────

    "POSTAL ADDRESS Line 1":
      safe(c.Addresses?.[2]?.Street || ""),

    "POSTAL ADDRESS Line 2":
      safe(c.Addresses?.[2]?.City || ""),

    "POSTAL ADDRESS Line 3":
      safe(c.Addresses?.[2]?.Region || ""),

    "POSTAL ADDRESS Suburb":
      safe(c.Addresses?.[2]?.City || ""),

    "POSTAL ADDRESS State":
      safe(c.Addresses?.[2]?.State || ""),

    "POSTAL ADDRESS Postcode":
      safe(c.Addresses?.[2]?.PostCode || ""),

    "POSTAL ADDRESS Country":
      safe(c.Addresses?.[2]?.Country || ""),

    // ───── OTHER DETAILS ─────

    "ABN":
      safe(c.SellingDetails?.ABN),

    "Branch":
      safe(c.Branch),

    "Email":
      safe(c.Email),

    "Skype":
      safe(c.SkypeID),

    "Other email":
      safe(c.OtherEmail),

    "Personal email":
      safe(c.PersonalEmail),

    "Work email":
      safe(c.WorkEmail),

    "Notes":
      safe(c.Notes),

    "Web":
      safe(c.Website),

    "Mobile":
      safe(c.Phone1?.Number),

    "Phone":
      safe(c.Phone2?.Number),

    "Fax":
      safe(c.FaxNumber),

    "Other Phone":
      safe(c.Phone3?.Number),

    "Primary Phone":
      safe(c.Phone1?.Number),

    "Home Phone":
      safe(c.Phone2?.Number),

    "Work Phone":
      safe(c.Phone3?.Number),

    // ───── BANK DETAILS ─────

    "bank name":
      safe(c.BankAccountDetails?.BankName),

    "bank branch number":
      safe(c.BankAccountDetails?.BranchNumber),

    "bank account number":
      safe(c.BankAccountDetails?.AccountNumber),
  }));

// ── 3. Suppliers (/Contact/Supplier) ─────────────────────────
export const flattenMYOBSuppliers = (items) =>
  items.map((s) => ({

    // ───── TEMPLATE FIELDS ─────

    "Display name":
      cleanNone(
        s.CompanyName ||
        `${s.FirstName || ""} ${s.LastName || ""}`.trim()
      ),

    "Customer name":
      cleanNone(
        `${s.FirstName || ""} ${s.LastName || ""}`.trim()
      ),

    "Is_Customer":
      "No",

    "Is_Supplier":
      "Yes",

    "Status":
      s.IsActive
        ? "Active"
        : "Inactive",

    // ───── BUSINESS ADDRESS ─────

    "BUSINESS ADDRESS Line 1":
      safe(s.Addresses?.[0]?.Street || ""),

    "BUSINESS ADDRESS line 2":
      safe(s.Addresses?.[0]?.City || ""),

    "BUSINESS ADDRESS line 3":
      safe(s.Addresses?.[0]?.Region || ""),

    "BUSINESS ADDRESS Suburb":
      safe(s.Addresses?.[0]?.City || ""),

    "BUSINESS ADDRESS State":
      safe(s.Addresses?.[0]?.State || ""),

    "BUSINESS ADDRESS Postcode":
      safe(s.Addresses?.[0]?.PostCode || ""),

    "BUSINESS ADDRESS Country":
      safe(s.Addresses?.[0]?.Country || ""),

    // ───── SHIPPING ADDRESS ─────

    "SHIPPING ADDRESS Line 1":
      safe(s.Addresses?.[1]?.Street || ""),

    "SHIPPING ADDRESS Line 2":
      safe(s.Addresses?.[1]?.City || ""),

    "SHIPPING ADDRESS Line 3":
      safe(s.Addresses?.[1]?.Region || ""),

    "SHIPPING ADDRESS Suburb":
      safe(s.Addresses?.[1]?.City || ""),

    "SHIPPING ADDRESS State":
      safe(s.Addresses?.[1]?.State || ""),

    "SHIPPING ADDRESS Postcode":
      safe(s.Addresses?.[1]?.PostCode || ""),

    "SHIPPING ADDRESS Country":
      safe(s.Addresses?.[1]?.Country || ""),

    // ───── POSTAL ADDRESS ─────

    "POSTAL ADDRESS Line 1":
      safe(s.Addresses?.[2]?.Street || ""),

    "POSTAL ADDRESS Line 2":
      safe(s.Addresses?.[2]?.City || ""),

    "POSTAL ADDRESS Line 3":
      safe(s.Addresses?.[2]?.Region || ""),

    "POSTAL ADDRESS Suburb":
      safe(s.Addresses?.[2]?.City || ""),

    "POSTAL ADDRESS State":
      safe(s.Addresses?.[2]?.State || ""),

    "POSTAL ADDRESS Postcode":
      safe(s.Addresses?.[2]?.PostCode || ""),

    "POSTAL ADDRESS Country":
      safe(s.Addresses?.[2]?.Country || ""),

    // ───── OTHER DETAILS ─────

    "ABN":
      safe(s.BuyingDetails?.ABN),

    "Branch":
      safe(s.Branch),

    "Email":
      safe(s.Email),

    "Skype":
      safe(s.SkypeID),

    "Other email":
      safe(s.OtherEmail),

    "Personal email":
      safe(s.PersonalEmail),

    "Work email":
      safe(s.WorkEmail),

    "Notes":
      safe(s.Notes),

    "Web":
      safe(s.Website),

    "Mobile":
      safe(s.Phone1?.Number),

    "Phone":
      safe(s.Phone2?.Number),

    "Fax":
      safe(s.FaxNumber),

    "Other Phone":
      safe(s.Phone3?.Number),

    "Primary Phone":
      safe(s.Phone1?.Number),

    "Home Phone":
      safe(s.Phone2?.Number),

    "Work Phone":
      safe(s.Phone3?.Number),

    // ───── BANK DETAILS ─────

    "bank name":
      safe(s.BankAccountDetails?.BankName),

    "bank branch number":
      safe(s.BankAccountDetails?.BranchNumber),

    "bank account number":
      safe(s.BankAccountDetails?.AccountNumber),
  }));

// ── 4. Accounts (/GeneralLedger/Account) ─────────────────────
export const flattenMYOBAccounts = (items) =>
  items.map((a) => ({

    // ───── TEMPLATE FIELDS ─────

    "ACCOUNT NAME":
      safe(a.Name),

    "ACCOUNT CODE":
      safe(
        a.DisplayID ||
        a.Number
      ),

    "TYPE":
      safe(
        a.Type ||
        a.Classification
      ),

    "Sub-account":
      a.ParentAccount?.DisplayID,

    "BSB":
      safe(
        a.BankingDetails?.BSBNumber
      ),

    "DESCRIPTION":
      safe(a.Description),

    "DEFAULT TAX CODE":
      safe(
        a.TaxCode?.Code
      ),

    "BALANCE":
      safe(
        a.CurrentBalance ??
        a.OpeningBalance
      ),

    "Status":
      a.IsActive
        ? "Active"
        : "Inactive",
  }));
// ── 5. Jobs (/GeneralLedger/Job) ─────────────────────────────
export const flattenMYOBJobs = (items) =>
  items.map((j) => ({

    // ───── TEMPLATE FIELDS ─────

    "Name":
      safe(
        j.Name
      ),

    "Description":
      safe(
        j.Description
      ),

    "Sub-classification":
      j.ParentJob?.Number,

    "Status":
      j.IsActive
        ? "Active"
        : "Inactive",
  }));

// ── 6. Tax Codes (/GeneralLedger/TaxCode) ────────────────────
export const flattenMYOBTaxCodes = (items) =>
  items.map((t) => ({
    "Code":                         safe(t.Code),
    "Description":                  safe(t.Description),
    "Type":                         safe(t.Type),
    "Rate":                         safe(t.Rate),
   
  }));