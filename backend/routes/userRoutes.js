// ============================================================
//  routes/userRoutes.js  —  Mounted at /api/user
// ============================================================
const express = require("express");
const router  = express.Router();

const { getMe } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Expose getMe as GET /api/user/profile per requirements
router.get("/profile", protect, getMe);

module.exports = router;
