import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    loading: true,
    authenticated: false,
    businessName: null,
    businessId: null,
    user: null,
  });

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await axios.get("/auth/status", { withCredentials: true });
      setAuth({ loading: false, ...res.data });
    } catch {
      setAuth({ loading: false, authenticated: false });
    }
  };

  const login = () => {
   window.location.href = "/myob-api/auth/login";
  };

  const logout = async () => {
    await axios.get("/auth/logout", { withCredentials: true });
    setAuth({ loading: false, authenticated: false, businessName: null });
    window.location.href = "/myob-app/";
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, refetch: checkAuthStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
