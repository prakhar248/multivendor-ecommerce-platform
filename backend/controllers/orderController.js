// ============================================================
//  controllers/orderController.js  —  UPDATED: snapshot seller + email notifications
// ============================================================
const Order   = require("../models/Order");
const Cart    = require("../models/Cart");
const Product = require("../models/Product");
const sendEmail = require("../utils/sendEmail");
const emailTemplate = require("../utils/emailTemplate");

exports.placeOrder = async (req, res, next) => {
  try {
    const { shippingAddress, orderItems: directItems } = req.body;

    let items = [];
    let cart = null;

    // ── DETERMINE FLOW: BUY NOW OR CART CHECKOUT ─────────────────────
    if (directItems && directItems.length > 0) {
      // ✅ BUY NOW FLOW (Direct purchase)
      console.log("🚀 Buy Now flow detected - items passed directly");
      items = directItems;
    } else {
      // ✅ CART FLOW (Traditional checkout)
      console.log("🛒 Cart flow detected - fetching from database");
      cart = await Cart.findOne({ user: req.user.id }).populate("items.product");

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: "Cart is empty." });
      }

      // Snapshot product details + seller on each item
      items = cart.items.map((item) => {
        // Handle images that can be either strings or {url, publicId} objects
        let imageUrl = "";
        if (item.product.images && item.product.images.length > 0) {
          const firstImage = item.product.images[0];
          imageUrl = typeof firstImage === "string" ? firstImage : (firstImage?.url || "");
        }

        return {
          product:  item.product._id,
          seller:   item.product.seller,   // <-- seller is now stored per item
          name:     item.product.name,
          image:    imageUrl,              // <-- now handles both string and object formats
          price:    item.priceAtAdd,
          quantity: item.quantity,
        };
      });
    }

    // ── CALCULATE PRICES ─────────────────────────────────────────────
    const itemsPrice    = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const shippingPrice = itemsPrice > 500 ? 0 : 50;
    const taxPrice      = Math.round(itemsPrice * 0.18);
    const totalPrice    = itemsPrice + shippingPrice + taxPrice;

    // ── CREATE ORDER ─────────────────────────────────────────────────
    const order = await Order.create({
      user: req.user.id,
      items: items,
      shippingAddress,
      itemsPrice,
      shippingPrice,
      taxPrice,
      totalPrice,
      paymentStatus: "pending",
    });

    console.log("✅ Order created:", order._id);

    // NOTE: Stock is NOT decremented here — it only decreases after
    // successful payment verification (in paymentController.js).
    // This prevents stock from being "consumed" by unpaid/failed orders.

    // ── CLEAR CART ONLY IF CART FLOW ─────────────────────────────────
    if (!directItems && cart) {
      cart.items = [];
      await cart.save();
      console.log("✅ Cart cleared");
    }

    // Send order confirmation email
    try {
      await sendEmail({
        to: req.user.email,
        subject: "Order Confirmation — ShopEasy",
        html: emailTemplate({
          title: "Order Placed",
          greeting: `Hi ${req.user.name},`,
          body: `
            <p>Your order has been placed successfully!</p>
            <table style="width:100%; border-collapse:collapse; margin:16px 0;">
              <tr>
                <td style="padding:8px 0; color:#64748b; font-size:13px;">Order ID</td>
                <td style="padding:8px 0; text-align:right; font-weight:600; color:#1e293b; font-size:13px; font-family:monospace;">${order._id}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; color:#64748b; font-size:13px;">Total Amount</td>
                <td style="padding:8px 0; text-align:right; font-weight:600; color:#1e293b; font-size:13px;">₹${order.totalPrice.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; color:#64748b; font-size:13px;">Status</td>
                <td style="padding:8px 0; text-align:right; font-size:13px;"><span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; font-weight:500;">Awaiting Payment</span></td>
              </tr>
            </table>
            <p>Please proceed to payment to confirm your order.</p>
          `,
          ctaText: "Complete Payment",
          ctaUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/orders`,
          footer: "Thank you for shopping with ShopEasy!",
        }),
      });
      console.log("✅ Order confirmation email sent to:", req.user.email);
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
    }

    res.status(201).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort("-createdAt")
      .populate("items.product", "name images");
    res.status(200).json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("user", "name email");
    if (!order) return res.status(404).json({ success: false, message: "Order not found." });

    const isOwner = order.user._id.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized." });
    }
    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

exports.getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().populate("user", "name email");
    res.status(200).json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id).populate("user", "email name");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const previousStatus = order.status;
    order.status = status;
    await order.save();

    // Send email notification when order is shipped
    if (status === "shipped" && previousStatus !== "shipped") {
      try {
        await sendEmail({
          to: order.user.email,
          subject: "Your Order Has Been Shipped! — ShopEasy",
          html: emailTemplate({
            title: "Order Shipped",
            greeting: `Hi ${order.user.name},`,
            body: `
              <p>Great news! Your order has been shipped and is on its way to you.</p>
              <table style="width:100%; border-collapse:collapse; margin:16px 0;">
                <tr>
                  <td style="padding:8px 0; color:#64748b; font-size:13px;">Order ID</td>
                  <td style="padding:8px 0; text-align:right; font-weight:600; color:#1e293b; font-size:13px; font-family:monospace;">${order._id}</td>
                </tr>
              </table>
              <p>You can track your order status anytime in your account dashboard.</p>
            `,
            ctaText: "Track My Order",
            ctaUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/orders`,
            footer: "Thank you for your patience! — The ShopEasy Team",
          }),
        });
        console.log("✅ Shipped email sent to:", order.user.email);
      } catch (emailError) {
        console.error("Failed to send shipped email:", emailError);
      }
    }

    // Send email when order is delivered
    if (status === "delivered" && previousStatus !== "delivered") {
      try {
        await sendEmail({
          to: order.user.email,
          subject: "Your Order Has Been Delivered! — ShopEasy",
          html: emailTemplate({
            title: "Order Delivered",
            greeting: `Hi ${order.user.name},`,
            body: `
              <p>Your order has been delivered!</p>
              <table style="width:100%; border-collapse:collapse; margin:16px 0;">
                <tr>
                  <td style="padding:8px 0; color:#64748b; font-size:13px;">Order ID</td>
                  <td style="padding:8px 0; text-align:right; font-weight:600; color:#1e293b; font-size:13px; font-family:monospace;">${order._id}</td>
                </tr>
              </table>
              <p>We hope you enjoy your purchase! Your satisfaction is important to us.</p>
              <p>Please share your feedback in the product reviews — your reviews help other customers!</p>
            `,
            ctaText: "Write a Review",
            ctaUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/orders`,
            footer: "Thank you for shopping with ShopEasy!",
          }),
        });
        console.log("✅ Delivered email sent to:", order.user.email);
      } catch (emailError) {
        console.error("Failed to send delivered email:", emailError);
      }
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};