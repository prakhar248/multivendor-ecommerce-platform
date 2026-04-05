// ============================================================
//  src/pages/Orders.jsx  —  User's order history with tracking
// ============================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

const STATUS_COLORS = {
  processing: "bg-yellow-100 text-yellow-700",
  shipped:    "bg-blue-100   text-blue-700",
  out_for_delivery: "bg-purple-100 text-purple-700",
  delivered:  "bg-green-100  text-green-700",
  cancelled:  "bg-red-100    text-red-600",
};

const PAYMENT_COLORS = {
  paid:    "bg-green-100 text-green-700",
  pending: "bg-orange-100 text-orange-600",
  failed:  "bg-red-100    text-red-600",
};

// Order tracking steps
const TRACKING_STEPS = [
  { key: "processing", label: "Processing", icon: "📋" },
  { key: "shipped", label: "Shipped", icon: "📦" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "🚚" },
  { key: "delivered", label: "Delivered", icon: "✅" },
];

// Component to show order tracking progress
const OrderTracking = ({ status }) => {
  const getStepIndex = () => {
    const index = TRACKING_STEPS.findIndex(step => step.key === status);
    return index >= 0 ? index : 0;
  };

  const currentStepIndex = getStepIndex();

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
      <p className="text-xs text-gray-500 mb-3 font-semibold">Order Tracking</p>
      
      {/* Visual progress bar */}
      <div className="flex items-center justify-between mb-4">
        {TRACKING_STEPS.map((step, index) => {
          const isCompleted = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          
          return (
            <div key={step.key} className="flex flex-col items-center flex-1">
              {/* Step circle */}
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2
                transition-colors
                ${isCompleted ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"}
                ${isCurrent ? "ring-2 ring-green-300" : ""}
              `}>
                {isCompleted ? "✓" : step.icon}
              </div>
              
              {/* Step label */}
              <p className={`text-xs font-semibold text-center line-clamp-2
                ${isCompleted ? "text-gray-700" : "text-gray-400"}
              `}>
                {step.label}
              </p>

              {/* Connecting line */}
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

      {/* Status text */}
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700 capitalize">
          {TRACKING_STEPS[currentStepIndex]?.label}
        </p>
      </div>
    </div>
  );
};

const Orders = () => {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await api.get("/orders/my-orders");
        setOrders(data.orders);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

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
      <h1 className="text-3xl font-bold text-gray-800 mb-8">My Orders</h1>

      <div className="space-y-5">
        {orders.map((order) => (
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
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${STATUS_COLORS[order.status]}`}>
                  {order.status === "out_for_delivery" ? "Out for Delivery" : order.status}
                </span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${PAYMENT_COLORS[order.paymentStatus]}`}>
                  {order.paymentStatus}
                </span>
              </div>
            </div>

            {/* Order tracking progress */}
            {order.status !== "cancelled" && <OrderTracking status={order.status} />}

            {/* Order items */}
            <div className="space-y-3 mb-4">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <img
                    src={item.image || "https://via.placeholder.com/60"}
                    alt={item.name}
                    className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
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
              <div className="flex items-center gap-4">
                <p className="font-bold text-gray-800">
                  Total: <span className="text-brand">₹{order.totalPrice.toLocaleString()}</span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;
