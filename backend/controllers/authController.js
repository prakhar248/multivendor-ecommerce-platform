// ============================================================
//  controllers/authController.js  —  OTP-based verification
//  Uses Resend for email, SHA-256 hashed OTPs with expiry.
// ============================================================

const User     = require("../models/User");
const TempUser = require("../models/TempUser");
const Seller   = require("../models/Seller");
const bcrypt   = require("bcryptjs");
const sendEmail      = require("../utils/sendEmail");
const emailTemplate  = require("../utils/emailTemplate");
const { generateOTP, hashOTP, verifyOTP } = require("../utils/otpUtils");

// OTP validity duration: 10 minutes
const OTP_EXPIRY_MS = 10 * 60 * 1000;

// Helper: build JWT response object
const sendTokenResponse = (user, statusCode, res) => {
  const token   = user.generateJWT();
  const userObj = user.toObject();
  delete userObj.password;

  res.status(statusCode).json({ success: true, token, user: userObj });
};

// ============================================================
//  @desc    Register new user (customer | seller | admin)
//  @route   POST /api/auth/signup
//  @access  Public
// ============================================================
exports.signup = async (req, res, next) => {
  try {
    const { name, email, password, role = "customer", storeName, storeDescription } = req.body;

    // 1. Validate role — only customer and seller allowed via public signup
    if (role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Admin accounts cannot be created via public signup.",
      });
    }

    // 2. If registering as seller, storeName is required
    if (role === "seller" && !storeName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Store name is required for seller registration.",
      });
    }

    // 3. Check for existing email in MAIN User table
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "Email is already registered." });
    }

    // 4. Check for existing TempUser
    await TempUser.findOneAndDelete({ email }); // Clear any stale temp records

    // 5. Generate OTP, hash it, store with expiry
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
    
    // Hash password for TempUser
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6. Create TempUser
    const tempUser = await TempUser.create({
      name, email, password: hashedPassword, role, 
      storeName: storeName?.trim(), storeDescription: storeDescription?.trim() || "",
      otpHash, otpExpires
    });

    // Dev console fallback
    if (process.env.NODE_ENV === "development") {
      console.log(`📩 OTP for ${tempUser.email}: ${otp}`);
    }

    // 7. Send verification OTP email
    const html = emailTemplate({
      title: "Verify Your Account",
      greeting: `Hi ${tempUser.name},`,
      body: `
        <p>Welcome to <strong>ShopEasy</strong>! We're excited to have you on board.</p>
        <p>Please use the verification code below to activate your account:</p>
      `,
      otp,
      footer: "If you didn't create an account on ShopEasy, you can safely ignore this email.",
    });

    console.log("Sending OTP to:", tempUser.email);
    try {
      await sendEmail({
        to: tempUser.email,
        subject: "Verify your email - ShopEasy",
        html,
      });
      console.log("Email sent successfully");
    } catch (error) {
      console.error("EMAIL ERROR:", error);
      // Clean up temp since email failed
      await TempUser.findByIdAndDelete(tempUser._id);
      return res.status(500).json({
        success: false,
        message: "Signup failed: Unable to send OTP",
        error: error.message
      });
    }

    // DO NOT return JWT token yet
    res.status(201).json({
      success: true,
      message: "Signup successful! Please check your email for the verification OTP.",
      email: tempUser.email,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Verify signup email using OTP (converts TempUser to User)
//  @route   POST /api/auth/verify-signup
//  @access  Public
// ============================================================
exports.verifySignupOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    const tempUser = await TempUser.findOne({ email });
    if (!tempUser) {
      return res.status(404).json({ success: false, message: "Signup session expired or user not found." });
    }

    // Check expiry
    if (!tempUser.otpExpires || tempUser.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    // Verify OTP hash
    if (!tempUser.otpHash || !verifyOTP(otp, tempUser.otpHash)) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    // Move to User schema
    const user = await User.create({
      name: tempUser.name,
      email: tempUser.email,
      password: tempUser.password, // Schema hook prevents double hashing
      role: tempUser.role,
      isEmailVerified: true
    });

    // Move to Seller if applicable
    let sellerProfile = null;
    if (tempUser.role === "seller") {
      sellerProfile = await Seller.create({
        user: user._id,
        storeName: tempUser.storeName,
        storeDescription: tempUser.storeDescription,
        isApproved: false,
      });
    }

    // Clean up temp table
    await TempUser.findByIdAndDelete(tempUser._id);

    // ── Send Welcome Email ──────────────────────────────────────────
    try {
      const roleLabel = tempUser.role === "seller" ? "Seller" : "Customer";
      
      let welcomeBody = `
        <p>Welcome to the <strong>ShopEasy</strong> family! 🎉</p>
        <p>Your account has been verified and activated successfully. You're now ready to experience seamless shopping.</p>
      `;

      if (tempUser.role === "seller") {
        welcomeBody += `
          <p style="margin-top:20px;"><strong>Next Steps for Sellers:</strong></p>
          <ul style="margin:12px 0; padding-left:24px;">
            <li>Complete your store profile</li>
            <li>Upload your products</li>
            <li>Get approved by our team</li>
            <li>Start selling to millions of customers</li>
          </ul>
        `;
      } else {
        welcomeBody += `
          <p style="margin-top:20px;"><strong>Quick Tips:</strong></p>
          <ul style="margin:12px 0; padding-left:24px;">
            <li>Browse our handpicked collection</li>
            <li>Add items to your wishlist</li>
            <li>Enjoy fast & free delivery on orders above ₹500</li>
            <li>Track your orders in real-time</li>
          </ul>
        `;
      }

      welcomeBody += `
        <p style="margin-top:20px;">If you have any questions, our support team is always here to help. Happy exploring! 🚀</p>
      `;

      const html = emailTemplate({
        title: `Welcome to ShopEasy, ${tempUser.name}!`,
        greeting: `Hi ${tempUser.name},`,
        body: welcomeBody,
        ctaText: tempUser.role === "seller" ? "Go to Seller Dashboard" : "Start Shopping",
        ctaUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/${tempUser.role === "seller" ? "seller-dashboard" : ""}`,
        footer: "Thank you for joining ShopEasy. We're committed to providing the best shopping experience.",
      });

      await sendEmail({
        to: tempUser.email,
        subject: `Welcome to ShopEasy, ${tempUser.name}! 🎉`,
        html,
      });
      console.log("✅ Welcome email sent to:", tempUser.email);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail signup if welcome email fails
    }

    const token = user.generateJWT();
    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      success: true,
      message: "Email verified successfully! You are now logged in.",
      token,
      user: userObj,
      sellerProfile
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Verify email using OTP
//  @route   POST /api/auth/verify-otp
//  @access  Public
// ============================================================
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required.",
      });
    }

    const user = await User.findOne({ email }).select("+otpHash +otpExpires");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified." });
    }

    // Check expiry
    if (!user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP hash
    if (!user.otpHash || !verifyOTP(otp, user.otpHash)) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    // Mark as verified, clear OTP fields
    user.isEmailVerified = true;
    user.otpHash    = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = user.generateJWT();
    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now log in.",
      token,
      user: userObj
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Resend verification OTP
//  @route   POST /api/auth/resend-otp
//  @access  Public
// ============================================================
exports.resendOtp = async (req, res, next) => {
  try {
    const { email, purpose = "email-verification" } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    console.log("Sending OTP to:", email, "for:", purpose);

    let targetUser = await User.findOne({ email }).select("+otpHash +otpExpires");
    let isTemp = false;

    if (!targetUser) {
      targetUser = await TempUser.findOne({ email });
      isTemp = true;
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Only check email verification for email-verification purpose
    // Allow OTP sending to verified users for password-change purpose
    if (purpose === "email-verification" && !isTemp && targetUser.isEmailVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified." });
    }

    // Generate new OTP
    const otp = generateOTP();
    targetUser.otpHash    = hashOTP(otp);
    targetUser.otpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
    await targetUser.save();

    // Dev console fallback
    if (process.env.NODE_ENV === "development") {
      console.log(`📩 OTP for ${targetUser.email}: ${otp}`);
    }

    // Customize email based on purpose
    let emailTitle, emailBody;
    if (purpose === "password-change") {
      emailTitle = "Change Your Password";
      emailBody = `
        <p>We received a request to change your password on <strong>ShopEasy</strong>.</p>
        <p>Here is your verification code:</p>
      `;
    } else {
      emailTitle = "Verify Your Account";
      emailBody = `
        <p>Here is your new verification code for <strong>ShopEasy</strong>:</p>
      `;
    }

    const html = emailTemplate({
      title: emailTitle,
      greeting: `Hi ${targetUser.name},`,
      body: emailBody,
      otp,
      footer: "If you didn't request this code, you can safely ignore this email.",
    });

    try {
      await sendEmail({
        to: targetUser.email,
        subject: purpose === "password-change" ? "Change Your Password - ShopEasy" : "Verify your email - ShopEasy",
        html,
      });
      console.log("Email sent successfully");
    } catch (error) {
      console.error("EMAIL ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email",
        error: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent"
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Login user
//  @route   POST /api/auth/login
//  @access  Public
// ============================================================
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Please provide email and password." });
    }

    // Explicitly select password (it's select:false in schema)
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email not verified",
        isEmailVerified: false,
      });
    }

    // For sellers: attach their approval status to the response
    let sellerProfile = null;
    if (user.role === "seller") {
      sellerProfile = await Seller.findOne({ user: user._id });
    }

    const token   = user.generateJWT();
    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      success: true,
      token,
      user: userObj,
      sellerProfile: sellerProfile || null,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Send forgot password OTP
//  @route   POST /api/auth/forgot-password
//  @access  Public
// ============================================================
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with that email." });
    }

    // Generate OTP for password reset
    const otp = generateOTP();
    user.resetOtpHash    = hashOTP(otp);
    user.resetOtpExpires = new Date(Date.now() + OTP_EXPIRY_MS);
    await user.save();

    // Dev console fallback
    if (process.env.NODE_ENV === "development") {
      console.log(`📩 Reset OTP for ${user.email}: ${otp}`);
    }

    const html = emailTemplate({
      title: "Reset Your Password",
      greeting: `Hi ${user.name},`,
      body: `
        <p>We received a request to reset your <strong>ShopEasy</strong> password.</p>
        <p>Use the code below to reset your password:</p>
      `,
      otp,
      footer: "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
    });

    console.log("Sending Reset OTP to:", user.email);
    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your password - ShopEasy",
        html,
      });
      console.log("Email sent successfully");
    } catch (error) {
      console.error("Email sending failed:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email",
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset OTP sent to your email.",
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Reset password using OTP
//  @route   POST /api/auth/reset-password
//  @access  Public
// ============================================================
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const user = await User.findOne({ email }).select("+resetOtpHash +resetOtpExpires +password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Check expiry
    if (!user.resetOtpExpires || user.resetOtpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP
    if (!user.resetOtpHash || !verifyOTP(otp, user.resetOtpHash)) {
      return res.status(400).json({ success: false, message: "Invalid OTP." });
    }

    // Update password and clear reset OTP fields
    user.password        = newPassword;
    user.resetOtpHash    = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful! You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get currently logged-in user's profile + seller info
//  @route   GET /api/auth/me
//  @access  Private
// ============================================================
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    let sellerProfile = null;
    if (user.role === "seller") {
      sellerProfile = await Seller.findOne({ user: user._id });
    }

    res.status(200).json({ success: true, user, sellerProfile });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Update user profile
//  @route   PUT /api/auth/profile
//  @access  Private
// ============================================================
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Change password
//  @route   PUT /api/auth/change-password
//  @access  Private
// ============================================================
// ============================================================
//  @desc    Change password with OTP verification
//  @route   PUT /api/auth/change-password
//  @access  Private
//  @body    { otp, newPassword }
// ============================================================
exports.changePassword = async (req, res, next) => {
  try {
    const { otp, newPassword } = req.body;
    
    if (!otp || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: "OTP and new password are required." 
      });
    }

    const user = await User.findById(req.user.id).select("+otpHash +otpExpires");

    // Check if OTP exists
    if (!user.otpHash || !user.otpExpires) {
      return res.status(400).json({ 
        success: false, 
        message: "No OTP found. Please request a new one." 
      });
    }

    // Check if OTP has expired
    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ 
        success: false, 
        message: "OTP has expired. Please request a new one." 
      });
    }

    // Verify OTP
    if (!verifyOTP(otp, user.otpHash)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid OTP." 
      });
    }

    // Update password
    user.password = newPassword;
    user.otpHash = null;      // Clear OTP after successful use
    user.otpExpires = null;
    await user.save();

    console.log("✅ Password changed successfully for user:", user.email);

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};
