
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ArrowRight, ShieldCheck, AlertTriangle, X, Zap, BarChart3, FileText } from "lucide-react";

const features = [
  { icon: Zap,       label: "Invoices & Sales",     color: "#6366f1" },
  { icon: BarChart3, label: "Bills & Payments",      color: "#f59e0b" },
  { icon: FileText,  label: "Banking & Quotes",     color: "#10b981" },
  { icon: ShieldCheck,label: "Reference Date",    color: "#3b82f6" },
];

const ERROR_MESSAGES = {
  invalid_scope:   "API scope invalid — backend mein MYOB_API_KEY_TYPE=old set karo",
  invalid_request: "Redirect URI mismatch — MYOB portal mein URI check karo",
  access_denied:   "Access deny kiya gaya",
  invalid_client:  "Client ID ya Secret galat hai",
};

const Particle = ({ style }) => (
  <div className="absolute rounded-full opacity-60 animate-float" style={style} />
);

export default function LoginPage() {
  const { authenticated, loading, login } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!loading && authenticated) navigate("/dashboard");
  }, [authenticated, loading, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("auth_error");
    if (err) { setAuthError(err); window.history.replaceState({}, "", "/"); }
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200 animate-pulse">M</div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex overflow-hidden" style={{ fontFamily: "'DM Sans', 'Outfit', sans-serif" }}>

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden px-16 py-12"
        style={{
          background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        }}>

        {/* Animated mesh background */}
        <div className="absolute inset-0 overflow-hidden">
          {[
            { width: 320, height: 320, background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)", top: "-10%", left: "-5%", animationDuration: "8s" },
            { width: 260, height: 260, background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)", top: "60%", left: "60%", animationDuration: "10s" },
            { width: 200, height: 200, background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)", top: "30%", left: "40%", animationDuration: "7s" },
          ].map((p, i) => (
            <Particle key={i} style={p} />
          ))}

          {/* Dot grid */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }} />
        </div>

        {/* Logo top */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
            <span className="text-white font-black text-lg">M</span>
          </div>
          <span className="text-white/80 font-semibold text-sm tracking-wide">MYOB Data Extraction Tool</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-400/30 bg-indigo-400/10 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-indigo-200 font-medium">Live Extraction</span>
          </div>

          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Extract MYOB<br />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              data instantly
            </span>
          </h2>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm mb-10">
            Connect your MYOB Business account and export invoices, bills, and payments to QBO or Xero format in seconds.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, color }) => (
              <div key={label}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: color + "22" }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <span className="text-white/70 text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs">
            Trusted for MYOB → QBO migration workflows
          </p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-indigo-200">M</div>
            <span className="font-bold text-slate-800">MYOB Data Tool</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">
              Welcome User
            </h1>
            <p className="text-slate-400 text-sm">
              Connect your MYOB account to continue.
            </p>
          </div>

          {/* Error */}
          {authError && (
            <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle size={14} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-0.5">Auth Failed</p>
                    <p className="text-xs text-red-400">{ERROR_MESSAGES[authError] || authError}</p>
                  </div>
                </div>
                <button onClick={() => setAuthError(null)} className="text-red-300 hover:text-red-500 transition-colors mt-1">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Connect button */}
          <button
            onClick={login}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="w-full relative overflow-hidden flex items-center justify-between px-6 py-4 rounded-2xl text-white font-semibold text-sm transition-all duration-300 group mb-4"
            style={{
              background: hovered
                ? "linear-gradient(135deg, #4338ca 0%, #6366f1 100%)"
                : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: hovered
                ? "0 20px 40px -10px rgba(99,102,241,0.5)"
                : "0 10px 30px -8px rgba(99,102,241,0.35)",
              transform: hovered ? "translateY(-2px)" : "translateY(0)",
            }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
                transform: "skewX(-20deg)",
              }} />
            <span className="relative z-10">Connect with MYOB</span>
            <div className="relative z-10 w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center transition-transform duration-300"
              style={{ transform: hovered ? "translateX(4px)" : "translateX(0)" }}>
              <ArrowRight size={15} />
            </div>
          </button>

          {/* Security note */}
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-5 h-5 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={11} className="text-emerald-600" />
            </div>
            <p className="text-xs text-slate-400">
              Secured via OAuth 2.0 — credentials never stored
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-300 font-medium">What you can do</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Feature list */}
          <div className="flex flex-col gap-2">
            {[
              { label: "Extract invoices, bills & payments", color: "#6366f1" },
              { label: "Convert to QBO or Xero format",      color: "#f59e0b" },
              { label: "Download as CSV, Excel or JSON",     color: "#10b981" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        .animate-float { animation: float var(--duration, 8s) ease-in-out infinite; }
      `}</style>
    </div>
  );
}