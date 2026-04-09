// ============================================================
//  components/ProductFormWithImages.jsx
//  Comprehensive product form used in both:
//  - CreateProductPage (navbar "Add Product" button)
//  - SellerDashboard (edit products)
// ============================================================
import { useState } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";

const MAX_IMAGES = 5;

const ProductFormWithImages = ({ editProduct = null, onSuccess, onCancel }) => {
  const [form, setForm] = useState({
    name:             editProduct?.name            || "",
    description:      editProduct?.description     || "",
    price:            editProduct?.price           || "",
    discountedPrice:  editProduct?.discountedPrice || "",
    stock:            editProduct?.stock           || "",
    category:         editProduct?.category        || "Electronics",
    brand:            editProduct?.brand           || "",
    tags:             editProduct?.tags?.join(", ") || "",
  });
  // Each item: { id, file, previewUrl }
  const [imageItems, setImageItems] = useState([]);
  // Track URLs of existing images to remove
  const [removedImageUrls, setRemovedImageUrls] = useState([]);
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Accumulate images instead of replacing
  const handleImageChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    setImageItems((prev) => {
      const existingCount = (editProduct?.images?.length || 0) + prev.length;
      const slotsLeft = MAX_IMAGES - existingCount;
      if (slotsLeft <= 0) {
        toast.error(`Maximum ${MAX_IMAGES} images allowed.`);
        return prev;
      }
      const filesToAdd = newFiles.slice(0, slotsLeft);
      const newItems = filesToAdd.map((file, idx) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${idx}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...newItems];
    });
    // Reset the input so the same file(s) can be re-selected
    e.target.value = "";
  };

  const removeNewImage = (id) => {
    setImageItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const removeExistingImage = (imageUrl) => {
    setRemovedImageUrls((prev) => [...prev, imageUrl]);
  };

  const restoreExistingImage = (imageUrl) => {
    setRemovedImageUrls((prev) => prev.filter((url) => url !== imageUrl));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      imageItems.forEach(({ file }) => formData.append("images", file));
      // Send removed image URLs to backend
      if (removedImageUrls.length > 0) {
        formData.append("removedImages", JSON.stringify(removedImageUrls));
      }

      if (editProduct) {
        await api.put(`/seller/products/${editProduct._id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Product updated!");
      } else {
        await api.post("/seller/products", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Product created!");
      }
      // Clean up preview URLs
      imageItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  const totalImages = (editProduct?.images?.length || 0) + imageItems.length;

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 max-w-2xl">
      <h2 className="font-bold text-gray-800 text-lg">
        {editProduct ? "Edit Product" : "Add New Product"}
      </h2>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-gray-600 block mb-1">Product Name *</label>
          <input type="text" value={form.name} onChange={set("name")} className="input-field" required />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-gray-600 block mb-1">Description *</label>
          <textarea value={form.description} onChange={set("description")}
            className="input-field resize-none h-24" required />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Price (₹) *</label>
          <input type="number" value={form.price} onChange={set("price")}
            className="input-field" required min="0" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Discounted Price (₹)</label>
          <input type="number" value={form.discountedPrice} onChange={set("discountedPrice")}
            className="input-field" min="0" placeholder="Leave blank if no discount" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Stock *</label>
          <input type="number" value={form.stock} onChange={set("stock")}
            className="input-field" required min="0" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Category *</label>
          <select value={form.category} onChange={set("category")} className="input-field">
            {["Electronics","Clothing","Books","Home","Sports","Beauty","Other"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Brand</label>
          <input type="text" value={form.brand} onChange={set("brand")} className="input-field" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">Tags (comma-separated)</label>
          <input type="text" value={form.tags} onChange={set("tags")}
            className="input-field" placeholder="wireless, bluetooth, gaming" />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Product Images ({totalImages}/{MAX_IMAGES})
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            disabled={totalImages >= MAX_IMAGES}
            className="input-field"
          />
          <p className="text-xs text-gray-400 mt-1">
            You can select multiple images at once, or add more images one by one (up to {MAX_IMAGES} total).
          </p>

          {/* Preview existing images (edit mode) */}
          {editProduct?.images?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Existing images:</p>
              <div className="flex gap-2 flex-wrap">
                {editProduct.images.map((img, i) => {
                  const isRemoved = removedImageUrls.includes(img.url);
                  return (
                    <div key={i} className="relative group">
                      <img 
                        src={img.url} 
                        alt="" 
                        className={`w-16 h-16 object-cover rounded-lg border ${isRemoved ? 'border-red-300 opacity-50 line-through' : 'border-gray-200'}`}
                      />
                      <button
                        type="button"
                        onClick={() => isRemoved ? restoreExistingImage(img.url) : removeExistingImage(img.url)}
                        className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow ${isRemoved ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}
                        aria-label={isRemoved ? "Restore image" : "Remove image"}
                        title={isRemoved ? "Click to restore" : "Click to delete"}
                      >
                        {isRemoved ? '↻' : '✕'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview newly selected images */}
          {imageItems.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">New images to upload:</p>
              <div className="flex gap-2 flex-wrap">
                {imageItems.map((item) => (
                  <div key={item.id} className="relative group">
                    <img src={item.previewUrl} alt=""
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => removeNewImage(item.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                      aria-label="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving..." : (editProduct ? "Update Product" : "Add Product")}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        )}
      </div>
    </form>
  );
};

export default ProductFormWithImages;
