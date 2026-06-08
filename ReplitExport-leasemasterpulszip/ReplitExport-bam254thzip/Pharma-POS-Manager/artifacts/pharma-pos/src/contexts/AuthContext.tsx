import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const API_BASE = "/api";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "client";
  hospitalId: number | null;
}

export interface AuthHospital {
  id: number;
  name: string;
  planType: string;
  planValue: string;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  hospital: AuthHospital | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, hospital: null, token: null, loading: true });

  useEffect(() => {
    const token = localStorage.getItem("pharmaos_token");
    if (!token) { setState(s => ({ ...s, loading: false })); return; }
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ user, hospital }) => setState({ user, hospital, token, loading: false }))
      .catch(() => { localStorage.removeItem("pharmaos_token"); setState({ user: null, hospital: null, token: null, loading: false }); });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || "Login failed");
    }
    const { token, user, hospital } = await res.json();
    localStorage.setItem("pharmaos_token", token);
    setState({ user, hospital, token, loading: false });
  };

  const logout = () => {
    localStorage.removeItem("pharmaos_token");
    setState({ user: null, hospital: null, token: null, loading: false });
  };

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
