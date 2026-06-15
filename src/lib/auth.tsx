import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "@/lib/api";

export type Role = "owner" | "manager" | "worker";

export interface SmartOpsUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  profileImage?: string;
  createdAt: string;
}

interface ServerUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  avatar?: string;
  company?: string;
  createdAt: string;
}

function toClientUser(u: ServerUser): SmartOpsUser {
  return {
    id: u.id,
    fullName: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    profileImage: u.avatar,
    createdAt: u.createdAt,
  };
}

interface AuthContextValue {
  user: SmartOpsUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    phone?: string;
    role: Role;
  }) => Promise<void>;
  logout: () => void;
  requestPasswordReset: (email: string) => Promise<string>;
  resetPassword: (token: string, newPassword: string, email?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (
    patch: Partial<Pick<SmartOpsUser, "fullName" | "phone" | "profileImage">>,
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SmartOpsUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: if we have a JWT, fetch the profile.
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api<{ user: ServerUser }>("/auth/profile");
        if (!cancelled) setUser(toClientUser(res.user));
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    async login(email, password) {
      const res = await api<{ token: string; user: ServerUser }>("/auth/login", {
        method: "POST",
        auth: false,
        body: { email, password },
      });
      setToken(res.token);
      setUser(toClientUser(res.user));
    },
    async register({ fullName, email, password, phone, role }) {
      const res = await api<{ token: string; user: ServerUser }>("/auth/register", {
        method: "POST",
        auth: false,
        body: { name: fullName, email, password, role, phone },
      });
      setToken(res.token);
      setUser(toClientUser(res.user));
    },
    logout() {
      // Fire and forget; clear locally regardless.
      api("/auth/logout", { method: "POST" }).catch(() => {});
      setToken(null);
      setUser(null);
    },
    async requestPasswordReset(email) {
      const res = await api<{ ok: boolean; devCode?: string }>("/auth/forgot-password", {
        method: "POST",
        auth: false,
        body: { email },
      });
      // Server returns devCode outside production. Return it so the UI can show/use it.
      return res.devCode ?? "";
    },
    async resetPassword(code, newPassword, email) {
      if (!email) throw new Error("Email is required to reset password.");
      await api("/auth/reset-password", {
        method: "POST",
        auth: false,
        body: { email, code, newPassword },
      });
    },
    async changePassword(currentPassword, newPassword) {
      await api("/auth/change-password", {
        method: "PUT",
        body: { currentPassword, newPassword },
      });
    },
    async updateProfile(patch) {
      const res = await api<{ user: ServerUser }>("/auth/profile", {
        method: "PUT",
        body: {
          name: patch.fullName,
          phone: patch.phone,
          avatar: patch.profileImage,
        },
      });
      setUser(toClientUser(res.user));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
