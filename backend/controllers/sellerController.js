// ============================================================
//  controllers/sellerController.js  —  NEW
//  All seller-dashboard operations:
//    - View own products
//    - Create / update / delete own products
//    - View own orders
//    - View seller stats
//
//  Security rule enforced here:
//    A seller can ONLY modify products where product.seller === req.user._id
// ============================================================

const Product = require("../models/Product");
const Order   = require("../models/Order");
const Seller  = require("../models/Seller");
const { cloudinary } = require("../config/cloudinary");

// ============================================================
//  @desc    Get seller dashboard stats
//  @route   GET /api/seller/stats
//  @access  Seller (approved)
// ============================================================
exports.getSellerStats = async (req, res, next) => {
  try {
    const sellerId = req.user._id;

    // Count this seller's products
    const totalProducts = await Product.countDocuments({ seller: sellerId });

    // Find all orders that contain at least one product from this seller
    const orders = await Order.find({ "items.seller": sellerId });

    const totalOrders  = orders.length;
    const totalRevenue = orders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((acc, o) => {
        // Sum only items belonging to this seller
        const sellerItems = o.items.filter(
          (item) => item.seller?.toString() === sellerId.toString()
        );
        return acc + sellerItems.reduce((s, i) => s + i.price * i.quantity, 0);
      }, 0);

    // Low-stock warning: products with stock < 5
    const lowStockProducts = await Product.find({ seller: sellerId, stock: { $lt: 5 } })
      .select("name stock images");

    res.status(200).json({
      success: true,
      stats: { totalProducts, totalOrders, totalRevenue, lowStockCount: lowStockProducts.length },
      lowStockProducts,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get seller profile
//  @route   GET /api/seller/profile
//  @access  Seller (approved)
// ============================================================
exports.getSellerProfile = async (req, res, next) => {
  try {
    const sellerProfile = await Seller.findOne({ user: req.user._id }).populate("user", "name email");
    if (!sellerProfile) {
      return res.status(404).json({ success: false, message: "Seller profile not found." });
    }
    res.status(200).json({ success: true, sellerProfile });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Update seller profile (store name, description, logo)
//  @route   PUT /api/seller/profile
//  @access  Seller (approved)
// ============================================================
exports.updateSellerProfile = async (req, res, next) => {
  try {
    const { storeName, storeDescription } = req.body;
    const sellerProfile = await Seller.findOneAndUpdate(
      { user: req.user._id },
      { storeName, storeDescription },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, sellerProfile });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get all products belonging to the logged-in seller
//  @route   GET /api/seller/products
//  @access  Seller (approved)
// ============================================================
exports.getMyProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = { seller: req.user._id };

    if (search) filter.$text = { $search: search };

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .sort("-createdAt")
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      products,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Create a new product (seller only)
//  @route   POST /api/seller/products
//  @access  Seller (approved)
// ============================================================
exports.createProduct = async (req, res, next) => {
  try {
    const { name, description, price, discountedPrice, stock, category, brand, tags } = req.body;

    const images = req.files
      ? req.files.map((file) => ({ url: file.path, publicId: file.filename }))
      : [];

    // seller field is set to the logged-in user's ID — not from req.body (security)
    const product = await Product.create({
      name,
      description,
      price:           Number(price),
      discountedPrice: discountedPrice ? Number(discountedPrice) : null,
      stock:           Number(stock),
      category,
      brand:           brand || "",
      tags:            tags ? tags.split(",").map((t) => t.trim()) : [],
      images,
      seller:          req.user._id, // Always set server-side
    });

    // Update seller's product count
    await Seller.findOneAndUpdate({ user: req.user._id }, { $inc: { totalProducts: 1 } });

    res.status(201).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Update a product (seller can only update THEIR OWN products)
//  @route   PUT /api/seller/products/:id
//  @access  Seller (approved)
// ============================================================
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // *** SECURITY CHECK: Verify this product belongs to the requesting seller ***
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you can only update your own products.",
      });
    }

    const updateData = { ...req.body };

    // If new images are uploaded, append them to existing ones
    if (req.files?.length > 0) {
      const newImages = req.files.map((file) => ({ url: file.path, publicId: file.filename }));
      updateData.images = [...product.images, ...newImages];
    }

    // Prevent seller from changing the seller field
    delete updateData.seller;

    product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new:           true,
      runValidators: true,
    });

    res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Delete a product (seller can only delete THEIR OWN products)
//  @route   DELETE /api/seller/products/:id
//  @access  Seller (approved)
// ============================================================
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // *** SECURITY CHECK ***
    if (product.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied — you can only delete your own products.",
      });
    }

    // Delete images from Cloudinary
    for (const image of product.images) {
      if (image.publicId) await cloudinary.uploader.destroy(image.publicId);
    }

    await product.deleteOne();

    // Decrement seller's product count
    await Seller.findOneAndUpdate({ user: req.user._id }, { $inc: { totalProducts: -1 } });

    res.status(200).json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get orders containing the seller's products
//  @route   GET /api/seller/orders
//  @access  Seller (approved)
// ============================================================
exports.getMyOrders = async (req, res, next) => {
  try {
    // Find orders that have at least one item sold by this seller
    const orders = await Order.find({ "items.seller": req.user._id })
      .sort("-createdAt")
      .populate("user", "name email");

    // Filter each order to show only this seller's items
    const sellerOrders = orders.map((order) => {
      const myItems = order.items.filter(
        (item) => item.seller?.toString() === req.user._id.toString()
      );
      const myTotal = myItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
      return {
        _id:           order._id,
        customer:      order.user,
        items:         myItems,
        myTotal,
        paymentStatus: order.paymentStatus,
        orderStatus:   order.status,
        createdAt:     order.createdAt,
      };
    });

    res.status(200).json({ success: true, orders: sellerOrders });
  } catch (error) {
    next(error);
  }
};
