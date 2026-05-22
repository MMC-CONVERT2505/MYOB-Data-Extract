import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, LogOut, Info, ChevronDown,
  Search, X, History, Settings, Building2,
  Sparkles, Zap, AlertTriangle, Activity
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback } from "react";
import axios from "axios";
import { usageAPI } from "../services/api";

// ── Nav Item ──────────────────────────────────────────────────
const NavItem = ({ to, icon: Icon, label, color }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
        isActive ? "text-white shadow-md" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
      }`
    }
    style={({ isActive }) =>
      isActive ? {
        background: `linear-gradient(135deg, ${color}ee 0%, ${color}bb 100%)`,
        boxShadow:  `0 4px 14px -4px ${color}66`,
      } : {}
    }
  >
    {({ isActive }) => (
      <>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${isActive ? "bg-white/20" : "group-hover:bg-slate-100"}`}>
          <Icon size={15} style={{ color: isActive ? "white" : color }} />
        </div>
        <span>{label}</span>
        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
      </>
    )}
  </NavLink>
);

// ── Usage Bar ─────────────────────────────────────────────────
function UsageBar({ usage }) {
  if (!usage) return null;

  const { used, limit, remaining, percent, warning, critical } = usage;

  // Color based on usage level              
  const barColor = critical ? "#ef4444"
    : warning               ? "#f59e0b"
    : percent > 60          ? "#f97316"
    : "#10b981";

  const bgColor = critical ? "#fef2f2"
    : warning               ? "#fffbeb"
    : "#f0fdf4";

  const textColor = critical ? "#dc2626"
    : warning                ? "#d97706"
    : "#059669";

  return (
    <div className="px-3 mt-5">
      <div className="rounded-xl border p-3 transition-all"
        style={{ background: bgColor, borderColor: barColor + "33" }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Activity size={11} style={{ color: barColor }} />
            <span className="text-xs font-semibold" style={{ color: textColor }}>
              API Call's Today
            </span>
          </div>
          <span className="text-xs font-bold" style={{ color: textColor }}>
            {used}/{limit}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-white/60 overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width:      `${percent}%`,
              background: `linear-gradient(90deg, ${barColor}aa, ${barColor})`,
            }}
          />
        </div>

        {/* Remaining text */}
        <p className="text-xs" style={{ color: textColor }}>
          {critical
            ? "❌ Daily limit reached"
            : `${remaining} requests remaining`}
        </p>
      </div>
    </div>
  );
}

// ── Main Layout ───────────────────────────────────────────────
export default function Layout({ children }) {
  const { businessName, businessId, logout, refetch } = useAuth();
  const [showAbout, setShowAbout]   = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [allFiles, setAllFiles]     = useState([]);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(false);
  const [usage, setUsage]           = useState(null);

  // ── Fetch usage on mount + every 30 seconds ───────────────
  const fetchUsage = useCallback(async () => {
    try {
      const res = await usageAPI.get();
      setUsage(res.data);                                                                                        
    } catch (err) {
      // Silently fail — usage display is non-critical
      console.error("Usage fetch error:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchUsage]);

  const loadAndSwitch = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/auth/company-files", { withCredentials: true });
      setAllFiles(res.data || []);
      setSearch("");
      setShowSwitch(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const selectFile = async (file) => {
    await axios.post("/auth/select-company",
      { businessId: file.Id, businessName: file.Name, businessUri: file.Uri || null },
      { withCredentials: true }
    );
    setShowSwitch(false);
    setSearch("");
    await refetch();
  };

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return allFiles;
    const q = search.toLowerCase();
    return allFiles.filter(f => f.Name?.toLowerCase().includes(q));
  }, [allFiles, search]);

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", color: "#6366f1" },
    { to: "/history",   icon: History,         label: "History",   color: "#f59e0b" },
    { to: "/settings",  icon: Settings,        label: "Settings",  color: "#10b981" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50/80" style={{ fontFamily: "'DM Sans', 'Outfit', sans-serif" }}>

      {/* ── Sidebar ── */}
      <aside className="w-60 min-h-screen flex flex-col flex-shrink-0 bg-white border-r border-slate-100 shadow-sm">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shadow-md"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 4px 12px -2px rgba(99,102,241,0.4)" }}>
              M
            </div>
            <div>
              <span className="font-bold text-sm text-slate-800">MYOB Tool</span>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-slate-400">Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 pt-4 flex flex-col gap-1">
          {navItems.map(item => <NavItem key={item.to} {...item} />)}
        </nav>

        {/* Company Switcher */}
        <div className="px-3 mt-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">Company</p>
          <button
            onClick={loadAndSwitch}
            disabled={loading}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-slate-50 border border-slate-100 group"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={13} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">
                {loading ? "Loading..." : (businessName?.slice(0, 18) + (businessName?.length > 18 ? "…" : "")) || "No company"}
              </p>
              <p className="text-xs text-slate-400">Click to switch</p>
            </div>
            <ChevronDown size={12} className="text-slate-300 flex-shrink-0 group-hover:text-slate-500 transition-colors" />
          </button> 

         
        </div>

         <UsageBar usage={usage} />



        <div className="flex-1" />

        {/* ── API Usage Bar ── */}
        {/* <UsageBar usage={usage} /> */}

        {/* About + Logout */}
        <div className="px-3 pb-5 flex flex-col gap-1.5">
          <button onClick={() => setShowAbout(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all duration-200">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
              <Info size={14} className="text-slate-400" />
            </div>
            <span>About</span>
          </button>

          <button onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all duration-200 group">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
              <LogOut size={14} className="text-red-400" />
            </div>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {/* Warning Banner — shown when <= 20 requests remaining */}
        {usage?.warning && !usage?.critical && (
          <div className="flex items-center gap-3 px-6 py-3 border-b animate-slide-down"
            style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={14} className="text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                ⚠️ Sirf {usage.remaining} API request{usage.remaining !== 1 ? "s" : ""} bachi hain aaj ke liye!
              </p>
              <p className="text-xs text-amber-600">
                Kal midnight pe automatically reset ho jaayega. Zaruri extractions pehle karo.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-700 px-2.5 py-1 rounded-lg bg-amber-100">
              {usage.used}/{usage.limit} used
            </span>
          </div>
        )}

        {/* Critical Banner — limit hit */}
        {usage?.critical && (
          <div className="flex items-center gap-3 px-6 py-3 border-b animate-slide-down"
            style={{ background: "#fef2f2", borderColor: "#fca5a5" }}>
            <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <Zap size={14} className="text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800">
                ❌ Aaj ki API limit ({usage.limit} requests) poori ho gayi!
              </p>
              <p className="text-xs text-red-500">
                Kal midnight pe reset hoga. Tab tak naye extractions nahi honge.
              </p>
            </div>
            <span className="text-xs font-bold text-red-700 px-2.5 py-1 rounded-lg bg-red-100">
              {usage.used}/{usage.limit}
            </span>
          </div>
        )}

        {children}
      </main>

      {/* ── Company Switch Modal ── */}
      {showSwitch && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-100 overflow-hidden"
            style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>

            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-800">Select Company File</h2>
                <p className="text-xs text-slate-400 mt-0.5">{allFiles.length} companies available</p>
              </div>
              <button onClick={() => setShowSwitch(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-slate-400">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 pb-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-indigo-300 focus-within:bg-white transition-all">
                <Search size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search company name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-transparent text-sm outline-none flex-1 text-slate-700 placeholder-slate-400"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="text-slate-300 hover:text-slate-500">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ minHeight: 0 }}>
              <div className="flex flex-col gap-1.5">
                {filteredFiles.length === 0 ? (
                  <div className="text-center py-10 text-sm text-slate-400">
                    No results for "{search}"
                  </div>
                ) : (
                  filteredFiles.map(file => (
                    <button
                      key={file.Id}
                      onClick={() => selectFile(file)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-200 hover:border-indigo-200"
                      style={{
                        borderColor: file.Id === businessId ? "#6366f1" : "#f1f5f9",
                        background:  file.Id === businessId ? "#f5f3ff" : "white",
                        boxShadow:   file.Id === businessId ? "0 0 0 1px #6366f1" : "none",
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{file.Name}</div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5 truncate">{file.Id}</div>
                      </div>
                      {file.Id === businessId && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-600 font-semibold ml-2 flex-shrink-0">
                          Active
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── About Modal ── */}
      {showAbout && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl border border-slate-100 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl mx-auto mb-4 shadow-lg"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 8px 20px -4px rgba(99,102,241,0.4)" }}>
              M
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">MYOB Data ExtractionTool</h2>
            <p className="text-sm text-slate-400 mb-1">Extract and convert MYOB data to QBO / Xero format.</p>
            <div className="flex items-center justify-center gap-1.5 mb-6">
              <Sparkles size={12} className="text-amber-400" />
              <span className="text-xs text-slate-300 font-medium">v1.0.0</span>
            </div>
            {/* Show usage in about modal too */}
            {usage && (
              <div className="mb-5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-left">
                <p className="text-xs font-semibold text-slate-500 mb-1">Today's API Usage</p>
                <p className="text-sm font-bold text-slate-800">{usage.used} / {usage.limit} requests</p>
                <div className="w-full h-1.5 rounded-full bg-slate-200 mt-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${usage.percent}%`, background: usage.critical ? "#ef4444" : usage.warning ? "#f59e0b" : "#10b981" }} />
                </div>
              </div>
            )}
            <button onClick={() => setShowAbout(false)}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", boxShadow: "0 6px 16px -4px rgba(99,102,241,0.4)" }}>
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in  { animation: fade-in 0.2s ease-out; }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
      `}</style>
    </div>
  );
}