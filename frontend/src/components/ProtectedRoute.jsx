// ============================================================
//  components/ProtectedRoute.jsx  —  UPDATED for 3 roles
//  Props:
//    adminOnly    → only role: "admin"
//    sellerOnly   → only role: "seller" (approved)
//    customerOnly → only role: "customer"
// ============================================================
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Spinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand" />
  </div>
);

const ProtectedRoute = ({
  children,
  adminOnly    = false,
  sellerOnly   = false,
  customerOnly = false,
}) => {
  const { user, sellerProfile, loading } = useAuth();

  if (loading) return <Spinner />;

  // Not logged in
  if (!user) return <Navigate to="/login" replace />;

  // Email verification check
  if (!user.isEmailVerified) return <Navigate to={`/verify-otp?email=${encodeURIComponent(user.email)}`} replace />;

  // Admin-only check
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;

  // Seller-only check — must be a seller AND approved
  if (sellerOnly) {
    if (user.role !== "seller") return <Navigate to="/" replace />;
    // Seller exists but not approved yet — show pending screen
    if (!sellerProfile?.isApproved) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
          <p className="text-5xl mb-4">⏳</p>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Pending Approval</h2>
          <p className="text-gray-500 max-w-md">
            Your seller account is under review. Our admin team will approve it shortly.
            You will be able to list products once approved.
          </p>
        </div>
      );
    }
  }

  // Customer-only check (sellers/admins shouldn't access customer-only pages)
  if (customerOnly && user.role !== "customer") return <Navigate to="/" replace />;

  return children;
};

export default ProtectedRoute;
