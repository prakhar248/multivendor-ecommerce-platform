// ============================================================
//  pages/ForgotPassword.jsx — Request password reset OTP
//  Clean, minimal UI matching the auth page design system
// ============================================================
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { toast } from "react-toastify";
import {
  ShoppingCart,
  Mail,
  ArrowLeft,
  KeyRound,
  Loader2,
} from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const navigate              = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email: email.trim() });
      toast.success(data.message);
      setSent(true);

      // Navigate to reset password page after short delay
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
      }, 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send reset code.");
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
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 mx-auto mb-4 flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Forgot Password?</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              No worries! Enter your email and we'll send you a reset code.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field pl-9"
                  required
                  autoComplete="email"
                  autoFocus
                  disabled={sent}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || sent}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Sending Code...
                </>
              ) : sent ? (
                "Code Sent! Redirecting..."
              ) : (
                "Send Reset Code"
              )}
            </button>
          </form>

          {/* Back to login */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
