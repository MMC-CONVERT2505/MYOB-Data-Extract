
import express from "express";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import env from "./config/env.js";
import connectDB from "./config/db.js";

import authRoutes       from "./routes/authRoutes.js";
import invoiceRoutes    from "./routes/invoiceRoutes.js";
import extractionRoutes from "./routes/extractionRoutes.js";
import historyRoutes    from "./routes/historyRoutes.js";
import settingsRoutes   from "./routes/settingsRoutes.js";
import usageRoutes      from "./routes/usageRoutes.js";
import downloadRoutes   from "./routes/downloadRoutes.js";

const isProd = process.env.NODE_ENV === "production";

// ── Connect to MongoDB first ──────────────────────────────────
await connectDB();

const app = express();

// ── Trust proxy (Nginx / Load Balancer ke liye) ───────────────
app.set("trust proxy", 1);

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: isProd
    ? env.FRONTEND_URL
    : [env.FRONTEND_URL, "http://localhost:5173"],
  credentials: true,
}));

// ── Session stored in MongoDB ─────────────────────────────────
app.use(session({
  secret:            env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl:       process.env.MONGODB_URI,
    dbName:         process.env.MONGODB_DB_NAME || "myob-app",
    collectionName: "sessions",
    ttl:            7 * 24 * 60 * 60,
    autoRemove:     "native",
  }),
  cookie: {
    secure:   isProd,         // HTTPS par true, HTTP par false
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? "none" : "lax",
  },
}));

// ── Routes ───────────────────────────────────────────────────
app.use("/auth",         authRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/extract",  extractionRoutes);
app.use("/api/history",  historyRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/usage",    usageRoutes);
app.use("/api/download", downloadRoutes);

// ── Health Check ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:        "ok",
    env:           process.env.NODE_ENV || "development",
    db:            "connected",
    sessionUserId: req.session?.userId || null,
  });
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  console.error(`❌ [${status}] ${req.method} ${req.path} — ${err.message}`);
  res.status(status).json({ error: err.message || "Internal Server Error" });
});

// ── Start Server ─────────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`✅ MYOB Backend running on http://localhost:${env.PORT}`);
  console.log(`🌍 Environment : ${process.env.NODE_ENV || "development"}`);
  console.log(`🔐 Auth URL    → http://localhost:${env.PORT}/auth/login`);
  console.log(`❤️  Health     → http://localhost:${env.PORT}/health`);
});
























// import express from "express";
// import cors from "cors";
// import session from "express-session";
// import MongoStore from "connect-mongo";
// import env from "./config/env.js";
// import connectDB from "./config/db.js";

// import authRoutes       from "./routes/authRoutes.js";
// import invoiceRoutes    from "./routes/invoiceRoutes.js";
// import extractionRoutes from "./routes/extractionRoutes.js";
// import historyRoutes    from "./routes/historyRoutes.js";
// import settingsRoutes   from "./routes/settingsRoutes.js";
// import usageRoutes      from "./routes/usageRoutes.js";
// import downloadRoutes   from "./routes/downloadRoutes.js";

// // ── Connect to MongoDB first ──────────────────────────────────
// await connectDB();

// const app = express();

// // ── Trust proxy (Nginx / Load Balancer ke liye) ───────────────
// // app.set("trust proxy", 1);

// // ── Middleware ───────────────────────────────────────────────
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// app.use(cors({
//   origin:      env.FRONTEND_URL,
//   credentials: true,
// }));

// // ── Session stored in MongoDB ─────────────────────────────────
// app.use(session({
//   secret:            env.SESSION_SECRET,
//   resave:            false,
//   saveUninitialized: false,
//   store: MongoStore.create({
//     mongoUrl:       process.env.MONGODB_URI || "mongodb://localhost:27017/myob-app",
//     dbName:         process.env.MONGODB_DB_NAME || "myob-app",
//     collectionName: "sessions",
//     ttl:            7 * 24 * 60 * 60,
//     autoRemove:     "native",
//   }),
//   cookie: {
//     secure:   false,
//     httpOnly: true,
//     maxAge:   7 * 24 * 60 * 60 * 1000,
//   },
// }));

// // ── Routes ───────────────────────────────────────────────────
// app.use("/auth",         authRoutes);
// app.use("/api/invoices", invoiceRoutes);

// app.use("/api/extract",  extractionRoutes);
// app.use("/api/history",  historyRoutes);
// app.use("/api/settings", settingsRoutes);
// app.use("/api/usage",    usageRoutes);       // ← NEW
// app.use("/api/download", downloadRoutes);

// // ── Health Check ─────────────────────────────────────────────
// app.get("/health", (req, res) => {
//   res.json({
//     status:        "ok",
//     db:            "connected",
//     sessionUserId: req.session?.userId || null,
//   });
// });

// // ── Global Error Handler ─────────────────────────────────────
// app.use((err, req, res, _next) => {
//   const status = err.status || 500;
//   console.error(`❌ [${status}] ${req.method} ${req.path} — ${err.message}`);
//   res.status(status).json({ error: err.message || "Internal Server Error" });
// });

// // ── Start Server ─────────────────────────────────────────────
// app.listen(env.PORT, () => {
//   console.log(`✅ MYOB Backend running on http://localhost:${env.PORT}`);
//   console.log(`🔐 Auth URL  → http://localhost:${env.PORT}/auth/login`);
//   console.log(`❤️  Health   → http://localhost:${env.PORT}/health`);
// });