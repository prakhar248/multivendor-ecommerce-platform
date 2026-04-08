// ============================================================
//  utils/deliveryUtils.js — Delivery tracking calculations
// ============================================================

/**
 * Calculate expected delivery dates based on payment time and delivery type
 * 
 * NORMAL DELIVERY:
 *   - Shipped: 24 hours after payment
 *   - Out for Delivery: 2 days after shipped (+2 days)
 *   - Delivered: 2 hours after out for delivery (+2 hours)
 * 
 * EXPRESS DELIVERY:
 *   - Shipped: 12 hours after payment
 *   - Out for Delivery: 1 day after shipped (+1 day)
 *   - Delivered: 1 hour after out for delivery (+1 hour)
 */
exports.calculateDeliveryDates = (paidAt, deliveryType = "normal") => {
  if (!paidAt) {
    throw new Error("paidAt date is required");
  }

  const baseTime = new Date(paidAt);
  let shippedAfterHours, outForDeliveryAfterDays, deliveredAfterHours;

  if (deliveryType === "express") {
    shippedAfterHours = 12;
    outForDeliveryAfterDays = 1;
    deliveredAfterHours = 1;
  } else {
    // normal
    shippedAfterHours = 24;
    outForDeliveryAfterDays = 2;
    deliveredAfterHours = 2;
  }

  // Calculate expected shipped time
  const expectedShippedAt = new Date(baseTime);
  expectedShippedAt.setHours(expectedShippedAt.getHours() + shippedAfterHours);

  // Calculate expected out for delivery time
  const expectedOutForDeliveryAt = new Date(expectedShippedAt);
  expectedOutForDeliveryAt.setDate(expectedOutForDeliveryAt.getDate() + outForDeliveryAfterDays);

  // Calculate expected delivered time
  const expectedDeliveredAt = new Date(expectedOutForDeliveryAt);
  expectedDeliveredAt.setHours(expectedDeliveredAt.getHours() + deliveredAfterHours);

  return {
    expectedShippedAt,
    expectedOutForDeliveryAt,
    expectedDeliveredAt,
  };
};

/**
 * Automatically update order status based on current time vs expected dates
 * This is useful for simulating delivery progress (e.g., for demo/testing)
 * In production, this would be triggered by actual shipping/delivery events
 */
exports.getOrderStatusByTime = (order) => {
  const now = new Date();

  if (order.status === "cancelled" || order.deliveredAt) {
    return order.status; // Cancelled or already delivered, don't change
  }

  // If delivered, keep as delivered
  if (order.expectedDeliveredAt && now >= order.expectedDeliveredAt) {
    return "delivered";
  }

  // If out for delivery
  if (order.expectedOutForDeliveryAt && now >= order.expectedOutForDeliveryAt) {
    return "out_for_delivery";
  }

  // If shipped
  if (order.expectedShippedAt && now >= order.expectedShippedAt) {
    return "shipped";
  }

  // Still processing
  return "processing";
};

/**
 * Get delivery timeline for display
 */
exports.getDeliveryTimeline = (order) => {
  const timeline = [
    {
      stage: "processing",
      label: "Processing",
      time: order.createdAt,
    },
    {
      stage: "shipped",
      label: "Shipped",
      expectedTime: order.expectedShippedAt,
      actualTime: order.shippedAt,
    },
    {
      stage: "out_for_delivery",
      label: "Out for Delivery",
      expectedTime: order.expectedOutForDeliveryAt,
      actualTime: order.outForDeliveryAt,
    },
    {
      stage: "delivered",
      label: "Delivered",
      expectedTime: order.expectedDeliveredAt,
      actualTime: order.deliveredAt,
    },
  ];

  return timeline;
};
