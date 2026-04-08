// ============================================================
//  src/pages/PaymentFailed.jsx — Clean failure state
// ============================================================
import { Link, useSearchParams } from "react-router-dom";
import { XCircle, Package, ArrowRight, RefreshCcw, CreditCard, AlertTriangle } from "lucide-react";

const PaymentFailed = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const error = searchParams.get("error");

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
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center animate-fade-in">

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-red-50 mx-auto mb-6 flex items-center justify-center">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
        <p className="text-gray-500 text-sm mb-6">{getErrorMessage()}</p>

        {/* Order Info */}
        {orderId && (
          <div className="card mb-6 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-gray-700">
                  <span className="text-gray-500">Order ID:</span>{" "}
                  <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">{orderId}</code>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  You can retry payment from the My Orders page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Help */}
        <div className="card mb-6 text-left">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">What can you do?</h3>
          <ul className="space-y-2.5 text-sm text-gray-600">
            <li className="flex items-start gap-2.5">
              <RefreshCcw className="w-4 h-4 text-brand mt-0.5 shrink-0" />
              <span><strong>Retry payment</strong> — Go to My Orders and click retry</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CreditCard className="w-4 h-4 text-brand mt-0.5 shrink-0" />
              <span><strong>Try a different method</strong> — Switch between Razorpay and PayU</span>
            </li>
            <li className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-brand mt-0.5 shrink-0" />
              <span><strong>Check your bank</strong> — If money was deducted, it will be refunded within 5-7 days</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/orders" className="btn-primary">
            <Package className="w-4 h-4" /> Go to My Orders
          </Link>
          <Link to="/products" className="btn-secondary">
            Continue Shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-8">
          Need help? Contact us at{" "}
          <a href="mailto:support@shopeasy.com" className="text-brand hover:underline">
            support@shopeasy.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentFailed;
