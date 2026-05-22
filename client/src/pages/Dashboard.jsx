

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { extractionAPI, settingsAPI } from "../services/api";
import {
  BarChart3, Clock, CheckCircle, FileText,
  FileDown, ChevronDown, Calendar, ArrowUpRight,
  CheckCircle2, AlertCircle, FileJson, Zap,
  FileSpreadsheet, Bell, Database, TrendingUp, Sparkles, X
} from "lucide-react";

const OUTPUT_FORMATS = [
  { value: "raw",  label: "MYOB Raw" },
  { value: "qbo",  label: "QuickBooks Online (QBO)" },
  { value: "xero", label: "Xero" },
];

const INVOICE_SUBTYPES = ["Item", "Service", "Professional", "Miscellaneous"];
const BILL_SUBTYPES = ["Item", "Service", "Professional", "Miscellaneous"];
const BANKING_SUBTYPES = ["spend", "receive", "transfer",];
const QUOTE_SUBTYPES = ["Item", "Service", "Professional", "TimeBilling", "Miscellaneous"];

const BANKING_LABELS = {
  spend: "Spend Money", receive: "Receive Money", transfer: "Transfer Money",
  // creditNote: "Credit Note", billCredit: "Bill Credit"
};

// Reference types — date filter nahi lagta
const REFERENCE_TYPES = new Set([
  "items", "customers", "suppliers", "accounts", "jobs", "taxcodes"
]);

const DATA_TYPES = [
  { key: "invoices",        label: "Invoices",         subtypes: INVOICE_SUBTYPES, color: "#6366f1" },
  { key: "bills",           label: "Bills",            subtypes: BILL_SUBTYPES,    color: "#f59e0b" },
  // { key: "creditNotes",     label: "Credit Notes",     subtypes: null,             color: "#10b981" },
  // { key: "vendorCredits",   label: "Vendor Credits",   subtypes: null,             color: "#3b82f6" },
  { key: "invoicePayments", label: "Invoice Payments", subtypes: null,             color: "#8b5cf6" },
  { key: "billPayments",    label: "Bill Payments",    subtypes: null,             color: "#ec4899" },
  { key: "banking",         label: "Banking",          subtypes: BANKING_SUBTYPES, color: "#14b8a6", bankingLabels: BANKING_LABELS },
  { key: "generalJournal",  label: "Journal",          subtypes: null,             color: "#f97316" },
  { key: "quotes",          label: "Quotes",           subtypes: QUOTE_SUBTYPES,   color: "#06b6d4" },
  // ── Reference Data ──────────────────────────────────────────
  { key: "items",           label: "Items",            subtypes: null,             color: "#0ea5e9" },
  { key: "customers",       label: "Customers",        subtypes: null,             color: "#a855f7" },
  { key: "suppliers",       label: "Suppliers",        subtypes: null,             color: "#f43f5e" },
  { key: "accounts",        label: "Accounts",         subtypes: null,             color: "#84cc16" },
  { key: "jobs",            label: "Jobs",             subtypes: null,             color: "#fb923c" },
  { key: "taxcodes",        label: "Tax Codes",        subtypes: null,             color: "#2dd4bf" },
];

const today = () => new Date().toISOString().split("T")[0];
const sixYearsAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 6); return d.toISOString().split("T")[0]; };
const fmtDate = (s) => { try { return new Date(s).toLocaleDateString("en-AU"); } catch { return s; } };

// Settings se date range calculate karo
const dateRangeFromSetting = (setting) => {
  const now = new Date();
  const fmt = (d) => d.toISOString().split("T")[0];
  switch (setting) {
    case "last30":      { const d = new Date(now); d.setDate(d.getDate() - 30);        return { start: fmt(d), end: fmt(now) }; }
    case "last60":      { const d = new Date(now); d.setDate(d.getDate() - 60);        return { start: fmt(d), end: fmt(now) }; }
    case "last90":      { const d = new Date(now); d.setDate(d.getDate() - 90);        return { start: fmt(d), end: fmt(now) }; }
    case "last6months": { const d = new Date(now); d.setMonth(d.getMonth() - 6);       return { start: fmt(d), end: fmt(now) }; }
    case "lastYear":    { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return { start: fmt(d), end: fmt(now) }; }
    default:              return { start: sixYearsAgo(), end: fmt(now) };
  }
};

const flatVal = (v) => { if (v === null || v === undefined) return ""; if (typeof v === "object") return JSON.stringify(v); return String(v); };
const csvCell = (v) => { const s = flatVal(v); return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCSV = (items) => { if (!items?.length) return ""; const keys = Object.keys(items[0]); return [keys.map(csvCell).join(","), ...items.map(r => keys.map(k => csvCell(r[k])).join(","))].join("\n"); };
const dl = (content, name, mime) => { const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([content], { type: mime })), download: name }); a.click(); URL.revokeObjectURL(a.href); };
const dlCSV = (items, name) => dl(toCSV(items.map(convertDatesInRow)), name + ".csv", "text/csv");
const dlJSON = (items, name) => dl(JSON.stringify(items.map(convertDatesInRow), null, 2), name + ".json", "application/json");

const DATE_COLS = new Set([
  "Payment Date","Invoice date", "Invoice Due date","Journal Date", "Invoice Date", "Due Date", "Date", "DateOccurred",
  "Adjustment Note Date", "As Of Date", "PromisedDate", "LastPaymentDate",
  "Terms.DiscountDate", "Terms.BalanceDueDate", "Terms.DiscountExpiryDate", "Terms.DueDate",
]);

const serialToDate = (v) => {
  if (typeof v !== "number" || v <= 0 || v > 2958465) return v;
  const epoch = new Date(Date.UTC(1899, 11, 30));
  const adjusted = v > 60 ? v - 1 : v;
  const d = new Date(epoch.getTime() + adjusted * 86400000);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const convertDatesInRow = (row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = DATE_COLS.has(k) && typeof v === "number" ? serialToDate(v) : v;
  }
  return out;
};

const dlExcel = (items, name) => {
  if (!items?.length) return;
  try {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error("no XLSX");
    const keys = Object.keys(items[0]);
    const ws = {};
    const range = { s: { r: 0, c: 0 }, e: { r: items.length, c: keys.length - 1 } };
    keys.forEach((k, c) => { ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: k, t: "s" }; });
    items.forEach((row, ri) => {
      keys.forEach((k, c) => {
        const v = row[k];
        const addr = XLSX.utils.encode_cell({ r: ri + 1, c });
        if (v === null || v === undefined || v === "") { ws[addr] = { v: "", t: "s" }; }
        else if (DATE_COLS.has(k) && typeof v === "number" && v > 0) { ws[addr] = { v, t: "n", z: "dd/mm/yyyy" }; }
        else if (typeof v === "object") { ws[addr] = { v: JSON.stringify(v), t: "s" }; }
        else if (typeof v === "number") { ws[addr] = { v, t: "n" }; }
        else { ws[addr] = { v: String(v), t: "s" }; }
      });
    });
    ws["!ref"] = XLSX.utils.encode_range(range);
    ws["!cols"] = keys.map(k => DATE_COLS.has(k) ? { wch: 14 } : { wch: Math.max(k.length + 2, 12) });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, name + ".xlsx");
  } catch { dl(toCSV(items), name + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); }
};

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon: Icon, gradient, label, value, trend }) {
  return (
    <div className="relative bg-white rounded-2xl p-5 border border-slate-100 overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2 opacity-10 group-hover:opacity-20 transition-opacity"
        style={{ background: gradient }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: gradient, boxShadow: "0 4px 12px -2px rgba(0,0,0,0.15)" }}>
          <Icon size={18} className="text-white" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50">
            <TrendingUp size={10} className="text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600">{trend}</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-black text-slate-800 mb-0.5">{value}</p>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
    </div>
  );
}

// ── Type Button ───────────────────────────────────────────────
function TypeButton({ dt, isActive, selectedSub, onActivate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = (isActive && selectedSub)
    ? (dt.bankingLabels ? dt.bankingLabels[selectedSub] : selectedSub + " " + dt.label.replace(/s$/, "") + "s")
    : dt.label;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => dt.subtypes ? setOpen(o => !o) : onActivate(dt.key, null)}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border"
        style={isActive ? {
          background: `linear-gradient(135deg, ${dt.color}ee 0%, ${dt.color}bb 100%)`,
          color: "white", borderColor: "transparent",
          boxShadow: `0 4px 14px -4px ${dt.color}88`,
          transform: "translateY(-1px)",
        } : { background: "white", color: "#64748b", borderColor: "#e2e8f0" }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.borderColor = dt.color + "66"; e.currentTarget.style.color = dt.color; } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; } }}
      >
        {label}
        {dt.subtypes && <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .15s" }} />}
      </button>

      {open && dt.subtypes && (
        <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl z-30 min-w-[190px] py-2 border border-slate-100 overflow-hidden">
          {dt.subtypes.map(s => {
            const subLabel = dt.bankingLabels ? dt.bankingLabels[s] : `${s} ${dt.label.replace(/s$/, "")}s`;
            return (
              <button key={s} onClick={() => { onActivate(dt.key, s); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50 font-medium"
                style={{ color: selectedSub === s && isActive ? dt.color : "#475569" }}>
                {subLabel}
              </button>
            );
          })}
          {!dt.bankingLabels && (
            <div className="border-t border-slate-100 mt-1 pt-1">
              <button onClick={() => { onActivate(dt.key, null); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-slate-50"
                style={{ color: !selectedSub && isActive ? dt.color : "#94a3b8" }}>
                All {dt.label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Download Button Group ─────────────────────────────────────
function DownloadGroup({ label, count, items, filename, color = "#6366f1" }) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "20" }}>
          <Database size={15} style={{ color }} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{label}</p>
          <p className="text-xs text-slate-400">{count.toLocaleString()} records ready</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "CSV",   onClick: () => dlCSV(items, filename),   bg: "white",        border: "#e2e8f0",       color: "#64748b" },
          { label: "Excel", onClick: () => dlExcel(items, filename), bg: "#10b98112",    border: "#10b98130",     color: "#059669" },
          { label: "JSON",  onClick: () => dlJSON(items, filename),  bg: color + "12",   border: color + "30",    color: color },
        ].map(({ label: btnLabel, onClick, bg, border, color: btnColor }) => (
          <button key={btnLabel} onClick={onClick}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 hover:shadow-sm border"
            style={{ background: bg, borderColor: border, color: btnColor }}>
            {btnLabel === "CSV"   && <FileDown size={13} />}
            {btnLabel === "Excel" && <FileSpreadsheet size={13} />}
            {btnLabel === "JSON"  && <FileJson size={13} />}
            {btnLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Result Modal ──────────────────────────────────────────────
function ResultModal({ result, outputFormat, myobFname, convertedFname, activeType, activeSub, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 51,
          width: "min(820px, 94vw)",
          maxHeight: "88vh",
          overflowY: "auto",
          animation: "modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div style={{ background: "white", borderRadius: "24px", overflow: "hidden", boxShadow: "0 32px 80px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(16,185,129,0.15)" }}>

          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)", padding: "28px 32px", display: "flex", alignItems: "center", gap: "16px", borderBottom: "1px solid #d1fae5" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 8px 20px -6px #10b98166" }}>
              <CheckCircle2 size={28} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 900, color: "#064e3b", fontSize: 22, margin: 0 }}>Extraction Complete!</p>
              <p style={{ color: "#065f46", fontSize: 13, margin: "4px 0 0" }}>
                {result.count.toLocaleString()} record{result.count !== 1 ? "s" : ""} extracted successfully
                {result.fromCache && (
                  <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 20, background: "#6ee7b7", color: "#064e3b", fontSize: 11, fontWeight: 700 }}>
                    ⚡ From Cache
                  </span>
                )}
              </p>
              <p style={{ color: "#10b981", fontSize: 11, margin: "2px 0 0", fontWeight: 600 }}>
                {activeType}{activeSub ? ` › ${activeSub}` : ""}
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ padding: "6px 16px", borderRadius: 20, background: "linear-gradient(135deg, #10b981, #059669)", color: "white", fontWeight: 900, fontSize: 18 }}>
                {result.count.toLocaleString()}
              </div>
              <p style={{ color: "#6ee7b7", fontSize: 10, marginTop: 4, fontWeight: 600 }}>ROWS</p>
            </div>
            <button
              onClick={onClose}
              style={{ marginLeft: 8, width: 36, height: 36, borderRadius: 10, border: "1.5px solid #a7f3d0", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#6b7280" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Download Groups */}
          <div style={{ padding: "24px 32px" }}>
            {outputFormat === "raw" && (
              <DownloadGroup
                label="MYOB Raw Data"
                count={result.count}
                items={result.items}
                filename={myobFname}
                color="#6366f1"
              />
            )}
            {outputFormat === "qbo" && result.converted && (
              <DownloadGroup
                label="QuickBooks Online (QBO)"
                count={result.converted.count}
                items={result.converted.items}
                filename={convertedFname}
                color="#2ca01c"
              />
            )}
            {outputFormat === "xero" && result.converted && (
              <DownloadGroup
                label="Xero"
                count={result.converted.count}
                items={result.converted.items}
                filename={convertedFname}
                color="#13b5ea"
              />
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "0 32px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              💡 Cache valid for 4 hours · Press Esc or click outside to close
            </p>
            <button
              onClick={onClose}
              style={{ padding: "10px 28px", borderRadius: 12, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", boxShadow: "0 4px 14px -4px #6366f188" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const { businessName } = useAuth();
  const [startDate, setStartDate] = useState(sixYearsAgo());
  const [endDate, setEndDate] = useState(today());
  const [outputFormat, setOutputFormat] = useState("raw");
  const [activeType, setActiveType] = useState(null);
  const [activeSub, setActiveSub] = useState(null);

  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Load settings on mount → apply to Dashboard state ────────
  useEffect(() => {
    setMounted(true);
    const loadSettings = async () => {
      try {
        const res = await settingsAPI.get();
        const s = res.data;

        // Default output format
        if (s?.defaultOutputFormat) setOutputFormat(s.defaultOutputFormat);

        // Default date range
        if (s?.defaultDateRange) {
          const { start, end } = dateRangeFromSetting(s.defaultDateRange);
          setStartDate(start);
          setEndDate(end);
        }

        // Default data type
        if (s?.defaultDataType) {
          setActiveType(s.defaultDataType);
          setActiveSub(s.defaultSubType || null);
        }
      } catch (err) {
        console.error("Failed to load settings:", err.message);
      }
    };
    loadSettings();
  }, []);

  const isReferenceType = activeType ? REFERENCE_TYPES.has(activeType) : false;

  const totalExtractions = history.reduce((s, h) => s + h.count, 0);
  const successCount = history.filter(h => h.status === "Success").length;

  const handleActivate = (type, sub) => {
    setActiveType(type); setActiveSub(sub);
    setResult(null); setError(null);
  };

  const handleExtract = async () => {
    if (!activeType) { setError("Please select a data type first."); return; }
    setLoading(true); setError(null); setResult(null); setShowModal(false);

    const isRef = REFERENCE_TYPES.has(activeType);
    const fname = `${activeType}${activeSub ? "_" + activeSub.toLowerCase() : ""}`;
    const histEntry = {
      id: Date.now(), label: fname, format: outputFormat.toUpperCase(),
      date: fmtDate(new Date()), count: 0, status: "In Progress"
    };
    setHistory(prev => [histEntry, ...prev.slice(0, 9)]);

    try {
      // Reference types ke liye startDate/endDate nahi bhejna
      const payload = {
        dataType: activeType,
        subType: activeSub,
        outputFormat,
        ...(!isRef && { startDate, endDate }),
      };

      const res = await extractionAPI.extract(payload);
      setResult(res.data);
      setShowModal(true);
      setHistory(prev => prev.map(h => h.id === histEntry.id
        ? { ...h, count: res.data.count, status: "Success" } : h));
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Extraction failed");
      setHistory(prev => prev.map(h => h.id === histEntry.id
        ? { ...h, status: "Failed" } : h));
    } finally { setLoading(false); }
  };

  const activeSubLabel = activeSub
    ? (DATA_TYPES.find(d => d.key === activeType)?.bankingLabels?.[activeSub]?.toLowerCase().replace(/ /g, "_") || activeSub.toLowerCase())
    : "";
  const baseLabel = `${activeType}${activeSubLabel ? "_" + activeSubLabel : ""}${!isReferenceType ? `_${startDate}_${endDate}` : ""}`;
  const myobFname = result ? `myob_${baseLabel}` : "myob_data";
  const convertedFname = result ? `${outputFormat}_${baseLabel}` : `${outputFormat}_data`;
  const activeColor = DATA_TYPES.find(d => d.key === activeType)?.color || "#6366f1";

  return (
    <div className="min-h-screen bg-slate-50/50" style={{ fontFamily: "'DM Sans', 'Outfit', sans-serif" }}>

      {/* Result Modal */}
      {showModal && result && (
        <ResultModal
          result={result}
          outputFormat={outputFormat}
          myobFname={myobFname}
          convertedFname={convertedFname}
          activeType={activeType}
          activeSub={activeSub}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Top Bar */}
      <div className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-black text-slate-800">Dashboard</h1>
          <p className="text-xs text-slate-400">
            {businessName ? `Connected to ${businessName}` : "No company selected"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <Bell size={15} />
          </button>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            {businessName?.[0]?.toUpperCase() || "U"}
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto">

        {/* Stat Cards */}
        <div className={`grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6 transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <StatCard icon={BarChart3} gradient="linear-gradient(135deg, #6366f1, #8b5cf6)" label="Total Records Extracted" value={totalExtractions.toLocaleString()} />
          <StatCard icon={Zap} gradient="linear-gradient(135deg, #f59e0b, #f97316)" label="Extractions Run" value={history.length} />
          <StatCard icon={CheckCircle} gradient="linear-gradient(135deg, #10b981, #059669)" label="Successful" value={successCount} />
          <StatCard icon={FileText} gradient="linear-gradient(135deg, #3b82f6, #6366f1)" label="Output Format" value={outputFormat.toUpperCase()} />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Extraction Panel */}
          <div className={`xl:col-span-2 transition-all duration-500 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-visible">

              <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">Extract Data</h2>
                  <p className="text-xs text-slate-400">Configure and run your extraction</p>
                </div>
              </div>

              <div className="p-6">

                {/* Step 1 — Date Range (reference types ke liye hide) */}
                {!isReferenceType && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">1</div>
                      <p className="text-sm font-bold text-slate-700">Date Range</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ label: "From", val: startDate, onChange: setStartDate }, { label: "To", val: endDate, onChange: setEndDate }].map(({ label, val, onChange }) => (
                        <div key={label} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-indigo-300 focus-within:bg-white transition-all">
                          <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                            <input type="date" value={val} onChange={e => onChange(e.target.value)}
                              className="bg-transparent text-sm font-semibold outline-none text-slate-700 w-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reference type info banner */}
                {isReferenceType && (
                  <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-100 bg-blue-50">
                    <Database size={15} className="text-blue-500 flex-shrink-0" />
                    <p className="text-xs text-blue-700 font-medium">
                      Reference data — date filter not required. All records will be fetched.
                    </p>
                  </div>
                )}

                {/* Step 2 — Output Format */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-600">
                      {isReferenceType ? "1" : "2"}
                    </div>
                    <p className="text-sm font-bold text-slate-700">Output Format</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {OUTPUT_FORMATS.map(f => (
                      <button key={f.value} onClick={() => setOutputFormat(f.value)}
                        className="px-4 py-3 rounded-xl border text-sm font-semibold transition-all duration-200"
                        style={outputFormat === f.value ? {
                          background: "linear-gradient(135deg, #f59e0b15, #f97316)",
                          borderColor: "#f59e0b", color: "#d97706",
                          boxShadow: "0 2px 10px -2px #f59e0b44",
                        } : { background: "white", borderColor: "#e2e8f0", color: "#64748b" }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 3 — Data Type */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-600">
                      {isReferenceType ? "2" : "3"}
                    </div>
                    <p className="text-sm font-bold text-slate-700">Data Type</p>
                  </div>

                  {/* Transactional types */}
                  <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Transactional</p>
                  <div className="grid grid-cols-4 gap-2 mb-4 z-50">
                    {DATA_TYPES.filter(dt => !REFERENCE_TYPES.has(dt.key)).map(dt => (
                      <TypeButton key={dt.key} dt={dt}
                        isActive={activeType === dt.key}
                        selectedSub={activeType === dt.key ? activeSub : null}
                        onActivate={handleActivate}
                      />
                    ))}
                  </div>

                  {/* Reference types */}
                  <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Reference Data</p>
                  <div className="grid grid-cols-4 gap-2 z-50">
                    {DATA_TYPES.filter(dt => REFERENCE_TYPES.has(dt.key)).map(dt => (
                      <TypeButton key={dt.key} dt={dt}
                        isActive={activeType === dt.key}
                        selectedSub={activeType === dt.key ? activeSub : null}
                        onActivate={handleActivate}
                      />
                    ))}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100 mb-4 text-sm text-red-600">
                    <AlertCircle size={15} className="flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Extract Button */}
                <button onClick={handleExtract} disabled={loading || !activeType}
                  className="w-full relative overflow-hidden flex items-center justify-center gap-2.5 py-4 rounded-xl text-sm font-bold text-white transition-all duration-300 group"
                  style={{
                    background: loading || !activeType ? "#c7d2fe" : `linear-gradient(135deg, ${activeColor}ee 0%, ${activeColor}bb 100%)`,
                    boxShadow: loading || !activeType ? "none" : `0 8px 20px -6px ${activeColor}88`,
                    cursor: loading || !activeType ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={e => { if (!loading && activeType) e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                >
                  {!loading && activeType && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)", transform: "skewX(-20deg)" }} />
                  )}
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /><span>Extracting data...</span></>
                  ) : (
                    <><Zap size={16} /><span>Extract Data</span><ArrowUpRight size={15} className="opacity-70" /></>
                  )}
                </button>

                {/* Re-open result button */}
                {result && !showModal && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:bg-emerald-50"
                    style={{ borderColor: "#10b981", color: "#10b981" }}
                  >
                    <CheckCircle2 size={14} style={{ display: "inline", marginRight: 6 }} />
                    View Last Result ({result.count.toLocaleString()} records) · {outputFormat.toUpperCase()}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className={`flex flex-col gap-4 transition-all duration-500 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>

            <div className="bg-white rounded-2xl mt-6 border border-slate-100 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Connection Status</h3>
              <div className="flex flex-col gap-2.5">
                {[
                  { name: "MYOB Business", connected: !!businessName, color: "#6366f1" },
                  ...(outputFormat !== "raw" ? [{ name: outputFormat === "xero" ? "Xero" : "QuickBooks Online", connected: true, color: "#10b981" }] : []),
                ].map(conn => (
                  <div key={conn.name}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
                    style={{ borderColor: conn.connected ? conn.color + "22" : "#f1f5f9", background: conn.connected ? conn.color + "08" : "#f8fafc" }}>
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: conn.connected ? conn.color : "#cbd5e1" }} />
                        {conn.connected && <div className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: conn.color }} />}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{conn.name}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: conn.connected ? conn.color : "#94a3b8" }}>
                      {conn.connected ? "Connected" : "Offline"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800">Recent Activity</h3>
                {history.length > 0 && <span className="text-xs text-slate-400 font-medium">{history.length} runs</span>}
              </div>

              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <Database size={20} className="text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400">No extractions yet</p>
                  <p className="text-xs text-slate-300">Run an extraction to see activity</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {history.map((h, i) => (
                    <div key={h.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                      style={{ animationDelay: `${i * 50}ms` }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: h.status === "Success" ? "#10b98115" : h.status === "In Progress" ? "#f59e0b15" : "#ef444415" }}>
                        {h.status === "Success"     && <CheckCircle size={14} className="text-emerald-500" />}
                        {h.status === "In Progress" && <Clock size={14} className="text-amber-500" />}
                        {h.status === "Failed"      && <AlertCircle size={14} className="text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{h.label}</p>
                        <p className="text-xs text-slate-400">{h.date} · {h.format}</p>
                      </div>
                      {h.status === "Success" && <span className="text-xs font-bold text-emerald-600 flex-shrink-0">{h.count}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}