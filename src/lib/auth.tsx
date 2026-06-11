import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "owner" | "manager" | "worker";

export interface SmartOpsUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  profileImage?: string; // data URL
  createdAt: string;
}

interface StoredAccount extends SmartOpsUser {
  password: string; // demo only — frontend-only build
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
  requestPasswordReset: (email: string) => Promise<string>; // returns token
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (patch: Partial<Pick<SmartOpsUser, "fullName" | "phone" | "profileImage">>) => Promise<void>;
}

const ACCOUNTS_KEY = "smartops.accounts";
const SESSION_KEY = "smartops.session";
const RESET_KEY = "smartops.resetTokens";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readAccounts(): StoredAccount[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeAccounts(list: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}
function publicUser(a: StoredAccount): SmartOpsUser {
  const { password: _pw, ...rest } = a;
  return rest;
}
async function hash(pw: string) {
  // Lightweight obfuscation for demo-only frontend storage.
  const enc = new TextEncoder().encode(pw + "::smartops");
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SmartOpsUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setLoading(false);
  }, []);

  const persistSession = (u: SmartOpsUser | null) => {
    setUser(u);
    if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    else localStorage.removeItem(SESSION_KEY);
  };

  const value: AuthContextValue = {
    user,
    loading,
    async login(email, password) {
      const accounts = readAccounts();
      const acc = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
      if (!acc) throw new Error("No account found for that email.");
      if (acc.password !== (await hash(password))) throw new Error("Incorrect password.");
      persistSession(publicUser(acc));
    },
    async register({ fullName, email, password, phone, role }) {
      const accounts = readAccounts();
      if (accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("An account with that email already exists.");
      }
      const acc: StoredAccount = {
        id: crypto.randomUUID(),
        fullName,
        email,
        phone,
        role,
        password: await hash(password),
        createdAt: new Date().toISOString(),
      };
      accounts.push(acc);
      writeAccounts(accounts);
      persistSession(publicUser(acc));
    },
    logout() {
      persistSession(null);
    },
    async requestPasswordReset(email) {
      const accounts = readAccounts();
      const acc = accounts.find((a) => a.email.toLowerCase() === email.toLowerCase());
      if (!acc) throw new Error("No account found for that email.");
      const token = crypto.randomUUID().slice(0, 8).toUpperCase();
      const tokens = JSON.parse(localStorage.getItem(RESET_KEY) || "{}");
      tokens[token] = { email: acc.email, exp: Date.now() + 1000 * 60 * 30 };
      localStorage.setItem(RESET_KEY, JSON.stringify(tokens));
      return token;
    },
    async resetPassword(token, newPassword) {
      const tokens = JSON.parse(localStorage.getItem(RESET_KEY) || "{}");
      const entry = tokens[token];
      if (!entry || entry.exp < Date.now()) throw new Error("Invalid or expired token.");
      const accounts = readAccounts();
      const idx = accounts.findIndex((a) => a.email.toLowerCase() === entry.email.toLowerCase());
      if (idx === -1) throw new Error("Account not found.");
      accounts[idx].password = await hash(newPassword);
      writeAccounts(accounts);
      delete tokens[token];
      localStorage.setItem(RESET_KEY, JSON.stringify(tokens));
    },
    async changePassword(currentPassword, newPassword) {
      if (!user) throw new Error("Not signed in.");
      const accounts = readAccounts();
      const idx = accounts.findIndex((a) => a.id === user.id);
      if (idx === -1) throw new Error("Account not found.");
      if (accounts[idx].password !== (await hash(currentPassword))) {
        throw new Error("Current password is incorrect.");
      }
      accounts[idx].password = await hash(newPassword);
      writeAccounts(accounts);
    },
    async updateProfile(patch) {
      if (!user) throw new Error("Not signed in.");
      const accounts = readAccounts();
      const idx = accounts.findIndex((a) => a.id === user.id);
      if (idx === -1) throw new Error("Account not found.");
      accounts[idx] = { ...accounts[idx], ...patch };
      writeAccounts(accounts);
      persistSession(publicUser(accounts[idx]));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
