// ============================================================
//  controllers/cartController.js
//  All cart operations for a logged-in user
// ============================================================

const Cart    = require("../models/Cart");
const Product = require("../models/Product");
const User    = require("../models/User");

// ── Helper: fetch or create cart for a user ──────────────────
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate("items.product", "name images price stock");
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
};

// ============================================================
//  @desc    Get the current user's cart
//  @route   GET /api/cart
//  @access  Private
// ============================================================
exports.getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    res.status(200).json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Add item to cart (or increase quantity if already there)
//  @route   POST /api/cart/add
//  @access  Private
// ============================================================
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // 1. Validate product exists and has enough stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: "Not enough stock" });
    }

    // 2. Get/create cart
    const cart = await getOrCreateCart(req.user.id);

    // 3. Check if the product is already in the cart
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      // Increase quantity (but don't exceed stock)
      const newQty = existingItem.quantity + Number(quantity);
      if (newQty > product.stock) {
        return res.status(400).json({ success: false, message: "Not enough stock" });
      }
      existingItem.quantity = newQty;
    } else {
      // Add new item — snapshot the price at this moment
      cart.items.push({
        product:    productId,
        quantity:   Number(quantity),
        priceAtAdd: product.discountedPrice || product.price,
      });
    }

    await cart.save();

    // Re-populate after save
    await cart.populate("items.product", "name images price stock");

    res.status(200).json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Update quantity of a cart item
//  @route   PUT /api/cart/update
//  @access  Private
// ============================================================
exports.updateCartItem = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
    }

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not in cart" });
    }

    // Validate against current stock
    const product = await Product.findById(productId);
    if (quantity > product.stock) {
      return res.status(400).json({ success: false, message: "Not enough stock" });
    }

    item.quantity = Number(quantity);
    await cart.save();
    await cart.populate("items.product", "name images price stock");

    res.status(200).json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Remove a single item from the cart
//  @route   DELETE /api/cart/remove/:productId
//  @access  Private
// ============================================================
exports.removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // Filter out the item we want to remove
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== req.params.productId
    );

    await cart.save();
    await cart.populate("items.product", "name images price stock");

    res.status(200).json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Clear the entire cart
//  @route   DELETE /api/cart/clear
//  @access  Private
// ============================================================
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.status(200).json({ success: true, message: "Cart cleared" });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Save a cart item for later (move from cart to savedForLater)
//  @route   POST /api/cart/save-for-later/:productId
//  @access  Private
// ============================================================
exports.saveForLater = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Get the cart and find the item
    const cart = await Cart.findOne({ user: req.user.id }).populate("items.product");
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const cartItem = cart.items.find((item) => item.product._id.toString() === productId);
    if (!cartItem) {
      return res.status(404).json({ success: false, message: "Item not in cart" });
    }

    // Move to savedForLater: add or update quantity
    const savedIndex = user.savedForLater.findIndex(
      (item) => item.product.toString() === productId
    );

    if (savedIndex >= 0) {
      // Already in savedForLater, increase quantity
      user.savedForLater[savedIndex].quantity += cartItem.quantity;
    } else {
      // New item to savedForLater
      user.savedForLater.push({
        product: productId,
        quantity: cartItem.quantity,
      });
    }

    // Remove from cart
    cart.items = cart.items.filter((item) => item.product._id.toString() !== productId);

    // Save both
    await cart.save();
    await user.save();

    // Populate and return updated cart
    await cart.populate("items.product", "name images price stock");

    res.status(200).json({ 
      success: true, 
      message: "Item saved for later",
      cart 
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Move a saved item back to cart
//  @route   POST /api/cart/move-to-cart/:productId
//  @access  Private
// ============================================================
exports.moveToCart = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Find saved item
    const savedIndex = user.savedForLater.findIndex(
      (item) => item.product.toString() === productId
    );

    if (savedIndex < 0) {
      return res.status(404).json({ success: false, message: "Item not in saved for later" });
    }

    const savedItem = user.savedForLater[savedIndex];

    // Validate product still exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (product.stock < savedItem.quantity) {
      return res.status(400).json({ 
        success: false, 
        message: "Not enough stock available" 
      });
    }

    // Get/create cart
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // Add to cart: check if already exists
    const existingItem = cart.items.find((item) => item.product.toString() === productId);
    
    if (existingItem) {
      const newQty = existingItem.quantity + savedItem.quantity;
      if (newQty > product.stock) {
        return res.status(400).json({ success: false, message: "Not enough stock" });
      }
      existingItem.quantity = newQty;
    } else {
      cart.items.push({
        product: productId,
        quantity: savedItem.quantity,
        priceAtAdd: product.discountedPrice || product.price,
      });
    }

    // Remove from savedForLater
    user.savedForLater.splice(savedIndex, 1);

    // Save both
    await cart.save();
    await user.save();

    // Populate and return updated cart
    await cart.populate("items.product", "name images price stock");

    res.status(200).json({ 
      success: true, 
      message: "Item moved to cart",
      cart 
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Remove a saved item
//  @route   DELETE /api/cart/remove-saved/:productId
//  @access  Private
// ============================================================
exports.removeSavedItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const initialLength = user.savedForLater.length;
    user.savedForLater = user.savedForLater.filter(
      (item) => item.product.toString() !== productId
    );

    if (user.savedForLater.length === initialLength) {
      return res.status(404).json({ success: false, message: "Item not in saved for later" });
    }

    await user.save();

    res.status(200).json({ 
      success: true, 
      message: "Item removed from saved for later" 
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
//  @desc    Get user's saved for later items
//  @route   GET /api/cart/saved-for-later
//  @access  Private
// ============================================================
exports.getSavedForLater = async (req, res, next) => {
  try {
    const user = await User
      .findById(req.user.id)
      .populate("savedForLater.product", "name images price stock discountedPrice");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ 
      success: true, 
      savedForLater: user.savedForLater 
    });
  } catch (error) {
    next(error);
  }
};
