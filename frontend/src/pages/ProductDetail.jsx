// ============================================================
//  src/pages/ProductDetail.jsx
//  Full product page: image gallery, zoom, details, reviews
// ============================================================

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { ShoppingCart, Zap, CheckCircle, XCircle, Minus, Plus, Info, MessageSquare } from "lucide-react";

// ── Star Rating Component ─────────────────────────────────────
// Interactive when editable, static when display-only
const StarRating = ({ rating, onRate, size = "text-xl", editable = false }) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = editable
          ? star <= (hoverRating || rating)
          : star <= Math.round(rating);

        return (
          <button
            key={star}
            type="button"
            disabled={!editable}
            onClick={() => editable && onRate?.(star)}
            onMouseEnter={() => editable && setHoverRating(star)}
            onMouseLeave={() => editable && setHoverRating(0)}
            className={`${size} transition-colors duration-150 ${
              editable ? "cursor-pointer hover:scale-110 transform" : "cursor-default"
            } ${filled ? "text-yellow-400" : "text-gray-300"}`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};

// ── Rating Breakdown Bar ──────────────────────────────────────
// Shows percentage bar for each star level (5★ → 1★)
const RatingBreakdown = ({ reviews }) => {
  const total = reviews.length;
  if (total === 0) return null;

  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="space-y-1.5">
      {counts.map(({ star, count }) => {
        const percent = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-sm">
            <span className="w-8 text-right text-gray-600 font-medium">{star}★</span>
            <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="w-8 text-gray-400 text-xs">{count}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Single Review Card ────────────────────────────────────────
const ReviewCard = ({ review }) => {
  const date = new Date(review.createdAt || review.updatedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="border-b border-gray-100 pb-4 last:border-0">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center text-brand font-bold text-sm flex-shrink-0">
          {(review.user?.name || review.name || "U").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-gray-800 text-sm">
              {review.user?.name || review.name || "Anonymous"}
            </p>
            <span className="text-xs text-gray-400">• {date}</span>
          </div>
          <StarRating rating={review.rating} size="text-sm" />
          <p className="text-gray-600 text-sm mt-2 leading-relaxed">{review.comment}</p>
        </div>
      </div>
    </div>
  );
};

// ============================================================
//  MAIN COMPONENT
// ============================================================
const ProductDetail = () => {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { addToCart } = useCart();
  const { user }      = useAuth();

  const [product,   setProduct]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [qty,       setQty]       = useState(1);
  const [showZoom,  setShowZoom]  = useState(false);

  // Review state
  const [rating,       setRating]       = useState(5);
  const [comment,      setComment]      = useState("");
  const [canReview,    setCanReview]    = useState(false);
  const [hasReviewed,  setHasReviewed]  = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Zoom refs
  const lensRef = useRef(null);
  const zoomRef = useRef(null);
  const rafIdRef = useRef(null);
  const rectRef = useRef(null);

  // Image URL (safe access)
  const imageUrl = typeof product?.images?.[activeImg] === "string"
    ? product?.images?.[activeImg]
    : product?.images?.[activeImg]?.url || "";

  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await api.get(`/products/${id}`);
        setProduct(data.product);
      } catch {
        navigate("/products");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  // Check if user can review (has purchased this product with payment completed)
  useEffect(() => {
    const checkPurchase = async () => {
      if (!user || !product?._id) return;
      try {
        const res = await api.get("/orders/my-orders");
        const purchased = res.data.orders.some((order) =>
          order.paymentStatus === "paid" &&
          order.items.some((item) =>
            (item.product?._id === product._id) || (item.product === product._id)
          )
        );
        setCanReview(purchased);

        // Check if user already reviewed this product
        const existing = product.reviews?.find(
          (r) => (r.user?._id || r.user) === user._id
        );
        if (existing) {
          setHasReviewed(true);
          setRating(existing.rating);
          setComment(existing.comment);
        }
      } catch (err) {
        console.error("Error checking purchase:", err);
      }
    };
    checkPurchase();
  }, [user, product]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const handleAddToCart = () => {
    if (!user) return navigate("/login");
    addToCart(product._id, qty);
  };

  const handleBuyNow = () => {
    if (!user) return navigate("/login");
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

  // Submit or update review
  const handleReview = async (e) => {
    e.preventDefault();
    if (!user) return navigate("/login");
    if (!comment.trim()) return toast.error("Please write a comment");

    setSubmittingReview(true);
    try {
      await api.post(`/products/${id}/reviews`, { rating, comment: comment.trim() });
      toast.success(hasReviewed ? "Review updated!" : "Review submitted!");
      setHasReviewed(true);

      // Refresh product to show new/updated review
      const { data } = await api.get(`/products/${id}`);
      setProduct(data.product);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Zoom handler
  const handleMouseMove = (e) => {
    if (!zoomRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    zoomRef.current.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
  };

  // Loading state
  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-brand" />
    </div>
  );

  if (!product) return null;

  const displayPrice = product.discountedPrice || product.price;
  const avgRating = product.rating || 0;
  const totalReviews = product.numReviews || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* ── PRODUCT LAYOUT ─────────────────────────────── */}
      <div className="grid grid-cols-12 gap-8">

        {/* COL 1: THUMBNAILS */}
        <div className="col-span-1 flex flex-col gap-2">
          {product.images.map((img, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setActiveImg(i)}
              className={`w-20 h-20 object-cover border-2 cursor-pointer transition-all duration-200 rounded-lg overflow-hidden hover:border-brand ${
                activeImg === i ? "border-brand ring-2 ring-brand/30" : "border-gray-200 hover:border-gray-300"
              }`}
              aria-label={`Select image ${i + 1}`}
            >
              <img
                src={typeof img === "string" ? img : img.url}
                alt={`${product.name} ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>

        {/* COL 2: MAIN IMAGE */}
        <div
          className="col-span-4 relative bg-gray-50 rounded-lg overflow-hidden cursor-crosshair"
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
          {showZoom && (
            <div
              ref={lensRef}
              className="absolute bg-gray-200/40 border border-gray-400 pointer-events-none"
              style={{ width: "180px", height: "180px" }}
            />
          )}
        </div>

        {/* COL 3: PRODUCT INFO + ZOOM OVERLAY */}
        <div className="col-span-7 relative h-fit">
          <div className={`transition-opacity duration-150 ${showZoom ? "opacity-0" : "opacity-100"}`}>
            <span className="text-sm font-medium text-orange-600">{product.category}</span>

            <h1 className="text-2xl font-semibold text-gray-800">{product.name}</h1>

            {/* Rating Summary (clickable → scrolls to reviews) */}
            <a href="#reviews-section" className="flex items-center gap-2 hover:opacity-80 transition">
              <StarRating rating={avgRating} size="text-lg" />
              <span className="text-gray-500 text-sm">
                {avgRating.toFixed(1)} ({totalReviews} {totalReviews === 1 ? "review" : "reviews"})
              </span>
            </a>

            {/* Seller */}
            <p className="text-sm text-gray-600">
              Sold by:{" "}
              <Link
                to={`/seller/${product.seller?._id}`}
                className="text-brand font-semibold hover:underline"
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
            <p className={`text-sm font-semibold flex items-center gap-1.5 ${product.stock > 0 ? "text-accent-dark" : "text-red-600"}`}>
              {product.stock > 0
                ? <><CheckCircle className="w-4 h-4" /> In Stock ({product.stock} left)</>
                : <><XCircle className="w-4 h-4" /> Out of Stock</>}
            </p>

            {/* Quantity */}
            {product.stock > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="px-3 py-2 hover:bg-gray-100"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 font-semibold border-x border-gray-300 min-w-12 text-center">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
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
                className="btn-secondary flex-1 py-2.5"
              >
                <ShoppingCart className="w-4 h-4" /> Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                disabled={product.stock === 0}
                className="btn-primary flex-1 py-2.5"
              >
                <Zap className="w-4 h-4" /> Buy Now
              </button>
            </div>
          </div>

          {/* ZOOM OVERLAY */}
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

      {/* ════════════════════════════════════════════════════════════
          REVIEWS SECTION
          ════════════════════════════════════════════════════════════ */}
      <div id="reviews-section" className="mt-12 scroll-mt-20">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Customer Reviews</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* LEFT: Rating Summary */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-24">
              {/* Average Rating */}
              <div className="text-center mb-4">
                <p className="text-5xl font-bold text-gray-800">{avgRating.toFixed(1)}</p>
                <StarRating rating={avgRating} size="text-2xl" />
                <p className="text-sm text-gray-500 mt-1">
                  Based on {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
                </p>
              </div>

              {/* Rating Breakdown */}
              {product.reviews?.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <RatingBreakdown reviews={product.reviews} />
                </div>
              )}

              {/* No reviews yet */}
              {totalReviews === 0 && (
                <div className="text-center py-4">
                  <p className="text-gray-400 text-sm">No reviews yet</p>
                  <p className="text-gray-400 text-xs mt-1">Be the first to review this product!</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Review Form + Review List */}
          <div className="md:col-span-2 space-y-6">

            {/* Review Form */}
            {user && canReview && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4 text-lg">
                  {hasReviewed ? "Update Your Review" : "Write a Review"}
                </h3>
                <form onSubmit={handleReview} className="space-y-4">
                  {/* Star Picker */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Rating
                    </label>
                    <StarRating
                      rating={rating}
                      onRate={setRating}
                      size="text-3xl"
                      editable
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {rating === 1 && "Poor"}
                      {rating === 2 && "Fair"}
                      {rating === 3 && "Good"}
                      {rating === 4 && "Very Good"}
                      {rating === 5 && "Excellent"}
                    </p>
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Review
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your experience with this product..."
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
                      required
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submittingReview || !comment.trim()}
                    className="bg-brand text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-brand-dark transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submittingReview ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      hasReviewed ? "Update Review" : "Submit Review"
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Not logged in prompt */}
            {!user && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-gray-600 mb-3">Please log in to write a review</p>
                <Link to="/login" className="text-brand font-semibold hover:underline">
                  Log In →
                </Link>
              </div>
            )}

            {/* Logged in but hasn't purchased */}
            {user && !canReview && (
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                <p className="text-blue-800 text-sm flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" /> You can only review products you've purchased and paid for.
                </p>
              </div>
            )}

            {/* Review List */}
            {product.reviews?.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 mb-4">
                  All Reviews ({product.reviews.length})
                </h3>
                <div className="space-y-4">
                  {product.reviews
                    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                    .map((review, i) => (
                      <ReviewCard key={review._id || i} review={review} />
                    ))}
                </div>
              </div>
            ) : (
              <div className="card p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium text-sm">No reviews yet</p>
                <p className="text-gray-400 text-xs mt-1">
                  Be the first to share your thoughts about this product.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
