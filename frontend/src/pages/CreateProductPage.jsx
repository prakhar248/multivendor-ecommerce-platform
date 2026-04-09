import { useNavigate } from "react-router-dom";
import ProductFormWithImages from "../components/ProductFormWithImages";

const CreateProductPage = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate("/seller");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Create New Product</h1>
          <p className="text-gray-600 mt-2">Add a new product to your store with images, pricing, and inventory details</p>
        </div>
        <ProductFormWithImages onSuccess={handleSuccess} />
      </div>
    </div>
  );
};

export default CreateProductPage;
