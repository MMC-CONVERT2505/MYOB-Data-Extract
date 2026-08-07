import axios from "axios";

const api = axios.create({baseURL: "/myob-api", withCredentials: true });

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
  extract:            (body)     => api.post("/api/extract", body),
  fetchReference:     (endpoint) => api.get(`/api/extract/${endpoint}`),
  // endpoints: "customers" | "suppliers" | "accounts" | "jobs" | "tax-codes" | "inventory-items"
  getCreditNotes:     (p = {})   => api.get("/api/extract/credit-notes", { params: p }),
  getVendorCredits:   (p = {})   => api.get("/api/extract/vendor-credits", { params: p }),
  getCreditRefunds:   (p = {})   => api.get("/api/extract/credit-refunds", { params: p }),

  // ── Async extraction (large datasets / 502-safe) ────────────
  startAsync:  (body)    => api.post("/api/extract/async", body),
  getJobStatus:(jobId)   => api.get(`/api/extract/status/${jobId}`),
  listJobs:    ()        => api.get("/api/extract/jobs"),
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

// ── Migration Summary (Get Summary) ─────────────────────────────  ← ADDED BLOCK
export const summaryAPI = {
  getProfile:      ()     => api.get("/api/summary/profile"),
  getTransactions: (body) => api.post("/api/summary/transactions", body),
  getFull:         (body) => api.post("/api/summary", body),

  // ── Async summary (large files / 502-safe) ──────────────────
  startAsync:   (body)  => api.post("/api/summary/async", body),
  getJobStatus: (jobId) => api.get(`/api/summary/status/${jobId}`),
};
