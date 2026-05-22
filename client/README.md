# MYOB Data Extractor

A full-stack web application that connects to the **MYOB Business API** via OAuth 2.0, extracts accounting data, and exports it in multiple formats — **MYOB Raw**, **QuickBooks Online (QBO)**, and **Xero**.

---

## Features

- 🔐 **MYOB OAuth 2.0** authentication with session management
- 📦 **15 data types** — transactional and reference data
- 🔄 **3 output formats** — MYOB Raw, QBO, Xero
- 💾 **Smart caching** — 4-hour MongoDB cache with chunked storage for large datasets
- 📥 **Download** as CSV, Excel (.xlsx), or JSON
- 📋 **Extraction history** with pagination and filtering
- ⚙️ **User settings** persistence

---

## Tech Stack

### Backend (`/server`)
| Package | Version | Purpose |
|---|---|---|
| express | ^4.18.2 | Web server & routing |
| mongoose | ^9.5.0 | MongoDB ODM |
| mongodb | ^7.2.0 | MongoDB driver |
| express-session | ^1.17.3 | Session management |
| connect-mongo | ^6.0.0 | MongoDB session store |
| axios | ^1.6.2 | HTTP client (MYOB API calls) |
| xlsx | ^0.18.5 | Excel file generation |
| dotenv | ^16.3.1 | Environment variable management |
| cors | ^2.8.5 | Cross-origin resource sharing |
| nodemon | ^3.0.2 | Dev auto-restart |

### Frontend (`/client`)
| Package | Version | Purpose |
|---|---|---|
| react | ^19.2.4 | UI framework |
| react-dom | ^19.2.4 | React DOM rendering |
| react-router-dom | ^7.14.0 | Client-side routing |
| axios | ^1.14.0 | HTTP client (API calls) |
| lucide-react | ^1.7.0 | Icon library |
| tailwindcss | 3.4 | Utility-first CSS |
| vite | ^8.0.1 | Build tool & dev server |
| @vitejs/plugin-react | ^6.0.1 | React plugin for Vite |

---

## Project Structure

```
MYOB-Auth/
├── client/                          # React frontend (Vite)
│   ├── public/
│   └── src/
│       ├── components/
│       │   └── Layout.jsx           # Sidebar + layout wrapper
│       ├── context/
│       │   └── AuthContext.jsx      # Auth state & session management
│       ├── pages/
│       │   ├── Dashboard.jsx        # Main extraction UI
│       │   ├── History.jsx          # Extraction history
│       │   ├── Settings.jsx         # User settings
│       │   ├── LoginPage.jsx        # MYOB OAuth login
│       │   └── AuthError.jsx        # Auth error page
│       ├── services/
│       │   └── api.jsx              # Axios API service layer
│       ├── App.jsx                  # Routes
│       └── main.jsx                 # Entry point
│
└── server/                          # Node.js + Express backend
    └── src/
        ├── config/                  # DB & env config
        ├── controllers/
        │   ├── authController.js    # OAuth login, callback, session
        │   ├── extractionController.js  # Main data extraction logic
        │   ├── historyController.js # Extraction history CRUD
        │   └── settingsController.js    # User settings CRUD
        ├── middleware/
        │   └── requireAuth.js       # Session auth guard
        ├── models/
        │   ├── ExtractionCache.model.js
        │   ├── ExtractionHistory.model.js
        │   ├── User.model.js
        │   └── UserSettings.model.js
        ├── routes/
        │   ├── authRoutes.js
        │   ├── extractionRoutes.js
        │   ├── historyRoutes.js
        │   └── settingsRoutes.js
        ├── services/
        │   ├── converters/
        │   │   ├── myobRaw.js           # MYOB Raw format converters
        │   │   ├── myobRaw_templates.js # MYOB Raw banking/journal templates
        │   │   ├── referenceRaw.js      # Reference data — Raw format
        │   │   ├── referenceQBO.js      # Reference data — QBO format
        │   │   ├── referenceXero.js     # Reference data — Xero format
        │   │   ├── qboInvoices.js       # QBO invoice converters
        │   │   ├── qboBills.js          # QBO bill converters
        │   │   ├── xeroInvoices.js      # Xero invoice converters
        │   │   └── xeroBills.js         # Xero bill converters
        │   ├── conversionService.js     # Format routing (QBO/Xero/Raw)
        │   ├── extractionCacheService.js # Cache read/write logic
        │   ├── extractionHistoryService.js # History DB operations
        │   ├── helpers.js               # Date formatting, safe() utils
        │   ├── myobService.js           # MYOB OAuth token exchange
        │   ├── userService.js           # User DB operations
        │   └── userSettingsService.js   # Settings DB operations
        └── server.js                    # Express app entry point
```

---

## Supported Data Types

### Transactional (date range required)
| Data Type | MYOB API Endpoint |
|---|---|
| Invoices | `/Sale/Invoice` |
| Bills | `/Purchase/Bill` |
| Invoice Payments | `/Sale/Payment` |
| Bill Payments | `/Purchase/Payment` |
| Banking | `/Banking/SpendMoneyTxn`, `/ReceiveMoneyTxn`, `/TransferMoneyTxn` |
| General Journal | `/GeneralLedger/JournalTransaction` |
| Quotes | `/Sale/Quote` |

### Reference Data (no date filter — all records fetched)
| Data Type | MYOB API Endpoint |
|---|---|
| Items | `/Inventory/Item` |
| Customers | `/Contact/Customer` |
| Suppliers | `/Contact/Supplier` |
| Accounts | `/GeneralLedger/Account` |
| Jobs | `/GeneralLedger/Job` |
| Tax Codes | `/GeneralLedger/TaxCode` |

---

## API Endpoints

### Auth (`/auth`)
| Method | Route | Description |
|---|---|---|
| GET | `/auth/login` | Redirect to MYOB OAuth |
| GET | `/auth/callback` | OAuth callback, save session |
| GET | `/auth/status` | Check session status |
| GET | `/auth/logout` | Destroy session |
| GET | `/auth/company-files` | Fetch MYOB company files |
| POST | `/auth/select-company` | Select active company |

### Extraction (`/api/extract`)
| Method | Route | Description |
|---|---|---|
| POST | `/api/extract` | Extract data (all types) |

### History (`/api/history`)
| Method | Route | Description |
|---|---|---|
| GET | `/api/history` | List history (paginated) |
| GET | `/api/history/:id` | Get single record |
| DELETE | `/api/history/:id` | Delete single record |
| DELETE | `/api/history` | Clear all history |

### Settings (`/api/settings`)
| Method | Route | Description |
|---|---|---|
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings` | Update user settings |

---

## Environment Variables

Create a `.env` file inside the `/server` directory:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/myob-auth

# Session
SESSION_SECRET=your_session_secret_here

# MYOB OAuth
MYOB_CLIENT_ID=your_myob_client_id
MYOB_CLIENT_SECRET=your_myob_client_secret
MYOB_AUTH_URL=https://secure.myob.com/oauth2/v1/authorize
MYOB_TOKEN_URL=https://secure.myob.com/oauth2/v1/token
MYOB_REDIRECT_URI=http://localhost:5000/auth/callback
MYOB_API_BASE=https://api.myob.com/accountright
MYOB_SCOPES=la.global

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5173
```

---

## Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB (local or Atlas)
- MYOB Developer account & registered app → [developer.myob.com](https://developer.myob.com)

### Installation

**1. Clone the repo**
```bash
git clone https://github.com/your-username/myob-auth.git
cd myob-auth
```

**2. Install backend dependencies**
```bash
cd server
npm install
```

**3. Install frontend dependencies**
```bash
cd ../client
npm install
```

**4. Set up environment variables**
```bash
cd ../server
cp .env.example .env
# Edit .env with your MYOB credentials and MongoDB URI
```

### Running in Development

**Start backend** (from `/server`):
```bash
npm run start
```
> Runs on `http://localhost:5000`

**Start frontend** (from `/client`):
```bash
npm run dev
```
> Runs on `http://localhost:5173`

---

## Caching

Extraction results are cached in MongoDB for **4 hours** to avoid repeated MYOB API calls.

- Datasets **under 12MB** → stored as a single document
- Datasets **over 12MB** → chunked into 1,000-row documents
- Cache key = `userId + businessId + dataType + subType + dateRange`
- Reference data cache key uses `"reference"` instead of date range

---

## Output Formats

| Format | Description |
|---|---|
| **MYOB Raw** | All original MYOB API fields, flattened |
| **QBO** | Mapped to QuickBooks Online import format |
| **Xero** | Mapped to Xero CSV import format |

All formats can be downloaded as **CSV**, **Excel (.xlsx)**, or **JSON**.

---

## License

MIT
