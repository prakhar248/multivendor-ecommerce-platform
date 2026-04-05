// ============================================================
//  utils/payuUtils.js  —  PayU Payment Gateway Utilities
//  Generates hash and payment details for PayU integration
// ============================================================

const crypto = require("crypto");

/**
 * Generate unique transaction ID (txnid)
 * PayU requires: 6-40 alphanumeric characters, no special chars
 * Format: timestamp + random string
 */
const generateTxnId = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  return `TXN${timestamp}${random}`;
};

/**
 * Generate SHA-512 hash for PayU payment
 *
 * Hash String Format:
 * key|txnid|amount|productinfo|firstname|email|||||||||||salt
 *
 * The hash is calculated as SHA-512(hashString)
 *
 * @param {Object} params - Payment parameters
 * @param {string} params.key - PayU Merchant Key
 * @param {string} params.salt - PayU Merchant Salt
 * @param {string} params.txnid - Transaction ID
 * @param {number} params.amount - Amount in rupees
 * @param {string} params.productinfo - Product description
 * @param {string} params.firstname - Customer first name
 * @param {string} params.email - Customer email
 * @returns {string} SHA-512 hash
 */
const generatePayUHash = ({
  key,
  salt,
  txnid,
  amount,
  productinfo,
  firstname,
  email,
}) => {
  // Build hash string with empty pipes for optional fields
  // Format: key|txnid|amount|productinfo|firstname|email|||||||||||salt
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;

  // Generate SHA-512 hash
  const hash = crypto.createHash("sha512").update(hashString).digest("hex");

  console.log("🔐 PayU Hash Generated");
  console.log("   Txn ID:", txnid);
  console.log("   Amount:", amount);
  console.log("   Email:", email);

  return hash;
};

/**
 * Create PayU payment object with all required fields
 *
 * @param {Object} params - Payment parameters
 * @param {Object} params.order - MongoDB Order document
 * @param {number} params.amount - Payment amount in rupees
 * @param {string} params.successUrl - Success callback URL
 * @param {string} params.failureUrl - Failure callback URL
 * @returns {Object} PayU payment object
 */
const createPayUPaymentObject = ({
  order,
  amount,
  successUrl,
  failureUrl,
}) => {
  const key = process.env.PAYU_KEY;
  const salt = process.env.PAYU_SALT;

  // Generate transaction ID
  const txnid = generateTxnId();

  // Extract customer details
  const firstname = order.user?.name?.split(" ")[0] || "Customer";
  const email = order.user?.email || "noreply@shopnow.com";

  // Product info (simplified, can be detailed list)
  const productinfo = `Order ${order._id.toString().slice(-6)} - ${order.items.length} items`;

  // Generate hash
  const hash = generatePayUHash({
    key,
    salt,
    txnid,
    amount: Math.round(amount),
    productinfo,
    firstname,
    email,
  });

  // PayU payment object
  const paymentObject = {
    key,
    txnid,
    amount: Math.round(amount),
    productinfo,
    firstname,
    email,
    hash,
    // Callback URLs (PayU will POST to these after payment)
    surl: successUrl,
    furl: failureUrl,
    // Additional fields (optional but useful)
    lastname: order.user?.name?.split(" ").slice(1).join(" ") || "User",
    address1: order.shippingAddress?.street || "",
    city: order.shippingAddress?.city || "",
    state: order.shippingAddress?.state || "",
    zipcode: order.shippingAddress?.pincode || "",
    phone: order.shippingAddress?.phone || "",
    // Custom fields for tracking
    udf1: order._id.toString(), // Order ID
    udf2: order.user._id.toString(), // User ID
  };

  return paymentObject;
};

/**
 * Verify PayU payment hash (for webhook/callback verification)
 * This is called when PayU sends success/failure callback
 *
 * @param {string} txnid - Transaction ID from PayU
 * @param {string} amount - Amount from PayU
 * @param {string} status - Payment status from PayU
 * @param {string} hash - Hash received from PayU
 * @returns {boolean} Whether hash is valid
 */
const verifyPayUHash = (txnid, amount, status, hash) => {
  const salt = process.env.PAYU_SALT;

  // Build hash string for verification
  // Format for verification: salt|status|udf2|udf1|address2|address1|state|city|zipcode|lastname|firstname|email|phone|productinfo|amount|txnid|key
  // But PayU typically sends: salt|status|...other fields...|amount|txnid|key
  // We'll use the simpler format: salt|status|amount|txnid|key

  const hashString = `${salt}|${status}|${amount}|${txnid}|${process.env.PAYU_KEY}`;
  const expectedHash = crypto.createHash("sha512").update(hashString).digest("hex");

  console.log("🔍 PayU Hash Verification");
  console.log("   Txn ID:", txnid);
  console.log("   Status:", status);
  console.log("   Hash Match:", expectedHash === hash);

  return expectedHash === hash;
};

module.exports = {
  generateTxnId,
  generatePayUHash,
  createPayUPaymentObject,
  verifyPayUHash,
};
