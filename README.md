# 🛍️ ShopNow — Multi-Vendor MERN E-Commerce Platform

A full-stack multi-vendor marketplace built with MongoDB, Express, React, and Node.js.
Supports 3 roles: **Customer**, **Seller**, and **Admin**.

---

## 📁 Complete File Structure

```
mern-ecommerce/
├── backend/
│   ├── config/
│   │   ├── db.js                  → MongoDB connection
│   │   └── cloudinary.js          → Cloudinary + Multer image upload
│   ├── controllers/
│   │   ├── authController.js      → signup (with role), login, verify email
│   │   ├── productController.js   → public browse/search (approved sellers only)
│   │   ├── sellerController.js    → seller CRUD (own products only)
│   │   ├── adminController.js     → approve sellers, manage users/orders
│   │   ├── cartController.js      → cart operations
│   │   ├── orderController.js     → place order, my orders
│   │   └── paymentController.js   → Razorpay create + verify
│   ├── middleware/
│   │   └── authMiddleware.js      → protect, adminOnly, sellerOnly, sellerOrAdmin
│   ├── models/
│   │   ├── User.js                → name, email, password, role (3 values)
│   │   ├── Seller.js              → storeName, storeDescription, isApproved
│   │   ├── Product.js             → seller ref, isActive flag
│   │   ├── Cart.js                → one cart per user
│   │   └── Order.js               → items with seller ref for revenue tracking
│   ├── routes/
│   │   ├── authRoutes.js          → /api/auth/*
│   │   ├── productRoutes.js       → /api/products/* (public)
│   │   ├── sellerRoutes.js        → /api/seller/* (seller only)
│   │   ├── adminRoutes.js         → /api/admin/* (admin only)
│   │   ├── cartRoutes.js          → /api/cart/*
│   │   ├── orderRoutes.js         → /api/orders/*
│   │   └── paymentRoutes.js       → /api/payment/*
│   ├── utils/
│   │   └── sendEmail.js           → Resend + HTML templates
│   ├── server.js                  → Express app entry point
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── axios.js            → Axios instance with JWT interceptor
    │   ├── context/
    │   │   ├── AuthContext.jsx     → user, sellerProfile, role helpers
    │   │   └── CartContext.jsx     → cart state synced with backend
    │   ├── components/
    │   │   ├── Navbar.jsx          → role-aware navigation
    │   │   ├── ProductCard.jsx     → product card with seller name
    │   │   └── ProtectedRoute.jsx  → guards for all 3 roles
    │   ├── pages/
    │   │   ├── Auth.jsx            → login + signup with role selector
    │   │   ├── Home.jsx            → hero, categories, featured products
    │   │   ├── Products.jsx        → browse with filters + pagination
    │   │   ├── ProductDetail.jsx   → full product page + reviews
    │   │   ├── Cart.jsx            → cart with qty controls
    │   │   ├── Checkout.jsx        → 3-step: address → review → pay
    │   │   ├── Orders.jsx          → customer order history
    │   │   ├── Profile.jsx         → edit profile
    │   │   ├── SellerDashboard.jsx → seller: stats, products, orders, store
    │   │   └── AdminDashboard.jsx  → admin: approve sellers, users, products, orders
    │   ├── App.jsx                 → all routes wired
    │   ├── main.jsx
    │   └── index.css
    ├── index.html                  → includes Razorpay SDK script
    ├── vite.config.js
    ├── tailwind.config.js
    └── .env.example
```

---

## 👥 Role System

| Role | What they can do |
|------|-----------------|
| **Customer** | Browse products, add to cart, place orders, write reviews |
| **Seller** | Register store, list/manage own products, view own orders (requires admin approval) |
| **Admin** | Approve/reject sellers, manage all users, delete any product, view all orders |

---

## 🔐 Security Rules

- **Sellers can only edit/delete their own products** — enforced server-side in `sellerController.js` by comparing `product.seller` with `req.user._id`
- **Admin accounts cannot be created via public signup** — the API rejects `role: "admin"` on signup
- **Unapproved sellers are blocked from listing products** — `sellerOnly` middleware checks `isApproved: true` in the Seller document
- **Public product listings only show approved sellers' products** — `productController.getProducts` filters by approved seller IDs
- **JWT payload carries role** — middleware never needs a DB call for role checks on every request

---

## 🚀 Setup & Run

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in: MONGO_URI, JWT_SECRET, EMAIL_*, CLOUDINARY_*, RAZORPAY_*
npm run dev
# → http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Set: VITE_API_URL=http://localhost:5000/api
#      VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
npm run dev
# → http://localhost:3000
```

---

## 🧪 Testing Each Role

### Customer
1. Go to `/signup` → select **Customer** → fill in details
2. Verify email → login → browse products → add to cart → checkout

### Seller
1. Go to `/signup` → select **Seller** → enter store name
2. Verify email → login → you'll see "Pending Approval" screen
3. Admin must approve you (see below)
4. After approval → `/seller` dashboard → add products

### Admin
```bash
# Create admin manually in MongoDB Atlas:
# 1. First signup as customer to create your account
# 2. In Atlas → Browse Collections → users → find your user
# 3. Edit: set role: "admin", isEmailVerified: true
# 4. Login again → redirected to /admin dashboard
```

---

## 📡 Complete API Reference

### Auth (`/api/auth`)
| Method | Endpoint | Access | Notes |
|--------|----------|--------|-------|
| POST | `/signup` | Public | Accepts `role`, `storeName` for sellers |
| POST | `/login` | Public | Returns `user` + `token` + `sellerProfile` |
| GET | `/verify-email/:token` | Public | |
| GET | `/me` | JWT | Returns user + sellerProfile |
| PUT | `/profile` | JWT | |
| PUT | `/change-password` | JWT | |

### Products (`/api/products`)
| Method | Endpoint | Access | Notes |
|--------|----------|--------|-------|
| GET | `/` | Public | Only approved sellers' products |
| GET | `/:id` | Public | |
| POST | `/:id/reviews` | JWT | Customers only |

### Seller (`/api/seller`) — requires approved seller JWT
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/stats` | Products, orders, revenue, low stock |
| GET | `/profile` | Store details |
| PUT | `/profile` | Update store name/description |
| GET | `/products` | Own products only |
| POST | `/products` | Create (multipart/form-data) |
| PUT | `/products/:id` | Own products only — ownership checked server-side |
| DELETE | `/products/:id` | Own products only — ownership checked server-side |
| GET | `/orders` | Orders containing this seller's items |

### Admin (`/api/admin`) — requires admin JWT
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/stats` | Platform-wide numbers |
| GET | `/users` | All users, filterable by `?role=seller` |
| DELETE | `/users/:id` | Cascades to Seller doc |
| GET | `/sellers` | All seller profiles |
| GET | `/sellers/pending` | Only unapproved sellers |
| PUT | `/sellers/:id/approve` | Sets isApproved: true |
| PUT | `/sellers/:id/reject` | Sets isApproved: false |
| DELETE | `/products/:id` | Admin override — any product |
| GET | `/orders` | All platform orders |
| PUT | `/orders/:id/status` | Update delivery status |

### Cart (`/api/cart`) — requires JWT
`GET /` · `POST /add` · `PUT /update` · `DELETE /remove/:productId` · `DELETE /clear`

### Orders (`/api/orders`) — requires JWT
`POST /` · `GET /my-orders` · `GET /:id`

### Payment (`/api/payment`) — requires JWT
`POST /create-order` · `POST /verify`

---

## 🎤 Review Explanation Notes

**"How does seller approval work?"**
Sellers sign up → Seller document created with `isApproved: false` → Admin sees them in "Pending Applications" tab → Clicks Approve → `isApproved` flips to `true` → Seller can now access their dashboard and list products. The `sellerOnly` middleware checks this on every seller API call.

**"How do you prevent sellers from editing other sellers' products?"**
In `sellerController.updateProduct` and `deleteProduct`, after fetching the product from DB, we compare `product.seller.toString() !== req.user._id.toString()` and return 403 if they don't match. The seller field is always set server-side on creation — never from `req.body`.

**"Why does the public product listing only show approved sellers?"**
In `productController.getProducts`, we first fetch all approved seller user IDs from the Seller collection, then filter the product query to `{ seller: { $in: approvedSellerIds } }`. Unapproved sellers' products are invisible to customers.

**"How does the JWT carry role information?"**
The token payload is `{ id, role }`. The `protect` middleware decodes this on every request. `adminOnly` and `sellerOnly` check `req.user.role` — no extra DB query needed for the role check itself.
