// ============================================================
//  routes/authRoutes.js  —  Mounted at /api/auth
//  Updated for OTP-based verification and password reset
// ============================================================
const express = require("express");
const router  = express.Router();

const {
  signup,
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  getMe,
  updateProfile,
  changePassword,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

// Public — Authentication
router.post("/signup",           signup);
router.post("/login",            login);

// Public — OTP Verification
router.post("/verify-otp",      verifyOtp);
router.post("/send-otp",        resendOtp);
router.post("/resend-otp",      resendOtp);

// Public — Password Reset
router.post("/forgot-password",  forgotPassword);
router.post("/reset-password",   resetPassword);

// Private — Profile
router.get ("/me",              protect, getMe);
router.put ("/profile",         protect, updateProfile);
router.put ("/change-password", protect, changePassword);

module.exports = router;
