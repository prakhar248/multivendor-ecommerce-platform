// routes/cartRoutes.js — Mounted at /api/cart
const express = require("express");
const router  = express.Router();
const { 
  getCart, 
  addToCart, 
  updateCartItem, 
  removeFromCart, 
  clearCart,
  saveForLater,
  moveToCart,
  removeSavedItem,
  getSavedForLater
} = require("../controllers/cartController");
const { protect } = require("../middleware/authMiddleware");

// All cart routes require login
router.use(protect);

// Save for later endpoints (must come before generic routes)
router.get   ("/saved-for-later",              getSavedForLater);
router.post  ("/save-for-later/:productId",    saveForLater);
router.post  ("/move-to-cart/:productId",      moveToCart);
router.delete("/remove-saved/:productId",      removeSavedItem);

// Core cart routes
router.get   ("/",                    getCart);
router.post  ("/add",                 addToCart);
router.put   ("/update",              updateCartItem);
router.delete("/remove/:productId",   removeFromCart);
router.delete("/clear",               clearCart);

module.exports = router;
