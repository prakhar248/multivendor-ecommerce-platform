// ============================================================
//  components/Navbar.jsx  —  UPDATED: role-aware navigation
// ============================================================
import { Link, useNavigate } from "react-router-dom";
import { useAuth }  from "../context/AuthContext";
import { useCart }  from "../context/CartContext";

const Navbar = () => {
  const { user, logout, isAdmin, isSeller, isApprovedSeller } = useAuth();
  const { cartCount } = useCart();
  const navigate      = useNavigate();

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Brand */}
        <Link to="/" className="text-2xl font-bold text-brand">🛍️ ShopperStop</Link>

        {/* Center links — role-aware */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link to="/"         className="hover:text-brand transition-colors">Home</Link>
          <Link to="/products" className="hover:text-brand transition-colors">Products</Link>
          {isApprovedSeller && (
            <>
              <Link to="/seller" className="hover:text-brand transition-colors text-purple-600">
                My Store
              </Link>
              <Link to="/create-product" className="hover:text-brand transition-colors text-purple-600">
                Add Product
              </Link>
            </>
          )}
          {isAdmin && (
            <Link to="/admin" className="hover:text-brand transition-colors text-amber-600">
              Admin Panel
            </Link>
          )}
        </div>

        {/* Right: Cart + Auth */}
        <div className="flex items-center gap-4">

          {/* Cart — only for customers */}
          {(!user || user.role === "customer") && (
            <Link to="/cart" className="relative">
              <span className="text-2xl">🛒</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-brand text-white text-xs
                                 rounded-full h-5 w-5 flex items-center justify-center font-bold">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              {/* Role badge */}
              <span className={`hidden md:inline-block text-xs font-semibold px-2.5 py-1 rounded-full
                ${isAdmin   ? "bg-amber-100  text-amber-700" :
                  isSeller  ? "bg-purple-100 text-purple-700" :
                              "bg-brand-light text-brand"}`}>
                {isAdmin ? "Admin" : isSeller ? "Seller" : "Customer"}
              </span>

              {/* Addresses link — for customers */}
              {(!isAdmin && !isSeller) && (
                <Link to="/addresses" className="text-sm text-gray-600 hover:text-brand transition-colors hidden md:block">
                  📍 Addresses
                </Link>
              )}

              {/* Profile link */}
              <Link to="/profile" className="flex items-center gap-2 text-sm text-gray-700 hover:text-brand">
                <img src={user.avatar} alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-brand" />
                <span className="hidden md:block font-medium">{user.name.split(" ")[0]}</span>
              </Link>

              <button onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors">
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link to="/login"  className="btn-secondary text-sm py-1.5">Login</Link>
              <Link to="/signup" className="btn-primary  text-sm py-1.5">Sign Up</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
