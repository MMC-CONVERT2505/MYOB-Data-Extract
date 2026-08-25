import { useState, useRef, useEffect } from "react";
import { summaryAPI } from "../services/api";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  PieChart, Calendar, Loader2, AlertCircle, Printer, Download,
  Building2, Landmark, CreditCard, Users, Package, Infinity as InfinityIcon,
} from "lucide-react";

const today = () => new Date().toISOString().split("T")[0];
const yearsAgo = (n) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().split("T")[0];
};
const fmtDMY = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

// Human-readable label for each async job phase — shown instead of a
// blind spinner so the person can see it's actually making progress,
// especially during "attachments" which is the slow one.
const PHASE_LABELS = {
  queued: "Queued…",
  profile: "Reading file profile…",
  transactions: "Counting accounts and transactions across all modules…",
  attachments: "Counting bill attachments…",
  done: "Finishing up…",
};

/**
 * Migration Summary page — ported from the MYOB Desktop Pro tool's
 * "Get Summary" module. Fetches the file profile + the transaction
 * counts for a conversion date range from /api/summary.
 *
 * Runs as an async job (POST /api/summary/async → poll
 * /api/summary/status/:jobId) instead of one blocking request, so large
 * files (thousands of bills → the attachment-count phase alone can take
 * minutes) never hit a 502/504 from the reverse proxy — the initial
 * request returns a jobId in milliseconds and the actual work continues
 * server-side while the frontend polls for progress.
 */
export default function Summary() {
  const [startDate, setStartDate] = useState(yearsAgo(2));
  const [endDate, setEndDate] = useState(today());
  const [accountingBasis, setAccountingBasis] = useState("Accrual");
  // Inception feature (Summary page only): when ON, fetch ALL data from the
  // company file's real first-ever transaction date till today, instead of
  // a manual date range. The real earliest date is computed server-side
  // (see summaryService.js findEarliestDate()) from the actual fetched data
  // — nothing is guessed on the frontend.
  const [inceptionMode, setInceptionMode] = useState(false);
  const [preInceptionRange, setPreInceptionRange] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const summaryRef = useRef(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // ── Async job state — mirrors Dashboard.jsx's extraction polling ──
  const [asyncJob, setAsyncJob] = useState(null);
  // shape: { jobId, status, progress: { phase, billsProcessed, billsTotal } }
  const pollRef = useRef(null);

  const clearPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // Poll every 5s — summary jobs are much shorter-lived than bulk
  // extractions, so a tighter interval keeps the UI feeling responsive
  // without hammering the server.
  const startPolling = (jobId) => {
    clearPoll();
    pollRef.current = setInterval(async () => {
      try {
        const res = await summaryAPI.getJobStatus(jobId);
        const job = res.data;
        setAsyncJob(job);

        if (job.status === "successful") {
          clearPoll();
          setLoading(false);
          setSummary(job.result);
          setAsyncJob(null);
          // Inception mode: reflect the REAL earliest date the backend found
          // (job.result.transactions.dateRange.startDate) back into the date
          // field, so the UI shows the actual first-ever transaction date
          // instead of our placeholder.
          const realStart = job.result?.transactions?.dateRange?.startDate;
          if (inceptionMode && realStart) {
            setStartDate(realStart);
          }
        }

        if (job.status === "failed") {
          clearPoll();
          setLoading(false);
          setError(job.errorMessage || "Summary generation failed.");
          setAsyncJob(null);
        }
      } catch (pollErr) {
        console.warn("Summary job status poll error:", pollErr.message);
      }
    }, 5000);
  };

  // Clean up poll on unmount.
  useEffect(() => { return () => clearPoll(); }, []);

  // Manual (operator-entered) fields — mirror of the desktop tool.
 const [manual, setManual] = useState({
    otherComplication: "No",
    repetition: "No",
    fixedAssets: "No",
    notes: "",
  });

  async function handleDownloadPdf() {
    if (!summaryRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(summaryRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = (p?.companyName || "Migration_Summary")
        .replace(/[\\/*?:"<>|]/g, "")
        .replace(/\s+/g, "_");

      pdf.save(`${safeName}_Summary.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloadingPdf(false);
    }
  }

  // Toggle "Inception" — remembers the manual range so switching back OFF
  // restores exactly what the user had picked before. The startDate we set
  // here is just a harmless placeholder (backend ignores it and computes
  // the file's REAL earliest transaction date once the job runs — see
  // startPolling above, which overwrites startDate with that real value).
  function toggleInception() {
    if (!inceptionMode) {
      setPreInceptionRange({ startDate, endDate });
      setStartDate(endDate);
      setEndDate(today());
      setInceptionMode(true);
    } else {
      if (preInceptionRange) {
        setStartDate(preInceptionRange.startDate);
        setEndDate(preInceptionRange.endDate);
      }
      setInceptionMode(false);
    }
  }

  async function handleFetch() {
    clearPoll();
    setLoading(true);
    setError(null);
    setSummary(null);
    setAsyncJob(null);
    try {
      const res = await summaryAPI.startAsync({ startDate, endDate, accountingBasis, inception: inceptionMode });
      const { jobId } = res.data;
      setAsyncJob({ jobId, status: "queued", progress: { phase: "queued", billsProcessed: 0, billsTotal: 0 } });
      startPolling(jobId);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error?.message || err.response?.data?.error || err.message || "Failed to start summary.");
    }
  }

  const p = summary?.profile;
  const t = summary?.transactions;

  return (
    <div className="min-h-screen bg-slate-50/50" style={{ fontFamily: "'DM Sans', 'Outfit', sans-serif" }}>
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)" }}>
            <PieChart size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800">Migration Summary</h1>
            <p className="text-xs text-slate-400">
              {p?.companyName || "Company file"} · conversion-period analysis
            </p>
          </div>
        </div>
       {summary && (
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)" }}
            >
              <Download size={14} /> {downloadingPdf ? "Generating…" : "Download PDF"}
            </button>
          </div>
        )}
      </div>

      <div className="p-8 max-w-4xl mx-auto space-y-5">
        {/* Controls */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 print:hidden">
          <div className="grid gap-4 sm:grid-cols-5 items-end">
            <div>
              <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                Conversion start date
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-teal-300 focus-within:bg-white transition-all">
                <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={inceptionMode}
                  className="w-full bg-transparent text-sm font-semibold outline-none text-slate-700 disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                Conversion end date
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-teal-300 focus-within:bg-white transition-all">
                <Calendar size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={inceptionMode}
                  className="w-full bg-transparent text-sm font-semibold outline-none text-slate-700 disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">
                Accounting basis
              </label>
              <select
                value={accountingBasis}
                onChange={(e) => setAccountingBasis(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 bg-slate-50 focus:outline-none focus:border-teal-300"
              >
                <option>Accrual</option>
                <option>Cash</option>
              </select>
            </div>
            <button
              type="button"
              onClick={toggleInception}
              disabled={loading}
              title="Fetch the company file's entire data, from inception to today"
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 active:scale-95 disabled:opacity-60 border ${
                inceptionMode
                  ? "text-white border-transparent"
                  : "text-slate-600 border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
              style={inceptionMode ? { background: "linear-gradient(135deg,#0d9488,#14b8a6)", boxShadow: "0 8px 20px -6px rgba(13,148,136,0.4)" } : undefined}
            >
              <InfinityIcon size={16} />
              {inceptionMode ? "Inception: ON" : "Inception"}
            </button>
            <button
              onClick={handleFetch}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-all duration-200 active:scale-95 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)", boxShadow: "0 8px 20px -6px rgba(13,148,136,0.4)" }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <PieChart size={16} />}
              {loading ? "Analysing…" : "Get Summary"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-3 text-slate-500">
            <Loader2 size={28} className="animate-spin text-teal-500" />
            <p className="text-sm">
              {PHASE_LABELS[asyncJob?.progress?.phase] || "Starting…"}
            </p>
            {asyncJob?.progress?.phase === "attachments" && asyncJob.progress.billsTotal > 0 && (
              <p className="text-xs text-slate-400">
                {asyncJob.progress.billsProcessed.toLocaleString()} / {asyncJob.progress.billsTotal.toLocaleString()} bills checked
              </p>
            )}
            <p className="text-[11px] text-slate-300">Polling every 5s — safe to leave this tab open</p>
          </div>
        )}

        {/* Summary */}
        {!loading && summary && (
          <div ref={summaryRef} className="space-y-5">
            {/* A. File profile */}
            <Card title="File profile" icon={Building2}>
              <Row label="Company name" value={p.companyName || "—"} />
              <Row label="Financial year end" value={p.financialYear?.endMonth || "—"} />
              <Row label="Accounting basis" value={p.accountingBasis || "Accrual"} />
              <Row label="Number of Chart of Accounts" value={p.chartOfAccounts.total} strong />
              <Row label="Number of Banks" value={p.chartOfAccounts.banks} strong />
              <Row label="Number of Credit Cards" value={p.chartOfAccounts.creditCards} strong />
              <Row label="Number of Active Employees" value={p.activeEmployees} />
              <Row label="Multi-Currency" value={p.flags.multiCurrency ? "Yes" : "No"} pill={p.flags.multiCurrency ? "warn" : "ok"} />
              <Row label="Class / Job / Location" value={p.flags.jobs ? `Yes (${p.flags.jobCount})` : "No"} pill={p.flags.jobs ? "warn" : "ok"} />
              <Row label="Tracked Inventory" value={p.flags.trackedInventory ? "Yes" : "No"} pill={p.flags.trackedInventory ? "warn" : "ok"} />
            </Card>

            {/* Bank / CC account lists */}
            {(p.chartOfAccounts.bankAccounts.length > 0 || p.chartOfAccounts.creditCardAccounts.length > 0) && (
              <Card title="Bank & credit card accounts" icon={Landmark}>
                {p.chartOfAccounts.bankAccounts.map((a) => (
                  <Row key={a.displayId} label={`${a.displayId} · ${a.name}`} value="Bank" />
                ))}
                {p.chartOfAccounts.creditCardAccounts.map((a) => (
                  <Row key={a.displayId} label={`${a.displayId} · ${a.name}`} value="Credit Card" />
                ))}
              </Card>
            )}

            {/* Manual fields */}
            <Card title="Manual fields — click to edit" icon={Users}>
              <div className="grid gap-3 sm:grid-cols-3">
                <ManualSelect label="Other Complication" value={manual.otherComplication} onChange={(v) => setManual({ ...manual, otherComplication: v })} />
                <ManualSelect label="Repetition" value={manual.repetition} onChange={(v) => setManual({ ...manual, repetition: v })} />
                <ManualSelect label="Fixed Assets" value={manual.fixedAssets} onChange={(v) => setManual({ ...manual, fixedAssets: v })} />
              </div>
              <textarea
                placeholder="Notes (optional)…"
                value={manual.notes}
                onChange={(e) => setManual({ ...manual, notes: e.target.value })}
                rows={2}
                className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:outline-none focus:border-teal-300"
              />
            </Card>

            {/* B. Transactions */}
            {t && (
              <Card title="No. of transactions in conversion period" icon={CreditCard}>
                <Row label="Date range" value={`${fmtDMY(t.dateRange.startDate)} → ${fmtDMY(t.dateRange.endDate)}`} />
                <Row label="Timeline (months)" value={t.timelineMonths} />
                <Row label="Total Transactions" value={t.totalTransactions} strong />
                <Row label="Total Lines" value={t.totalGLLines ?? t.totalLines} strong />
                <Row label="Bank / Credit Card" value={`${t.counts.bank.lines ?? t.counts.bank.transactions} / ${t.counts.creditCard.lines ?? t.counts.creditCard.transactions}`} />
                <Row label="Invoice / Credit Memo" value={`${t.counts.invoice.lines ?? t.counts.invoice.transactions} / ${t.counts.creditMemo.lines ?? t.counts.creditMemo.transactions}`} />
                <Row label="Bill / Bill Credit" value={`${t.counts.bill.lines ?? t.counts.bill.transactions} / ${t.counts.billCredit.lines ?? t.counts.billCredit.transactions}`} />
                <Row label="Manual Journal" value={t.counts.manualJournal.transactions} />
                <Row label="Sale Receipt" value={t.counts.salesReceipt.transactions} />
              </Card>
            )}

            {/* Add-ons */}
            {t && (
              <Card title="Add-ons" icon={Package}>
                <Row label="Attachments" value={t.addOns.attachments ?? 0} />
                <Row label="Sales Quotes" value={t.addOns.salesQuotes} />
                <Row label="Purchase Orders" value={t.addOns.purchaseOrders} />
              </Card>
            )}
          </div>
        )}

        {!loading && !summary && !error && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 flex flex-col items-center gap-2 text-slate-400">
            <PieChart size={34} />
            <p className="text-sm font-semibold text-slate-500">No summary yet</p>
            <p className="text-xs">Pick a conversion date range and click Get Summary.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl bg-white overflow-hidden border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
        <Icon size={15} className="text-teal-600" />
        <p className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">{title}</p>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

function Row({ label, value, strong, pill }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      {pill ? (
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={pill === "ok" ? { background: "#e8f8f0", color: "#16a34a" } : { background: "#fdf3e6", color: "#b45309" }}
        >
          {value}
        </span>
      ) : (
        <span className={`text-sm ${strong ? "font-bold" : "font-semibold"} text-slate-800`}>{value}</span>
      )}
    </div>
  );
}

function ManualSelect({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:outline-none focus:border-teal-300"
      >
        <option>No</option>
        <option>Yes</option>
      </select>
    </div>
  );
}