// ============================================================
//  pages/SellerDashboard.jsx  —  NEW
//  Tabs: Overview | My Products | Add Product | Orders | Profile
// ============================================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { toast } from "react-toastify";
import ProductFormWithImages from "../components/ProductFormWithImages";

// ── Sub-component: Stat Card ─────────────────────────────────
const StatCard = ({ icon, label, value, color }) => (
  <div className={`card border-l-4 ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
      <span className="text-4xl">{icon}</span>
    </div>
  </div>
);

// ── Main Dashboard Component ─────────────────────────────────
const SellerDashboard = () => {
  const [tab,         setTab]         = useState("overview");
  const [stats,       setStats]       = useState(null);
  const [products,    setProducts]    = useState([]);
  const [orders,      setOrders]      = useState([]);
  const [profile,     setProfile]     = useState(null);
  const [editProduct, setEditProduct] = useState(null);  // null = add mode, obj = edit mode

  useEffect(() => {
    if (tab === "overview") fetchStats();
    if (tab === "products") fetchProducts();
    if (tab === "add")      setEditProduct(null);
    if (tab === "orders")   fetchOrders();
    if (tab === "profile")  fetchProfile();
  }, [tab]);

  const fetchStats    = async () => { try { const { data } = await api.get("/seller/stats");    setStats(data);             } catch (e) { console.error(e); } };
  const fetchProducts = async () => { try { const { data } = await api.get("/seller/products"); setProducts(data.products); } catch (e) { console.error(e); } };
  const fetchOrders   = async () => { try { const { data } = await api.get("/seller/orders");   setOrders(data.orders);     } catch (e) { console.error(e); } };
  const fetchProfile  = async () => { try { const { data } = await api.get("/seller/profile");  setProfile(data.sellerProfile); } catch (e) { console.error(e); } };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api.delete(`/seller/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    }
  };

  // Update order status
  const handleOrderStatus = async (orderId, status) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      toast.success("Order status updated.");
      fetchOrders();
    } catch (err) { 
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const TABS = [
    { key: "overview", label: "📊 Overview"    },
    { key: "products", label: "📦 My Products" },
    { key: "add",      label: "➕ Add Product" },
    { key: "orders",   label: "🛒 My Orders"   },
    { key: "profile",  label: "🏪 Store"       },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h1 className="text-3xl font-bold text-gray-800">Seller Dashboard</h1>
        <Link to="/create-product" className="btn-primary text-sm">
          + Quick Add Product
        </Link>
      </div>
      <p className="text-gray-400 text-sm mb-6">Manage your store, products and orders</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors
              ${tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ───────────────────────────────────── */}
      {tab === "overview" && stats && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon="📦" label="My Products"  value={stats.stats.totalProducts}             color="border-purple-400" />
            <StatCard icon="🛒" label="Total Orders" value={stats.stats.totalOrders}               color="border-blue-400"   />
            <StatCard icon="💰" label="Revenue"      value={`₹${stats.stats.totalRevenue.toLocaleString()}`} color="border-green-400"  />
            <StatCard icon="⚠️" label="Low Stock"   value={stats.stats.lowStockCount}              color="border-red-400"    />
          </div>

          {stats.lowStockProducts?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-red-600 mb-3">⚠️ Low Stock Alert</h3>
              <div className="space-y-2">
                {stats.lowStockProducts.map((p) => {
                  const imageUrl = typeof p.images?.[0] === "string"
                    ? p.images[0]
                    : p.images?.[0]?.url;
                  return (
                  <div key={p._id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <img src={imageUrl} alt={p.name}
                        className="w-8 h-8 rounded object-cover" />
                      <span className="text-gray-700">{p.name}</span>
                    </div>
                    <span className="text-red-500 font-bold">{p.stock} left</span>
                  </div>
                );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MY PRODUCTS ────────────────────────────────── */}
      {tab === "products" && (
        <div>
          {editProduct ? (
            <ProductFormWithImages
              editProduct={editProduct}
              onSuccess={() => { setEditProduct(null); fetchProducts(); }}
              onCancel={() => setEditProduct(null)}
            />
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">{products.length} products</p>
                <button onClick={() => setTab("add")} className="btn-primary text-sm">
                  + Add Product
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Stock</th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                          No products yet. Click "+ Add Product" to get started.
                        </td>
                      </tr>
                    ) : products.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={p.images[0]?.url || "https://via.placeholder.com/40"}
                              alt={p.name} className="w-10 h-10 object-cover rounded-lg" />
                            <span className="font-medium text-gray-700 max-w-xs line-clamp-1">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.category}</td>
                        <td className="px-4 py-3 font-semibold text-brand">₹{p.price.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${p.stock < 5 ? "text-red-500" : "text-green-600"}`}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-yellow-500">
                          ★ {p.rating.toFixed(1)} ({p.numReviews})
                        </td>
                        <td className="px-4 py-3 flex gap-3">
                          <button onClick={() => { setEditProduct(p); setTab("products"); }}
                            className="text-brand text-xs font-semibold hover:underline">Edit</button>
                          <button onClick={() => handleDelete(p._id)}
                            className="text-red-500 text-xs font-semibold hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ADD PRODUCT ────────────────────────────────── */}
      {tab === "add" && (
        <ProductFormWithImages
          onSuccess={() => { toast.success("Product added!"); setTab("products"); }}
          onCancel={() => setTab("products")}
        />
      )}

      {/* ── MY ORDERS ──────────────────────────────────── */}
      {tab === "orders" && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">My Total</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No orders yet.</td>
                </tr>
              ) : orders.map((o) => (
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{o._id.slice(-8)}</td>
                  <td className="px-4 py-3 text-gray-700">{o.customer?.name || o.user?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{o.items.length} item(s)</td>
                  <td className="px-4 py-3 font-semibold text-brand">₹{(o.myTotal || o.totalPrice).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                      ${o.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{o.status === "out_for_delivery" ? "Out for Delivery" : (o.status || o.orderStatus)}</td>
                  <td className="px-4 py-3">
                    <select value={o.status || o.orderStatus || "processing"} onChange={(e) => handleOrderStatus(o._id, e.target.value)}
                      className="text-xs border border-gray-300 rounded px-2 py-1">
                      {["processing","shipped","out_for_delivery","delivered","cancelled"].map((s) => (
                        <option key={s} value={s}>{s === "out_for_delivery" ? "Out for Delivery" : s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── STORE PROFILE ──────────────────────────────── */}
      {tab === "profile" && profile && (
        <StoreProfileEditor profile={profile} onUpdated={fetchProfile} />
      )}
    </div>
  );
};

// ── Store Profile Editor ─────────────────────────────────────
const StoreProfileEditor = ({ profile, onUpdated }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    storeName:        profile.storeName,
    storeDescription: profile.storeDescription,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put("/seller/profile", form);
      toast.success("Store profile updated!");
      onUpdated();
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-lg">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-gray-800 text-lg">🏪 Store Details</h2>
        <span className={`text-xs px-3 py-1 rounded-full font-semibold
          ${profile.isApproved ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
          {profile.isApproved ? "✓ Approved" : "⏳ Pending"}
        </span>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Store Name</label>
            <input type="text" value={form.storeName}
              onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
              className="input-field" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Store Description</label>
            <textarea value={form.storeDescription}
              onChange={(e) => setForm((f) => ({ ...f, storeDescription: e.target.value }))}
              className="input-field resize-none h-24" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Store Name</span>
            <span className="text-gray-700 font-medium">{profile.storeName}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500 block mb-1">Description</span>
            <p className="text-gray-700">{profile.storeDescription || "No description yet."}</p>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total Products</span>
            <span className="text-gray-700 font-medium">{profile.totalProducts}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Member Since</span>
            <span className="text-gray-700 font-medium">
              {new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </span>
          </div>
          <button onClick={() => setEditing(true)} className="btn-primary mt-3">Edit Store</button>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;
