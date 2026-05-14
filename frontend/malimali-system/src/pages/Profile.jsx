import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  MdPerson, MdBusiness, MdEmail,
  MdPhone, MdLocationOn, MdEdit, MdSave, MdCancel
} from 'react-icons/md';

export default function Profile() {
  const { currentUser, settings, setSettings } = useApp();

  // 1. State for toggling edit mode
  const [isEditing, setIsEditing] = useState(false);

  // 2. Local state for form inputs
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    phone: '',
    location: ''
  });

  // 3. Populate form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        companyName: settings.companyName || '',
        email: settings.email || '',
        phone: settings.phone || '',
        location: settings.location || ''
      });
    }
  }, [settings]);

  const adminSuffix = currentUser?._id ? currentUser._id.toString().slice(-4).toUpperCase() : "0000";

  // 4. Save handler to update the database
  const handleSave = async () => {
    try {
      // Access the token from the currentUser
      const token = currentUser?.token;
      if (!token) {
        alert("Session expired. Please login again.");
        return;
      }

      const res = await fetch("http://localhost:5000/api/setup/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSettings(data.settings); // Update global context
        setIsEditing(false);
        alert("Business profile updated successfully!");
      } else {
        alert(data.error || "Failed to update profile.");
      }
    } catch (err) {
      console.error("Failed to update settings:", err);
      alert("Network error: Could not reach server.");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>

        {/* Toggle Button */}
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold transition-all shadow-sm ${isEditing ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {isEditing ? <><MdSave /> Save Changes</> : <><MdEdit /> Edit Business Info</>}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Side: Personal Info (Read Only) */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-blue-50 rounded-full mb-4 flex items-center justify-center text-blue-600 border-2 border-blue-100 shadow-inner">
            <MdPerson size={48} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{currentUser?.name || "User Name"}</h2>
          <p className="text-blue-600 text-xs uppercase font-black tracking-widest mt-1">
            {currentUser?.role || "Staff"}
          </p>

          <div className="mt-8 w-full text-left space-y-4 border-t pt-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Admin ID:</span>
              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                MLR-{adminSuffix}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Email:</span>
              <span className="text-gray-700 font-medium">{currentUser?.username || "Not set"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Status:</span>
              <span className="text-green-500 font-bold flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Editable Company Settings */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border">
          <div className="flex items-center gap-2 mb-6 border-b pb-4">
            <MdBusiness className="text-gray-400 text-xl" />
            <h3 className="font-bold text-gray-700">Company Profile Settings</h3>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Company Name</label>
              <input
                disabled={!isEditing}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-xl mt-1 border border-gray-100 text-gray-800 font-semibold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-75"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Business Email</label>
              <div className="relative mt-1">
                <MdEmail className="absolute left-3 top-4 text-gray-400" />
                <input
                  disabled={!isEditing}
                  className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-100 text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-75"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Phone Number</label>
              <div className="relative mt-1">
                <MdPhone className="absolute left-3 top-4 text-gray-400" />
                <input
                  disabled={!isEditing}
                  className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-100 text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-75"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Address</label>
              <div className="relative mt-1">
                <MdLocationOn className="absolute left-3 top-4 text-gray-400" />
                <textarea
                  disabled={!isEditing}
                  rows="2"
                  className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-100 text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-75 resize-none"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            {isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}