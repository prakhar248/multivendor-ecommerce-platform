// ============================================================
//  models/User.js  —  UPDATED for multi-vendor platform
//  Roles: "customer" | "seller" | "admin"
// ============================================================

const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, "Name is required"],
      trim:      true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },

    password: {
      type:      String,
      required:  [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select:    false,
    },

    // "customer" = browse/buy  |  "seller" = manage own products  |  "admin" = everything
    role: {
      type:    String,
      enum: {
        values:  ["customer", "seller", "admin"],
        message: "Role must be customer, seller, or admin",
      },
      default: "customer",
    },

    isEmailVerified:       { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    resetPasswordToken:    String,
    resetPasswordExpire:   Date,

    avatar: {
      type:    String,
      default: "https://res.cloudinary.com/demo/image/upload/v1/default-avatar.png",
    },
    phone: { type: String, default: "" },

    // Addresses for delivery
    addresses: [
      {
        label: {
          type:    String,
          enum:    ["home", "work", "other"],
          default: "home",
        },
        name:      { type: String, required: true },
        street:    { type: String, required: true },
        city:      { type: String, required: true },
        state:     { type: String, required: true },
        pincode:   { type: String, required: true },
        phone:     { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Saved for later items (like Amazon's save for later)
    savedForLater: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true, default: 1, min: 1 },
        savedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Hash password before every save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt    = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

// JWT payload carries id + role so middleware never needs a DB call for role checks
userSchema.methods.generateJWT = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "30d" }
  );
};

module.exports = mongoose.model("User", userSchema);
