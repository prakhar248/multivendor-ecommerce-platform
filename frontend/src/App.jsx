// ============================================================
//  App.jsx  —  UPDATED: seller route + role-based redirects
// ============================================================
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider }  from "./context/AuthContext";
import { CartProvider }  from "./context/CartContext";
import Navbar            from "./components/Navbar";
import ProtectedRoute    from "./components/ProtectedRoute";

import Home             from "./pages/Home";
import Products         from "./pages/Products";
import ProductDetail    from "./pages/ProductDetail";
import Cart             from "./pages/Cart";
import Auth             from "./pages/Auth";
import Checkout         from "./pages/Checkout";
import Orders           from "./pages/Orders";
import Profile          from "./pages/Profile";
import SellerDashboard  from "./pages/SellerDashboard";
import AdminDashboard   from "./pages/AdminDashboard";
import CreateProduct    from "./pages/CreateProduct";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <ToastContainer position="top-right" autoClose={3000} />
          <Navbar />

          <Routes>
            {/* ── Public ──────────────────────────── */}
            <Route path="/"              element={<Home />}          />
            <Route path="/products"      element={<Products />}      />
            <Route path="/products/:id"  element={<ProductDetail />} />
            <Route path="/login"         element={<Auth mode="login" />}  />
            <Route path="/signup"        element={<Auth mode="signup" />} />

            {/* ── Customer-only ───────────────────── */}
            <Route path="/cart"     element={<ProtectedRoute><Cart /></ProtectedRoute>}         />
            <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>}     />
            <Route path="/orders"   element={<ProtectedRoute><Orders /></ProtectedRoute>}       />
            <Route path="/profile"  element={<ProtectedRoute><Profile /></ProtectedRoute>}      />

            {/* ── Seller Dashboard ─────────────────── */}
            {/* ProtectedRoute with sellerOnly shows pending screen if not approved */}
            <Route path="/seller" element={
              <ProtectedRoute sellerOnly>
                <SellerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/seller/create-product" element={
              <ProtectedRoute sellerOnly>
                <CreateProduct />
              </ProtectedRoute>
            } />

            {/* ── Admin Dashboard ──────────────────── */}
            <Route path="/admin" element={
              <ProtectedRoute adminOnly>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* 404 */}
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
                <p className="text-8xl mb-4">🤔</p>
                <h1 className="text-4xl font-bold text-gray-700 mb-2">404</h1>
                <p className="text-gray-400 mb-6">This page does not exist.</p>
                <a href="/" className="btn-primary">Go Home</a>
              </div>
            } />
          </Routes>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
