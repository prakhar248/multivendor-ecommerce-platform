// ============================================================
//  controllers/adminController.js  —  REWRITTEN for multi-vendor
//  Admin can:
//    - View dashboard stats
//    - View / manage all users
//    - Approve / reject sellers
//    - View all orders
//    - Delete any product
// ============================================================

const User    = require("../models/User");
const Seller  = require("../models/Seller");
const Product = require("../models/Product");
const Order   = require("../models/Order");
const { cloudinary } = require("../config/cloudinary");
const sendEmail = require("../utils/sendEmail");

// ============================================================
//  @desc    Get platform-wide stats for admin dashboard
//  @route   GET /api/admin/stats
//  @access  Admin
// ============================================================
exports.getStats = async (req, res, next) => {
  try {
    const [totalUsers, totalSellers, pendingSellers, totalProducts, totalOrders, paidOrders] =
      await Promise.all([
        User.countDocuments(),
        Seller.countDocuments({ isApproved: true }),
        Seller.countDocuments({ isApproved: false }),
        Product.countDocuments(),
        Order.countDocuments(),
        Order.find({ paymentStatus: "paid" }),
      ]);

    const totalRevenue = paidOrders.reduce((acc, o) => acc + o.totalPrice, 0);

    // Recent activity: last 5 orders
    const recentOrders = await Order.find({})
      .sort("-createdAt")
      .limit(5)
      .populate("user", "name email");

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalSellers,
        pendingSellers,
        totalProducts,
        totalOrders,
        totalRevenue,
      },
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get all users with optional role filter
//  @route   GET /api/admin/users?role=seller
//  @access  Admin
// ============================================================
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (role) filter.role = role;

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(filter);

    const users = await User.find(filter)
      .sort("-createdAt")
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({ success: true, total, users });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get all pending seller applications
//  @route   GET /api/admin/sellers/pending
//  @access  Admin
// ============================================================
exports.getPendingSellers = async (req, res, next) => {
  try {
    const pending = await Seller.find({ isApproved: false })
      .populate("user", "name email createdAt")
      .sort("-createdAt");

    res.status(200).json({ success: true, count: pending.length, sellers: pending });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get all sellers (approved + pending)
//  @route   GET /api/admin/sellers
//  @access  Admin
// ============================================================
exports.getAllSellers = async (req, res, next) => {
  try {
    const sellers = await Seller.find({})
      .populate("user", "name email createdAt isEmailVerified")
      .populate("approvedBy", "name")
      .sort("-createdAt");

    res.status(200).json({ success: true, count: sellers.length, sellers });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Approve a seller application
//  @route   PUT /api/admin/sellers/:id/approve
//  @access  Admin
// ============================================================
exports.approveSeller = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.params.id).populate("user", "name email");

    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found." });
    }

    if (seller.isApproved) {
      return res.status(400).json({ success: false, message: "Seller is already approved." });
    }

    seller.isApproved  = true;
    seller.approvedBy  = req.user._id;
    seller.approvedAt  = Date.now();
    await seller.save();

    // Send seller approval email
    try {
      await sendEmail(
        seller.user.email,
        "🎉 Your Store Has Been Approved - ShopperStop",
        `<p>Hi ${seller.user.name},</p>
         <p>Congratulations! Your seller account has been approved!</p>
         <p><strong>Store Name:</strong> ${seller.storeName}</p>
         <p>Your store is now active and you can start listing products.</p>
         <br/>
         <p><strong>Next Steps:</strong></p>
         <ul>
           <li>Log in to your seller dashboard</li>
           <li>Add your products with descriptions and images</li>
           <li>Set your pricing and manage inventory</li>
           <li>Monitor orders and customer reviews</li>
         </ul>
         <br/>
         <p>Best of luck with your store! We're excited to have you as part of ShopperStop.</p>
         <p>If you have any questions, feel free to contact our support team.</p>`
      );
      console.log("✅ Seller approval email sent to:", seller.user.email);
    } catch (emailError) {
      console.error("Failed to send seller approval email:", emailError);
    }

    res.status(200).json({ success: true, message: "Seller approved successfully.", seller });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Reject / revoke seller approval
//  @route   PUT /api/admin/sellers/:id/reject
//  @access  Admin
// ============================================================
exports.rejectSeller = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: "Seller not found." });
    }

    seller.isApproved = false;
    seller.approvedBy = null;
    seller.approvedAt = null;
    await seller.save();

    res.status(200).json({ success: true, message: "Seller approval revoked.", seller });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Delete any user (with cascade)
//  @route   DELETE /api/admin/users/:id
//  @access  Admin
// ============================================================
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account." });
    }

    // If deleting a seller, also remove their profile
    if (user.role === "seller") {
      await Seller.findOneAndDelete({ user: user._id });
    }

    await user.deleteOne();

    res.status(200).json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Admin deletes ANY product (including other sellers')
//  @route   DELETE /api/admin/products/:id
//  @access  Admin
// ============================================================
exports.deleteAnyProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Clean up Cloudinary images
    for (const image of product.images) {
      if (image.publicId) await cloudinary.uploader.destroy(image.publicId);
    }

    await product.deleteOne();
    res.status(200).json({ success: true, message: "Product deleted by admin." });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get all orders (admin view)
//  @route   GET /api/admin/orders
//  @access  Admin
// ============================================================
exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({})
      .sort("-createdAt")
      .populate("user", "name email");

    const totalRevenue = orders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((acc, o) => acc + o.totalPrice, 0);

    res.status(200).json({ success: true, totalRevenue, orders });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Update any order status
//  @route   PUT /api/admin/orders/:id/status
//  @access  Admin
// ============================================================
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    order.status = status;
    if (status === "delivered") order.deliveredAt = Date.now();
    await order.save();

    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};
