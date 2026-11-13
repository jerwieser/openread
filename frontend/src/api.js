// Thin fetch wrapper around the FastAPI backend. Locally the Vite dev server forwards /api to it; in
// production the build is told the API's own address (VITE_API_URL, e.g.
// https://api.openread.example.com, set by the GitHub workflow).
const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(status, message, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors; // { fieldName: "message" } from 422 responses
  }
}

// Called when a request comes back 401 (the session expired). Set by the store.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(method, path, body, { form = false } = {}) {
  // The login cookie is httpOnly: the browser sends it automatically, JS never sees it. "include":
  // in production the API is on its own subdomain, and the cookie should go there too.
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: body && !form ? { "Content-Type": "application/json" } : undefined,
    body: form ? new URLSearchParams(body) : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !path.startsWith("/auth/")) onUnauthorized();

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (res.ok) return data;

  // FastAPI errors: { detail: "message" } or, for validation, { detail: [{ loc, msg }] }
  const detail = data?.detail;
  if (Array.isArray(detail)) {
    const fieldErrors = {};
    for (const err of detail) fieldErrors[err.loc.at(-1)] = err.msg;
    throw new ApiError(res.status, "Something in the form isn't right. Check it and try again.", fieldErrors);
  }
  if (res.status === 429) throw new ApiError(429, "Too many tries. Wait a minute and try again.");
  throw new ApiError(res.status, detail ?? "Something went wrong. Try again in a moment.");
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
  // Login uses OAuth2's standard form fields: "username" carries the email.
  login: (email, password) => request("POST", "/auth/login", { username: email, password }, { form: true }),
};
