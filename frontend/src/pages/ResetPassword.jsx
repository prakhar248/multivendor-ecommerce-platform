// ============================================================
//  pages/ResetPassword.jsx — Enter OTP + new password
//  Features: 6-box OTP input, password fields, resend with timer
// ============================================================
import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../api/axios";
import { toast } from "react-toastify";
import {
  ShoppingCart,
  Lock,
  ArrowLeft,
  KeyRound,
  CheckCircle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const emailFromUrl   = searchParams.get("email") || "";
  const navigate       = useNavigate();

  const [otp, setOtp]               = useState(Array(OTP_LENGTH).fill(""));
  const [newPassword, setNewPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState("");
  const [cooldown, setCooldown]     = useState(0);
  const inputRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Redirect after success
  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => navigate("/login", { replace: true }), 3000);
    return () => clearTimeout(timeout);
  }, [success, navigate]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pastedData) return;
    const newOtp = Array(OTP_LENGTH).fill("");
    pastedData.split("").forEach((char, i) => { newOtp[i] = char; });
    setOtp(newOtp);
    const focusIndex = Math.min(pastedData.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleReset = async (e) => {
    e.preventDefault();
    const otpString = otp.join("");

    if (otpString.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit code.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/reset-password", {
        email: emailFromUrl,
        otp: otpString,
        newPassword,
      });
      toast.success(data.message);
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || "Password reset failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN);

    try {
      const { data } = await api.post("/auth/forgot-password", { email: emailFromUrl });
      toast.success("New reset code sent!");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resend code.");
    }
  };

  // ── Success State ──────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-sm w-full text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center bg-green-50">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h1>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Your password has been updated successfully. Redirecting to login...
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ animation: "shrink 3s linear forwards" }}
            />
          </div>
          <style>{`
            @keyframes shrink {
              from { width: 100%; }
              to { width: 0%; }
            }
          `}</style>
          <Link to="/login" className="inline-block mt-6 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Go to Login Now →
          </Link>
        </div>
      </div>
    );
  }

  // ── Main Reset Form ────────────────────────────────────────
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

          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 mx-auto mb-4 flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-violet-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset Password</h1>
            <p className="text-gray-500 text-sm">
              Enter the code sent to{" "}
              <span className="text-indigo-600 font-semibold">{emailFromUrl || "your email"}</span>
            </p>
          </div>

          <form onSubmit={handleReset}>
            {/* OTP Input */}
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-700 block mb-2">Verification Code</label>
              <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all duration-200
                      ${digit ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 bg-gray-50 text-gray-800"}
                      focus:border-violet-500 focus:ring-2 focus:ring-violet-100 focus:bg-white`}
                    style={{ caretColor: "#7C3AED" }}
                  />
                ))}
              </div>

              {/* Resend */}
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors
                    ${cooldown > 0
                      ? "text-gray-300 cursor-not-allowed"
                      : "text-violet-600 hover:text-violet-700 cursor-pointer"
                    }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                    placeholder="Min 6 characters"
                    className="input-field pl-9 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    placeholder="••••••••"
                    className="input-field pl-9"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Resetting...
                </>
              ) : (
                "Reset Password"
              )}
            </button>
          </form>

          {/* Back Link */}
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

export default ResetPassword;
