// ── Reckon Converters — Reference Data ────────────────────────
// Covers: accounts (COA), customers, suppliers, items, jobs
// Sheets: COA, Customer, Supplier, Item, Job
// Mirrors: referenceQBO.js / referenceXero.js / referenceRaw.js

import { safe, cleanNone } from "../helpers.js";

// ── 1. Chart of Accounts → "COA" sheet ────────────────────────
// Endpoint: /GeneralLedger/Account
export const flattenReckonCOA = (items) =>
  items.map((a) => ({
    "Account Number":         safe(a.DisplayID),
    "Account Name":           safe(a.Name),
    "Account Type":           safe(a.Type),
    "Header":                 a.ParentAccount ? "" : "H",
    "Parent Account Number":  safe(a.ParentAccount?.DisplayID),
    "Tax Code":               safe(a.TaxCode?.Code),
    "Classification":         safe(a.Classification || a.Type),
    "Description":            safe(a.Description),
  }));

// ── 2/3. Customer & Supplier → "Customer" / "Supplier" sheet ──
// Endpoints: /Contact/Customer, /Contact/Supplier
const flattenReckonContact = (items, contactType) =>
  items.map((c) => ({
    "Contact ID":       "",
    "Name":             cleanNone(c.CompanyName || `${c.FirstName || ""} ${c.LastName || ""}`.trim()),
    "Phone1":           safe(c.Phone1?.Number),
    "Phone2":           safe(c.Phone2?.Number),
    "Phone3":           safe(c.Phone3?.Number),
    "Type":             contactType,
    "Email":            safe(c.Email),
    "Balance ($)":      safe(c.OpenBalance ?? c.CurrentBalance),
    "Status":           c.IsActive ? "Active" : "Inactive",
    "Street":           safe(c.Addresses?.[0]?.Street),
    "City":             safe(c.Addresses?.[0]?.City),
    "State":            safe(c.Addresses?.[0]?.State),
    "Postcode":         safe(c.Addresses?.[0]?.PostCode),
    "Country":          safe(c.Addresses?.[0]?.Country),
    "Ship Street":      safe(c.Addresses?.[1]?.Street),
    "Ship City":        safe(c.Addresses?.[1]?.City),
    "Ship State":       safe(c.Addresses?.[1]?.State),
    "Ship Postcode":    safe(c.Addresses?.[1]?.PostCode),
    "Ship Country":     safe(c.Addresses?.[1]?.Country),
    "ABN":              safe(c.SellingDetails?.ABN || c.BuyingDetails?.ABN),
    "Payment method":   "",
    "Fax":              safe(c.FaxNumber),
    "WWW":              safe(c.Website),
    "Contact name":     `${c.FirstName || ""} ${c.LastName || ""}`.trim(),
    "BSB number":       safe(c.BankAccountDetails?.BranchNumber),
    "Bank acct No.":    safe(c.BankAccountDetails?.AccountNumber),
    "Bank acct name":   safe(c.BankAccountDetails?.AccountName),
    "Bank value":       "",
    "Credit card No.":  "",
    "Card name":        "",
    "Memo":             "",
    "Notes":            safe(c.Notes),
  }));

export const flattenReckonCustomer = (items) => flattenReckonContact(items, "Customer");
export const flattenReckonSupplier = (items) => flattenReckonContact(items, "Supplier");

// ── 4. Items → "Item" sheet ────────────────────────────────────
// Endpoint: /Inventory/Item
export const flattenReckonItem = (items) =>
  items.map((i) => ({
    "Name":                                     safe(i.Name),
    "Description":                              safe(i.Description || i.SellingDetails?.Description),
    "Item ID":                                  safe(i.Number),
    "Selling Price":                            safe(i.SellingDetails?.BaseSellingPrice ?? i.BaseSellingPrice),
    "Income account for tracking sales":        safe(i.IncomeAccount?.DisplayID),
    "Tax code":                                 safe(i.SellingDetails?.TaxCode?.Code),
    "Buying price":                             safe(i.BuyingDetails?.StandardCost ?? i.BuyingDetails?.LastPurchasePrice),
    "Expense account for tracking purchases":   safe(i.ExpenseAccount?.DisplayID || i.CostOfSalesAccount?.DisplayID),
    "Purchase Tax code":                        safe(i.BuyingDetails?.TaxCode?.Code), // template col is also "Tax code" — renamed to avoid duplicate key
    "Primary supplier for reorders":            "",
    "Default reorder quantity (per buying unit)": "",
  }));

// ── 5. Jobs → "Job" sheet ───────────────────────────────────────
// Endpoint: /GeneralLedger/Job
export const flattenReckonJob = (items) =>
  items.map((j) => ({
    "Job number": safe(j.Number),
    "Job name":   safe(j.Name),
  }));