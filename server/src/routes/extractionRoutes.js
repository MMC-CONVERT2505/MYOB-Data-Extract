// import { Router } from "express";
// import requireAuth from "../middleware/requireAuth.js";
// import {
//   extractData,
//   getCustomers,
//   getSuppliers,
//   getAccounts,
//   getJobs,
//   getTaxCodes,
//   getInventoryItems,
// } from "../controllers/extractionController.js";

// const router = Router();

// router.use(requireAuth);

// // Main extraction endpoint
// router.post("/",                  extractData);

// // Reference data endpoints
// router.get("/customers",          getCustomers);
// router.get("/suppliers",          getSuppliers);
// router.get("/accounts",           getAccounts);
// router.get("/jobs",               getJobs);
// router.get("/tax-codes",          getTaxCodes);
// router.get("/inventory-items",    getInventoryItems);

// export default router;






import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import {
  extractData,
  getCreditNotes,
  getVendorCredits,
} from "../controllers/extractionController.js";

const router = Router();

router.use(requireAuth);

// Main extraction endpoint (handles ALL data types including reference data)
router.post("/",              extractData);

// Legacy individual endpoints
router.get("/credit-notes",   getCreditNotes);
router.get("/vendor-credits", getVendorCredits);

export default router;