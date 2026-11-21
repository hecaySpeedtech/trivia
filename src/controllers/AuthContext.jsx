import { createContext, useContext, useState, useEffect } from "react";
import { getSession, getProfile, login as doLoginAuth, logout as doLogout } from "../models/authService.js";
import { logger } from "../models/loggerService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
        const r = await getProfile(session.user.id);
        if (r.ok) setProfile(r.data);
      }
      setLoading(false);
    })();
  }, []);

  const login = async (u, p) => {
    const r = await doLoginAuth(u, p);
    if (r.ok) {
      setUser(r.data);
      const pr = await getProfile(r.data.id);
      if (pr.ok) setProfile(pr.data);
    }
    return r;
  };

  const logout = async () => {
    await doLogout();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) { const r = await getProfile(user.id); if (r.ok) setProfile(r.data); }
  };

  const isSuperAdmin = profile?.rol === "super_admin";

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, refreshProfile, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }