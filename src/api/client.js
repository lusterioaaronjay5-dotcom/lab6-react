import axios from 'axios';

// Empty VITE_API_URL means "same origin" (useful with a Vercel rewrite/proxy).
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const STORAGE_KEY = 'product_app_session';

export const authStorage = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  },
  set(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

let onAuthFailure = null;
export function setAuthFailureHandler(handler) {
  onAuthFailure = handler;
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const session = authStorage.get();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// The API rotates refresh tokens (each one works once), so only one refresh
// may run at a time. Parallel 401s share the same promise.
let refreshPromise = null;

function refreshTokens() {
  if (!refreshPromise) {
    const session = authStorage.get();
    refreshPromise = axios
      .post(
        `${API_URL}/api/refresh`,
        { refresh_token: session?.refresh_token },
        { headers: { 'Content-Type': 'application/json' } }
      )
      .then(({ data }) => {
        const next = {
          ...authStorage.get(),
          access_token: data.tokens.access_token,
          refresh_token: data.tokens.refresh_token,
        };
        authStorage.set(next);
        return next.access_token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const NO_REFRESH_URLS = ['/login', '/register', '/refresh'];

// On 401: refresh once, then retry the original request.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    const canRefresh =
      status === 401 &&
      original &&
      !original._retried &&
      !original.skipAuthRefresh &&
      !NO_REFRESH_URLS.includes(original.url) &&
      authStorage.get()?.refresh_token;

    if (!canRefresh) return Promise.reject(error);

    original._retried = true;
    try {
      const token = await refreshTokens();
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      authStorage.clear();
      if (onAuthFailure) onAuthFailure();
      return Promise.reject(error);
    }
  }
);

export function getErrorMessage(error) {
  if (error.response) {
    const body = error.response.data;
    if (body && typeof body.error === 'string') return body.error;
    return `The server returned an error (${error.response.status}).`;
  }
  if (error.request) {
    return 'Cannot reach the server. Check your connection and make sure the API is running.';
  }
  return error.message || 'Something went wrong.';
}

export default api;