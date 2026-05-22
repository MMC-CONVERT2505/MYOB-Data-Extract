import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

const ERROR_MESSAGES = {
  invalid_scope: "API scope invalid hai. Backend mein MYOB_API_KEY_TYPE check karo.",
  invalid_request: "Redirect URI mismatch — MYOB portal mein URI verify karo.",
  access_denied: "User ne access deny kar diya.",
  invalid_client: "Client ID ya Secret galat hai.",
};

export default function AuthError() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const rawMessage = params.get("message") || "Unknown error";
  const friendlyMessage = ERROR_MESSAGES[rawMessage] || rawMessage;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="w-full max-w-sm mx-4 bg-bg-2 border border-border rounded-xl p-10 text-center animate-fade-up">
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 bg-red-400/10 rounded-2xl flex items-center justify-center">
            <AlertTriangle size={28} className="text-danger" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-2">Authentication Failed</h1>
        <p className="text-muted text-sm mb-3">There was an issue while connecting with MYOB.</p>

        {/* Error code */}
        <div className="bg-bg-3 border border-border rounded-[6px] px-4 py-2 text-xs text-danger font-mono mb-3">
          {rawMessage}
        </div>

        {/* Friendly explanation */}
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-[6px] px-4 py-3 text-xs text-warning text-left mb-7">
          💡 {friendlyMessage}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-[10px] transition-all duration-200"
          >
            <RefreshCw size={15} /> Try Again
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-transparent border border-border text-muted hover:text-white hover:border-border-light rounded-[10px] transition-all duration-200 text-sm"
          >
            <ArrowLeft size={14} /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
}