import axios from "axios";

const api = axios.create({ withCredentials: true });

// ── Sales Invoices ────────────────────────────────────────────
export const invoiceAPI = {
  getSales:            (p = {}) => api.get("/api/invoices/sales", { params: p }),
  getSaleById:         (uid)    => api.get(`/api/invoices/sales/${uid}`),
  getSalesByType:      (type, p = {}) => api.get(`/api/invoices/sales/type/${type}`, { params: p }),
  getPayments:         (p = {}) => api.get("/api/invoices/payments", { params: p }),
  getOrders:           (p = {}) => api.get("/api/invoices/orders", { params: p }),
  getSummary:          ()       => api.get("/api/invoices/sales/summary"),
  getPurchases:        (p = {}) => api.get("/api/invoices/purchases", { params: p }),
  getPurchaseByType:   (type, p = {}) => api.get(`/api/invoices/purchases/type/${type}`, { params: p }),
  getPurchasePayments: (p = {}) => api.get("/api/invoices/purchases/payments", { params: p }),
};

// ── Contacts ─────────────────────────────────────────────────
export const contactAPI = {
  getCustomers:    (p = {}) => api.get("/api/contacts/customers", { params: p }),
  getCustomerById: (uid)    => api.get(`/api/contacts/customers/${uid}`),
  getSuppliers:    (p = {}) => api.get("/api/contacts/suppliers", { params: p }),
  getSupplierById: (uid)    => api.get(`/api/contacts/suppliers/${uid}`),
  getEmployees:    (p = {}) => api.get("/api/contacts/employees", { params: p }),
  getAll:          ()       => api.get("/api/contacts/all"),
};

// ── Company ──────────────────────────────────────────────────
export const companyAPI = {
  getInfo:     ()       => api.get("/api/company/info"),
  getAccounts: (p = {}) => api.get("/api/company/accounts", { params: p }),
  getTaxCodes: ()       => api.get("/api/company/tax-codes"),
};

// ── Data Extraction ──────────────────────────────────────────
export const extractionAPI = {
  extract:          (body)     => api.post("/api/extract", body),
  fetchReference:   (endpoint) => api.get(`/api/extract/${endpoint}`),
  // endpoints: "customers" | "suppliers" | "accounts" | "jobs" | "tax-codes" | "inventory-items"
};

// ── Extraction History ────────────────────────────────────────
export const historyAPI = {
  getAll:    (p = {}) => api.get("/api/history", { params: p }),
  getById:   (id)     => api.get(`/api/history/${id}`),
  deleteOne: (id)     => api.delete(`/api/history/${id}`),
  clearAll:  ()       => api.delete("/api/history"),
};

// ── User Settings ─────────────────────────────────────────────
export const settingsAPI = {
  get:  ()     => api.get("/api/settings"),
  save: (body) => api.put("/api/settings", body),
};

// ── API Usage ─────────────────────────────────────────────────
export const usageAPI = {
  get: () => api.get("/api/usage"),
};