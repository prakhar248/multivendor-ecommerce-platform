// ============================================================
//  src/pages/Cart.jsx
//  Shows cart items with quantity controls + Save for Later
// ============================================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import api from "../api/axios";

const Cart = () => {
  const { cart, loading, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user }    = useAuth();
  const navigate    = useNavigate();
  const [savedItems, setSavedItems] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const items       = cart?.items || [];
  const totalPrice  = items.reduce((acc, i) => acc + i.priceAtAdd * i.quantity, 0);
  const shipping    = totalPrice > 500 ? 0 : 50;
  const tax         = Math.round(totalPrice * 0.18);
  const grandTotal  = totalPrice + shipping + tax;

  // Fetch saved for later items
  useEffect(() => {
    const fetchSavedItems = async () => {
      try {
        setLoadingSaved(true);
        const { data } = await api.get("/cart/saved-for-later");
        setSavedItems(data.savedForLater || []);
      } catch (err) {
        console.error("Failed to fetch saved items:", err);
      } finally {
        setLoadingSaved(false);
      }
    };
    if (user) fetchSavedItems();
  }, [user]);

  // Save item for later
  const handleSaveForLater = async (productId) => {
    try {
      await api.post(`/cart/save-for-later/${productId}`);
      toast.success("Item saved for later");
      // Refresh saved items
      const { data } = await api.get("/cart/saved-for-later");
      setSavedItems(data.savedForLater || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save item");
    }
  };

  // Move saved item to cart
  const handleMoveToCart = async (productId) => {
    try {
      const { data } = await api.post(`/cart/move-to-cart/${productId}`);
      toast.success("Item moved to cart");
      // Refresh saved items
      const response = await api.get("/cart/saved-for-later");
      setSavedItems(response.data.savedForLater || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to move item");
    }
  };

  // Remove saved item
  const handleRemoveSavedItem = async (productId) => {
    try {
      await api.delete(`/cart/remove-saved/${productId}`);
      toast.info("Item removed");
      setSavedItems(savedItems.filter(item => item.product._id !== productId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove item");
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand" />
    </div>
  );

  // Show saved items if cart is empty but have saved items
  if (items.length === 0 && savedItems.length === 0) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="text-6xl mb-4">🛒</p>
      <h2 className="text-2xl font-bold text-gray-700 mb-2">Your cart is empty</h2>
      <p className="text-gray-400 mb-6">Add some products to get started</p>
      <Link to="/products" className="btn-primary">Browse Products</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Shopping Cart</h1>

      <div className="grid md:grid-cols-3 gap-8">

        {/* ── Cart Items ─────────────────────────────────── */}
        <div className="md:col-span-2 space-y-4">
          {items.length > 0 && (
            <>
              <h2 className="font-bold text-gray-800 text-lg">Cart Items</h2>
              {items.map((item) => (
                <div key={item._id} className="card flex gap-4">
                  {/* Product image */}
                  <Link to={`/products/${item.product._id}`}>
                    {(() => {
                      // Handle images that can be either strings or {url, publicId} objects
                      const imageUrl = typeof item.product.images?.[0] === "string"
                        ? item.product.images[0]
                        : item.product.images?.[0]?.url || "https://via.placeholder.com/100";
                      return (
                        <img
                          src={imageUrl}
                          alt={item.product.name}
                          className="w-24 h-24 object-cover rounded-xl flex-shrink-0"
                        />
                      );
                    })()}
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <Link to={`/products/${item.product._id}`}
                      className="font-semibold text-gray-800 hover:text-brand line-clamp-2 text-sm">
                      {item.product.name}
                    </Link>
                    <p className="text-brand font-bold text-lg mt-1">₹{item.priceAtAdd.toLocaleString()}</p>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden text-sm">
                        <button
                          onClick={() => updateQuantity(item.product._id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="px-3 py-1 hover:bg-gray-100 disabled:opacity-40 font-bold"
                        >−</button>
                        <span className="px-3 py-1 border-x border-gray-300 font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product._id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="px-3 py-1 hover:bg-gray-100 disabled:opacity-40 font-bold"
                        >+</button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product._id)}
                        className="text-red-400 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>

                      <button
                        onClick={() => handleSaveForLater(item.product._id)}
                        className="text-blue-400 hover:text-blue-600 text-sm"
                      >
                        💾 Save for Later
                      </button>
                    </div>
                  </div>

                  {/* Line total */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-800">
                      ₹{(item.priceAtAdd * item.quantity).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}

              <button onClick={clearCart} className="text-sm text-red-400 hover:text-red-600">
                🗑️ Clear Cart
              </button>
            </>
          )}

          {/* ── Saved for Later Section ────────────────────── */}
          {savedItems.length > 0 && (
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h2 className="font-bold text-gray-800 text-lg mb-4">
                💾 Saved for Later ({savedItems.length})
              </h2>
              <div className="space-y-3">
                {savedItems.map((saved) => (
                  <div key={saved.product._id} className="card flex gap-4">
                    {/* Product image */}
                    <Link to={`/products/${saved.product._id}`}>
                      {(() => {
                        const imageUrl = typeof saved.product.images?.[0] === "string"
                          ? saved.product.images[0]
                          : saved.product.images?.[0]?.url || "https://via.placeholder.com/100";
                        return (
                          <img
                            src={imageUrl}
                            alt={saved.product.name}
                            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                          />
                        );
                      })()}
                    </Link>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <Link to={`/products/${saved.product._id}`}
                        className="font-semibold text-gray-800 hover:text-brand line-clamp-2 text-sm">
                        {saved.product.name}
                      </Link>
                      <p className="text-brand font-bold mt-1">
                        ₹{(saved.product.discountedPrice || saved.product.price).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Qty: {saved.quantity}
                      </p>

                      {/* Action buttons */}
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => handleMoveToCart(saved.product._id)}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          Move to Cart
                        </button>
                        <button
                          onClick={() => handleRemoveSavedItem(saved.product._id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Order Summary ──────────────────────────────– */}
        {items.length > 0 && (
          <div className="card h-fit sticky top-24">
            <h2 className="font-bold text-gray-800 text-lg mb-4">Order Summary</h2>

            <div className="space-y-3 text-sm border-b border-gray-100 pb-4 mb-4">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">₹{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className={shipping === 0 ? "text-green-600 font-medium" : "font-medium"}>
                  {shipping === 0 ? "FREE" : `₹${shipping}`}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>GST (18%)</span>
                <span className="font-medium">₹{tax.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-between font-bold text-gray-800 text-lg mb-6">
              <span>Total</span>
              <span className="text-brand">₹{grandTotal.toLocaleString()}</span>
            </div>

            {totalPrice > 0 && totalPrice <= 500 && (
              <p className="text-xs text-center text-gray-400 mb-3">
                Add ₹{(500 - totalPrice).toFixed(0)} more for free shipping!
              </p>
            )}

            <button
              onClick={() => navigate("/checkout")}
              className="btn-primary w-full py-3 text-base"
            >
              Proceed to Checkout →
            </button>

            <Link to="/products" className="btn-secondary w-full py-2.5 text-sm text-center block mt-3">
              Continue Shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
