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
  /** TTL in ms for GET response cache. Default 15s for GET. Set 0 to disable. */
  cacheTtlMs?: number;
  /** Force-bypass cache and in-flight dedup. */
  noCache?: boolean;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

type CacheEntry = { value: unknown; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Invalidate cached GET responses. Pass a path prefix or omit to clear all. */
export function invalidateCache(pathPrefix?: string) {
  if (!pathPrefix) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (key.includes(pathPrefix)) responseCache.delete(key);
  }
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, cacheTtlMs, noCache, signal } = opts;
  const isGet = method === "GET";
  const ttl = cacheTtlMs ?? (isGet ? 15_000 : 0);
  const cacheKey = isGet ? `${method} ${path}` : "";

  // 1) Cache hit (GET only)
  if (isGet && !noCache && ttl > 0) {
    const hit = responseCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  }

  // 2) In-flight dedup (GET only): coalesce parallel identical requests
  if (isGet && !noCache && inflight.has(cacheKey)) {
    return inflight.get(cacheKey) as Promise<T>;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const exec = (async () => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
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
    if (isGet && ttl > 0) {
      responseCache.set(cacheKey, { value: data, expiresAt: Date.now() + ttl });
    } else if (!isGet) {
      // Mutations invalidate related GET cache (path root, e.g. "/trips/123" -> "/trips")
      const root = "/" + path.split("/").filter(Boolean)[0];
      invalidateCache(root);
    }
    return data as T;
  })();

  if (isGet && !noCache) {
    inflight.set(cacheKey, exec);
    try {
      return (await exec) as T;
    } finally {
      inflight.delete(cacheKey);
    }
  }
  return exec;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const API_URL = API_BASE;
