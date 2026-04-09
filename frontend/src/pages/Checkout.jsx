// ============================================================
//  src/pages/Checkout.jsx — Enhanced Checkout with Dual Payment
//  Step 0: Select/Add address
//  Step 1: Review order + Select payment method
//  Step 2: Processing payment
//
//  Supports: Razorpay (popup) and PayU (redirect)
// ============================================================

import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import addressService from "../services/addressService";
import AddressForm from "../components/AddressForm";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

const STEPS = ["Address", "Review", "Payment"];

const Checkout = () => {
  const { cart, clearCart } = useCart();
  const { user }            = useAuth();
  const navigate            = useNavigate();
  const location            = useLocation();
  const [searchParams]      = useSearchParams();
  const buyNowItem          = location.state?.buyNowItem;

  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [deliveryType, setDeliveryType] = useState("normal"); // NEW: Delivery type selection
  const [payuRedirecting, setPayuRedirecting] = useState(false);

  // Address management
  const [savedAddresses, setSavedAddresses]   = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [formData, setFormData] = useState({
    name:    user?.name    || "",
    phone:   user?.phone   || "",
    street:  "",
    city:    "",
    state:   "",
    pincode: "",
  });

  // Determine items: buyNowItem (from navigation state) or cart
  const items = buyNowItem
    ? [buyNowItem]
    : cart?.items || [];

  // Price calculation — handles both Buy Now and Cart items
  const itemsPrice = items.reduce((acc, item) => {
    const price = Number(item.price || item.priceAtAdd || item.product?.price || 0);
    const qty = Number(item.quantity || item.qty || 1);
    return acc + (price * qty);
  }, 0);

  // Calculate shipping price based on order amount and delivery type
  // Order >= ₹500: Free delivery (standard), ₹99 for express
  // Order < ₹500: ₹100 delivery (standard), ₹199 for express
  const shipping = itemsPrice >= 500
    ? (deliveryType === "express" ? 99 : 0)
    : (deliveryType === "express" ? 199 : 100);

  const tax        = Math.round(itemsPrice * 0.18);
  const grandTotal = itemsPrice + shipping + tax;

  // Handle PayU return params (user comes back from PayU redirect)
  useEffect(() => {
    const paymentStatus = searchParams.get("paymentStatus");
    const returnOrderId = searchParams.get("orderId");

    if (paymentStatus === "failure" && returnOrderId) {
      toast.error("Payment failed. You can retry from My Orders page.");
    }
  }, [searchParams]);

  // Fetch saved addresses on mount
  useEffect(() => {
    fetchSavedAddresses();
  }, []);

  const fetchSavedAddresses = async () => {
    try {
      const data = await addressService.getAddresses();
      setSavedAddresses(data.addresses || []);

      if (data.addresses.length > 0) {
        const defaultAddr = data.addresses.find((a) => a.isDefault);
        setSelectedAddressId(defaultAddr?._id || data.addresses[0]._id);
        setShowAddressForm(false);
      } else {
        setShowAddressForm(true);
        setSelectedAddressId(null);
      }
    } catch (err) {
      console.error("Error fetching addresses:", err);
      setShowAddressForm(true);
      toast.error("Failed to load addresses");
    }
  };

  // Get current address object
  const getCurrentAddress = () => {
    if (selectedAddressId) {
      const addr = savedAddresses.find((a) => a._id === selectedAddressId);
      if (addr) {
        return {
          name:    addr.name,
          street:  addr.street,
          city:    addr.city,
          state:   addr.state,
          pincode: addr.pincode,
          phone:   addr.phone,
        };
      }
    }
    return formData;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Save address directly from checkout
  const handleSaveAddressFromCheckout = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.street || !formData.city || !formData.state || !formData.pincode) {
      return toast.error("Please fill all address fields");
    }

    setSavingAddress(true);
    try {
      const response = await addressService.addAddress({
        ...formData,
        label: "home",
        isDefault: savedAddresses.length === 0,
      });

      if (!response.address || !response.address._id) {
        throw new Error("Address saved but missing ID in response");
      }

      toast.success("Address saved successfully!");
      await fetchSavedAddresses();
      setSelectedAddressId(response.address._id);
      setShowAddressForm(false);
      setFormData({
        name:    user?.name || "",
        phone:   user?.phone || "",
        street:  "",
        city:    "",
        state:   "",
        pincode: "",
      });
    } catch (err) {
      console.error("Error saving address:", err?.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to save address");
    } finally {
      setSavingAddress(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name:    user?.name || "",
      phone:   user?.phone || "",
      street:  "",
      city:    "",
      state:   "",
      pincode: "",
    });
    setShowAddressForm(false);
  };

  // Step 0 → Step 1: Validate address selection
  const handleAddressSubmit = (e) => {
    e.preventDefault();
    if (!selectedAddressId) {
      return toast.error("Please select or add an address to continue");
    }
    if (!buyNowItem && (!cart?.items || cart.items.length === 0)) {
      return toast.error("Your cart is empty. Please add items or use Buy Now.");
    }
    setStep(1);
  };

  // ── Consolidated Payment Flow ────────────────────────────────────
  const handlePayNow = async () => {
    if (!items || items.length === 0) {
      toast.error("No items to checkout.");
      return;
    }

    setLoading(true);
    try {
      const shippingAddress = getCurrentAddress();

      // Build order items with proper structure
      const orderItems = items.map((item) => {
        const itemPrice = Number(item.price || item.priceAtAdd || item.product?.price || 0);
        const itemQty = Number(item.quantity || item.qty || 1);
        const itemImage =
          item.image ||
          (typeof item.product?.images?.[0] === "string" ? item.product.images[0] : item.product?.images?.[0]?.url) ||
          item.product?.images?.[0] ||
          "";

        return {
          product: item._id || item.product?._id || item.product,
          name: item.name || item.product?.name || "Product",
          image: itemImage,
          price: itemPrice,
          quantity: itemQty,
        };
      });

      const orderPayload = {
        shippingAddress,
        orderItems,
        itemsPrice:    Number(itemsPrice) || 0,
        shippingPrice: Number(shipping) || 0,
        taxPrice:      Number(tax) || 0,
        totalPrice:    Number(grandTotal) || 0,
        deliveryType,  // NEW: Include customer's delivery preference
      };

      // Step 1: Create order in MongoDB
      const { data: orderData } = await api.post("/orders", orderPayload);
      const createdOrder = orderData.order;

      if (!createdOrder || !createdOrder._id) {
        throw new Error("Order creation failed - Missing order ID");
      }

      setOrderId(createdOrder._id);

      // Route based on selected payment method
      if (paymentMethod === "payu") {
        await handlePayUPayment(createdOrder._id);
      } else {
        await handleRazorpayPayment(createdOrder._id);
      }
    } catch (err) {
      console.error("Payment flow error:", err?.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  // ── Razorpay Payment Handler ────────────────────────────────────
  const handleRazorpayPayment = async (createdOrderId) => {
    try {
      const { data: paymentData } = await api.post("/payment/create-order", {
        orderId: createdOrderId,
      });

      const shippingAddress = getCurrentAddress();

      const options = {
        key: paymentData.keyId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        name: "ShopEasy",
        description: `Order #${createdOrderId}`,
        order_id: paymentData.razorpayOrderId,

        handler: async (response) => {
          try {
            await api.post("/payment/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId: createdOrderId,
            });

            // Clear cart after successful payment
            if (!buyNowItem) {
              clearCart();
            }

            toast.success("🎉 Payment successful! Your order is confirmed.");
            navigate("/orders");
          } catch (verifyErr) {
            console.error("Payment verification failed:", verifyErr);
            toast.error("Payment verification failed. Please contact support.");
          }
        },

        prefill: {
          name: user.name,
          email: user.email,
          contact: shippingAddress.phone,
        },

        theme: { color: "#6C63FF" },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (response) => {
        console.error("Payment failed:", response.error);
        toast.error(`Payment failed: ${response.error.description}`);
      });

      rzp.open();
    } catch (err) {
      console.error("Razorpay payment error:", err?.response?.data || err.message);
      throw err;
    }
  };

  // ── PayU Payment Handler ────────────────────────────────────
  const handlePayUPayment = async (createdOrderId) => {
    try {
      setPayuRedirecting(true);

      const { data: paymentResponse } = await api.post("/payment/payu-generate", {
        orderId: createdOrderId,
      });

      if (!paymentResponse.success || !paymentResponse.paymentData) {
        throw new Error("Failed to generate PayU payment form");
      }

      const paymentData = paymentResponse.paymentData;
      const payuTestUrl = paymentResponse.payuTestUrl;

      // NOTE: Do NOT clear cart here. PayU redirects away from frontend,
      // and if payment fails the user should keep their cart.
      // Cart is cleared server-side in handlePayUSuccess callback,
      // and the PaymentSuccess page syncs the frontend state.

      // Create hidden form and submit to PayU gateway
      const form = document.createElement("form");
      form.method = "POST";
      form.action = payuTestUrl;
      form.style.display = "none";

      // CRITICAL: Use EXACT values from backend — do NOT modify hash-critical fields
      // These fields MUST match what was used in hash generation on the backend:
      // key, txnid, amount, productinfo, firstname, email, udf1-5
      const fields = {
        key:              paymentData.key,
        txnid:            paymentData.txnid,
        amount:           paymentData.amount,       // Already "299.00" from backend
        productinfo:      paymentData.productinfo,  // Already cleaned on backend
        firstname:        paymentData.firstname,    // Already cleaned on backend
        email:            paymentData.email,         // Already cleaned on backend
        phone:            paymentData.phone,
        lastname:         paymentData.lastname || "",
        hash:             paymentData.hash,
        surl:             paymentData.surl,
        furl:             paymentData.furl,
        service_provider: paymentData.service_provider,
        udf1:             paymentData.udf1,         // Already set on backend
        udf2:             paymentData.udf2,         // Already set on backend
        udf3:             paymentData.udf3,         // Already set on backend
        udf4:             paymentData.udf4,         // Already set on backend
        udf5:             paymentData.udf5,         // Already set on backend
        address1:         paymentData.address1 || "",
        city:             paymentData.city || "",
        state:            paymentData.state || "",
        zipcode:          paymentData.zipcode || "",
        country:          paymentData.country || "India",
      };

      // Create hidden input for each field — use value exactly, never "undefined"
      Object.entries(fields).forEach(([fieldName, fieldValue]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = fieldName;
        input.value = fieldValue != null ? String(fieldValue) : "";
        form.appendChild(input);
      });

      document.body.appendChild(form);

      console.log("✅ PayU form created — submitting to:", payuTestUrl);
      console.log("📦 FULL FORM PAYLOAD:");
      Object.entries(fields).forEach(([k, v]) => {
        console.log(`   ${k}: "${v}"`);
      });


      // Submit form — this redirects the browser to PayU
      form.submit();

    } catch (err) {
      setPayuRedirecting(false);
      console.error("PayU payment error:", err?.response?.data || err.message);
      throw err;
    }
  };

  const currentAddress = getCurrentAddress();
  const isBuyNow = !!buyNowItem;

  // ── PayU Redirect Overlay ────────────────────────────────────
  if (payuRedirecting) {
    return (
      <div className="fixed inset-0 bg-white/95 z-50 flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-green-100">
            <svg className="w-10 h-10 text-green-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Redirecting to PayU...</h2>
          <p className="text-gray-500 mb-4">You will be securely redirected to PayU's payment gateway.</p>
          <p className="text-sm text-gray-400">Do not close this window or press the back button.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Checkout</h1>
      </div>

      {/* Progress bar */}
      <div className="flex items-center mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
              ${i <= step ? "bg-brand text-white" : "bg-gray-200 text-gray-400"}`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`ml-2 text-sm font-medium ${i <= step ? "text-brand" : "text-gray-400"}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${i < step ? "bg-brand" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Shipping Address ───────────────────── */}
      {step === 0 && (
        <form onSubmit={handleAddressSubmit} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-gray-800 text-lg">Shipping Address</h2>
            {isBuyNow && <span className="text-xs text-gray-500">Step 1 of 2</span>}
          </div>

          {/* No addresses yet */}
          {savedAddresses.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-900">
                📍 <strong>No saved addresses yet.</strong> Please add one to continue with checkout.
              </p>
            </div>
          )}

          {/* Saved Addresses */}
          {savedAddresses.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Your Saved Addresses</h3>
              <div className="space-y-2 mb-4">
                {savedAddresses.map((addr) => (
                  <label
                    key={addr._id}
                    className={`block p-4 border-2 rounded-lg cursor-pointer transition ${
                      selectedAddressId === addr._id && !showAddressForm
                        ? "border-brand bg-brand-light"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="address"
                        value={addr._id}
                        checked={selectedAddressId === addr._id && !showAddressForm}
                        onChange={() => {
                          setSelectedAddressId(addr._id);
                          setShowAddressForm(false);
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">{addr.name}</p>
                          {addr.isDefault && (
                            <span className="text-xs font-semibold text-brand bg-brand-light px-2 py-0.5 rounded">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{addr.street}</p>
                        <p className="text-sm text-gray-600">
                          {addr.city}, {addr.state} {addr.pincode}
                        </p>
                        <p className="text-sm text-gray-600 font-medium mt-1">📞 {addr.phone}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {!showAddressForm && (
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="text-brand hover:text-brand-dark font-medium text-sm mb-4"
                >
                  + Add a Different Address
                </button>
              )}
            </div>
          )}

          {/* Address Form */}
          {showAddressForm && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">
                  {savedAddresses.length === 0 ? "Add Address to Continue" : "Add New Address"}
                </h3>
                {savedAddresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddressForm(false);
                      resetForm();
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                )}
              </div>

              <AddressForm
                formData={formData}
                onInputChange={handleInputChange}
                onSubmit={handleSaveAddressFromCheckout}
                onCancel={resetForm}
                loading={savingAddress}
                submitLabel={savingAddress ? "Saving..." : "Save & Use This Address"}
                showCancel={savedAddresses.length > 0}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedAddressId}
            className="w-full bg-brand text-white font-semibold py-3 rounded-lg hover:bg-brand-dark transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {selectedAddressId ? "Continue to Review →" : "Please Select or Add an Address"}
          </button>
        </form>
      )}

      {/* ── STEP 1: Review Order + Payment Method ──────────── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Payment Method Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4 text-lg">Choose Payment Method</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Razorpay Option */}
              <label
                id="payment-method-razorpay"
                className={`flex flex-col items-center p-5 border-2 rounded-xl cursor-pointer transition-all ${
                  paymentMethod === "razorpay"
                    ? "border-brand bg-brand-light shadow-md ring-2 ring-brand/30"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="razorpay"
                  checked={paymentMethod === "razorpay"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="sr-only"
                />
                <span className="text-3xl mb-2">💳</span>
                <p className="font-bold text-gray-900 text-base">Razorpay</p>
                <p className="text-xs text-gray-500 mt-1 text-center">Fast & secure popup checkout</p>
                {paymentMethod === "razorpay" && (
                  <span className="mt-2 text-xs font-semibold text-brand bg-white px-3 py-1 rounded-full border border-brand/30">
                    ✓ Selected
                  </span>
                )}
              </label>

              {/* PayU Option */}
              <label
                id="payment-method-payu"
                className={`flex flex-col items-center p-5 border-2 rounded-xl cursor-pointer transition-all ${
                  paymentMethod === "payu"
                    ? "border-green-500 bg-green-50 shadow-md ring-2 ring-green-500/30"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="payu"
                  checked={paymentMethod === "payu"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="sr-only"
                />
                <span className="text-3xl mb-2">🏦</span>
                <p className="font-bold text-gray-900 text-base">PayU</p>
                <p className="text-xs text-gray-500 mt-1 text-center">Trusted Indian payment gateway</p>
                {paymentMethod === "payu" && (
                  <span className="mt-2 text-xs font-semibold text-green-700 bg-white px-3 py-1 rounded-full border border-green-500/30">
                    ✓ Selected
                  </span>
                )}
              </label>
            </div>

            {/* Payment method info */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              {paymentMethod === "razorpay" ? (
                <p className="text-xs text-gray-600">
                  💡 Razorpay opens a secure popup — you stay on this page during payment.
                </p>
              ) : (
                <p className="text-xs text-gray-600">
                  💡 PayU will redirect you to a secure payment page. After payment, you'll return to ShopEasy automatically.
                </p>
              )}
            </div>
          </div>

          {/* Delivery Type Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4 text-lg">Choose Delivery Speed</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Normal Delivery Option */}
              <label
                className={`block p-5 border-2 rounded-xl cursor-pointer transition-all ${
                  deliveryType === "normal"
                    ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-500/30"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                <input
                  type="radio"
                  name="deliveryType"
                  value="normal"
                  checked={deliveryType === "normal"}
                  onChange={(e) => setDeliveryType(e.target.value)}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 flex items-center gap-2">
                      <span className="text-xl">🚚</span> Normal Delivery (5-6 days)
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      Shipped after 24 hours → Out for delivery in 2 days → Delivered in 2 hours
                    </p>
                    <p className="text-sm font-semibold text-blue-600 mt-2">FREE</p>
                  </div>
                  {deliveryType === "normal" && (
                    <span className="text-blue-600 text-lg">✓</span>
                  )}
                </div>
              </label>

              {/* Express Delivery Option */}
              <label
                className={`block p-5 border-2 rounded-xl cursor-pointer transition-all ${
                  deliveryType === "express"
                    ? "border-orange-500 bg-orange-50 shadow-md ring-2 ring-orange-500/30"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                }`}
              >
                <input
                  type="radio"
                  name="deliveryType"
                  value="express"
                  checked={deliveryType === "express"}
                  onChange={(e) => setDeliveryType(e.target.value)}
                  className="sr-only"
                />
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 flex items-center gap-2">
                      <span className="text-xl">⚡</span> Express Delivery (2-3 days)
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      Shipped after 12 hours → Out for delivery in 1 day → Delivered in 1 hour
                    </p>
                    <p className="text-sm font-semibold text-orange-600 mt-2">+₹99</p>
                  </div>
                  {deliveryType === "express" && (
                    <span className="text-orange-600 text-lg">✓</span>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Order Review */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4 text-lg">Order Review</h2>
            <div className="space-y-3">
              {items.map((item, i) => {
                const product = item.product || item;
                const displayName = product?.name || item?.name || "Product";
                const imageUrl = typeof product?.images?.[0] === "string"
                  ? product.images[0]
                  : product?.images?.[0]?.url || item?.image || "";
                const displayPrice = Number(item.priceAtAdd || item.price || product?.price || 0);
                const displayQty = Number(item.quantity || item.qty || 1);

                return (
                  <div key={i} className="flex items-center gap-3">
                    {imageUrl && (
                      <img src={imageUrl} alt={displayName}
                        className="w-14 h-14 object-cover rounded-lg border border-gray-100" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 line-clamp-1">{displayName}</p>
                      <p className="text-xs text-gray-400">Qty: {displayQty}</p>
                    </div>
                    <p className="font-semibold text-sm text-gray-800">
                      ₹{(displayPrice * displayQty).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Price breakdown */}
            <div className="border-t border-gray-100 mt-4 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>₹{itemsPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Shipping</span><span>{shipping === 0 ? "FREE" : `₹${shipping}`}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>GST 18%</span><span>₹{tax}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-800 text-base pt-2 border-t border-gray-200">
                <span>Total</span><span className="text-brand">₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Delivery Address Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-sm text-gray-600">
            <h3 className="font-semibold text-gray-800 mb-2">Delivering to:</h3>
            <p><strong>{currentAddress.name}</strong></p>
            <p>{currentAddress.street}</p>
            <p>{currentAddress.city}, {currentAddress.state} {currentAddress.pincode}</p>
            <p className="font-semibold mt-2">📞 {currentAddress.phone}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="flex-1 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition">
              ← Back
            </button>
            <button
              id="pay-now-button"
              onClick={handlePayNow}
              disabled={loading || items.length === 0}
              className={`flex-1 py-3 font-semibold rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed text-white ${
                paymentMethod === "payu"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-brand hover:bg-brand-dark"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Processing...
                </span>
              ) : (
                `Pay ₹${grandTotal.toLocaleString()} with ${paymentMethod === "payu" ? "PayU" : "Razorpay"}`
              )}
            </button>
          </div>

          {/* Test Card / UPI Info */}
          <div className={`rounded-xl p-4 mt-2 text-sm space-y-2 border ${
            paymentMethod === "razorpay"
              ? "bg-brand-light border-brand/20 text-brand-dark"
              : "bg-green-50 border-green-200 text-green-900"
          }`}>
            {paymentMethod === "razorpay" ? (
              <>
                <p className="font-semibold">🧪 Razorpay Test Mode — Indian Cards & UPI</p>
                <p>Visa: <code className="bg-white/60 px-2 py-0.5 rounded font-mono text-xs">4111 1111 1111 1111</code></p>
                <p>Mastercard: <code className="bg-white/60 px-2 py-0.5 rounded font-mono text-xs">5267 3181 8797 5449</code></p>
                <p>Expiry: Any future date &bull; CVV: Any 3 digits</p>
                <p>UPI (success): <code className="bg-white/60 px-2 py-0.5 rounded font-mono text-xs">success@razorpay</code></p>
                <p>UPI (failure): <code className="bg-white/60 px-2 py-0.5 rounded font-mono text-xs">failure@razorpay</code></p>
                <p className="text-xs opacity-80 mt-1">
                  ⚠️ DO NOT use international cards — use Indian test cards above. OTP: any 4+ digit number = success, below 4 digits = failure.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">🧪 PayU Test Mode</p>
                <p>Card: <code className="bg-white/60 px-2 py-0.5 rounded font-mono text-xs">5123 4567 8901 2346</code></p>
                <p>Expiry: Any future date &bull; CVV: <code className="bg-white/60 px-2 py-0.5 rounded font-mono text-xs">123</code></p>
                <p className="text-xs opacity-80 mt-1">
                  ℹ️ You'll be redirected to PayU's secure checkout page.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;
