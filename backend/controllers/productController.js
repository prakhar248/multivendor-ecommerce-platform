// ============================================================
//  controllers/productController.js  —  UPDATED for multi-vendor
//  Public routes: browse, search, filter, view, review
//  (Create / Update / Delete moved to sellerController.js)
// ============================================================

const Product = require("../models/Product");
const Seller  = require("../models/Seller");

// ============================================================
//  @desc    Create product with image upload
//  @route   POST /api/products
//  @access  Seller (approved)
// ============================================================
exports.createProduct = async (req, res, next) => {
  try {
    const { name, price, description, category, countInStock } = req.body;

    if (!name || !price || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "name, price, description and category are required",
      });
    }

    const images = req.files?.length ? req.files.map((file) => file.path) : [];

    // Graceful handling: allow product creation without images.
    if (images.length === 0) {
      // no-op: product is still created with an empty images array
    }

    const product = await Product.create({
      name: name.trim(),
      price: Number(price),
      description: description.trim(),
      category,
      countInStock: Number(countInStock || 0),
      stock: Number(countInStock || 0),
      images,
      seller: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get all products (public browsing with filters)
//  @route   GET /api/products
//  @access  Public
// ============================================================
exports.getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      seller,               // Filter by a specific seller's products
      sort    = "-createdAt",
      page    = 1,
      limit   = 12,
    } = req.query;

    // Build filter — only show products from APPROVED sellers
    // We do this by looking up approved seller user IDs
    const approvedSellers = await Seller.find({ isApproved: true }).select("user");
    const approvedSellerIds = approvedSellers.map((s) => s.user);

    const filter = {
      seller:   { $in: approvedSellerIds }, // Only approved sellers
      isActive: true,
    };

    if (search)   filter.$text     = { $search: search };
    if (category && category !== "All") filter.category = category;
    if (seller)   filter.seller    = seller;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate("seller", "name")   // Show seller name on product card
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      products,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get single product by ID
//  @route   GET /api/products/:id
//  @access  Public
// ============================================================
exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("seller",        "name avatar")
      .populate("reviews.user",  "name avatar");

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Fetch store name for the seller
    const sellerProfile = await Seller.findOne({ user: product.seller._id }).select("storeName");

    res.status(200).json({ success: true, product, sellerStore: sellerProfile });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Add or update a review (customers only)
//  @route   POST /api/products/:id/reviews
//  @access  Private (customer)
// ============================================================
exports.addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    // Sellers should not review products (business rule)
    if (req.user.role === "seller") {
      return res.status(403).json({ success: false, message: "Sellers cannot review products." });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const existingReview = product.reviews.find(
      (r) => r.user.toString() === req.user.id.toString()
    );

    if (existingReview) {
      existingReview.rating  = Number(rating);
      existingReview.comment = comment;
    } else {
      product.reviews.push({
        user:    req.user.id,
        name:    req.user.name,
        rating:  Number(rating),
        comment,
      });
    }

    product.numReviews = product.reviews.length;
    product.rating     = product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.numReviews;

    await product.save();
    res.status(201).json({ success: true, message: "Review submitted.", product });
  } catch (error) {
    next(error);
  }
};
