
import { myobRequest } from "../services/myobService.js";
import { convertToQBO, convertToMYOBRaw, convertToXero } from "../services/conversionService.js";
import { getCachedExtraction, saveExtractionWithCache, estimatePayloadSize } from "../services/extractionCacheService.js";

const getAuth = (req) => ({
  dbUser: req.dbUser,
  userId: req.session.userId,
});

// ── POST /api/extract ────────────────────────────────────────
export const extractData = async (req, res, next) => {
  const { dbUser, userId } = getAuth(req);
  const { startDate, endDate, dataType, subType, outputFormat = "raw" } = req.body;

  try {
    // ── Reference Data Types ──────────────────────────────────
    const REFERENCE_DATA_TYPES = new Set([
      "items", "customers", "suppliers", "accounts", "jobs", "taxcodes"
    ]);
    const isReference = REFERENCE_DATA_TYPES.has(dataType);

    // ── Validation ────────────────────────────────────────────
    if (!dataType) {
      return res.status(400).json({ error: "dataType is required" });
    }
    if (!isReference && (!startDate || !endDate)) {
      return res.status(400).json({ error: "startDate, endDate are required for this dataType" });
    }

    // ── Date Parser ───────────────────────────────────────────
    const parseDate = (d) => {
      if (!d) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
        const [day, month, year] = d.split("/");
        return `${year}-${month}-${day}`;
      }
      const parsed = new Date(d);
      if (isNaN(parsed)) throw new Error(`Invalid date: ${d}`);
      return parsed.toISOString().split("T")[0];
    };

    // ── Date Parsing ──────────────────────────────────────────
    let start = null;
    let end = null;
    if (!isReference) {
      start = parseDate(startDate);
      end = parseDate(endDate);
      if (!start || !end) {
        return res.status(400).json({ error: "Invalid date format. Use yyyy-mm-dd." });
      }
    }

    // ── Cache Keys ────────────────────────────────────────────
    // Reference types → "reference" string (date-independent)
    // Transactional   → actual date strings
    const cacheStart = isReference ? "reference" : start;
    const cacheEnd   = isReference ? "reference" : end;

    // ── Cache Check ───────────────────────────────────────────
    const cachedItems = await getCachedExtraction(
      userId, dbUser.businessId, dataType, subType || null, cacheStart, cacheEnd
    );

    let items = [];
    let fromCache = false;
    let estimatedBytes = 0;

    if (cachedItems !== null) {
      items = cachedItems;
      fromCache = true;
      console.log(`⚡ Serving from cache — ${items.length} items`);
    } else {
      if (!isReference) console.log(`📅 Date range: ${start} → ${end}`);
      const dateFilter = !isReference
        ? `Date ge datetime'${start}' and Date le datetime'${end}'`
        : null;

      switch (dataType) {

        // ── Invoices ──────────────────────────────────────────
        case "invoices": {
          try {
            const baseEp = subType ? `/Sale/Invoice/${subType}` : `/Sale/Invoice`;
            let allItems = [];
            let pageUrl = `${baseEp}?$top=1000&$orderby=Date desc`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            let filtered = allItems.filter(i => {
              if (!i.Date) return true;
              const d = i.Date.substring(0, 10);
              return d >= start && d <= end;
            });
            if (filtered.length === 0 && subType && allItems.length === 0) {
              console.warn(`⚠️ /Sale/Invoice/${subType} returned 0 — falling back to /Sale/Invoice`);
              let fallbackAll = [];
              let fbPage = `/Sale/Invoice?$top=1000&$orderby=Date desc`;
              while (fbPage) {
                const data = await myobRequest(dbUser, userId, "GET", fbPage);
                const pageItems = data?.Items || [];
                fallbackAll = fallbackAll.concat(pageItems);
                if (data?.NextPageLink && pageItems.length > 0) {
                  const u = new URL(data.NextPageLink);
                  const parts = u.pathname.split("/");
                  const bizIdx = parts.indexOf(dbUser.businessId);
                  fbPage = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
                } else { fbPage = null; }
              }
              filtered = fallbackAll.filter(i => {
                if (!i.Date) return false;
                const d = i.Date.substring(0, 10);
                if (d < start || d > end) return false;
                if (subType && i.InvoiceType) return i.InvoiceType.toLowerCase() === subType.toLowerCase();
                return true;
              });
              console.log(`✅ /Sale/Invoice (fallback, InvoiceType=${subType}) → ${filtered.length} records`);
            } else {
              console.log(`✅ ${baseEp} → ${filtered.length} records (from ${allItems.length} total)`);
            }
            items = filtered;
          } catch (invErr) {
            if (invErr.status === 403 && subType) {
              console.warn(`⚠️ /Sale/Invoice/${subType} 403, falling back to generic`);
              try {
                const fallback = await myobRequest(dbUser, userId, "GET", `/Sale/Invoice?$top=1000&$orderby=Date desc`);
                const all = fallback?.Items || [];
                items = all.filter(i => {
                  if (!i.Date) return true;
                  const d = i.Date.substring(0, 10);
                  return d >= start && d <= end;
                });
              } catch (fe) { throw fe; }
            } else { throw invErr; }
          }
          break;
        }

        // ── Bills ─────────────────────────────────────────────
        case "bills": {
          try {
            const baseEp = subType ? `/Purchase/Bill/${subType}` : `/Purchase/Bill`;
            let allItems = [];
            let pageUrl = `${baseEp}?$top=1000&$orderby=Date desc`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            items = allItems.filter(i => {
              if (!i.Date) return true;
              const d = i.Date.substring(0, 10);
              return d >= start && d <= end;
            });
            console.log(`✅ ${baseEp} → ${items.length} records (from ${allItems.length} total)`);
          } catch (billErr) {
            if (billErr.status === 403 && subType) {
              console.warn(`⚠️ /Purchase/Bill/${subType} 403, falling back to generic`);
              try {
                const fallback = await myobRequest(dbUser, userId, "GET", `/Purchase/Bill?$top=1000&$orderby=Date desc`);
                const all = fallback?.Items || [];
                items = all.filter(i => {
                  if (!i.Date) return true;
                  const d = i.Date.substring(0, 10);
                  return d >= start && d <= end;
                });
              } catch (fe) { throw fe; }
            } else { throw billErr; }
          }
          break;
        }

        // ── Credit Notes ──────────────────────────────────────
        case "creditNotes": {
          const cnEndpoints = [
            `/Sale/CreditSettlement?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`,
            `/Sale/CreditSettlement?$top=1000&$orderby=Date desc`,
            `/Sale/CreditSettlement`,
          ];
          let cnFetched = false;
          for (const ep of cnEndpoints) {
            try {
              const data = await myobRequest(dbUser, userId, "GET", ep);
              const all = data?.Items || [];
              items = ep.includes("filter")
                ? all
                : all.filter(i => {
                  if (!i.Date) return true;
                  const d = i.Date.substring(0, 10);
                  return d >= start && d <= end;
                });
              console.log(`✅ ${ep.split("?")[0]} → ${items.length} records`);
              cnFetched = true;
              break;
            } catch (err) {
              if (err.status === 400 || err.status === 404) {
                console.warn(`⚠️ ${ep.split("?")[0]} returned ${err.status}, trying next...`);
                continue;
              }
              throw err;
            }
          }
          if (!cnFetched) { console.warn("⚠️ Credit Notes not available"); items = []; }
          break;
        }

        // ── Vendor Credits ────────────────────────────────────
        case "vendorCredits": {
          const vcEndpoints = [
            `/Purchase/DebitSettlement?$top=1000&$filter=${encodeURIComponent(dateFilter)}&$orderby=Date desc`,
            `/Purchase/DebitSettlement?$top=1000&$orderby=Date desc`,
            `/Purchase/DebitSettlement`,
          ];
          let vcFetched = false;
          for (const ep of vcEndpoints) {
            try {
              const data = await myobRequest(dbUser, userId, "GET", ep);
              const all = data?.Items || [];
              items = ep.includes("filter")
                ? all
                : all.filter(i => {
                  if (!i.Date) return true;
                  const d = i.Date.substring(0, 10);
                  return d >= start && d <= end;
                });
              console.log(`✅ ${ep.split("?")[0]} → ${items.length} records`);
              vcFetched = true;
              break;
            } catch (err) {
              if (err.status === 400 || err.status === 404) {
                console.warn(`⚠️ ${ep.split("?")[0]} returned ${err.status}, trying next...`);
                continue;
              }
              throw err;
            }
          }
          if (!vcFetched) { console.warn("⚠️ Vendor Credits not available"); items = []; }
          break;
        }

        // ── Invoice Payments ──────────────────────────────────
        case "invoicePayments": {
          let invPayFetched = false;
          for (const baseEp of ["/Sale/CustomerPayment", "/Sale/Payment"]) {
            try {
              let allItems = [];
              let pageUrl = `${baseEp}?$top=1000&$orderby=Date desc`;
              while (pageUrl) {
                const data = await myobRequest(dbUser, userId, "GET", pageUrl);
                const pageItems = data?.Items || [];
                allItems = allItems.concat(pageItems);
                console.log(`📄 ${baseEp} page: ${pageItems.length} (total: ${allItems.length})`);
                if (data?.NextPageLink && pageItems.length > 0) {
                  const u = new URL(data.NextPageLink);
                  const parts = u.pathname.split("/");
                  const bizIdx = parts.indexOf(dbUser.businessId);
                  pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
                } else { pageUrl = null; }
              }
              items = allItems.filter(i => {
                if (!i.Date) return true;
                const d = i.Date.substring(0, 10);
                return d >= start && d <= end;
              });
              console.log(`✅ ${baseEp} → ${items.length} records in range (from ${allItems.length} total)`);
              invPayFetched = true;
              break;
            } catch (err) {
              if (err.status === 404) { console.warn(`⚠️ ${baseEp} 404, trying next...`); continue; }
              throw err;
            }
          }
          if (!invPayFetched) { const e = new Error("Invoice Payments endpoint not found."); e.status = 404; throw e; }
          break;
        }

        // ── Bill Payments ─────────────────────────────────────
        case "billPayments": {
          let billPayFetched = false;
          for (const baseEp of ["/Purchase/SupplierPayment", "/Purchase/Payment"]) {
            try {
              let allItems = [];
              let pageUrl = `${baseEp}?$top=1000&$orderby=Date desc`;
              while (pageUrl) {
                const data = await myobRequest(dbUser, userId, "GET", pageUrl);
                const pageItems = data?.Items || [];
                allItems = allItems.concat(pageItems);
                if (data?.NextPageLink && pageItems.length > 0) {
                  const u = new URL(data.NextPageLink);
                  const parts = u.pathname.split("/");
                  const bizIdx = parts.indexOf(dbUser.businessId);
                  pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
                } else { pageUrl = null; }
              }
              items = allItems.filter(i => {
                if (!i.Date) return true;
                const d = i.Date.substring(0, 10);
                return d >= start && d <= end;
              });
              console.log(`✅ ${baseEp} → ${items.length} records (from ${allItems.length} total)`);
              billPayFetched = true;
              break;
            } catch (err) {
              if (err.status === 404) { console.warn(`⚠️ ${baseEp} 404, trying next...`); continue; }
              if (err.status === 403) { console.warn(`⚠️ ${baseEp} 403`); items = []; billPayFetched = true; break; }
              throw err;
            }
          }
          if (!billPayFetched) { items = []; }
          break;
        }

        // ── Banking ───────────────────────────────────────────
        case "banking": {
          const bankingEndpoints = {
            spend:      "/Banking/SpendMoneyTxn",
            receive:    "/Banking/ReceiveMoneyTxn",
            transfer:   "/Banking/TransferMoneyTxn",
            creditNote: "/Sale/CreditSettlement",
            billCredit: "/Purchase/DebitSettlement",
          };
          const bankEp = bankingEndpoints[subType];
          if (!bankEp) {
            return res.status(400).json({
              error: `Unknown banking subType: ${subType}. Valid: spend, receive, transfer, creditNote, billCredit`,
            });
          }
          try {
            let allItems = [];
            let pageUrl = `${bankEp}?$top=1000&$orderby=Date desc`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            items = allItems.filter(i => {
              const dateField = i.Date || i.DateOccurred || "";
              if (!dateField) return true;
              const d = dateField.substring(0, 10);
              return d >= start && d <= end;
            });
            console.log(`✅ ${bankEp} → ${items.length} records (from ${allItems.length} total)`);
          } catch (err) {
            if (err.status === 404) { console.warn(`⚠️ ${bankEp} 404`); items = []; }
            else { throw err; }
          }
          break;
        }

        // ── General Journal ───────────────────────────────────
        case "generalJournal": {
          try {
            let allItems = [];
            let pageUrl = `/GeneralLedger/GeneralJournal?$top=1000&$orderby=DateOccurred desc`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            items = allItems.filter(i => {
              const dateField = i.DateOccurred || i.Date || "";
              if (!dateField) return true;
              const d = dateField.substring(0, 10);
              return d >= start && d <= end;
            });
            console.log(`✅ /GeneralLedger/GeneralJournal → ${items.length} records (from ${allItems.length} total)`);
          } catch (err) {
            if (err.status === 404) { console.warn("⚠️ GeneralJournal 404"); items = []; }
            else { throw err; }
          }
          break;
        }

        // ── Quotes ────────────────────────────────────────────
        case "quotes": {
          try {
            const baseEp = subType ? `/Sale/Quote/${subType}` : `/Sale/Quote`;
            let allItems = [];
            let pageUrl = `${baseEp}?$filter=${encodeURIComponent(dateFilter)}&$top=1000&$orderby=Date desc`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            let filtered = allItems.filter(i => {
              if (!i.Date) return true;
              const d = i.Date.substring(0, 10);
              return d >= start && d <= end;
            });
            if (filtered.length === 0 && allItems.length === 0 && subType) {
              console.warn(`⚠️ Quote $filter returned 0 — trying without $filter`);
              let allFb = [];
              let fbPage = `${baseEp}?$top=1000&$orderby=Date desc`;
              while (fbPage) {
                const data = await myobRequest(dbUser, userId, "GET", fbPage);
                const pageItems = data?.Items || [];
                allFb = allFb.concat(pageItems);
                if (data?.NextPageLink && pageItems.length > 0) {
                  const u = new URL(data.NextPageLink);
                  const parts = u.pathname.split("/");
                  const bizIdx = parts.indexOf(dbUser.businessId);
                  fbPage = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
                } else { fbPage = null; }
              }
              filtered = allFb.filter(i => {
                if (!i.Date) return false;
                const d = i.Date.substring(0, 10);
                return d >= start && d <= end;
              });
              console.log(`✅ Quote fallback (no filter) → ${filtered.length} records`);
            } else {
              console.log(`✅ ${baseEp} → ${filtered.length} records (from ${allItems.length} total)`);
            }
            items = filtered;
          } catch (quoteErr) {
            if (quoteErr.status === 400) {
              console.warn(`⚠️ Quote $filter gave 400 — retrying without $filter`);
              try {
                const baseEp2 = subType ? `/Sale/Quote/${subType}` : `/Sale/Quote`;
                let allItems2 = [];
                let fbPage = `${baseEp2}?$top=1000&$orderby=Date desc`;
                while (fbPage) {
                  const data = await myobRequest(dbUser, userId, "GET", fbPage);
                  const pageItems = data?.Items || [];
                  allItems2 = allItems2.concat(pageItems);
                  if (data?.NextPageLink && pageItems.length > 0) {
                    const u = new URL(data.NextPageLink);
                    const parts = u.pathname.split("/");
                    const bizIdx = parts.indexOf(dbUser.businessId);
                    fbPage = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
                  } else { fbPage = null; }
                }
                items = allItems2.filter(i => {
                  if (!i.Date) return true;
                  const d = i.Date.substring(0, 10);
                  return d >= start && d <= end;
                });
              } catch (fe) { throw fe; }
            } else if (quoteErr.status === 403 && subType) {
              console.warn(`⚠️ /Sale/Quote/${subType} 403, falling back to generic`);
              try {
                const fallback = await myobRequest(dbUser, userId, "GET", `/Sale/Quote?$top=1000&$orderby=Date desc`);
                const all = fallback?.Items || [];
                items = all.filter(i => {
                  if (!i.Date) return true;
                  const d = i.Date.substring(0, 10);
                  return d >= start && d <= end;
                });
              } catch (fe) { throw fe; }
            } else if (quoteErr.status === 404) {
              console.warn("⚠️ Quotes 404"); items = [];
            } else { throw quoteErr; }
          }
          break;
        }

        // ── Reference Data Types ──────────────────────────────
        case "items": {
          try {
            let allItems = [];
            let pageUrl = `/Inventory/Item?$top=1000`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            items = allItems;
            console.log(`✅ /Inventory/Item → ${items.length} records`);
          } catch (err) {
            if (err.status === 404) { console.warn("⚠️ /Inventory/Item 404"); items = []; }
            else throw err;
          }
          break;
        }

        case "customers": {
          try {
            let allItems = [];
            let pageUrl = `/Contact/Customer?$top=1000`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            items = allItems;
            console.log(`✅ /Contact/Customer → ${items.length} records`);
          } catch (err) {
            if (err.status === 404) { console.warn("⚠️ /Contact/Customer 404"); items = []; }
            else throw err;
          }
          break;
        }

        case "suppliers": {
          try {
            let allItems = [];
            let pageUrl = `/Contact/Supplier?$top=1000`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            items = allItems;
            console.log(`✅ /Contact/Supplier → ${items.length} records`);
          } catch (err) {
            if (err.status === 404) { console.warn("⚠️ /Contact/Supplier 404"); items = []; }
            else throw err;
          }
          break;
        }

        case "accounts": {
          try {
            let allItems = [];
            let pageUrl = `/GeneralLedger/Account?$top=1000`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            items = allItems;
            console.log(`✅ /GeneralLedger/Account → ${items.length} records`);
          } catch (err) {
            if (err.status === 404) { console.warn("⚠️ /GeneralLedger/Account 404"); items = []; }
            else throw err;
          }
          break;
        }

        case "jobs": {
          try {
            let allItems = [];
            let pageUrl = `/GeneralLedger/Job?$top=1000`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            items = allItems;
            console.log(`✅ /GeneralLedger/Job → ${items.length} records`);
          } catch (err) {
            if (err.status === 404) { console.warn("⚠️ /GeneralLedger/Job 404"); items = []; }
            else throw err;
          }
          break;
        }

        case "taxcodes": {
          try {
            let allItems = [];
            let pageUrl = `/GeneralLedger/TaxCode?$top=1000`;
            while (pageUrl) {
              const data = await myobRequest(dbUser, userId, "GET", pageUrl);
              const pageItems = data?.Items || [];
              allItems = allItems.concat(pageItems);
              if (data?.NextPageLink && pageItems.length > 0) {
                const u = new URL(data.NextPageLink);
                const parts = u.pathname.split("/");
                const bizIdx = parts.indexOf(dbUser.businessId);
                pageUrl = "/" + parts.slice(bizIdx + 1).join("/") + u.search;
              } else { pageUrl = null; }
            }
            items = allItems;
            console.log(`✅ /GeneralLedger/TaxCode → ${items.length} records`);
          } catch (err) {
            if (err.status === 404) { console.warn("⚠️ /GeneralLedger/TaxCode 404"); items = []; }
            else throw err;
          }
          break;
        }

        default:
          return res.status(400).json({ error: `Unknown dataType: ${dataType}` });
      }

      // ── Save to history + cache ───────────────────────────────
      // ✅ FIX: cacheStart/cacheEnd use karo (reference = "reference", transactional = actual dates)
      estimatedBytes = estimatePayloadSize(items.slice(0, 100), items.length);
      await saveExtractionWithCache({
        userId,
        businessId:   dbUser.businessId,
        businessName: dbUser.businessName || "",
        startDate:    cacheStart,   // ✅ FIXED — was: start
        endDate:      cacheEnd,     // ✅ FIXED — was: end
        dataType,
        subType:      subType || null,
        outputFormat,
        status:       "success",
        itemCount:    items.length,
        items,
        estimatedBytes,
      });
      console.log(`💾 Saved to history + cache (${items.length} items, ~${Math.round(estimatedBytes / 1024)}KB)`);
    }

    // ── Convert data ──────────────────────────────────────────
    const businessName = dbUser.businessName || "";
    console.log(`ℹ️ Organization Name: "${businessName}"`);

    if (!Array.isArray(items)) {
      console.warn("⚠️ items is not an array:", typeof items);
      items = [];
    }

    const myobFlat  = convertToMYOBRaw(items, dataType, subType || null, businessName);
    let converted   = null;
    if (outputFormat === "qbo")  converted = convertToQBO(items, dataType, subType || null, businessName);
    if (outputFormat === "xero") converted = convertToXero(items, dataType, subType || null, businessName);

    const responseItems = outputFormat === "raw" ? myobFlat : (converted || myobFlat);

    res.json({
      success:   true,
      dataType,
      subType:   subType || null,
      startDate: cacheStart,
      endDate:   cacheEnd,
      count:     items.length,
      fromCache,
      items:     responseItems,
      converted: outputFormat !== "raw" && converted
        ? { count: converted.length, items: converted }
        : null,
    });

  } catch (err) {
    try {
      await saveExtractionWithCache({
        userId,
        businessId:   dbUser?.businessId || "",
        businessName: dbUser?.businessName || "",
        startDate,
        endDate,
        dataType,
        subType:      subType || null,
        outputFormat,
        status:       "failed",
        itemCount:    0,
        errorMessage: err.message,
        items:        [],
        estimatedBytes: 0,
      });
    } catch (histErr) {
      console.error("⚠️ Failed to save error history:", histErr.message);
    }
    next(err);
  }
};

// ── GET /api/extract/credit-notes ────────────────────────────
export const getCreditNotes = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const { top = 200, skip = 0 } = req.query;
    const data = await myobRequest(dbUser, userId, "GET",
      `/Sale/CreditSettlement?$top=${top}&$skip=${skip}&$orderby=Date desc`);
    res.json(data);
  } catch (err) { next(err); }
};

// ── GET /api/extract/vendor-credits ──────────────────────────
export const getVendorCredits = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const { top = 200, skip = 0 } = req.query;
    const data = await myobRequest(dbUser, userId, "GET",
      `/Purchase/DebitSettlement?$top=${top}&$skip=${skip}&$orderby=Date desc`);
    res.json(data);
  } catch (err) { next(err); }
};