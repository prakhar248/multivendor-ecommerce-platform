// ============================================================
//  components/Navbar.jsx — Clean sticky nav with mobile menu
// ============================================================
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import {
  ShoppingCart,
  User,
  LogOut,
  Menu,
  X,
  Store,
  PlusCircle,
  Shield,
  MapPin,
  Package,
  Home,
  Search,
} from "lucide-react";

const Navbar = () => {
  const { user, logout, isAdmin, isSeller, isApprovedSeller } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setMobileOpen(false);
  };

  const closeMobile = () => setMobileOpen(false);

  const NavLink = ({ to, children, className = "" }) => (
    <Link
      to={to}
      onClick={closeMobile}
      className={`text-sm font-medium text-gray-600 hover:text-brand transition-colors ${className}`}
    >
      {children}
    </Link>
  );

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 shadow-nav">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 text-xl font-bold text-brand shrink-0">
          <ShoppingCart className="w-6 h-6" />
          ShopEasy
        </Link>

        {/* Center Nav — Desktop */}
        <div className="hidden md:flex items-center gap-6 mx-8">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/products">Products</NavLink>
          {isApprovedSeller && (
            <>
              <NavLink to="/seller" className="text-purple-600 hover:text-purple-700">
                <span className="inline-flex items-center gap-1"><Store className="w-3.5 h-3.5" /> My Store</span>
              </NavLink>
              <NavLink to="/create-product" className="text-purple-600 hover:text-purple-700">
                <span className="inline-flex items-center gap-1"><PlusCircle className="w-3.5 h-3.5" /> Add Product</span>
              </NavLink>
            </>
          )}
          {isAdmin && (
            <NavLink to="/admin" className="text-amber-600 hover:text-amber-700">
              <span className="inline-flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Admin</span>
            </NavLink>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">

          {/* Cart — customers only */}
          {(!user || user.role === "customer") && (
            <Link to="/cart" className="relative p-2 text-gray-600 hover:text-brand transition-colors">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-brand text-white text-[10px]
                                 rounded-full h-4.5 w-4.5 min-w-[18px] flex items-center justify-center font-bold leading-none px-1">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          )}

          {user ? (
            <div className="hidden md:flex items-center gap-3">
              {/* Role badge */}
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                ${isAdmin  ? "bg-amber-50 text-amber-700 border border-amber-200"
                : isSeller ? "bg-purple-50 text-purple-700 border border-purple-200"
                :            "bg-brand-light text-brand border border-brand/20"}`}>
                {isAdmin ? "Admin" : isSeller ? "Seller" : "Customer"}
              </span>

              {/* Addresses — customers only */}
              {(!isAdmin && !isSeller) && (
                <Link to="/addresses" className="p-2 text-gray-500 hover:text-brand transition-colors" title="Addresses">
                  <MapPin className="w-4.5 h-4.5" />
                </Link>
              )}

              {/* Orders — customers only */}
              {(!isAdmin && !isSeller) && (
                <Link to="/orders" className="p-2 text-gray-500 hover:text-brand transition-colors" title="My Orders">
                  <Package className="w-4.5 h-4.5" />
                </Link>
              )}

              {/* Profile */}
              <Link to="/profile" className="flex items-center gap-2 text-sm text-gray-700 hover:text-brand transition-colors">
                <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center">
                  <User className="w-4 h-4 text-brand" />
                </div>
                <span className="font-medium">{user.name.split(" ")[0]}</span>
              </Link>

              <button onClick={handleLogout}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Logout">
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          ) : (
            <div className="hidden md:flex gap-2">
              <Link to="/login"  className="btn-secondary py-2 px-4 text-sm">Log in</Link>
              <Link to="/signup" className="btn-primary py-2 px-4 text-sm">Sign up</Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 text-gray-600 hover:text-brand">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white animate-fade-in">
          <div className="px-4 py-4 space-y-1">
            <MobileLink to="/" icon={<Home className="w-4 h-4" />} onClick={closeMobile}>Home</MobileLink>
            <MobileLink to="/products" icon={<Search className="w-4 h-4" />} onClick={closeMobile}>Products</MobileLink>

            {user && (!isAdmin && !isSeller) && (
              <>
                <MobileLink to="/orders" icon={<Package className="w-4 h-4" />} onClick={closeMobile}>My Orders</MobileLink>
                <MobileLink to="/addresses" icon={<MapPin className="w-4 h-4" />} onClick={closeMobile}>Addresses</MobileLink>
              </>
            )}

            {isApprovedSeller && (
              <>
                <MobileLink to="/seller" icon={<Store className="w-4 h-4" />} onClick={closeMobile}>My Store</MobileLink>
                <MobileLink to="/create-product" icon={<PlusCircle className="w-4 h-4" />} onClick={closeMobile}>Add Product</MobileLink>
              </>
            )}

            {isAdmin && (
              <MobileLink to="/admin" icon={<Shield className="w-4 h-4" />} onClick={closeMobile}>Admin Panel</MobileLink>
            )}

            <div className="border-t border-gray-100 pt-3 mt-3">
              {user ? (
                <div className="flex items-center justify-between">
                  <Link to="/profile" onClick={closeMobile} className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <User className="w-4 h-4" />
                    {user.name}
                  </Link>
                  <button onClick={handleLogout} className="text-sm text-red-500 font-medium">Logout</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Link to="/login"  onClick={closeMobile} className="btn-secondary flex-1 text-center py-2 text-sm">Log in</Link>
                  <Link to="/signup" onClick={closeMobile} className="btn-primary flex-1 text-center py-2 text-sm">Sign up</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

const MobileLink = ({ to, icon, onClick, children }) => (
  <Link to={to} onClick={onClick}
        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
    <span className="text-gray-400">{icon}</span>
    {children}
  </Link>
);

export default Navbar;
