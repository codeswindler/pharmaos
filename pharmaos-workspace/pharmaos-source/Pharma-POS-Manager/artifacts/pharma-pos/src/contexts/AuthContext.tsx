import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const API_BASE = "/api";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: "super_admin" | "pharmacy_owner" | "manager" | "cashier";
  pharmacyId: number | null;
}

export interface AuthPharmacy {
  id: number;
  name: string;
  planType: string;
  planValue: string;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  pharmacy: AuthPharmacy | null;
  modules: string[];
  token: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, pharmacy: null, modules: [], token: null, loading: true });

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("pharmaos_token"));
    const token = localStorage.getItem("pharmaos_token");
    if (!token) { setState(s => ({ ...s, loading: false })); return; }
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ user, pharmacy, modules }) => setState({ user, pharmacy, modules: modules ?? [], token, loading: false }))
      .catch(() => { localStorage.removeItem("pharmaos_token"); setState({ user: null, pharmacy: null, modules: [], token: null, loading: false }); });
  }, []);

  const login = async (identifier: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || "Login failed");
    }
    const { token, user, pharmacy, modules } = await res.json();
    localStorage.setItem("pharmaos_token", token);
    setState({ user, pharmacy, modules: modules ?? [], token, loading: false });
    return user;
  };

  const logout = () => {
    localStorage.removeItem("pharmaos_token");
    setState({ user: null, pharmacy: null, modules: [], token: null, loading: false });
  };

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
