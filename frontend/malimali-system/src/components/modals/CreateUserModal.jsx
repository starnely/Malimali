import React, { useState } from "react";
import FormInputDropdown from "../../pages/Products/FormInputDropdown";

export default function CreateUserModal({ isOpen, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    fullname: "",
    username: "",
    email: "",
    password: "",
    role: "cashier",
    store: "Store One"
  });
  const [showPassword, setShowPassword] = useState(false);

  const generatePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    for (let i = 0; i < 12; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({ ...formData, password: retVal });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Create User Account</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="space-y-3">
          <label className="block text-sm text-gray-600">Fullname</label>
          <input 
            className="w-full px-3 py-2 border rounded-md"
            value={formData.fullname}
            onChange={(e) => setFormData({...formData, fullname: e.target.value})}
            placeholder="John Smith"
          />

          <label className="block text-sm text-gray-600">Username</label>
          <input 
            className="w-full px-3 py-2 border rounded-md"
            value={formData.username}
            onChange={(e) => setFormData({...formData, username: e.target.value})}
          />

          <label className="block text-sm text-gray-600">e-Mail</label>
          <input 
            type="email"
            className="w-full px-3 py-2 border rounded-md"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />

          <label className="block text-sm text-gray-600">Password</label>
          <input 
            type={showPassword ? "text" : "password"}
            className="w-full px-3 py-2 border rounded-md mb-2"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
          />

          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={generatePassword}
              className="bg-gray-800 text-white px-3 py-1 text-sm rounded hover:bg-gray-700"
            >
              Generate Secure Password
            </button>
            <label className="flex items-center text-xs text-gray-500">
              <input 
                type="checkbox" 
                className="mr-1" 
                checked={showPassword} 
                onChange={() => setShowPassword(!showPassword)}
              /> Show password
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormInputDropdown 
              label="Role"
              value={formData.role}
              options={["owner", "manager", "cashier"]}
              onChange={(val) => setFormData({...formData, role: val})}
            />
            <FormInputDropdown 
              label="Warehouse/Store"
              value={formData.store}
              options={["Store One", "Store Two", "Warehouse"]}
              onChange={(val) => setFormData({...formData, store: val})}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Dismiss</button>
          <button 
            onClick={() => onCreate(formData)} 
            className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}