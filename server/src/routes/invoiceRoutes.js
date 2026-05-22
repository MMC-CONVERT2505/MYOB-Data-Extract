import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import {
  getSalesInvoices,
  getSalesInvoiceById,
  getSalesInvoicesByType,
  getPayments,
  getOrders,
  getInvoiceSummary,
  getPurchaseBills,
  getPurchaseBillsByType,
  getPurchasePayments,
} from "../controllers/invoiceController.js";

const router = Router();

router.use(requireAuth);

// Sales
router.get("/sales",                getSalesInvoices);
router.get("/sales/summary",        getInvoiceSummary);   // before /:uid
router.get("/sales/type/:type",     getSalesInvoicesByType);
router.get("/sales/:uid",           getSalesInvoiceById);
router.get("/payments",             getPayments);
router.get("/orders",               getOrders);

// Purchases / Bills
router.get("/purchases",            getPurchaseBills);
router.get("/purchases/type/:type", getPurchaseBillsByType);
router.get("/purchases/payments",   getPurchasePayments);

export default router;