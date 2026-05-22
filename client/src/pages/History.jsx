import { useState, useEffect } from "react";
import { historyAPI } from "../services/api";
import {
  History as HistoryIcon, CheckCircle, AlertCircle, Clock,
  Trash2, RefreshCw, Filter, Database, FileText, Calendar,
} from "lucide-react";

const DATA_TYPE_COLORS = {
  invoices:        "#6366f1",
  bills:           "#f59e0b",
  invoicePayments: "#8b5cf6",
  billPayments:    "#ec4899",
  banking:         "#14b8a6",
  generalJournal:  "#f97316",
  quotes:          "#06b6d4",
};

const fmtDate = (s) => {
  try {
    return new Date(s).toLocaleString("en-AU", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return s; }
};

export default function History() {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter,  setFilter]    = useState("");
  const [page,    setPage]      = useState(1);
  const [totalPages, setTotal]  = useState(1);
  const [deleting, setDeleting] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => { setMounted(true); fetchHistory(); }, []);
  useEffect(() => { fetchHistory(); }, [page, filter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await historyAPI.getAll({ page, limit: 15, dataType: filter || undefined });
      setRecords(res.data.items || []);
      setTotal(res.data.totalPages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const deleteOne = async (id) => {
    setDeleting(id);
    try {
      await historyAPI.deleteOne(id);
      setRecords(prev => prev.filter(r => r._id !== id));
    } catch (err) { console.error(err); }
    finally { setDeleting(null); }
  };

  const clearAll = async () => {
    if (!window.confirm("Do you want to delete all history?")) return;
    setClearing(true);
    try {
      await historyAPI.clearAll();
      setRecords([]);
    } catch (err) { console.error(err); }
    finally { setClearing(false); }
  };

  const dataTypes = Object.keys(DATA_TYPE_COLORS);

  return (
    <div className="min-h-screen bg-slate-50/50" style={{ fontFamily: "'DM Sans', 'Outfit', sans-serif" }}>

      {/* Top Bar */}
      <div className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", boxShadow: "0 4px 12px -2px rgba(245,158,11,0.4)" }}>
            <HistoryIcon size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800">Extraction History</h1>
            <p className="text-xs text-slate-400">All your past extractions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchHistory}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-all">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          {records.length > 0 && (
            <button onClick={clearAll} disabled={clearing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-sm text-red-500 hover:bg-red-50 transition-all">
              <Trash2 size={13} />
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="p-8 max-w-6xl mx-auto">

        {/* Filters */}
        <div className={`mb-5 transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-slate-500 mr-2">
              <Filter size={14} />
              <span className="font-medium">Filter:</span>
            </div>
            <button onClick={() => { setFilter(""); setPage(1); }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
              style={!filter ? { background: "#6366f1", color: "white", borderColor: "transparent" } : { background: "white", color: "#64748b", borderColor: "#e2e8f0" }}>
              All
            </button>
            {dataTypes.map(dt => (
              <button key={dt} onClick={() => { setFilter(dt); setPage(1); }}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border capitalize"
                style={filter === dt ? {
                  background: DATA_TYPE_COLORS[dt],
                  color: "white",
                  borderColor: "transparent",
                } : {
                  background: "white",
                  color: "#64748b",
                  borderColor: "#e2e8f0",
                }}>
                {dt.replace(/([A-Z])/g, " $1").trim()}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className={`bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm transition-all duration-500 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-2 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Loading history...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <Database size={24} className="text-slate-300" />
              </div>
              <p className="text-base font-semibold text-slate-600">No history found</p>
              <p className="text-sm text-slate-400">
                {filter ? `No "${filter}" extractions found` : "Run an extraction to see it here"}
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="grid px-6 py-3 border-b border-slate-100"
                style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto" }}>
                {["Extraction", "Type", "Date Range", "Records", "Status", ""].map(h => (
                  <div key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</div>
                ))}
              </div>

              {/* Rows */}
              {records.map((r, i) => {
                const color = DATA_TYPE_COLORS[r.dataType] || "#6366f1";
                return (
                  <div key={r._id}
                    className="grid px-6 py-4 border-b border-slate-50 hover:bg-slate-50/60 transition-colors items-center group"
                    style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", animationDelay: `${i * 30}ms` }}>

                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + "15" }}>
                        <FileText size={15} style={{ color }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 capitalize">
                          {r.dataType}{r.subType ? ` · ${r.subType}` : ""}
                        </p>
                        <p className="text-xs text-slate-400">{r.businessName || "—"}</p>
                      </div>
                    </div>

                    <div>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase"
                        style={{ background: color + "15", color }}>
                        {r.outputFormat}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar size={11} className="text-slate-300 flex-shrink-0" />
                      <span>{r.startDate} → {r.endDate}</span>
                    </div>

                    <div>
                      <span className="text-sm font-bold text-slate-800">{r.itemCount.toLocaleString()}</span>
                      <span className="text-xs text-slate-400 ml-1">rows</span>
                    </div>

                    <div>
                      <span className="flex items-center gap-1.5 text-xs font-semibold w-fit px-2.5 py-1 rounded-lg"
                        style={r.status === "success"
                          ? { background: "#f0fdf4", color: "#16a34a" }
                          : { background: "#fef2f2", color: "#dc2626" }}>
                        {r.status === "success" ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                        {r.status === "success" ? "Success" : "Failed"}
                      </span>
                      <p className="text-xs text-slate-300 mt-1">{fmtDate(r.createdAt)}</p>
                    </div>

                    <div>
                      <button onClick={() => deleteOne(r._id)} disabled={deleting === r._id}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                        {deleting === r._id
                          ? <div className="w-3.5 h-3.5 border border-red-300 border-t-red-500 rounded-full animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 flex items-center justify-between border-t border-slate-100">
                  <p className="text-xs text-slate-400">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">
                      Previous
                    </button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}