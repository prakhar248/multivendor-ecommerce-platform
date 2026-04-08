// ============================================================
//  src/pages/Orders.jsx — Enhanced order history
//  Features: tracking, payment method badge, retry payment,
//            payment details, order filtering
// ============================================================

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { toast } from "react-toastify";

const STATUS_COLORS = {
  processing:       "bg-yellow-100 text-yellow-700",
  shipped:          "bg-blue-100   text-blue-700",
  out_for_delivery: "bg-purple-100 text-purple-700",
  delivered:        "bg-green-100  text-green-700",
  cancelled:        "bg-red-100    text-red-600",
};

const PAYMENT_COLORS = {
  paid:     "bg-green-100 text-green-700",
  pending:  "bg-orange-100 text-orange-600",
  failed:   "bg-red-100    text-red-600",
  refunded: "bg-gray-100   text-gray-600",
};

const PAYMENT_METHOD_BADGE = {
  razorpay: { label: "Razorpay", icon: "R", color: "bg-blue-50 text-blue-700 border-blue-200" },
  payu:     { label: "PayU",     icon: "P", color: "bg-green-50 text-green-700 border-green-200" },
};

const TRACKING_STEPS = [
  { key: "processing",       label: "Processing",       icon: "1" },
  { key: "shipped",          label: "Shipped",           icon: "2" },
  { key: "out_for_delivery", label: "Out for Delivery",  icon: "3" },
  { key: "delivered",        label: "Delivered",          icon: "4" },
];

const FILTER_OPTIONS = [
  { value: "all",     label: "All Orders" },
  { value: "paid",    label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "failed",  label: "Failed" },
];

// ── Order Tracking Visual ─────────────────────────────────────
const OrderTracking = ({ status }) => {
  const currentIndex = TRACKING_STEPS.findIndex((s) => s.key === status);
  const stepIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
      <p className="text-xs text-gray-500 mb-3 font-semibold">Order Tracking</p>
      <div className="flex items-center justify-between">
        {TRACKING_STEPS.map((step, index) => {
          const isCompleted = index <= stepIndex;
          const isCurrent = index === stepIndex;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2
                transition-colors
                ${isCompleted ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}
                ${isCurrent ? "ring-2 ring-green-300" : ""}
              `}>
                {isCompleted ? "✓" : step.icon}
              </div>
              <p className={`text-xs font-semibold text-center line-clamp-2
                ${isCompleted ? "text-gray-700" : "text-gray-400"}
              `}>
                {step.label}
              </p>
              {index < TRACKING_STEPS.length - 1 && (
                <div className={`
                  h-1 flex-1 mx-0.5 mt-2 rounded
                  ${isCompleted ? "bg-green-500" : "bg-gray-200"}
                `} style={{ minWidth: "20px" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
//  MAIN COMPONENT
// ============================================================
const Orders = () => {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");
  const [retryingOrderId, setRetryingOrderId] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Handle legacy payment return params (in case of direct navigation)
  useEffect(() => {
    const paymentStatus = searchParams.get("paymentStatus");
    if (paymentStatus === "success") {
      toast.success("🎉 Payment successful! Your order is confirmed.");
    } else if (paymentStatus === "failure") {
      toast.error("Payment failed. You can retry from below.");
    }
  }, [searchParams]);

  // Fetch orders
  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await api.get("/orders/my-orders");
      setOrders(data.orders);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  // Retry payment for a failed/pending order
  const handleRetryPayment = async (orderId, method) => {
    setRetryingOrderId(orderId);
    try {
      // Reset order status to pending
      await api.post("/payment/retry", {
        orderId,
        paymentMethod: method,
      });

      // Navigate to checkout-like flow
      // For Razorpay, we can open the popup directly
      if (method === "razorpay") {
        const { data: paymentData } = await api.post("/payment/create-order", { orderId });

        const options = {
          key: paymentData.keyId,
          amount: paymentData.amount,
          currency: paymentData.currency,
          name: "ShopEasy",
          description: `Order #${orderId}`,
          order_id: paymentData.razorpayOrderId,
          handler: async (response) => {
            try {
              await api.post("/payment/verify", {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                orderId,
              });
              toast.success("🎉 Payment successful!");
              fetchOrders(); // Refresh orders
            } catch (verifyErr) {
              toast.error("Payment verification failed");
            }
          },
          theme: { color: "#6C63FF" },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (response) => {
          toast.error(`Payment failed: ${response.error.description}`);
        });
        rzp.open();
      } else if (method === "payu") {
        // For PayU, generate form and redirect
        const { data: paymentResponse } = await api.post("/payment/payu-generate", { orderId });

        if (!paymentResponse.success) {
          throw new Error("Failed to generate PayU payment");
        }

        const paymentData = paymentResponse.paymentData;
        const form = document.createElement("form");
        form.method = "POST";
        form.action = paymentResponse.payuTestUrl;
        form.style.display = "none";

        const fields = {
          key: paymentData.key,
          txnid: paymentData.txnid,
          amount: paymentData.amount,
          productinfo: paymentData.productinfo,
          firstname: paymentData.firstname,
          lastname: paymentData.lastname || "",
          email: paymentData.email,
          phone: paymentData.phone,
          address1: paymentData.address1 || "",
          city: paymentData.city || "",
          state: paymentData.state || "",
          zipcode: paymentData.zipcode || "",
          country: paymentData.country || "India",
          hash: paymentData.hash,
          surl: paymentData.surl,
          furl: paymentData.furl,
          udf1: paymentData.udf1 || "",
          udf2: paymentData.udf2 || "",
          udf3: paymentData.udf3 || "",
          udf4: paymentData.udf4 || "",
          udf5: paymentData.udf5 || "",
          service_provider: paymentData.service_provider || "payu_paisa",
        };

        Object.entries(fields).forEach(([fieldName, fieldValue]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = fieldName;
          input.value = String(fieldValue);
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      }
    } catch (err) {
      console.error("Retry payment error:", err);
      toast.error(err.response?.data?.message || "Failed to retry payment");
    } finally {
      setRetryingOrderId(null);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (filter === "all") return true;
    return order.paymentStatus === filter;
  });

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand" />
    </div>
  );

  if (orders.length === 0) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-6xl mb-4">📦</p>
      <h2 className="text-2xl font-bold text-gray-700 mb-2">No orders yet</h2>
      <p className="text-gray-400 mb-6">Start shopping and your orders will appear here</p>
      <Link to="/products" className="btn-primary">Shop Now</Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-800">My Orders</h1>

        {/* Filter Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                filter === opt.value
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
              {opt.value !== "all" && (
                <span className="ml-1 text-gray-400">
                  ({orders.filter((o) => o.paymentStatus === opt.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No orders match this filter</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => {
            const methodBadge = PAYMENT_METHOD_BADGE[order.paymentMethod] || null;
            const canRetry = order.paymentStatus === "failed" || order.paymentStatus === "pending";
            const isRetrying = retryingOrderId === order._id;

            return (
              <div key={order._id} className="card">
                {/* Order header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Order ID</p>
                    <p className="font-mono text-sm text-gray-700">{order._id}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    {/* Payment Method Badge */}
                    {methodBadge && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${methodBadge.color}`}>
                        {methodBadge.icon} {methodBadge.label}
                      </span>
                    )}
                    {/* Order Status */}
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${STATUS_COLORS[order.status]}`}>
                      {order.status === "out_for_delivery" ? "Out for Delivery" : order.status}
                    </span>
                    {/* Payment Status */}
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${PAYMENT_COLORS[order.paymentStatus]}`}>
                      {order.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Payment Details (for paid orders) */}
                {order.paymentStatus === "paid" && (
                  <div className="bg-green-50 rounded-lg p-3 mb-4 text-sm">
                    <div className="flex flex-wrap gap-4 text-green-800">
                      {order.paidAt && (
                        <span>
                          <strong>Paid on:</strong>{" "}
                          {new Date(order.paidAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      )}
                      {order.razorpayPaymentId && (
                        <span>
                          <strong>Payment ID:</strong>{" "}
                          <code className="bg-green-100 px-1.5 py-0.5 rounded text-xs">
                            {order.razorpayPaymentId}
                          </code>
                        </span>
                      )}
                      {order.payuTxnId && (
                        <span>
                          <strong>Txn ID:</strong>{" "}
                          <code className="bg-green-100 px-1.5 py-0.5 rounded text-xs">
                            {order.payuTxnId}
                          </code>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Retry Payment (for failed/pending orders) */}
                {canRetry && (
                  <div className="bg-red-50 rounded-lg p-4 mb-4 border border-red-100">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-red-800">
                          {order.paymentStatus === "failed" ? "❌ Payment Failed" : "⏳ Payment Pending"}
                        </p>
                        <p className="text-xs text-red-600 mt-0.5">
                          Choose a payment method to retry
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRetryPayment(order._id, "razorpay")}
                          disabled={isRetrying}
                          className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isRetrying ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                          ) : "💳"}
                          Razorpay
                        </button>
                        <button
                          onClick={() => handleRetryPayment(order._id, "payu")}
                          disabled={isRetrying}
                          className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {isRetrying ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                          ) : "🏦"}
                          PayU
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order tracking */}
                {order.status !== "cancelled" && order.paymentStatus === "paid" && (
                  <OrderTracking status={order.status} />
                )}

                {/* Order items */}
                <div className="space-y-3 mb-4">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <img
                        src={item.image || "https://via.placeholder.com/60"}
                        alt={item.name}
                        className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-gray-100"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 line-clamp-1">{item.name}</p>
                        <p className="text-xs text-gray-400">Qty: {item.quantity} × ₹{item.price.toLocaleString()}</p>
                      </div>
                      <p className="font-semibold text-gray-700 text-sm flex-shrink-0">
                        ₹{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Order footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                  </p>
                  <p className="font-bold text-gray-800">
                    Total: <span className="text-brand">₹{order.totalPrice.toLocaleString()}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Orders;
