import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import AuthLayout from '../components/shared/AuthLayout';

const SetupWizard = () => {
    const { setupOwner } = useApp();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: '', phone: '', email: '', location: '', logo: null,
        ownerName: '', ownerEmail: '', ownerPassword: '', activationCode: ''
    });

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        setFormData({ ...formData, [name]: files ? files[0] : value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const data = new FormData();
        // Use the EXACT keys your 'clean' setup.js is looking for:
        data.append('companyName', formData.companyName);
        data.append('phone', formData.phone);
        data.append('email', formData.email);
        data.append('location', formData.location);
        data.append('logo', formData.logo); // This is the file
        data.append('ownerName', formData.ownerName);
        data.append('ownerEmail', formData.ownerEmail);
        data.append('ownerPassword', formData.ownerPassword);
        data.append('activationCode', formData.activationCode);

        const result = await setupOwner(data);

        if (result.success) {
            alert("Configuration Success! Welcome to your new POS.");
            window.location.href = '/login';
        } else {
            alert("Setup failed: " + (result.error || result.message));
        }
        setLoading(false);
    };

    const inputClass = "w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm";

    return (
        <AuthLayout>
            <div className="p-6">
                <div className="flex justify-between mb-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`h-1.5 w-full mx-1 rounded-full ${step >= i ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    ))}
                </div>

                <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); setStep(step + 1); }}>
                    {step === 1 && (
                        <div className="space-y-4 animate-fadeIn">
                            <h2 className="text-2xl font-bold text-gray-800">Business Details</h2>
                            <p className="text-sm text-gray-500">Let's brand your system.</p>
                            <input name="companyName" placeholder="Company Name" onChange={handleChange} className={inputClass} required />
                            <input name="phone" placeholder="Business Phone" onChange={handleChange} className={inputClass} />
                            <input name="location" placeholder="Address / City" onChange={handleChange} className={inputClass} />
                            <div className="p-4 border-2 border-dashed border-gray-200 rounded-xl text-center">
                                <span className="text-xs text-gray-400 block mb-2 font-medium">Upload Business Logo</span>
                                <input name="logo" type="file" onChange={handleChange} className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-xl shadow-lg transition">Continue</button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-fadeIn">
                            <h2 className="text-2xl font-bold text-gray-800">Administrator</h2>
                            <p className="text-sm text-gray-500">Create the primary owner account.</p>

                            <input
                                name="ownerName"
                                placeholder="Full Name"
                                onChange={handleChange}
                                className={inputClass} required />

                            <input
                                name="ownerEmail"
                                type="email"
                                placeholder="Login Email"
                                onChange={handleChange}
                                className={inputClass} required />

                            <input
                                name="ownerPassword"
                                type="password"
                                placeholder="Secure Password"
                                onChange={handleChange}
                                className={inputClass} required />

                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-xl shadow-lg transition">Next Step</button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-fadeIn text-center">
                            <div className="text-5xl mb-4">🚀</div>
                            <h2 className="text-2xl font-bold text-gray-800">Activation</h2>
                            <p className="text-sm text-gray-500">Enter your license key to activate the software.</p>
                            <input name="activationCode" placeholder="XXXX-XXXX-XXXX" onChange={handleChange} className={`${inputClass} text-center tracking-widest font-mono uppercase`} required />
                            <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold p-3 rounded-xl shadow-lg transition disabled:opacity-50">
                                {loading ? "Initializing..." : "Activate System"}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </AuthLayout>
    );
};

export default SetupWizard;