// ============================================================
//  pages/Auth.jsx — Clean auth with Lucide icons
//  Updated: redirects to OTP page after signup, forgot password link
// ============================================================
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import {
  ShoppingCart,
  Mail,
  Lock,
  User,
  Store,
  FileText,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";

const Auth = ({ mode = "login" }) => {
  const [tab,     setTab]     = useState(mode);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const { login }             = useAuth();
  const navigate              = useNavigate();

  const [form, setForm] = useState({
    name:             "",
    email:            "",
    password:         "",
    confirmPassword:  "",
    role:             "customer",
    storeName:        "",
    storeDescription: "",
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        email:    form.email.trim(),
        password: form.password,
      });

      if (!data.token || !data.user) {
        setError("Invalid response from server. Please try again.");
        return;
      }

      login(data.user, data.token, data.sellerProfile ?? null);
      toast.success(`Welcome back, ${data.user.name}!`);

      if (data.user.role === "admin")  { navigate("/admin",  { replace: true }); return; }
      if (data.user.role === "seller") { navigate("/seller", { replace: true }); return; }
      navigate("/", { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Login failed.";
      setError(msg);

      // If user is unverified, redirect to OTP verification page
      if (err.response?.status === 403 && err.response?.data?.requiresVerification) {
        const email = err.response.data.email || form.email.trim();
        toast.info("Please verify your email first.");
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
        return;
      }

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error("Passwords do not match");
    if (form.role === "seller" && !form.storeName.trim()) return toast.error("Please enter your store name");

    setLoading(true);
    try {
      const payload = {
        name: form.name, email: form.email, password: form.password,
        role: form.role, storeName: form.storeName, storeDescription: form.storeDescription,
      };
      const { data } = await api.post("/auth/signup", payload);
      toast.success(data.message);

      // Redirect to OTP verification page with email
      const email = data.email || form.email.trim();
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card p-8">

          {/* Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-2 text-2xl font-bold text-brand">
              <ShoppingCart className="w-6 h-6" />
              ShopEasy
            </Link>
            <p className="text-gray-500 text-sm mt-2">
              {tab === "login" ? "Sign in to your account" : "Create your account"}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            {["login", "signup"].map((t) => (
              <button key={t} onClick={() => { setTab(t); setError(""); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all
                  ${tab === t ? "bg-white shadow-sm text-brand" : "text-gray-500"}`}>
                {t === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* Login */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" value={form.email} onChange={set("email")}
                    placeholder="you@example.com" className="input-field pl-9" required autoComplete="email" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="password" value={form.password} onChange={set("password")}
                    placeholder="••••••••" className="input-field pl-9" required autoComplete="current-password" />
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? "Signing in..." : "Log in"}
              </button>
            </form>
          )}

          {/* Signup */}
          {tab === "signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={form.name} onChange={set("name")}
                    placeholder="John Doe" className="input-field pl-9" required />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" value={form.email} onChange={set("email")}
                    placeholder="you@example.com" className="input-field pl-9" required />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">I want to join as a...</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "customer", label: "Customer", Icon: ShoppingBag, desc: "Browse & buy products" },
                    { value: "seller",   label: "Seller",   Icon: Store,       desc: "List & sell products" },
                  ].map(({ value, label, Icon, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role: value }))}
                      className={`p-3 rounded-xl border-2 text-left transition-all
                        ${form.role === value
                          ? "border-brand bg-brand-light"
                          : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <Icon className={`w-5 h-5 mb-1.5 ${form.role === value ? "text-brand" : "text-gray-400"}`} />
                      <span className={`font-semibold text-sm block ${form.role === value ? "text-brand" : "text-gray-700"}`}>
                        {label}
                      </span>
                      <span className="text-xs text-gray-400">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seller fields */}
              {form.role === "seller" && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Store Details</p>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">
                      Store Name <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={form.storeName} onChange={set("storeName")}
                        placeholder="e.g. TechZone Electronics" className="input-field pl-9" required />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 block mb-1">Store Description</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <textarea value={form.storeDescription} onChange={set("storeDescription")}
                        placeholder="Tell customers what you sell..." rows={2}
                        className="input-field pl-9 resize-none" />
                    </div>
                  </div>
                  <p className="text-xs text-purple-600 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Your account will be reviewed before you can list products.
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="password" value={form.password} onChange={set("password")}
                    placeholder="Min 6 characters" className="input-field pl-9" required minLength={6} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="password" value={form.confirmPassword} onChange={set("confirmPassword")}
                    placeholder="••••••••" className="input-field pl-9" required />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-400 mt-5">
            By continuing, you agree to our Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
