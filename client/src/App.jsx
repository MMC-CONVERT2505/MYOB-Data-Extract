
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage  from "./pages/LoginPage";
import Dashboard  from "./pages/Dashboard";
import AuthError  from "./pages/AuthError";
import History    from "./pages/History";
import Settings   from "./pages/Settings";
import Layout     from "./components/Layout";

function PrivateRoute({ children }) {
  const { authenticated, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg animate-pulse"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 20px -4px rgba(99,102,241,0.4)" }}>
          M
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
  return authenticated ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"           element={<LoginPage />} />
          <Route path="/auth/error" element={<AuthError />} />

          <Route path="/dashboard" element={
            <PrivateRoute>
              <Layout><Dashboard /></Layout>
            </PrivateRoute>
          } />

          <Route path="/history" element={
            <PrivateRoute>
              <Layout><History /></Layout>
            </PrivateRoute>
          } />

          <Route path="/settings" element={
            <PrivateRoute>
              <Layout><Settings /></Layout>
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;