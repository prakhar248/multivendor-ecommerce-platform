import { useEffect, useId, useRef, useState } from "react";
import api from "../services/api";
import { CheckCircle } from "lucide-react";

const initialForm = {
  name: "",
  price: "",
  description: "",
  category: "",
  countInStock: "",
};

const categories = ["Electronics", "Clothing", "Books", "Home", "Sports", "Beauty", "Other"];

const MAX_IMAGES = 5;

/** Parse backend error message from various Express/Mongoose shapes */
function getErrorMessage(err) {
  const data = err.response?.data;
  if (!data) return err.message || "Something went wrong. Please try again.";
  if (typeof data.message === "string") return data.message;
  if (Array.isArray(data.message)) return data.message.join(", ");
  if (data.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors)[0];
    if (typeof first === "string") return first;
    if (first?.message) return first.message;
  }
  return "Failed to create product.";
}

const ButtonSpinner = () => (
  <svg
    className="animate-spin h-5 w-5 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const ProductForm = () => {
  const formId = useId();
  const [form, setForm] = useState(initialForm);
  /** { id, file, previewUrl }[] */
  const [imageItems, setImageItems] = useState([]);
  const imageItemsRef = useRef(imageItems);
  imageItemsRef.current = imageItems;

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Revoke blob URLs only on unmount (avoid revoking still-visible previews on partial remove)
  useEffect(() => {
    return () => {
      imageItemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onImageChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setError("");
    setSuccess("");

    setImageItems((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      const next = selected.slice(0, MAX_IMAGES).map((file, idx) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${idx}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return next;
    });
    e.target.value = "";
  };

  const removeImage = (id) => {
    setImageItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const validate = () => {
    if (!form.name.trim()) return "Product name is required.";
    if (!form.description.trim()) return "Description is required.";
    if (form.price === "" || Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      return "Please enter a valid price.";
    }
    if (!form.category.trim()) return "Please select a category.";
    return null;
  };

  const resetAll = () => {
    setForm(initialForm);
    setImageItems((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("description", form.description.trim());
      formData.append("price", String(form.price));
      formData.append("category", form.category.trim());
      formData.append("countInStock", form.countInStock === "" ? "0" : String(form.countInStock));

      imageItems.forEach(({ file }) => {
        formData.append("images", file);
      });

      await api.post("/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess(`✨ "${form.name}" has been created successfully! It's now live on ShopEasy.`);
      resetAll();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Create product</h2>
      <p className="text-sm text-gray-500 mb-6">Add a new product with images (up to {MAX_IMAGES}).</p>

      {success && (
        <div text-sm text-emerald-800 flex items-center gap-3
          role="status">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Success!</p>
            <p className="text-emerald-700">{success}</p>
          </div>
          {success}
        </div>
      )}
      {error && (
        <div
          className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id={`${formId}-name`}
            name="name"
            value={form.name}
            onChange={onChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
            placeholder="Product name"
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-description`} className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id={`${formId}-description`}
            name="description"
            value={form.description}
            onChange={onChange}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition resize-y min-h-[100px]"
            placeholder="Describe your product"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${formId}-price`} className="block text-sm font-medium text-gray-700 mb-1">
              Price <span className="text-red-500">*</span>
            </label>
            <input
              id={`${formId}-price`}
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={onChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="0.00"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-countInStock`} className="block text-sm font-medium text-gray-700 mb-1">
              Stock
            </label>
            <input
              id={`${formId}-countInStock`}
              name="countInStock"
              type="number"
              min="0"
              value={form.countInStock}
              onChange={onChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${formId}-category`} className="block text-sm font-medium text-gray-700 mb-1">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id={`${formId}-category`}
            name="category"
            value={form.category}
            onChange={onChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition bg-white"
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${formId}-images`} className="block text-sm font-medium text-gray-700 mb-1">
            Images {imageItems.length > 0 && <span className="text-brand font-semibold">({imageItems.length}/{MAX_IMAGES} selected)</span>}
          </label>
          <input
            id={`${formId}-images`}
            type="file"
            accept="image/*"
            multiple
            onChange={onImageChange}
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand/90"
            disabled={imageItems.length >= MAX_IMAGES}
          />
          {imageItems.length > 0 && (
            <p className="mt-1 text-xs text-emerald-600 font-medium">✓ {imageItems.length} file(s) selected and ready to upload</p>
          )}
          {imageItems.length < MAX_IMAGES && (
            <p className="mt-1 text-xs text-gray-400">PNG, JPG, WebP up to {MAX_IMAGES} images.</p>
          )}
        </div>

        {imageItems.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {imageItems.map((item) => (
                <div key={item.id} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-32 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(item.id)}
                    className="absolute top-2 right-2 rounded-full bg-black/60 text-white p-1.5 text-xs opacity-0 group-hover:opacity-100 focus:opacity-100 transition hover:bg-black/80"
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {loading ? (
            <>
              <ButtonSpinner />
              Creating…
            </>
          ) : (
            "Create product"
          )}
        </button>
      </form>
    </div>
  );
};

export default ProductForm;
