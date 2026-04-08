// ============================================================
//  pages/AdminDashboard.jsx  —  REWRITTEN for multi-vendor
//  Tabs: Overview | Sellers (pending + all) | Users | Products | Orders
// ============================================================
import { useEffect, useState } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";

const StatCard = ({ icon, label, value, color, sub }) => (
  <div className={`card border-l-4 ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <span className="text-4xl">{icon}</span>
    </div>
  </div>
);

const AdminDashboard = () => {
  const [tab,      setTab]      = useState("overview");
  const [stats,    setStats]    = useState(null);
  const [sellers,  setSellers]  = useState([]);
  const [pending,  setPending]  = useState([]);
  const [users,    setUsers]    = useState([]);
  const [products, setProducts] = useState([]);
  const [orders,   setOrders]   = useState([]);

  useEffect(() => {
    if (tab === "overview") fetchStats();
    if (tab === "sellers")  { fetchSellers(); fetchPending(); }
    if (tab === "users")    fetchUsers();
    if (tab === "products") fetchProducts();
    if (tab === "orders")   fetchOrders();
  }, [tab]);

  const fetchStats    = async () => { try { const { data } = await api.get("/admin/stats");           setStats(data);              } catch (e) { console.error(e); } };
  const fetchSellers  = async () => { try { const { data } = await api.get("/admin/sellers");         setSellers(data.sellers);    } catch (e) { console.error(e); } };
  const fetchPending  = async () => { try { const { data } = await api.get("/admin/sellers/pending"); setPending(data.sellers);    } catch (e) { console.error(e); } };
  const fetchUsers    = async () => { try { const { data } = await api.get("/admin/users");           setUsers(data.users);        } catch (e) { console.error(e); } };
  const fetchProducts = async () => { try { const { data } = await api.get("/products?limit=50");     setProducts(data.products);  } catch (e) { console.error(e); } };
  const fetchOrders   = async () => { try { const { data } = await api.get("/admin/orders");          setOrders(data.orders);      } catch (e) { console.error(e); } };

  // Approve seller
  const handleApprove = async (sellerId) => {
    try {
      await api.put(`/admin/sellers/${sellerId}/approve`);
      toast.success("Seller approved! They can now list products.");
      fetchSellers(); fetchPending();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to approve"); }
  };

  // Reject seller
  const handleReject = async (sellerId) => {
    if (!window.confirm("Revoke this seller's approval?")) return;
    try {
      await api.put(`/admin/sellers/${sellerId}/reject`);
      toast.info("Seller approval revoked.");
      fetchSellers();
    } catch (err) { toast.error("Failed to revoke approval"); }
  };

  // Delete user
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Delete this user permanently?")) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success("User deleted.");
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || "Failed to delete"); }
  };

  // Delete product (admin override)
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api.delete(`/admin/products/${productId}`);
      toast.success("Product deleted.");
      fetchProducts();
    } catch (err) { toast.error("Failed to delete product"); }
  };

  // Update order status
  const handleOrderStatus = async (orderId, status) => {
    try {
      await api.put(`/admin/orders/${orderId}/status`, { status });
      toast.success("Order status updated.");
      fetchOrders();
    } catch (err) { toast.error("Failed to update status"); }
  };

  const TABS = [
    { key: "overview", label: "📊 Overview"  },
    { key: "sellers",  label: "🏪 Sellers",  badge: pending.length > 0 ? pending.length : null },
    { key: "users",    label: "👥 Users"     },
    { key: "products", label: "📦 Products"  },
    { key: "orders",   label: "🛒 Orders"    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
      <p className="text-gray-400 text-sm mb-6">Manage the entire ShopEasy platform</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors
              ${tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
            {/* Pending badge */}
            {t.badge && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ───────────────────────────────────── */}
      {tab === "overview" && stats && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard icon="👥" label="Total Users"    value={stats.stats.totalUsers}    color="border-blue-400"   />
            <StatCard icon="🏪" label="Active Sellers" value={stats.stats.totalSellers}  color="border-purple-400" sub={`${stats.stats.pendingSellers} pending`} />
            <StatCard icon="⏳" label="Pending"        value={stats.stats.pendingSellers} color="border-orange-400" />
            <StatCard icon="📦" label="Products"       value={stats.stats.totalProducts} color="border-teal-400"   />
            <StatCard icon="🛒" label="Orders"         value={stats.stats.totalOrders}   color="border-green-400"  />
            <StatCard icon="💰" label="Revenue"
              value={`₹${stats.stats.totalRevenue.toLocaleString()}`} color="border-amber-400" />
          </div>

          {/* Pending seller alert banner */}
          {stats.stats.pendingSellers > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⏳</span>
                <div>
                  <p className="font-semibold text-orange-800">
                    {stats.stats.pendingSellers} seller{stats.stats.pendingSellers > 1 ? "s" : ""} awaiting approval
                  </p>
                  <p className="text-sm text-orange-600">Review and approve seller applications</p>
                </div>
              </div>
              <button onClick={() => setTab("sellers")} className="btn-primary text-sm">
                Review Now
              </button>
            </div>
          )}

          {/* Recent orders */}
          {stats.recentOrders?.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-gray-700 mb-3">Recent Orders</h3>
              <div className="space-y-2">
                {stats.recentOrders.map((o) => (
                  <div key={o._id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 font-mono">{o._id.slice(-8)}</span>
                    <span className="text-gray-700">{o.user?.name}</span>
                    <span className="font-semibold text-brand">₹{o.totalPrice.toLocaleString()}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                      ${o.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                      {o.paymentStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SELLERS ────────────────────────────────────── */}
      {tab === "sellers" && (
        <div className="space-y-8">

          {/* Pending Applications */}
          {pending.length > 0 && (
            <div>
              <h2 className="font-bold text-orange-600 mb-4 flex items-center gap-2">
                ⏳ Pending Applications
                <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                  {pending.length}
                </span>
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {pending.map((seller) => (
                  <div key={seller._id} className="card border-l-4 border-orange-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-800">{seller.storeName}</p>
                        <p className="text-sm text-gray-500">{seller.user?.name} · {seller.user?.email}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Applied {new Date(seller.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {seller.storeDescription && (
                      <p className="text-sm text-gray-600 mb-3 bg-gray-50 p-2 rounded-lg">
                        {seller.storeDescription}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(seller._id)}
                        className="btn-primary text-sm py-1.5 flex-1">
                        ✓ Approve
                      </button>
                      <button onClick={() => handleReject(seller._id)}
                        className="btn-secondary text-sm py-1.5 text-red-500 border-red-200 flex-1">
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Sellers Table */}
          <div>
            <h2 className="font-bold text-gray-800 mb-4">All Sellers</h2>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr>
                    <th className="px-4 py-3">Store</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Products</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {sellers.map((seller) => (
                    <tr key={seller._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-800">{seller.storeName}</td>
                      <td className="px-4 py-3 text-gray-500">{seller.user?.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                          ${seller.isApproved ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                          {seller.isApproved ? "✓ Approved" : "⏳ Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{seller.totalProducts}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(seller.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {seller.isApproved ? (
                          <button onClick={() => handleReject(seller._id)}
                            className="text-xs text-red-500 font-semibold hover:underline">
                            Revoke
                          </button>
                        ) : (
                          <button onClick={() => handleApprove(seller._id)}
                            className="text-xs text-green-600 font-semibold hover:underline">
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── USERS ──────────────────────────────────────── */}
      {tab === "users" && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-700">{u.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize
                      ${u.role === "admin"    ? "bg-amber-100  text-amber-700"  :
                        u.role === "seller"   ? "bg-purple-100 text-purple-700" :
                                               "bg-blue-100   text-blue-700"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.isVerified ? "text-green-600" : "text-red-400"}>
                      {u.isVerified ? "✓" : "✗"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDeleteUser(u._id)}
                      className="text-xs text-red-500 font-semibold hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PRODUCTS ───────────────────────────────────── */}
      {tab === "products" && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {products.map((p) => {
                const imageUrl = typeof p.images?.[0] === "string"
                  ? p.images[0]
                  : p.images?.[0]?.url || "https://via.placeholder.com/40";
                return (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={imageUrl} alt={p.name}
                          className="w-10 h-10 object-cover rounded-lg" />
                        <span className="font-medium text-gray-700 line-clamp-1 max-w-xs">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.seller?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{p.category}</td>
                    <td className="px-4 py-3 font-semibold text-brand">₹{p.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${p.stock < 5 ? "text-red-500" : "text-green-600"}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDeleteProduct(p._id)}
                        className="text-xs text-red-500 font-semibold hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ORDERS ─────────────────────────────────────── */}
      {tab === "orders" && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Update Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{o._id.slice(-8)}</td>
                  <td className="px-4 py-3 text-gray-700">{o.user?.name}</td>
                  <td className="px-4 py-3 font-semibold text-brand">₹{o.totalPrice.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                      ${o.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{o.status === "out_for_delivery" ? "Out for Delivery" : o.status}</td>
                  <td className="px-4 py-3">
                    <select value={o.status} onChange={(e) => handleOrderStatus(o._id, e.target.value)}
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
    </div>
  );
};

export default AdminDashboard;
