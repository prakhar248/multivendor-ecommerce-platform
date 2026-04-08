// ============================================================
//  server.js — Multi-vendor E-commerce Backend
// ============================================================

require("dotenv").config(); // MUST be at top

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// Connect DB
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? "https://your-production-domain.com"
        : process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// ── API Routes ───────────────────────────────────────────────
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/addresses", require("./routes/addressRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/seller", require("./routes/sellerRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// ── Health Check ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server running — multi-vendor mode" });
});

// ── Image Upload ─────────────────────────────────────────────
const uploadRoutes = require("./routes/uploadRoutes");
app.use("/api/upload", uploadRoutes);

// ── Email Test Route ─────────────────────────────────────────
const sendEmail = require("./utils/sendEmail");

app.get("/api/test-email", async (req, res) => {
  try {
    await sendEmail({
      to: process.env.EMAIL_USER || "test@example.com",
      subject: "Test Email 🚀",
      html: "<h1>Resend email is working successfully!</h1>",
    });
    res.send("✅ Email sent successfully via Resend!");
  } catch (err) {
    console.error("❌ Email error:", err.message);
    res.status(500).send("❌ Email failed");
  }
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌", err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Multi-vendor server running on port ${PORT}`);
});