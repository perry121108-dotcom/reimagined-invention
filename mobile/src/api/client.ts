import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT_MS } from './config';

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

// Callback registered by App.tsx to navigate to login when auth is fully lost
let onAuthExpired: (() => void) | null = null;
export function setAuthExpiredHandler(fn: () => void) { onAuthExpired = fn; }

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await AsyncStorage.getItem('access_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (res.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) return request<T>(path, opts);
      // Both tokens gone — kick user back to login
      onAuthExpired?.();
      throw new Error('登入已過期，請重新登入');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error ?? (err as any).message ?? `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshToken(): Promise<boolean> {
  const refresh = await AsyncStorage.getItem('refresh_token');
  if (!refresh) {
    await clearTokens();
    return false;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });

    if (!res.ok) {
      await clearTokens();
      return false;
    }

    const data = await res.json();
    await AsyncStorage.setItem('access_token', data.access_token);
    return true;
  } catch {
    return false;
  }
}

async function clearTokens() {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body, auth }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
