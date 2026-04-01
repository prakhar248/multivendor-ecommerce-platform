// ============================================================
//  models/Product.js  —  UPDATED for multi-vendor
//  Key change: products now belong to a seller, not just admin
// ============================================================

const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name:    { type: String, required: true },
    rating:  { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    // ── Core Info ────────────────────────────────────────────
    name: {
      type:     String,
      required: [true, "Product name is required"],
      trim:     true,
    },

    description: {
      type:     String,
      required: [true, "Description is required"],
    },

    // ── Pricing & Stock ──────────────────────────────────────
    price: {
      type:     Number,
      required: [true, "Price is required"],
      min:      [0, "Price cannot be negative"],
    },

    discountedPrice: {
      type:    Number,
      default: null,
    },

    stock: {
      type:     Number,
      required: true,
      default:  0,
      min:      [0, "Stock cannot be negative"],
    },
    countInStock: {
      type:    Number,
      default: 0,
      min:     [0, "countInStock cannot be negative"],
    },

    // ── Images ───────────────────────────────────────────────
    // Supports both legacy objects ({url, publicId}) and direct URL strings.
    images: [{ type: mongoose.Schema.Types.Mixed }],

    // ── Categorization ───────────────────────────────────────
    category: {
      type:     String,
      required: [true, "Category is required"],
      enum:     ["Electronics", "Clothing", "Books", "Home", "Sports", "Beauty", "Other"],
    },

    brand: { type: String, default: "" },
    tags:  [String],

    // ── Seller Reference (CHANGED from "createdBy" to "seller") ─
    // This links the product to its seller.
    // Middleware uses this to ensure sellers can only edit THEIR products.
    seller: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",        // References User (who has role: "seller")
      required: [true, "Seller is required"],
    },

    // ── Reviews & Ratings ────────────────────────────────────
    reviews:    [reviewSchema],
    rating:     { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },

    // ── Visibility ───────────────────────────────────────────
    // Products from unapproved sellers are hidden from public listings
    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

productSchema.pre("validate", function (next) {
  if (typeof this.stock === "number" && (this.countInStock === undefined || this.countInStock === null)) {
    this.countInStock = this.stock;
  }
  if (typeof this.countInStock === "number" && (this.stock === undefined || this.stock === null)) {
    this.stock = this.countInStock;
  }
  next();
});

// Full-text search index on name, description, brand
productSchema.index({ name: "text", description: "text", brand: "text" });

// Compound index: fast lookups for "products by this seller"
productSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);
