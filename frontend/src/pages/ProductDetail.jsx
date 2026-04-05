// ============================================================
//  src/pages/ProductDetail.jsx
//  Shows full product details, image gallery, reviews, add-to-cart, buy now
// ============================================================

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

const ProductDetail = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { addToCart } = useCart();
  const { user }      = useAuth();

  const [product,   setProduct]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [qty,       setQty]       = useState(1);
  const [rating,    setRating]    = useState(5);
  const [comment,   setComment]   = useState("");
  const [canReview, setCanReview] = useState(false);
  const [showZoom,  setShowZoom]  = useState(false);

  // ✅ ALL HOOKS AT TOP LEVEL (BEFORE ANY RETURNS)
  // Direct DOM refs for zero-lag zoom (no React re-renders)
  const lensRef = useRef(null);
  const zoomRef = useRef(null);
  const rafIdRef = useRef(null);
  const rectRef = useRef(null);

  // ✅ DERIVE imageUrl EARLY (BEFORE useEffect THAT USES IT)
  // Safety check: fallback to empty string if no image
  const imageUrl = typeof product?.images?.[activeImg] === "string"
    ? product?.images?.[activeImg]
    : product?.images?.[activeImg]?.url || "";
  
  console.log("📸 Image URL:", imageUrl);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get(`/products/${id}`);
        setProduct(data.product);
      } catch {
        navigate("/products");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  // Check if user has purchased this product
  useEffect(() => {
    const checkPurchase = async () => {
      if (!user || !product?._id) return;
      try {
        const res = await api.get("/orders/my-orders");
        const purchased = res.data.orders.some(order =>
          order.items.some(item => item.product._id === product._id || item.product === product._id)
        );
        setCanReview(purchased);
      } catch (err) {
        console.error("Error checking purchase:", err);
      }
    };
    checkPurchase();
  }, [user, product]);

  const handleAddToCart = () => {
    if (!user) return navigate("/login");
    addToCart(product._id, qty);
  };

  const handleBuyNow = () => {
    if (!user) return navigate("/login");
    // Navigate to checkout with Buy Now item passed via location.state
    // No cart dependency - direct checkout
    navigate("/checkout", {
      state: {
        buyNowItem: {
          product: {
            _id: product._id,
            name: product.name,
            images: product.images,
            price: product.price,
            discountedPrice: product.discountedPrice,
          },
          quantity: qty,
          priceAtAdd: product.discountedPrice || product.price,
        },
      },
    });
  };

  const handleReview = async (e) => {
    e.preventDefault();
    if (!user) return navigate("/login");
    try {
      await api.post(`/products/${id}/reviews`, { rating, comment });
      toast.success("Review submitted!");
      setComment("");
      // Refresh product to show new review
      const { data } = await api.get(`/products/${id}`);
      setProduct(data.product);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit review");
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // ✅ REMOVED: Background image is now set directly in JSX (no timing issues)

  // ✅ CONDITIONAL RETURNS (AFTER ALL HOOKS)
  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand" />
    </div>
  );

  if (!product) return null;

  const displayPrice = product.discountedPrice || product.price;

  // ✅ SIMPLIFIED ZOOM TRACKING - Direct cursor → background position mapping
  const handleMouseMove = (e) => {
    if (!zoomRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();

    // Cursor position inside image
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert to percentage for background position
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    // Apply zoom movement (follows cursor perfectly)
    zoomRef.current.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
  };

  return (
    <div className="max-w-full mx-auto px-4 py-10">
      {/* ── AMAZON-STYLE 4-COLUMN LAYOUT ─────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* COL 1: THUMBNAILS (LEFT) */}
        <div className="col-span-1 flex flex-col gap-2">
          {product.images.map((img, i) => (
            <img
              key={i}
              src={typeof img === "string" ? img : img.url}
              alt={`${product.name} ${i + 1}`}
              onClick={() => setActiveImg(i)}
              className={`w-20 h-20 object-cover border-2 cursor-pointer transition hover:border-gray-400 ${
                activeImg === i ? "border-gray-400" : "border-gray-200"
              }`}
            />
          ))}
        </div>

        {/* COL 2: MAIN IMAGE (CENTER) */}
        <div
          className="col-span-3 relative bg-gray-50 rounded-lg overflow-hidden cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseEnter={(e) => {
            setShowZoom(true);
            rectRef.current = e.currentTarget.getBoundingClientRect();
          }}
          onMouseLeave={() => setShowZoom(false)}
        >
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-contain min-h-[600px]"
          />

          {/* Zoom Lens */}
          {showZoom && (
            <div
              ref={lensRef}
              className="absolute bg-gray-200/40 border border-gray-400 pointer-events-none"
              style={{
                width: "180px",
                height: "180px",
              }}
            />
          )}
        </div>

        {/* COL 3: PRODUCT INFO (FAR RIGHT) WITH OVERLAY ZOOM */}
        <div className="col-span-4 relative h-fit">
          {/* PRODUCT DETAILS (HIDDEN WHEN ZOOM IS ACTIVE) */}
          <div className={`transition-opacity duration-150 ${showZoom ? "opacity-0" : "opacity-100"}`}>
            <span className="text-sm font-medium text-orange-600">{product.category}</span>
            
            <h1 className="text-2xl font-semibold text-gray-800">{product.name}</h1>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-lg">
                {"★".repeat(Math.round(product.rating))}{"☆".repeat(5 - Math.round(product.rating))}
              </span>
              <span className="text-gray-500 text-sm">({product.numReviews} reviews)</span>
            </div>

            {/* Seller */}
            <p className="text-sm text-gray-600">
              Sold by:{" "}
              <Link
                to={`/seller/${product.seller?._id}`}
                className="text-blue-600 font-semibold hover:underline"
              >
                {product.seller?.name}
              </Link>
            </p>

            {/* Price */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-gray-800">₹{displayPrice.toLocaleString()}</span>
                {product.discountedPrice && (
                  <>
                    <span className="text-gray-400 line-through text-lg">₹{product.price.toLocaleString()}</span>
                    <span className="text-red-600 font-bold">
                      {Math.round(((product.price - product.discountedPrice) / product.price) * 100)}% OFF
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>

            {/* Stock */}
            <p className={`text-sm font-semibold ${product.stock > 0 ? "text-green-600" : "text-red-600"}`}>
              {product.stock > 0 ? `✓ In Stock (${product.stock} left)` : "✗ Out of Stock"}
            </p>

            {/* Quantity */}
            {product.stock > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="px-3 py-2 hover:bg-gray-100"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 font-semibold border-x border-gray-300 min-w-12 text-center">{qty}</span>
                  <button
                    onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                    className="px-3 py-2 hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg transition"
              >
                🛒 Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                disabled={product.stock === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold py-2 rounded-lg transition"
              >
                Buy Now
              </button>
            </div>
          </div>

          {/* OVERLAY ZOOM PANEL (APPEARS ON HOVER) */}
          {showZoom && imageUrl && (
            <div className="absolute top-0 left-0 w-full h-[600px] bg-white border border-gray-300 z-50 rounded-lg overflow-hidden transition-opacity duration-150">
              <div
                ref={zoomRef}
                className="w-full h-full bg-no-repeat"
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: "200%",
                }}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ProductDetail;
