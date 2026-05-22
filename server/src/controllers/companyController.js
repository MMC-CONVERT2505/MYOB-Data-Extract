import { myobRequest } from "../services/myobService.js";

// ── GET /api/company/info ────────────────────────────────────
export const getCompanyInfo = async (req, res, next) => {
  try {
    const data = await myobRequest(req.session, "GET", "/CompanyFile");
    res.json({
      ...data,
      businessName: req.session.businessName,
      businessId: req.session.businessId,
    });
  } catch (err) {
    next(err);
  }
};


// ── GET /api/company/accounts ────────────────────────────────
// export const getAccounts = async (req, res, next) => {
//   try {
//     const { top = 200, type } = req.query;
//     let endpoint = `/Account?$top=${top}&$orderby=Number`;
//     if (type) endpoint += `&$filter=Type eq '${type}'`;
//     const data = await myobRequest(req.session, "GET", endpoint);
//     res.json(data);
//   } catch (err) {
//     next(err);
//   }
// };


export const getAccounts = async (req, res, next) => {
  try {
    const { top = 200, type } = req.query
    let endpoint = `/Account?$top=${top}&$orderby=Number`
    if(type) endpoint += `&$filter=Type eq '${type}'`
    const data = await myobRequest(req.session, "GET", endpoint);
    res.json(data)
  } catch (error) {
    next(error)
  }
}

// ── GET /api/company/tax-codes ───────────────────────────────
export const getTaxCodes = async (req, res, next) => {
  try {
    const data = await myobRequest(req.session, "GET", "/TaxCode?$top=100");
    res.json(data);
  } catch (err) {
    next(err);
  }
};

