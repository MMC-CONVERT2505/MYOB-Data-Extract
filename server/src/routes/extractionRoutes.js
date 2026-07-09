

// import { Router } from "express";
// import requireAuth from "../middleware/requireAuth.js";
// import {
//   extractData,
//   getCreditNotes,
//   getVendorCredits,
// } from "../controllers/extractionController.js";

// const router = Router();

// router.use(requireAuth);

// // Main extraction endpoint (handles ALL data types including reference data)
// router.post("/",              extractData);

// // Legacy individual endpoints
// router.get("/credit-notes",   getCreditNotes);
// router.get("/vendor-credits", getVendorCredits);

// export default router;





import {
  extractData,
  getCreditNotes,
  getVendorCredits,
  getCreditRefunds,
} from "../controllers/extractionController.js";

const router = Router();

router.use(requireAuth);

// Main extraction endpoint (handles ALL data types including reference data)
router.post("/",              extractData);

// Legacy individual endpoints
router.get("/credit-notes",   getCreditNotes);
router.get("/vendor-credits", getVendorCredits);
router.get("/credit-refunds", getCreditRefunds);

export default router;