// ============================================================
//  src/api/axios.js  —  Central Axios instance
//  All API calls go through this so we never repeat base URL or headers
// ============================================================

import axios from "axios";

const API = import.meta.env.VITE_API_URL;

if (!API) {
  throw new Error("VITE_API_URL is not defined. Check Vercel environment variables.");
}

// Debug log — verify correct base URL in production
console.log("API BASE URL:", API);

const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/** Public auth endpoints — 401 here means bad credentials, not “session expired” */
function isAuthPublicRoute(config) {
  const url = String(config?.url || "").toLowerCase();
  return (
    url.includes("auth/login") ||
    url.includes("auth/signup") ||
    url.includes("auth/forgot-password") ||
    url.includes("auth/reset-password") ||
    url.includes("auth/verify-otp") ||
    url.includes("auth/resend-otp")
  );
}

// ── Request Interceptor ──────────────────────────────────────
// Automatically attach the JWT token to every outgoing request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ─────────────────────────────────────
// 401 on protected routes → clear session and send to login.
// Do NOT do this for login/signup: wrong password also returns 401 and must show an error in UI.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 && !isAuthPublicRoute(error.config)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("sellerProfile");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
