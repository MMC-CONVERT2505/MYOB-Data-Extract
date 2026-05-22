import { get } from "mongoose";
import { myobRequest } from "../services/myobService.js";

// Helper: extract dbUser and userId from request
const getAuth = (req) => ({
  dbUser: req.dbUser,
  userId: req.session.userId,
});

// ── GET /api/invoices/sales ──────────────────────────────────
export const getSalesInvoices = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const { top = 50, skip = 0, filter } = req.query;
    let endpoint = `/Sale/Invoice?$top=${top}&$skip=${skip}&$orderby=Date desc`;
    if (filter) endpoint += `&$filter=${encodeURIComponent(filter)}`;
    const data = await myobRequest(dbUser, userId, "GET", endpoint);
    res.json(data);
  } catch (err) { next(err); }
};

// ── GET /api/invoices/sales/type/:type ──────────────────────
export const getSalesInvoicesByType = async (req, res, next) => {
  try {
    console.log("print random data");
    // const { dbUser, userId } = getAuth(req);
    // const { top = 200, skip = 0 } = req.query;
    // const endpoint = `/Sale/Invoice/${req.params.type}?$top=${top}&$skip=${skip}&$orderby=Date desc`;
    // const data = await myobRequest(dbUser, userId, "GET", endpoint);
    // res.json(data);
  } catch (err) { next(err); }
};

// ── GET /api/invoices/sales/:uid ─────────────────────────────
export const getSalesInvoiceById = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const data = await myobRequest(dbUser, userId, "GET", `/Sale/Invoice/${req.params.uid}`);
    res.json(data);
  } catch (err) { next(err); }
};


// ── GET /api/invoices/payments ───────────────────────────────
export const getPayments = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const { top = 200, skip = 0 } = req.query;
    const data = await myobRequest(dbUser, userId, "GET",
      `/Sale/Payment?$top=${top}&$skip=${skip}&$orderby=Date desc`);
    res.json(data);
  } catch (err) { next(err); }
};

// ── GET /api/invoices/orders ─────────────────────────────────
// export const getOrders = async (req, res, next) => {
//   try {
//     const { dbUser, userId } = getAuth(req);
//     const { top = 200, skip = 0 } = req.query;
//     const data = await myobRequest(dbUser, userId, "GET",
//       `/Sale/Order?$top=${top}&$skip=${skip}&$orderby=Date desc`);
//     res.json(data);
//   } catch (err) { next(err); }
// };

export const getOrders = async(req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req)
    const { top = 200, skip = 0 } = req.query;
    const data = await myobRequest(dbUser, userId, "GET",
      `/Sale/Order?$top=${top}&$skip=`
    )
  } catch (error) {
    
  }
}

// ── GET /api/invoices/summary ────────────────────────────────
export const getInvoiceSummary = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const [invoices, payments] = await Promise.all([
      myobRequest(dbUser, userId, "GET", "/Sale/Invoice?$top=1000&$orderby=Date desc"),
      myobRequest(dbUser, userId, "GET", "/Sale/Payment?$top=1000&$orderby=Date desc"),
    ]);
    const invoiceList = invoices.Items || [];
    const paymentList = payments.Items || [];
    const totalOutstanding = invoiceList
      .filter(i => i.Status === "Open")
      .reduce((s, i) => s + (i.BalanceDueAmount || 0), 0);
    const totalPaid = paymentList.reduce((s, p) => s + (p.Amount || 0), 0);
    res.json({
      totalInvoices:    invoiceList.length,
      openInvoices:     invoiceList.filter(i => i.Status === "Open").length,
      totalOutstanding: totalOutstanding.toFixed(2),
      totalPaid:        totalPaid.toFixed(2),
      recentInvoices:   invoiceList.slice(0, 5),
    });
  } catch (err) { next(err); }
};



// ── GET /api/invoices/purchases ──────────────────────────────
// export const getPurchaseBills = async (req, res, next) => {
//   try {
//     const { dbUser, userId } = getAuth(req);
//     const { top = 200, skip = 0 } = req.query;
//     const data = await myobRequest(dbUser, userId, "GET",
//       `/Purchase/Bill?$top=${top}&$skip=${skip}&$orderby=Date desc`);
//     res.json(data);
//   } catch (err) { next(err); }
// };

export const getPurchaseBills = async(req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req)
    const { top = 200, skip = 0 } = req.query
    const data = await myobRequest(dbUser, userId, "GET",
      `/Purchase/Bill?$top=${top}&$skip=${skip}&$orderby=Date desc`
    )
    res.json(data)
  } catch (error) {
    next(error)   
  }
}

// ── GET /api/invoices/purchases/type/:type ───────────────────
export const getPurchaseBillsByType = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const { top = 200, skip = 0 } = req.query;
    const endpoint = `/Purchase/Bill/${req.params.type}?$top=${top}&$skip=${skip}&$orderby=Date desc`;
    const data = await myobRequest(dbUser, userId, "GET", endpoint);
    res.json(data);
  } catch (err) { next(err); }
};

// ── GET /api/invoices/purchases/payments ─────────────────────
export const getPurchasePayments = async (req, res, next) => {
  try {
    const { dbUser, userId } = getAuth(req);
    const { top = 200, skip = 0 } = req.query;
    const data = await myobRequest(dbUser, userId, "GET",
      `/Purchase/Payment?$top=${top}&$skip=${skip}&$orderby=Date desc`);
    res.json(data);
  } catch (err) { next(err); }
};



