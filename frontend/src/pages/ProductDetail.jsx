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
    const productData = {
      _id: product._id,
      name: product.name,
      price: product.discountedPrice || product.price,
      image: typeof product.images?.[0] === "string" ? product.images[0] : product.images?.[0]?.url,
      quantity: qty,
      seller: product.seller?._id
    };
    localStorage.setItem("buyNowProduct", JSON.stringify(productData));
    navigate("/checkout");
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

  // ✅ CONDITIONAL RETURNS (AFTER ALL HOOKS)
  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand" />
    </div>
  );

  if (!product) return null;

  const displayPrice = product.discountedPrice || product.price;
  const imageUrl = typeof product.images?.[activeImg] === "string"
    ? product.images[activeImg]
    : product.images?.[activeImg]?.url;

  const handleMouseMove = (e) => {
    // Cancel previous frame if still pending
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      const rect = e.currentTarget.getBoundingClientRect();

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const lensSize = 150;

      let lensX = x - lensSize / 2;
      let lensY = y - lensSize / 2;

      // Clamp lens strictly inside image boundaries
      lensX = Math.max(0, Math.min(lensX, rect.width - lensSize));
      lensY = Math.max(0, Math.min(lensY, rect.height - lensSize));

      // CRITICAL: Calculate zoom center (lens center) not lens top-left
      const xPercent = ((lensX + lensSize / 2) / rect.width) * 100;
      const yPercent = ((lensY + lensSize / 2) / rect.height) * 100;

      // DIRECT DOM UPDATE (NO STATE = NO RE-RENDER = ZERO LAG)
      if (lensRef.current) {
        lensRef.current.style.left = lensX + "px";
        lensRef.current.style.top = lensY + "px";
      }

      if (zoomRef.current) {
        zoomRef.current.style.backgroundImage = `url(${imageUrl})`;
        zoomRef.current.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
        zoomRef.current.style.backgroundSize = "200%";
      }

      rafIdRef.current = null;
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid md:grid-cols-2 gap-10">

        {/* ── Image Gallery with Amazon-Style Magnifier ───────────────────────────────── */}
        <div>
          <div className="flex gap-8">
            {/* LEFT: Main Image with Lens */}
            <div className="flex-1">
              <div
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 mb-3 cursor-crosshair hover:ring-1 hover:ring-gray-400 transition-all duration-200"
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setShowZoom(true)}
                onMouseLeave={() => setShowZoom(false)}
              >
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />

                {/* Clean Amazon-Style Lens */}
                {showZoom && (
                  <div
                    ref={lensRef}
                    className="absolute bg-gray-200/40 border border-gray-400 pointer-events-none"
                    style={{
                      width: "150px",
                      height: "150px",
                    }}
                  />
                )}
              </div>

              {/* Thumbnail Gallery */}
              {product.images.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      className={`w-16 h-16 rounded overflow-hidden border transition-all
                        ${activeImg === i ? "border-gray-400" : "border-gray-200 hover:border-gray-400"}`}
                    >
                      <img
                        src={typeof img === "string" ? img : img.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Clean Amazon-Style Zoom Panel (Desktop Only) */}
            {showZoom && imageUrl && (
              <div className="hidden lg:block w-[500px] h-[500px] border border-gray-300 overflow-hidden bg-white">
                <div
                  ref={zoomRef}
                  className="w-full h-full bg-no-repeat"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Product Info ─────────────────────────────────── */}
        <div>
          <p className="text-sm text-brand font-medium mb-2">{product.category}</p>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">{product.name}</h1>

          {/* Rating */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-yellow-400">{"★".repeat(Math.round(product.rating))}{"☆".repeat(5 - Math.round(product.rating))}</span>
            <span className="text-gray-500 text-sm">({product.numReviews} reviews)</span>
          </div>

          {/* Seller Info */}
          <p className="text-sm text-gray-600 mb-4">
            Sold by:{" "}
            <Link
              to={`/seller/${product.seller?._id}`}
              className="text-blue-500 font-medium hover:underline"
            >
              {product.seller?.name}
            </Link>
          </p>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-5">
            <span className="text-3xl font-bold text-gray-800">₹{displayPrice.toLocaleString()}</span>
            {product.discountedPrice && (
              <>
                <span className="text-gray-400 line-through text-lg">₹{product.price.toLocaleString()}</span>
                <span className="bg-red-100 text-red-600 text-sm font-bold px-2 py-0.5 rounded-full">
                  {Math.round(((product.price - product.discountedPrice) / product.price) * 100)}% OFF
                </span>
              </>
            )}
          </div>

          <p className="text-gray-600 leading-relaxed mb-6">{product.description}</p>

          {/* Stock status */}
          <p className={`text-sm font-medium mb-4 ${product.stock > 0 ? "text-green-600" : "text-red-500"}`}>
            {product.stock > 0 ? `✓ In Stock (${product.stock} left)` : "✗ Out of Stock"}
          </p>

          {/* Quantity selector */}
          {product.stock > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-medium text-gray-600">Qty:</span>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="px-3 py-2 hover:bg-gray-100 text-lg font-bold">−</button>
                <span className="px-4 py-2 font-semibold border-x border-gray-300">{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                  className="px-3 py-2 hover:bg-gray-100 text-lg font-bold">+</button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="btn-primary flex-1 py-3 text-base disabled:opacity-40"
            >
              🛒 Add to Cart
            </button>
            <button
              onClick={handleBuyNow}
              disabled={product.stock === 0}
              className="btn-secondary flex-1 py-3 text-base disabled:opacity-40"
            >
              Buy Now
            </button>
          </div>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {product.tags.map((tag) => (
                <span key={tag} className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Reviews Section ──────────────────────────────── */}
      <section className="mt-14">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Customer Reviews</h2>

        {/* Write a review */}
        {user ? (
          canReview ? (
            <form onSubmit={handleReview} className="card mb-8">
              <h3 className="font-semibold text-gray-700 mb-3">Write a Review</h3>
              <div className="flex gap-2 mb-3">
                {[1,2,3,4,5].map((star) => (
                  <button key={star} type="button" onClick={() => setRating(star)}
                    className={`text-2xl ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}>
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts about this product..."
                className="input-field resize-none h-24 mb-3"
                required
              />
              <button type="submit" className="btn-primary">Submit Review</button>
            </form>
          ) : (
            <div className="card mb-8 bg-blue-50 border-l-4 border-blue-500">
              <p className="text-blue-700 text-sm">
                ✓ You can only review products you have purchased.
              </p>
            </div>
          )
        ) : (
          <div className="card mb-8 bg-blue-50 border-l-4 border-blue-500">
            <p className="text-blue-700 text-sm">
              <Link to="/login" className="font-medium hover:underline">Login</Link> to write a review.
            </p>
          </div>
        )}

        {/* Review list */}
        {product.reviews.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No reviews yet. Be the first!</p>
        ) : (
          <div className="space-y-4">
            {product.reviews.map((review) => (
              <div key={review._id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 text-sm">{review.name}</span>
                    <span className="text-yellow-400 text-sm">{"★".repeat(review.rating)}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProductDetail;
