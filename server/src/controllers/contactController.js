import { myobRequest } from "../services/myobService.js";

// ── GET /api/contacts/customers ──────────────────────────────
// export const getCustomers = async (req, res, next) => {
//   try {
//     const { top = 100, skip = 0, search } = req.query;
//     let endpoint = `/Contact/Customer?$top=${top}&$skip=${skip}&$orderby=CompanyName`;
//     if (search) {
//       endpoint += `&$filter=substringof('${search}',CompanyName) or substringof('${search}',FirstName) or substringof('${search}',LastName)`;
//     }
//     const data = await myobRequest(req.session, "GET", endpoint);
//     res.json(data);
//   } catch (err) {
//     next(err);
//   }
// };

export const getCustomers = async (req, res, next) => {
  try {
    const { top = 100, skip = 0, search } = req.query
    let endpoint = `/Contact/Customer?$top=${top}&$skip=${skip}&$orderby=CompanyName`;
    if(search){
      endpoint += `&$filter=substringof('${search}', CompanyName) or substringof('${search}', FirstName) or substringof('${search}', LastName)`

    }
    const data = await myobRequest(req.session, "GET", endpoint)
    res.json(data)
  } catch (error) {
    next(error)
  }
}



// ── GET /api/contacts/customers/:uid ────────────────────────
export const getCustomerById = async (req, res, next) => {
  try {
    const data = await myobRequest(
      req.session,
      "GET",
      `/Contact/Customer/${req.params.uid}`
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};


// ── GET /api/contacts/suppliers ──────────────────────────────
export const getSuppliers = async (req, res, next) => {
  try {
    const { top = 100, skip = 0, search } = req.query;
    let endpoint = `/Contact/Supplier?$top=${top}&$skip=${skip}&$orderby=CompanyName`;
    if (search) {
      endpoint += `&$filter=substringof('${search}',CompanyName)`;
    }
    const data = await myobRequest(req.session, "GET", endpoint);
    res.json(data);
  } catch (err) {
    next(err);
  }
};


// ── GET /api/contacts/suppliers/:uid ────────────────────────
export const getSupplierById = async (req, res, next) => {
  try {
    const data = await myobRequest(
      req.session,
      "GET",
      `/Contact/Supplier/${req.params.uid}`
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};



// ── GET /api/contacts/employees ──────────────────────────────
export const getEmployees = async (req, res, next) => {
  try {
    const { top = 100, skip = 0 } = req.query;
    const data = await myobRequest(
      req.session,
      "GET",
      `/Contact/Employee?$top=${top}&$skip=${skip}&$orderby=LastName`
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
};


// ── GET /api/contacts/all ────────────────────────────────────
export const getAllContacts = async (req, res, next) => {
  try {
    const [customers, suppliers] = await Promise.all([
      myobRequest(req.session, "GET", "/Contact/Customer?$top=500"),
      myobRequest(req.session, "GET", "/Contact/Supplier?$top=500"),
    ]);
    res.json({
      customers: customers.Items || [],
      suppliers: suppliers.Items || [],
      totalCustomers: customers.Count || 0,
      totalSuppliers: suppliers.Count || 0,
    });
  } catch (err) {
    next(err);
  }
};