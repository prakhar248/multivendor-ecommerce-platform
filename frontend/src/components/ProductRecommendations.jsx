// ============================================================
//  components/ProductRecommendations.jsx
//  Displays "Suggested Products" (by tags) and "Similar Products" (by category)
// ============================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { Star, Zap } from "lucide-react";
import { motion } from "framer-motion";

const ProductCard = ({ product, index = 0 }) => {
  const displayPrice = product.discountedPrice || product.price;
  const avgRating = product.rating || 0;

  return (
    <Link
      to={`/products/${product._id}`}
      className="group block"
    >
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-brand shadow-card hover:shadow-card-hover transition-all duration-300">
      {/* Image Container */}
      <div className="relative w-full h-48 bg-gray-100 overflow-hidden">
        <img
          src={typeof product.images?.[0] === "string" ? product.images[0] : product.images?.[0]?.url}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        {product.discountedPrice && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
            {Math.round(((product.price - product.discountedPrice) / product.price) * 100)}% OFF
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          View Details
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <span className="text-xs font-medium text-orange-600 uppercase">{product.category}</span>
        <h3 className="font-semibold text-gray-800 text-sm mt-1 line-clamp-2 group-hover:text-brand transition-colors">
          {product.name}
        </h3>

        {/* Rating */}
        {avgRating > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-xs text-gray-600">{avgRating.toFixed(1)}</span>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mt-3 mb-3">
          <span className="text-lg font-bold text-gray-800">₹{displayPrice.toLocaleString()}</span>
          {product.discountedPrice && (
            <span className="text-sm text-gray-400 line-through">₹{product.price.toLocaleString()}</span>
          )}
        </div>

        {/* Stock Status */}
        {product.stock > 0 ? (
          <span className="text-xs text-accent-dark font-semibold">In Stock</span>
        ) : (
          <span className="text-xs text-red-600 font-semibold">Out of Stock</span>
        )}
      </div>
      </motion.div>
    </Link>
  );
};

const ProductRecommendations = ({ currentProductId, category, tags }) => {
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch suggested products (by tags)
        if (tags && tags.length > 0) {
          const suggestedResponse = await api.get("/products", {
            params: {
              tags: tags.join(","),
              limit: 6,
            },
          });
          const filtered = suggestedResponse.data.products.filter(
            (p) => p._id !== currentProductId
          );
          setSuggestedProducts(filtered.slice(0, 6));
        }

        // Fetch similar products (by category)
        const similarResponse = await api.get("/products", {
          params: {
            category: category,
            limit: 6,
          },
        });
        const filtered = similarResponse.data.products.filter(
          (p) => p._id !== currentProductId
        );
        setSimilarProducts(filtered.slice(0, 6));
      } catch (err) {
        console.error("Failed to fetch recommendations:", err);
        setError("Could not load recommendations");
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [currentProductId, category, tags]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-brand" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  const hasSuggestedProducts = suggestedProducts.length > 0;
  const hasSimilarProducts = similarProducts.length > 0;

  if (!hasSuggestedProducts && !hasSimilarProducts) {
    return null;
  }

  return (
    <div className="space-y-12">
      {/* ════════════════════════════════════════════════════════════
          SUGGESTED PRODUCTS (by tags)
          ════════════════════════════════════════════════════════════ */}
      {hasSuggestedProducts && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Suggested Products</h2>
            <Zap className="w-6 h-6 text-brand" />
          </div>
          <p className="text-gray-600 text-sm mb-6">
            Products similar to this one based on tags: <span className="font-semibold">{tags?.join(", ")}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {suggestedProducts.map((product, i) => (
              <ProductCard key={product._id} product={product} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          SIMILAR PRODUCTS (by category)
          ════════════════════════════════════════════════════════════ */}
      {hasSimilarProducts && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-800">More Products</h2>
            <span className="text-lg text-gray-600">in {category}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {similarProducts.map((product, i) => (
              <ProductCard key={product._id} product={product} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductRecommendations;
