// routes/paymentRoutes.js — Mounted at /api/payment
const express = require("express");
const router  = express.Router();
const {
  createRazorpayOrder,
  verifyPayment,
  generatePayUPayment,
  handlePayUSuccess,
  handlePayUFailure,
} = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

// Razorpay routes
router.post("/create-order", protect, createRazorpayOrder);
router.post("/verify", protect, verifyPayment);

// PayU routes
router.post("/payu-generate", protect, generatePayUPayment);
// PayU callbacks (public, no auth needed - called by PayU servers)
router.post("/payu-success", handlePayUSuccess);
router.post("/payu-failure", handlePayUFailure);

module.exports = router;
