// ============================================================
//  src/pages/Profile.jsx — User profile with Lucide icons
// ============================================================
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { User, Mail, Phone, Calendar, Package, ShoppingCart, CheckCircle, AlertCircle, Pencil, Lock } from "lucide-react";

const Profile = () => {
  const { user, login, fetchProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [loading, setLoading] = useState(false);

  // Email verification state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Change password state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordStep, setChangePasswordStep] = useState("send-otp"); // send-otp | verify-otp | set-password
  const [changePasswordOtp, setChangePasswordOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  useEffect(() => {
    // Explicit fetch profile when component mounts, ensuring we have latest DB state
    fetchProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put("/auth/profile", form);
      // fetch fresh profile
      fetchProfile();
      toast.success("Profile updated!");
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    try {
      setVerifyLoading(true);
      const { data } = await api.post("/auth/send-otp", { email: user.email });
      toast.success(data.message || "OTP sent successfully");
      setShowVerifyModal(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) return toast.error("Enter a valid 6-digit OTP");
    try {
      setVerifyLoading(true);
      const { data } = await api.post("/auth/verify-otp", { email: user.email, otp });
      // Update tokens and user state dynamically
      login(data.user, data.token);
      toast.success(data.message || "Email verified successfully");
      setShowVerifyModal(false);
      setOtp("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed");
    } finally {
      setVerifyLoading(false);
    }
  };

  // ── Change Password Handlers ────────────────────────────────────
  const handleInitiatePasswordChange = async () => {
    try {
      setChangePasswordLoading(true);
      const { data } = await api.post("/auth/send-otp", { email: user.email });
      toast.success(data.message || "OTP sent to your email");
      setChangePasswordStep("verify-otp");
      setShowChangePasswordModal(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleVerifyChangePasswordOtp = () => {
    if (!changePasswordOtp || changePasswordOtp.length !== 6) {
      return toast.error("Enter a valid 6-digit OTP");
    }
    setChangePasswordStep("set-password");
  };

  const handleSetNewPassword = async () => {
    if (!newPassword || !confirmPassword) {
      return toast.error("Please fill in both password fields");
    }
    if (newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    try {
      setChangePasswordLoading(true);
      const { data } = await api.put("/auth/change-password", {
        otp: changePasswordOtp,
        newPassword,
      });
      login(data.user, data.token);
      toast.success("Password changed successfully!");
      setShowChangePasswordModal(false);
      setChangePasswordStep("send-otp");
      setChangePasswordOtp("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      <div className="card mb-6">
        {/* Profile info */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">{user.name}</h2>
          <p className="text-gray-500 text-sm flex items-center gap-1.5 mt-2">
            <Mail className="w-3.5 h-3.5" /> {user.email}
          </p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-2 inline-block border
            ${user.role === "admin"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-brand-light text-brand border-brand/20"}`}>
            {user.role}
          </span>
        </div>

        {/* Verification */}
        {user.isEmailVerified ? (
          <div className="flex items-center gap-2 text-sm p-3 rounded-lg mb-5 bg-green-50 border border-green-200 text-green-800">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-semibold">✅ Email Verified</span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 rounded-lg mb-5 bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-3 text-amber-800">
              <AlertCircle className="w-6 h-6 shrink-0 text-amber-500" />
              <div>
                <p className="font-semibold">Email not verified</p>
                <p className="text-xs text-amber-700 mt-0.5">Verify your email to secure your account.</p>
              </div>
            </div>
            <button
               onClick={handleSendOtp}
               disabled={verifyLoading}
               className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition disabled:opacity-50 whitespace-nowrap"
            >
              Verify Email
            </button>
          </div>
        )}

        {/* Edit form */}
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field pl-9" required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 XXXXX XXXXX" className="input-field pl-9" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</span>
              <span className="text-gray-800 font-medium">{user.phone || "Not set"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Member since</span>
              <span className="text-gray-800 font-medium">
                {new Date(user.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </span>
            </div>
            <button onClick={() => setEditing(true)} className="btn-primary mt-4">
              <Pencil className="w-4 h-4" /> Edit Profile
            </button>
            <button onClick={handleInitiatePasswordChange} disabled={changePasswordLoading} className="btn-secondary mt-3">
              <Lock className="w-4 h-4" /> Change Password
            </button>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/orders" className="card-hover text-center group">
          <div className="w-10 h-10 rounded-lg bg-brand-light mx-auto mb-2.5 flex items-center justify-center group-hover:bg-brand transition-colors">
            <Package className="w-5 h-5 text-brand group-hover:text-white transition-colors" />
          </div>
          <p className="font-semibold text-gray-800 text-sm">My Orders</p>
        </Link>
        <Link to="/cart" className="card-hover text-center group">
          <div className="w-10 h-10 rounded-lg bg-brand-light mx-auto mb-2.5 flex items-center justify-center group-hover:bg-brand transition-colors">
            <ShoppingCart className="w-5 h-5 text-brand group-hover:text-white transition-colors" />
          </div>
          <p className="font-semibold text-gray-800 text-sm">My Cart</p>
        </Link>
      </div>

      {/* Verify OTP Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative">
            <button onClick={() => setShowVerifyModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">✕</button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-brand-light mx-auto mb-3 flex items-center justify-center">
                <Mail className="w-6 h-6 text-brand" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Enter OTP</h2>
              <p className="text-sm text-gray-500 mt-1">We sent a 6-digit code to {user.email}</p>
            </div>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full text-center text-3xl font-bold tracking-[0.3em] py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand mb-4 outline-none"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={verifyLoading || otp.length !== 6}
              className="btn-primary w-full py-3 mt-2"
            >
              {verifyLoading ? "Verifying..." : "Verify Email"}
            </button>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative">
            <button
              onClick={() => {
                setShowChangePasswordModal(false);
                setChangePasswordStep("send-otp");
                setChangePasswordOtp("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>

            {/* Step 1: Verify OTP */}
            {changePasswordStep === "verify-otp" && (
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-brand-light mx-auto mb-3 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-brand" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Verify Your Identity</h2>
                  <p className="text-sm text-gray-500 mt-1">We sent a 6-digit code to {user.email}</p>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={changePasswordOtp}
                  onChange={(e) => setChangePasswordOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full text-center text-3xl font-bold tracking-[0.3em] py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-brand mb-4 outline-none"
                />
                <button
                  onClick={handleVerifyChangePasswordOtp}
                  disabled={changePasswordOtp.length !== 6}
                  className="btn-primary w-full py-3"
                >
                  Verify OTP
                </button>
              </>
            )}

            {/* Step 2: Set New Password */}
            {changePasswordStep === "set-password" && (
              <>
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Create New Password</h2>
                  <p className="text-sm text-gray-500 mt-1">Choose a strong password</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="input-field"
                    />
                  </div>
                  <button
                    onClick={handleSetNewPassword}
                    disabled={changePasswordLoading || !newPassword || !confirmPassword}
                    className="btn-primary w-full py-3"
                  >
                    {changePasswordLoading ? "Updating..." : "Change Password"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
