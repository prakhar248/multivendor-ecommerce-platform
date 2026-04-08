// ============================================================
//  models/Seller.js  —  NEW: Seller profile / store details
//
//  Every user who signs up as "seller" gets a corresponding
//  Seller document created automatically by authController.
//  A seller must be APPROVED by admin before they can list products.
// ============================================================

const mongoose = require("mongoose");

const sellerSchema = new mongoose.Schema(
  {
    // Reference back to the User account (1-to-1 relationship)
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      unique:   true, // One seller profile per user account
    },

    // ── Store Info ──────────────────────────────────────────
    storeName: {
      type:      String,
      required:  [true, "Store name is required"],
      trim:      true,
      maxlength: [100, "Store name cannot exceed 100 characters"],
    },

    storeDescription: {
      type:    String,
      default: "",
      maxlength: [500, "Store description cannot exceed 500 characters"],
    },

    // ── Admin Approval ──────────────────────────────────────
    // Sellers start as NOT approved. Admin must flip this to true
    // before their products appear publicly and they can add new ones.
    isApproved: {
      type:    Boolean,
      default: false,
    },

    // Admin who approved (or null if still pending)
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
      default: null,
    },

    approvedAt: {
      type:    Date,
      default: null,
    },

    // ── Stats (updated on order events) ────────────────────
    totalSales:    { type: Number, default: 0 },
    totalRevenue:  { type: Number, default: 0 },
    totalProducts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Seller", sellerSchema);
