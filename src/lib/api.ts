// Thin fetch wrapper around the MERN backend in /server.
// Set VITE_API_URL to your deployed API base, e.g. https://smartops-api.onrender.com/api
const API_BASE = "https://smartopsowner-dashboard.onrender.com/api";

const TOKEN_KEY = "smartops.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${API_BASE}. Deploy the /server backend and set VITE_API_URL.`,
    );
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const fromBody =
      data && typeof data === "object" && "message" in data
        ? (data as { message?: string }).message
        : undefined;
    const msg = fromBody || res.statusText || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const API_URL = API_BASE;
