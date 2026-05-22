


import { useState, useEffect } from "react";
import { settingsAPI } from "../services/api";
import { Settings as SettingsIcon, Save, Check, Palette, Calendar, Database, Sparkles } from "lucide-react";

const OUTPUT_OPTIONS = [
  { value: "raw",  label: "MYOB Raw",            desc: "Original MYOB format",          color: "#6366f1" },
  { value: "qbo",  label: "QuickBooks Online",   desc: "QBO import format",             color: "#2ca01c" },
  { value: "xero", label: "Xero",                desc: "Xero import format",            color: "#13b5ea" },
];

const DATE_RANGE_OPTIONS = [
  { value: "last30",      label: "Last 30 days" },
  { value: "last60",      label: "Last 60 days" },
  { value: "last90",      label: "Last 90 days" },
  { value: "last6months", label: "Last 6 months" },
  { value: "lastYear",    label: "Last year" },
  { value: "custom",      label: "Custom" },
];

const DATA_TYPE_OPTIONS = [
  { value: "invoices",        label: "Invoices",         color: "#6366f1" },
  { value: "bills",           label: "Bills",            color: "#f59e0b" },
  { value: "creditNotes",     label: "Credit Notes",     color: "#10b981" },
  { value: "vendorCredits",   label: "Vendor Credits",   color: "#3b82f6" },
  { value: "invoicePayments", label: "Invoice Payments", color: "#8b5cf6" },
  { value: "billPayments",    label: "Bill Payments",    color: "#ec4899" },
  { value: "banking",         label: "Banking",          color: "#14b8a6" },
  { value: "generalJournal",  label: "Journal",          color: "#f97316" },
];

export default function Settings() {
  const [settings, setSettings] = useState({ defaultOutputFormat: "raw", defaultDateRange: "last30", defaultDataType: "invoices" });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await settingsAPI.get();
      setSettings(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsAPI.save(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const Section = ({ icon: Icon, title, desc, color, children }) => (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + "15" }}>
          <Icon size={16} style={{ color }} />
        </div>
        <div>
          <h2 className="font-bold text-slate-800 text-sm">{title}</h2>
          <p className="text-xs text-slate-400">{desc}</p>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-indigo-100 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50" style={{ fontFamily: "'DM Sans', 'Outfit', sans-serif" }}>

      {/* Top Bar */}
      <div className="bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 12px -2px rgba(16,185,129,0.4)" }}>
            <SettingsIcon size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800">Settings</h1>
            <p className="text-xs text-slate-400">Customize your preferences</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5"
          style={{
            background: saved
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            boxShadow: saved
              ? "0 6px 16px -4px rgba(16,185,129,0.4)"
              : "0 6px 16px -4px rgba(99,102,241,0.4)",
          }}>
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <Check size={15} />
          ) : (
            <Save size={15} />
          )}
          {saved ? "Saved!" : saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="p-8 max-w-3xl mx-auto flex flex-col gap-5">

        {/* Output Format */}
        <div className={`transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <Section icon={Palette} title="Default Output Format" desc="Format used when extracting data" color="#6366f1">
            <div className="grid grid-cols-3 gap-3">
              {OUTPUT_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => setSettings(s => ({ ...s, defaultOutputFormat: opt.value }))}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 text-center"
                  style={settings.defaultOutputFormat === opt.value ? {
                    borderColor: opt.color,
                    background:  opt.color + "10",
                    transform:   "translateY(-2px)",
                    boxShadow:   `0 4px 14px -4px ${opt.color}44`,
                  } : {
                    borderColor: "#f1f5f9",
                    background:  "white",
                  }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: opt.color + "20" }}>
                    <Sparkles size={14} style={{ color: opt.color }} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">{opt.label}</p>
                  <p className="text-xs text-slate-400">{opt.desc}</p>
                  {settings.defaultOutputFormat === opt.value && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: opt.color }}>
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Default Date Range */}
        <div className={`transition-all duration-500 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <Section icon={Calendar} title="Default Date Range" desc="Pre-selected date range when opening dashboard" color="#f59e0b">
            <div className="grid grid-cols-3 gap-2">
              {DATE_RANGE_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => setSettings(s => ({ ...s, defaultDateRange: opt.value }))}
                  className="px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200"
                  style={settings.defaultDateRange === opt.value ? {
                    background:  "linear-gradient(135deg, #f59e0b15, #f97316) ",
                    borderColor: "#f59e0b",
                    color:       "#d97706",
                    boxShadow:   "0 2px 10px -2px #f59e0b44",
                  } : {
                    background:  "white",
                    borderColor: "#e2e8f0",
                    color:       "#64748b",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Default Data Type */}
        <div className={`transition-all duration-500 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <Section icon={Database} title="Default Data Type" desc="Pre-selected data type when opening dashboard" color="#10b981">
            <div className="flex flex-wrap gap-2">
              {DATA_TYPE_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => setSettings(s => ({ ...s, defaultDataType: opt.value }))}
                  className="px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200"
                  style={settings.defaultDataType === opt.value ? {
                    background:  opt.color,
                    borderColor: "transparent",
                    color:       "white",
                    boxShadow:   `0 4px 14px -4px ${opt.color}88`,
                    transform:   "translateY(-1px)",
                  } : {
                    background:  "white",
                    borderColor: "#e2e8f0",
                    color:       "#64748b",
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Save reminder */}
        {!saved && (
          <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-500 delay-300 ${mounted ? "opacity-100" : "opacity-0"}`}
            style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
            <Sparkles size={14} className="text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Changes are not saved automatically — click <strong>Save Settings</strong> to apply.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}