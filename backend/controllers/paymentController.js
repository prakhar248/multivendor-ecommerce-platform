// ============================================================
//  controllers/paymentController.js
//  Dual payment gateway: Razorpay + PayU (test mode)
//
//  RAZORPAY FLOW:
//  1. Order created in DB via /api/orders
//  2. Frontend sends orderId → /api/payment/create-order
//  3. Creates Razorpay order, frontend opens checkout popup
//  4. Frontend sends payment details → /api/payment/verify
//  5. Verify signature, mark order paid, send email
//
//  PAYU FLOW:
//  1. Order created in DB via /api/orders
//  2. Frontend sends orderId → /api/payment/payu-generate
//  3. Backend generates hash + payment object
//  4. Frontend creates hidden form, submits to PayU
//  5. PayU redirects to surl/furl after payment
//  6. Backend verifies hash, marks order paid, redirects to frontend
// ============================================================

const Razorpay = require("razorpay");
const crypto   = require("crypto");
const Order    = require("../models/Order");
const Product  = require("../models/Product");
const Cart     = require("../models/Cart");
const sendEmail = require("../utils/sendEmail");
const { createPayUPaymentObject, verifyPayUHash } = require("../utils/payuUtils");

// Initialize Razorpay with test keys from .env
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ============================================================
//  @desc    Create a Razorpay order for an existing order
//  @route   POST /api/payment/create-order
//  @access  Private
// ============================================================
exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Verify order belongs to this user
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized - Order does not belong to you" });
    }

    // Check if order is already paid
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Order already paid" });
    }

    // Create a Razorpay order (amount in paise: ₹1 = 100 paise)
    const razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(order.totalPrice * 100),
      currency: "INR",
      receipt:  `receipt_${orderId}`,
      notes: {
        orderId:  orderId.toString(),
        userId:   req.user._id.toString(),
      },
    });

    // Save the Razorpay order_id to our order record
    order.razorpayOrderId = razorpayOrder.id;
    order.paymentMethod = "razorpay";
    await order.save();

    res.status(200).json({
      success:         true,
      razorpayOrderId: razorpayOrder.id,
      amount:          razorpayOrder.amount,
      currency:        razorpayOrder.currency,
      keyId:           process.env.RAZORPAY_KEY_ID,  // NEVER send key_secret!
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    next(error);
  }
};

// ============================================================
//  @desc    Verify Razorpay payment signature
//  @route   POST /api/payment/verify
//  @access  Private
// ============================================================
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment verification fields",
      });
    }

    // Re-create the expected signature
    const body      = razorpay_order_id + "|" + razorpay_payment_id;
    const expected  = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    // Timing-safe comparison prevents timing attacks
    const isAuthentic = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(razorpay_signature)
    );

    if (!isAuthentic) {
      console.warn("Payment signature mismatch for order:", orderId);
      return res.status(400).json({ success: false, message: "Payment verification failed - Invalid signature" });
    }

    // Fetch and verify the order
    const order = await Order.findById(orderId).populate("user", "email name");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized - Order does not belong to you" });
    }

    // Mark the order as paid
    order.paymentStatus      = "paid";
    order.paymentMethod      = "razorpay";
    order.razorpayPaymentId  = razorpay_payment_id;
    order.razorpaySignature  = razorpay_signature;
    order.paidAt             = new Date();
    await order.save();

    // ── DECREMENT STOCK (only after confirmed payment) ──────────────
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity, countInStock: -item.quantity },
      });
    }
    console.log("✅ Stock decremented for", order.items.length, "items after Razorpay payment");

    // Send payment success email (non-blocking)
    try {
      await sendEmail(
        order.user.email,
        "Payment Successful - Order Confirmed! ✅",
        `<p>Hi ${order.user.name},</p>
         <p>Your payment has been received and confirmed!</p>
         <p><strong>Order ID:</strong> ${order._id}</p>
         <p><strong>Amount Paid:</strong> ₹${order.totalPrice}</p>
         <p><strong>Payment ID:</strong> ${razorpay_payment_id}</p>
         <br/>
         <p>Your order is now confirmed and will be processed by our team.</p>
         <p>You will receive a shipping notification once your items are dispatched.</p>
         <br/>
         <p>Thank you for shopping with ShopperStop!</p>`
      );
      console.log("✅ Payment success email sent to:", order.user.email);
    } catch (emailError) {
      console.error("Failed to send payment success email:", emailError);
    }

    console.log("✅ Razorpay payment verified for order:", orderId);

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    next(error);
  }
};

// ============================================================
//  @desc    Generate PayU payment object with hash
//  @route   POST /api/payment/payu-generate
//  @access  Private
//
//  Returns all fields needed to create a hidden form that
//  submits directly to PayU's payment gateway.
// ============================================================
exports.generatePayUPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    // Fetch order with populated user data
    const order = await Order.findById(orderId).populate("user", "name email phone");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Verify order belongs to this user
    if (order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized - Order does not belong to you" });
    }

    // Check if order is already paid
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Order already paid" });
    }

    // Generate PayU payment details (hash, formatted amount, etc.)
    const paymentObject = createPayUPaymentObject({
      order,
      amount: order.totalPrice,
      successUrl: `${process.env.BACKEND_URL}/api/payment/payu-success`,
      failureUrl: `${process.env.BACKEND_URL}/api/payment/payu-failure`,
    });

    // Store transaction ID and payment method in order for tracking
    order.payuTxnId = paymentObject.txnid;
    order.paymentMethod = "payu";
    await order.save();

    // Return ALL fields needed for the PayU form
    // Spread the entire paymentObject — this guarantees no field is missed or mistyped
    res.status(200).json({
      success: true,
      paymentData: paymentObject,
      payuTestUrl: "https://test.payu.in/_payment",
    });

    console.log("✅ PayU payment details generated for order:", orderId);
    console.log("   PayU test URL: https://test.payu.in/_payment");
    console.log("   surl:", paymentObject.surl);
    console.log("   furl:", paymentObject.furl);
  } catch (error) {
    console.error("PayU payment generation error:", error);
    next(error);
  }
};

// ============================================================
//  @desc    Handle PayU payment success callback
//  @route   POST /api/payment/payu-success
//  @access  Public (called by PayU via browser redirect)
//
//  PayU redirects the browser here with POST data including:
//  txnid, status, amount, email, firstname, hash, udf1-5, etc.
// ============================================================
exports.handlePayUSuccess = async (req, res, next) => {
  try {
    // ── DEBUG: Full PayU response dump ────────────────────────
    console.log("\n" + "=".repeat(60));
    console.log("📨 PayU SUCCESS CALLBACK RECEIVED");
    console.log("=".repeat(60));
    console.log("   Method:", req.method);
    console.log("   PayU FULL BODY:", JSON.stringify(req.body, null, 2));
    console.log("   PayU FULL QUERY:", JSON.stringify(req.query, null, 2));

    // Support BOTH GET and POST — PayU may redirect with either method
    const data = req.body && Object.keys(req.body).length > 0 ? req.body : req.query;

    const {
      txnid,
      status,
      amount,
      email,
      firstname,
      udf1,         // Order ID (custom field we set)
      hash,
      mihpayid,     // PayU's internal payment ID
      mode,         // Payment mode (CC, DC, NB, etc.)
      error_Message,
    } = data;

    console.log("   ── Parsed Fields ──");
    console.log("   PayU STATUS:", status);
    console.log("   Txn ID:", txnid);
    console.log("   PayU Payment ID (mihpayid):", mihpayid);
    console.log("   Amount:", amount);
    console.log("   Mode:", mode);
    console.log("   UDF1 (orderId):", udf1);
    console.log("   Error Message:", error_Message || "none");
    console.log("=".repeat(60) + "\n");

    // Validate required fields
    if (!txnid || !status || !amount || !udf1) {
      console.error("❌ PayU callback missing fields:", { txnid, status, amount, udf1 });
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=missing_fields`);
    }

    // Find order — first by udf1 (order ID), then by PayU txn ID
    let order = await Order.findById(udf1).populate("user", "email name");
    if (!order) {
      order = await Order.findOne({ payuTxnId: txnid }).populate("user", "email name");
    }

    if (!order) {
      console.error("❌ Order not found for PayU txnid:", txnid, "udf1:", udf1);
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=order_not_found`);
    }

    // Verify hash using the correct reverse hash format
    if (hash) {
      const isValidHash = verifyPayUHash(data);
      if (!isValidHash) {
        console.warn("⚠️ PayU hash verification failed for txnid:", txnid);
        // In test mode, log but continue — in production, you should reject
      } else {
        console.log("✅ PayU hash verification passed");
      }
    }

    // ── DECISION: Check data.status (source of truth, NOT PayU UI) ──
    if (status === "success") {
      // Mark order as paid
      order.paymentStatus = "paid";
      order.payuStatus = status;
      order.payuTxnId = txnid;
      order.paidAt = new Date();
      await order.save();

      // ── DECREMENT STOCK (only after confirmed payment) ──────────────
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity, countInStock: -item.quantity },
        });
      }
      console.log("✅ Stock decremented for", order.items.length, "items after PayU payment");

      console.log("✅ ORDER CONFIRMED AS PAID:", order._id);

      // Clear user's cart server-side (since PayU redirects lose frontend state)
      try {
        const cart = await Cart.findOne({ user: order.user._id });
        if (cart && cart.items.length > 0) {
          cart.items = [];
          await cart.save();
          console.log("✅ Cart cleared server-side for user:", order.user._id);
        }
      } catch (cartError) {
        console.error("Failed to clear cart:", cartError);
      }

      // Send payment success email (non-blocking)
      try {
        await sendEmail(
          order.user.email,
          "Payment Successful - Order Confirmed! ✅",
          `<p>Hi ${order.user.name},</p>
           <p>Your payment has been received and confirmed via PayU!</p>
           <p><strong>Order ID:</strong> ${order._id}</p>
           <p><strong>Amount Paid:</strong> ₹${order.totalPrice}</p>
           <p><strong>Transaction ID:</strong> ${txnid}</p>
           <br/>
           <p>Your order is now confirmed and will be processed by our team.</p>
           <p>You will receive a shipping notification once your items are dispatched.</p>
           <br/>
           <p>Thank you for shopping with ShopperStop!</p>`
        );
        console.log("✅ Payment success email sent to:", order.user.email);
      } catch (emailError) {
        console.error("Failed to send payment success email:", emailError);
      }

      // Redirect to dedicated frontend success page
      return res.redirect(`${process.env.FRONTEND_URL}/payment-success?orderId=${order._id}`);
    } else {
      // Payment failed or pending — status is NOT "success"
      order.paymentStatus = "failed";
      order.payuStatus = status;
      order.payuTxnId = txnid;
      await order.save();

      console.log("❌ Payment NOT successful for order:", order._id, "PayU status:", status);

      // Send failure notification email
      try {
        await sendEmail(
          order.user.email,
          "Payment Failed - Please Try Again ❌",
          `<p>Hi ${order.user.name},</p>
           <p>Unfortunately, your payment could not be processed.</p>
           <p><strong>Order ID:</strong> ${order._id}</p>
           <p><strong>Amount:</strong> ₹${order.totalPrice}</p>
           <br/>
           <p>Please try again or contact our support team if you need assistance.</p>`
        );
      } catch (emailError) {
        console.error("Failed to send payment failure email:", emailError);
      }

      // Redirect to dedicated frontend failure page
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?orderId=${order._id}`);
    }
  } catch (error) {
    console.error("PayU success callback CRASH error:", error);
    // Always redirect to frontend, even on error
    return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=server_error`);
  }
};

// ============================================================
//  @desc    Handle PayU payment failure callback
//  @route   POST /api/payment/payu-failure
//  @access  Public (called by PayU via browser redirect)
// ============================================================
exports.handlePayUFailure = async (req, res, next) => {
  try {
    // ── DEBUG: Full PayU response dump ────────────────────────
    console.log("\n" + "=".repeat(60));
    console.log("📨 PayU FAILURE CALLBACK RECEIVED");
    console.log("=".repeat(60));
    console.log("   Method:", req.method);
    console.log("   PayU FULL BODY:", JSON.stringify(req.body, null, 2));
    console.log("   PayU FULL QUERY:", JSON.stringify(req.query, null, 2));

    // Support BOTH GET and POST — PayU may redirect with either method
    const data = req.body && Object.keys(req.body).length > 0 ? req.body : req.query;
    const { txnid, udf1, status, error_Message } = data;

    console.log("   ── Parsed Fields ──");
    console.log("   PayU STATUS:", status);
    console.log("   Txn ID:", txnid);
    console.log("   UDF1 (orderId):", udf1);
    console.log("   Error Message:", error_Message || "none");
    console.log("=".repeat(60) + "\n");

    // ── IMPORTANT: PayU sandbox sometimes routes success to furl ──
    // Check data.status — if it says "success", treat it as success
    // regardless of which endpoint PayU redirected to.
    if (status === "success") {
      console.log("⚠️ PayU sent status=success to FAILURE URL (sandbox quirk)");
      console.log("   Routing to success handler instead...");
      return exports.handlePayUSuccess(req, res, next);
    }

    // Find and update order
    let order = null;
    if (udf1) {
      order = await Order.findById(udf1).populate("user", "email name");
    }
    if (!order && txnid) {
      order = await Order.findOne({ payuTxnId: txnid }).populate("user", "email name");
    }

    if (order) {
      order.paymentStatus = "failed";
      order.payuStatus = status || "failure";
      order.payuTxnId = txnid || order.payuTxnId;
      await order.save();

      console.log("❌ ORDER MARKED AS FAILED:", order._id, "PayU status:", status);

      // Send failure email
      try {
        await sendEmail(
          order.user.email,
          "Payment Failed - Please Try Again ❌",
          `<p>Hi ${order.user.name},</p>
           <p>Unfortunately, your payment could not be processed via PayU.</p>
           <p><strong>Order ID:</strong> ${order._id}</p>
           <p><strong>Amount:</strong> ₹${order.totalPrice}</p>
           <br/>
           <p>Please try again or use a different payment method.</p>`
        );
      } catch (emailError) {
        console.error("Failed to send payment failure email:", emailError);
      }
    } else {
      console.error("❌ Order not found for failure callback. txnid:", txnid, "udf1:", udf1);
    }

    // Redirect to dedicated frontend failure page
    res.redirect(`${process.env.FRONTEND_URL}/payment-failed${udf1 ? `?orderId=${udf1}` : ""}`);
  } catch (error) {
    console.error("PayU failure callback CRASH error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=server_error`);
  }
};

// ============================================================
//  @desc    Retry payment for a failed/pending order
//  @route   POST /api/payment/retry
//  @access  Private
//
//  Allows user to retry payment on an order that failed or
//  is still pending. Returns paymentMethod so frontend knows
//  which gateway to use.
// ============================================================
exports.retryPayment = async (req, res, next) => {
  try {
    const { orderId, paymentMethod } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    const order = await Order.findById(orderId).populate("user", "name email phone");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Verify order belongs to this user
    if (order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Only allow retry for failed or pending orders
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Order already paid" });
    }

    // Reset payment status to pending for retry
    order.paymentStatus = "pending";
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    }
    await order.save();

    console.log("🔄 Payment retry initiated for order:", orderId, "method:", paymentMethod || order.paymentMethod);

    res.status(200).json({
      success: true,
      message: "Order ready for payment retry",
      order: {
        _id: order._id,
        totalPrice: order.totalPrice,
        paymentMethod: paymentMethod || order.paymentMethod || "razorpay",
      },
    });
  } catch (error) {
    console.error("Retry payment error:", error);
    next(error);
  }
};
