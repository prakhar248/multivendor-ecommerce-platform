// ============================================================
//  src/pages/PaymentFailed.jsx
//  Dedicated failure page shown after PayU payment fails.
//  Provides retry options and helpful guidance.
// ============================================================

import { Link, useSearchParams } from "react-router-dom";

const PaymentFailed = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const error = searchParams.get("error");

  // Translate error codes to user-friendly messages
  const getErrorMessage = () => {
    switch (error) {
      case "order_not_found":
        return "We couldn't find your order. Please contact support if you were charged.";
      case "missing_fields":
        return "The payment gateway response was incomplete. Please try again.";
      case "server_error":
        return "Our server encountered an issue. Please try again in a moment.";
      default:
        return "Your payment could not be processed. Don't worry — no amount has been deducted.";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 mb-6">
          <svg
            className="w-12 h-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Payment Failed
        </h1>
        <p className="text-gray-500 mb-6">{getErrorMessage()}</p>

        {/* Order Info */}
        {orderId && (
          <div className="bg-red-50 rounded-xl border border-red-200 p-4 mb-6">
            <p className="text-sm text-red-800">
              <strong>Order ID:</strong>{" "}
              <code className="bg-red-100 px-2 py-0.5 rounded text-xs font-mono">
                {orderId}
              </code>
            </p>
            <p className="text-xs text-red-600 mt-2">
              You can retry payment from the My Orders page.
            </p>
          </div>
        )}

        {/* What to do next */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6 text-left">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">
            What can you do?
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-brand mt-0.5">•</span>
              <span>
                <strong>Retry payment</strong> — Go to My Orders and click retry
                with Razorpay or PayU
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand mt-0.5">•</span>
              <span>
                <strong>Try a different method</strong> — Switch between
                Razorpay and PayU
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand mt-0.5">•</span>
              <span>
                <strong>Check your bank</strong> — If money was deducted, it
                will be refunded within 5-7 days
              </span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/orders"
            className="bg-brand text-white font-semibold px-6 py-3 rounded-lg hover:bg-brand-dark transition"
          >
            Go to My Orders
          </Link>
          <Link
            to="/products"
            className="bg-gray-100 text-gray-700 font-semibold px-6 py-3 rounded-lg hover:bg-gray-200 transition"
          >
            Continue Shopping
          </Link>
        </div>

        {/* Support */}
        <p className="text-xs text-gray-400 mt-8">
          Need help? Contact us at{" "}
          <a
            href="mailto:support@shopperstop.com"
            className="text-brand hover:underline"
          >
            support@shopperstop.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentFailed;
