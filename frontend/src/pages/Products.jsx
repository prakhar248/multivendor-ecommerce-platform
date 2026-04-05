// ============================================================
//  src/pages/Products.jsx
//  Product listing with search (debounced), filters, sorting
// ============================================================

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";
import ProductCard from "../components/ProductCard";

const CATEGORIES = ["All", "Electronics", "Clothing", "Books", "Home", "Sports", "Beauty"];

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from URL query params
  const [searchInput, setSearchInput] = useState(searchParams.get("search")   || ""); // Raw input
  const [search,      setSearch]      = useState(searchParams.get("search")   || ""); // Debounced (used for API)
  const [category,    setCategory]    = useState(searchParams.get("category") || "All");
  const [minPrice,    setMinPrice]    = useState(searchParams.get("minPrice") || "");
  const [maxPrice,    setMaxPrice]    = useState(searchParams.get("maxPrice") || "");
  const [sort,        setSort]        = useState(searchParams.get("sort")     || "newest");
  const [page,        setPage]        = useState(1);

  const [products,   setProducts]   = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);

  // ── DEBOUNCE SEARCH (500ms delay) ───────────────────────
  // When user types, update searchInput immediately
  // But only trigger API call after they stop typing for 500ms
  useEffect(() => {
    const delay = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // Reset to first page on search
    }, 500);

    return () => clearTimeout(delay);
  }, [searchInput]);

  // ── FETCH PRODUCTS ──────────────────────────────────────
  // Triggered when search (debounced), category, price, sort, or page changes
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          ...(search   && { search }),
          ...(category !== "All" && { category }),
          ...(minPrice && { minPrice }),
          ...(maxPrice && { maxPrice }),
          sort,
          page,
          limit: 12,
        });

        const { data } = await api.get(`/products?${params}`);
        setProducts(data.products);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [search, category, minPrice, maxPrice, sort, page]);

  // Reset to page 1 whenever category, price, or sort changes
  const handleFilter = (key, value) => {
    if (key === "search") {
      setSearchInput(value); // Update raw input (will be debounced)
    } else {
      setPage(1); // Reset page for other filters
      if (key === "category") setCategory(value);
      if (key === "minPrice") setMinPrice(value);
      if (key === "maxPrice") setMaxPrice(value);
      if (key === "sort")     setSort(value);
    }
  };

  // Reset all filters
  const handleReset = () => {
    setSearchInput("");
    setSearch("");
    setCategory("All");
    setMinPrice("");
    setMaxPrice("");
    setSort("newest");
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-6">

        {/* ── Sidebar Filters ────────────────────────────── */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="card space-y-6">
            <h2 className="font-bold text-gray-800 text-lg">Filters</h2>

            {/* Search with Debounce */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">Search</label>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleFilter("search", e.target.value)}
                placeholder="Search products..."
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-1">Takes effect after you stop typing</p>
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">Category</label>
              <div className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleFilter("category", cat)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors
                      ${category === cat
                        ? "bg-brand text-white font-medium"
                        : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">Price Range (₹)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => handleFilter("minPrice", e.target.value)}
                  placeholder="Min"
                  className="input-field"
                />
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => handleFilter("maxPrice", e.target.value)}
                  placeholder="Max"
                  className="input-field"
                />
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="w-full btn-secondary text-sm"
            >
              Reset Filters
            </button>
          </div>
        </aside>

        {/* ── Main Product Grid ───────────────────────────── */}
        <main className="flex-1">

          {/* Sort Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-800">{total}</span> products found
            </p>
            <select
              value={sort}
              onChange={(e) => handleFilter("sort", e.target.value)}
              className="input-field w-full sm:w-48 text-sm"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-lg mb-3" />
                  <div className="h-3 bg-gray-200 rounded mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            // No Products State
            <div className="text-center py-20 text-gray-400">
              <p className="text-6xl mb-4">🔍</p>
              <p className="text-lg font-semibold text-gray-600">No products found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            // Product Grid
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {products.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
              >
                ← Prev
              </button>
              
              {/* Page numbers */}
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors
                    ${page === i + 1 ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  {i + 1}
                </button>
              ))}
              
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page === totalPages}
                className="btn-secondary px-4 py-2 text-sm disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Products;
