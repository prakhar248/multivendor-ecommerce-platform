// ============================================================
//  services/api.js — Axios instance for product & API calls
//  Base URL + Bearer token from localStorage
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

function isAuthPublicRoute(config) {
  const url = String(config?.url || "").toLowerCase();
  return (
    url.includes("auth/login") ||
    url.includes("auth/signup") ||
    url.includes("auth/forgot-password") ||
    url.includes("auth/reset-password")
  );
}

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
