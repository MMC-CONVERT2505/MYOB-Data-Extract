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
  items.map((i) => {
    const purchaseAccount =
      i.ExpenseAccount?.DisplayID ||
      i.CostOfSalesAccount?.DisplayID ||
      i.BuyingDetails?.ExpenseAccount?.DisplayID ||
      i.BuyingDetails?.CostOfSalesAccount?.DisplayID ||
      "";

    return {
      // ───── GENERAL ─────
      "NAME": safe(i.Name),
      "CODE": safe(i.Number),

      "TYPE":
        i.IsInventoried
          ? "Inventory"
          : i.IsSold && i.IsBought
          ? "Bought & Sold"
          : i.IsSold
          ? "Sold"
          : i.IsBought
          ? "Bought"
          : "Service",

      "Status": i.IsActive ? "Active" : "Inactive",

      // ───── SALES ─────
      "SALE ACCOUNT":
        i.IncomeAccount?.DisplayID || "",

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
        purchaseAccount,

      "PURCHASE DESCRIPTION":
        safe(
          i.BuyingDetails?.Description ||
          i.Description
        ),

      "PURCHASE PRICE":
        safe(
          i.BuyingDetails?.StandardCost ??
          i.BuyingDetails?.LastPurchasePrice ??
          ""
        ),

      "PURCHASE TAX":
        safe(
          i.BuyingDetails?.TaxCode?.Code
        ),
    };
  });

// ── Customers (/Contact/Customer) ─────────────────────────
export const flattenMYOBCustomers = (items) => {

  console.log(JSON.stringify(items, null, 2));

  return items.map((c) => {

    const primaryAddress =
      c.Addresses?.find(a => a.Location === 1) ||
      c.Addresses?.[0] ||
      {};

    const shippingAddress =
      c.Addresses?.find(a => a.Location === 2) ||
      c.Addresses?.[1] ||
      {};

    const postalAddress =
      c.Addresses?.find(a => a.Location === 3) ||
      c.Addresses?.[2] ||
      {};

    return {

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

      "Is_Customer": "Yes",

      "Is_Supplier": "No",

      "Status":
        c.IsActive ? "Active" : "Inactive",

      // ───── BUSINESS ADDRESS ─────

      "BUSINESS ADDRESS Line 1":
        safe(primaryAddress.Street),

      "BUSINESS ADDRESS line 2":
        safe(primaryAddress.City),

      "BUSINESS ADDRESS line 3":
        safe(primaryAddress.Region),

      "BUSINESS ADDRESS Suburb":
        safe(primaryAddress.City),

      "BUSINESS ADDRESS State":
        safe(primaryAddress.State),

      "BUSINESS ADDRESS Postcode":
        safe(primaryAddress.PostCode),

      "BUSINESS ADDRESS Country":
        safe(primaryAddress.Country),

      // ───── SHIPPING ADDRESS ─────

      "SHIPPING ADDRESS Line 1":
        safe(shippingAddress.Street),

      "SHIPPING ADDRESS Line 2":
        safe(shippingAddress.City),

      "SHIPPING ADDRESS Line 3":
        safe(shippingAddress.Region),

      "SHIPPING ADDRESS Suburb":
        safe(shippingAddress.City),

      "SHIPPING ADDRESS State":
        safe(shippingAddress.State),

      "SHIPPING ADDRESS Postcode":
        safe(shippingAddress.PostCode),

      "SHIPPING ADDRESS Country":
        safe(shippingAddress.Country),

      // ───── POSTAL ADDRESS ─────

      "POSTAL ADDRESS Line 1":
        safe(postalAddress.Street),

      "POSTAL ADDRESS Line 2":
        safe(postalAddress.City),

      "POSTAL ADDRESS Line 3":
        safe(postalAddress.Region),

      "POSTAL ADDRESS Suburb":
        safe(postalAddress.City),

      "POSTAL ADDRESS State":
        safe(postalAddress.State),

      "POSTAL ADDRESS Postcode":
        safe(postalAddress.PostCode),

      "POSTAL ADDRESS Country":
        safe(postalAddress.Country),

      // ───── OTHER DETAILS ─────

      "ABN":
        safe(c.SellingDetails?.ABN),

      "Branch":
        safe(c.Branch),

      "Email":
        safe(primaryAddress.Email),

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
        safe(primaryAddress.Website),

      "Mobile":
        safe(primaryAddress.Phone1),

      "Phone":
        safe(primaryAddress.Phone1),

      "Fax":
        safe(primaryAddress.Fax),

      "Other Phone":
        safe(primaryAddress.Phone3),

      "Primary Phone":
        safe(primaryAddress.Phone1),

      "Home Phone":
        safe(primaryAddress.Phone2),

      "Work Phone":
        safe(primaryAddress.Phone3),

      // ───── BANK DETAILS ─────

      "bank name":
        safe(c.BankAccountDetails?.BankName),

      "bank branch number":
        safe(c.BankAccountDetails?.BranchNumber),

      "bank account number":
        safe(c.BankAccountDetails?.AccountNumber),
    };

  });

};
// ── 3. Suppliers (/Contact/Supplier) ─────────────────────────
export const flattenMYOBSuppliers = (items) => {

  console.log(JSON.stringify(items, null, 2));

  return items.map((s) => {

    const businessAddress =
      s.Addresses?.find(a => a.Location === 1) ||
      s.Addresses?.[0] ||
      {};

    const shippingAddress =
      s.Addresses?.find(a => a.Location === 2) ||
      s.Addresses?.[1] ||
      {};

    const postalAddress =
      s.Addresses?.find(a => a.Location === 3) ||
      s.Addresses?.[2] ||
      {};

    return {

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

      "Is_Customer": "No",

      "Is_Supplier": "Yes",

      "Status":
        s.IsActive ? "Active" : "Inactive",

      // ───── BUSINESS ADDRESS ─────

      "BUSINESS ADDRESS Line 1":
        safe(businessAddress.Street),

      "BUSINESS ADDRESS line 2":
        safe(businessAddress.City),

      "BUSINESS ADDRESS line 3":
        safe(businessAddress.Region),

      "BUSINESS ADDRESS Suburb":
        safe(businessAddress.City),

      "BUSINESS ADDRESS State":
        safe(businessAddress.State),

      "BUSINESS ADDRESS Postcode":
        safe(businessAddress.PostCode),

      "BUSINESS ADDRESS Country":
        safe(businessAddress.Country),

      // ───── SHIPPING ADDRESS ─────

      "SHIPPING ADDRESS Line 1":
        safe(shippingAddress.Street),

      "SHIPPING ADDRESS Line 2":
        safe(shippingAddress.City),

      "SHIPPING ADDRESS Line 3":
        safe(shippingAddress.Region),

      "SHIPPING ADDRESS Suburb":
        safe(shippingAddress.City),

      "SHIPPING ADDRESS State":
        safe(shippingAddress.State),

      "SHIPPING ADDRESS Postcode":
        safe(shippingAddress.PostCode),

      "SHIPPING ADDRESS Country":
        safe(shippingAddress.Country),

      // ───── POSTAL ADDRESS ─────

      "POSTAL ADDRESS Line 1":
        safe(postalAddress.Street),

      "POSTAL ADDRESS Line 2":
        safe(postalAddress.City),

      "POSTAL ADDRESS Line 3":
        safe(postalAddress.Region),

      "POSTAL ADDRESS Suburb":
        safe(postalAddress.City),

      "POSTAL ADDRESS State":
        safe(postalAddress.State),

      "POSTAL ADDRESS Postcode":
        safe(postalAddress.PostCode),

      "POSTAL ADDRESS Country":
        safe(postalAddress.Country),

      // ───── OTHER DETAILS ─────

      "ABN":
        safe(s.BuyingDetails?.ABN),

      "Branch":
        safe(s.Branch),

      "Email":
        safe(businessAddress.Email),

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
        safe(businessAddress.Website),

      "Mobile":
        safe(businessAddress.Phone1),

      "Phone":
        safe(businessAddress.Phone1),

      "Fax":
        safe(businessAddress.Fax),

      "Other Phone":
        safe(businessAddress.Phone3),

      "Primary Phone":
        safe(businessAddress.Phone1),

      "Home Phone":
        safe(businessAddress.Phone2),

      "Work Phone":
        safe(businessAddress.Phone3),

      // ───── BANK DETAILS ─────

      "bank name":
        safe(s.PaymentDetails?.BankAccountName),

      "bank branch number":
        safe(s.PaymentDetails?.BSBNumber),

      "bank account number":
        safe(s.PaymentDetails?.BankAccountNumber),
    };
  });
};
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