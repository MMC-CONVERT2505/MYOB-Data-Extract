import { Router } from "express";
import {
  login,
  callback,
  status,
  logout,
  getCompanyFiles,
  selectCompany,
} from "../controllers/authController.js";

const router = Router();

router.get("/login",           login);
router.get("/callback",        callback);
router.get("/status",          status);
router.get("/logout",          logout);
router.get("/company-files",   getCompanyFiles);
router.post("/select-company", selectCompany);

export default router;