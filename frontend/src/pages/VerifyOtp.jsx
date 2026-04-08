// ============================================================
//  pages/VerifyOtp.jsx — OTP verification with 6 input boxes
//  Premium UI with auto-focus, countdown timer, resend button
// ============================================================
import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { toast } from "react-toastify";
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

const VerifyOtp = () => {
  const [searchParams]    = useSearchParams();
  const emailFromUrl      = searchParams.get("email") || "";
  const navigate          = useNavigate();
  const { login }         = useAuth();

  const [otp, setOtp]             = useState(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState("");
  const [cooldown, setCooldown]   = useState(0);
  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-redirect after success
  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => navigate("/", { replace: true }), 3000);
    return () => clearTimeout(timeout);
  }, [success, navigate]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-focus next box
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
    pastedData.split("").forEach((char, i) => {
      newOtp[i] = char;
    });
    setOtp(newOtp);

    // Focus the input after the last pasted character
    const focusIndex = Math.min(pastedData.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length !== OTP_LENGTH) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/verify-otp", {
        email: emailFromUrl,
        otp: otpString,
      });
      toast.success(data.message);
      if (data.token && data.user) {
        login(data.user, data.token); // update the auth context to isEmailVerified: true
      }
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || "Verification failed.";
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
      const { data } = await api.post("/auth/resend-otp", { email: emailFromUrl });
      toast.success(data.message);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resend OTP.");
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Your account has been verified successfully. Redirecting...
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
          <Link to="/" className="inline-block mt-6 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            Continue →
          </Link>
        </div>
      </div>
    );
  }

  // ── Main OTP Form ──────────────────────────────────────────
  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="card p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 mx-auto mb-4 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Verify Your Email</h1>
            <p className="text-gray-500 text-sm">
              We've sent a 6-digit code to
            </p>
            <p className="text-indigo-600 font-semibold text-sm mt-1">
              {emailFromUrl || "your email"}
            </p>
          </div>

          {/* OTP Input Boxes */}
          <form onSubmit={handleVerify}>
            <div className="flex justify-center gap-2.5 mb-6" onPaste={handlePaste}>
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
                    ${digit ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-gray-50 text-gray-800"}
                    focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:bg-white`}
                  style={{ caretColor: "#4F46E5" }}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-4">
                {error}
              </div>
            )}

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || otp.join("").length !== OTP_LENGTH}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Verify Email
                </>
              )}
            </button>
          </form>

          {/* Resend Section */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm mb-2">Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={cooldown > 0}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors
                ${cooldown > 0
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-indigo-600 hover:text-indigo-700 cursor-pointer"
                }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cooldown > 0 ? "" : "hover:rotate-180 transition-transform duration-500"}`} />
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
            </button>
          </div>

          {/* Back Link */}
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <Link to="/signup" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
