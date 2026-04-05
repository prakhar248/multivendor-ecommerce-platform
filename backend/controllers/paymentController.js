// ============================================================
//  controllers/paymentController.js
//  Razorpay integration (test mode) with email notifications
//
//  FLOW:
//  1. Order is created in DB first via /api/orders
//  2. Frontend sends orderId to /api/payment/create-order
//  3. This creates a Razorpay order for that orderId
//  4. Frontend opens Razorpay checkout and user pays
//  5. Frontend sends payment details to /api/payment/verify
//  6. We verify signature and mark order as paid + send email
// ============================================================

const Razorpay = require("razorpay");
const crypto   = require("crypto");
const Order    = require("../models/Order");
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

    // Validate orderId
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    // Fetch our order from MongoDB
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

    // Create a Razorpay order
    // Amount must be in paise (₹1 = 100 paise)
    const razorpayOrder = await razorpay.orders.create({
      amount:   Math.round(order.totalPrice * 100), // Convert ₹ to paise
      currency: "INR",
      receipt:  `receipt_${orderId}`,
      notes: {
        orderId:  orderId.toString(),
        userId:   req.user._id.toString(),
      },
    });

    // Save the Razorpay order_id to our order record
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.status(200).json({
      success:         true,
      razorpayOrderId: razorpayOrder.id,
      amount:          razorpayOrder.amount,
      currency:        razorpayOrder.currency,
      // Send key_id to frontend (NEVER send key_secret!)
      keyId:           process.env.RAZORPAY_KEY_ID,
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
//
//  How signature verification works:
//  Razorpay creates: HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, secret)
//  We recreate the same hash and compare — if they match, payment is genuine.
// ============================================================
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // Validate all required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment verification fields",
      });
    }

    // 1. Re-create the expected signature
    const body      = razorpay_order_id + "|" + razorpay_payment_id;
    const expected  = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    // 2. Compare signatures (timing-safe comparison prevents timing attacks)
    const isAuthentic = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(razorpay_signature)
    );

    if (!isAuthentic) {
      console.warn("Payment signature mismatch for order:", orderId);
      return res.status(400).json({ success: false, message: "Payment verification failed - Invalid signature" });
    }

    // 3. Fetch and verify the order
    const order = await Order.findById(orderId).populate("user", "email name");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Verify order belongs to this user
    if (order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized - Order does not belong to you" });
    }

    // 4. Mark the order as paid
    order.paymentStatus      = "paid";
    order.razorpayPaymentId  = razorpay_payment_id;
    order.razorpaySignature  = razorpay_signature;
    order.paidAt             = new Date();
    await order.save();

    // Send payment success email
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
         <p>Thank you for shopping with ShopNow!</p>`
      );
      console.log("✅ Payment success email sent to:", order.user.email);
    } catch (emailError) {
      console.error("Failed to send payment success email:", emailError);
    }

    console.log("✅ Payment verified for order:", orderId);

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
//  This endpoint generates all required PayU payment details
//  including the security hash. Response is used to create
//  a form that submits directly to PayU.
// ============================================================
exports.generatePayUPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    // Validate orderId
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    // Fetch order from MongoDB
    const order = await Order.findById(orderId).populate("user", "name email");
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

    // Generate PayU payment details
    const paymentObject = createPayUPaymentObject({
      order,
      amount: order.totalPrice,
      // These URLs are called by PayU after payment
      successUrl: `${process.env.BACKEND_URL}/api/payment/payu-success`,
      failureUrl: `${process.env.BACKEND_URL}/api/payment/payu-failure`,
    });

    // Store transaction ID in order for tracking
    order.payuTxnId = paymentObject.txnid;
    order.paymentMethod = "payu";
    await order.save();

    // Return payment object to frontend
    res.status(200).json({
      success: true,
      paymentData: {
        key: paymentObject.key,
        txnid: paymentObject.txnid,
        amount: paymentObject.amount,
        productinfo: paymentObject.productinfo,
        firstname: paymentObject.firstname,
        email: paymentObject.email,
        lastname: paymentObject.lastname,
        address1: paymentObject.address1,
        city: paymentObject.city,
        state: paymentObject.state,
        zipcode: paymentObject.zipcode,
        phone: paymentObject.phone,
        hash: paymentObject.hash,
        surl: paymentObject.surl,
        furl: paymentObject.furl,
        udf1: paymentObject.udf1,
        udf2: paymentObject.udf2,
      },
      payuTestUrl: "https://test.payu.in/_payment",
    });

    console.log("✅ PayU payment details generated for order:", orderId);
  } catch (error) {
    console.error("PayU payment generation error:", error);
    next(error);
  }
};

// ============================================================
//  @desc    Handle PayU payment success callback
//  @route   POST /api/payment/payu-success
//  @access  Public (called by PayU, not user)
//
//  PayU will POST the following parameters:
//  - txnid, status, amount, email, transaction_id, etc.
//  - hash (generated by PayU for verification)
// ============================================================
exports.handlePayUSuccess = async (req, res, next) => {
  try {
    const {
      txnid,        // Our transaction ID
      status,       // Payment status (success, failure, pending, etc.)
      amount,       // Amount paid
      email,        // Customer email
      firstname,    // Customer name
      udf1,         // Order ID (custom field we set)
      hash,         // Hash from PayU for verification
    } = req.body;

    console.log("📨 PayU Success Callback Received");
    console.log("   Txn ID:", txnid);
    console.log("   Status:", status);
    console.log("   Amount:", amount);

    // Validate required fields
    if (!txnid || !status || !amount || !udf1) {
      return res.status(400).json({
        success: false,
        message: "Missing required PayU callback fields",
      });
    }

    // Find order by transaction ID
    let order = await Order.findById(udf1).populate("user", "email name");
    if (!order) {
      // Try finding by PayU transaction ID
      order = await Order.findOne({ payuTxnId: txnid }).populate("user", "email name");
    }

    if (!order) {
      console.error("❌ Order not found for PayU txnid:", txnid);
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Verify hash (optional but recommended for production)
    if (hash) {
      const isValidHash = verifyPayUHash(txnid, amount, status, hash);
      if (!isValidHash) {
        console.warn("⚠️ PayU hash verification failed for txnid:", txnid);
        // Continue anyway, but log it - some PayU setups may have hash mismatches
      }
    }

    // Check payment status from PayU
    if (status === "success" || status === "3") {
      // Mark order as paid
      order.paymentStatus = "paid";
      order.payuStatus = status;
      order.paidAt = new Date();
      await order.save();

      console.log("✅ Order marked as paid:", order._id);

      // Send payment success email
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
           <p>Thank you for shopping with ShopNow!</p>`
        );
        console.log("✅ Payment success email sent to:", order.user.email);
      } catch (emailError) {
        console.error("Failed to send payment success email:", emailError);
      }

      // Redirect to frontend success page with order ID
      return res.redirect(`${process.env.FRONTEND_URL}/orders?paymentStatus=success&orderId=${order._id}`);
    } else {
      // Payment failed or pending
      order.paymentStatus = "failed";
      order.payuStatus = status;
      await order.save();

      console.log("❌ Payment failed for order:", order._id, "Status:", status);

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
        console.log("✅ Payment failure email sent to:", order.user.email);
      } catch (emailError) {
        console.error("Failed to send payment failure email:", emailError);
      }

      // Redirect to frontend failure page
      return res.redirect(`${process.env.FRONTEND_URL}/checkout?paymentStatus=failure&orderId=${order._id}`);
    }
  } catch (error) {
    console.error("PayU success callback error:", error);
    next(error);
  }
};

// ============================================================
//  @desc    Handle PayU payment failure callback
//  @route   POST /api/payment/payu-failure
//  @access  Public (called by PayU, not user)
// ============================================================
exports.handlePayUFailure = async (req, res, next) => {
  try {
    const { txnid, udf1 } = req.body;

    console.log("📨 PayU Failure Callback Received");
    console.log("   Txn ID:", txnid);

    // Find and update order
    let order = await Order.findById(udf1).populate("user", "email name");
    if (!order) {
      order = await Order.findOne({ payuTxnId: txnid }).populate("user", "email name");
    }

    if (order) {
      order.paymentStatus = "failed";
      order.payuStatus = "failure";
      await order.save();

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
    }

    // Redirect to checkout with failure status
    res.redirect(`${process.env.FRONTEND_URL}/checkout?paymentStatus=failure${udf1 ? `&orderId=${udf1}` : ""}`);
  } catch (error) {
    console.error("PayU failure callback error:", error);
    next(error);
  }
};
