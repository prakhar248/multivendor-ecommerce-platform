import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const initialForm = {
  name: "",
  price: "",
  description: "",
  category: "",
  countInStock: "",
};

const categories = ["Electronics", "Clothing", "Books", "Home", "Sports", "Beauty", "Other"];

const ProductForm = () => {
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => previews.forEach((src) => URL.revokeObjectURL(src));
  }, [previews]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onImageChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected.slice(0, 5));
  };

  const resetForm = () => {
    setForm(initialForm);
    setFiles([]);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", form.name);
      formData.append("price", form.price);
      formData.append("description", form.description);
      formData.append("category", form.category);
      formData.append("countInStock", form.countInStock || "0");

      files.forEach((file) => formData.append("images", file));

      const { data } = await api.post("/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const normalizedImages = (data?.product?.images || []).map((img) =>
        typeof img === "string" ? img : img?.url
      ).filter(Boolean);

      setUploadedImages(normalizedImages);
      setMessage("Product created successfully.");
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl shadow">
      <h2 className="text-2xl font-semibold mb-4">Create Product</h2>

      {message && <p className="mb-3 text-green-600">{message}</p>}
      {error && <p className="mb-3 text-red-600">{error}</p>}

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          name="name"
          value={form.name}
          onChange={onChange}
          placeholder="Product name"
          className="w-full border rounded-lg px-3 py-2"
          required
        />

        <input
          name="price"
          type="number"
          min="0"
          step="0.01"
          value={form.price}
          onChange={onChange}
          placeholder="Price"
          className="w-full border rounded-lg px-3 py-2"
          required
        />

        <textarea
          name="description"
          value={form.description}
          onChange={onChange}
          placeholder="Description"
          className="w-full border rounded-lg px-3 py-2 min-h-28"
          required
        />

        <select
          name="category"
          value={form.category}
          onChange={onChange}
          className="w-full border rounded-lg px-3 py-2"
          required
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <input
          name="countInStock"
          type="number"
          min="0"
          value={form.countInStock}
          onChange={onChange}
          placeholder="Stock quantity"
          className="w-full border rounded-lg px-3 py-2"
        />

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onImageChange}
          className="w-full border rounded-lg px-3 py-2"
        />

        {previews.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-gray-600">Selected image preview</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {previews.map((src, idx) => (
                <img key={src + idx} src={src} alt={`preview-${idx}`} className="h-28 w-full object-cover rounded-lg" />
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded-lg disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Product"}
        </button>
      </form>

      {uploadedImages.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Uploaded images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {uploadedImages.map((src, idx) => (
              <img key={src + idx} src={src} alt={`uploaded-${idx}`} className="h-28 w-full object-cover rounded-lg" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductForm;
