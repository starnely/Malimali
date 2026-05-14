import React from 'react';

const AuthLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-white">
      {/* LEFT SIDE: Your Developer Branding */}
      <div className="hidden lg:flex w-1/2 bg-gray-50 flex-col items-center justify-center border-r p-12">
        <div className="text-center">
          {/* Your Dev Logo */}
          <div className="bg-black text-white w-12 h-12 flex items-center justify-center rounded-md mx-auto mb-6 text-xl font-bold">
            MKD
          </div>
          
          <h1 className="text-blue-500 font-bold text-3xl mb-2">
            POS (Point Of Sales) v2.0
          </h1>
          
          {/* Illustration Placeholder */}
          <div className="my-8">
             <img 
               src="/pos.jpg" 
               alt="POS System" 
               className="w-full max-w-md mx-auto"
             />
          </div>

          <div className="mt-12 text-gray-400 text-sm">
            <p>© 2026 - 2050 POS (Point Of Sales) v2.0.</p>
            <p>Designed & Developed by: <span className="text-blue-400 font-medium">NthigaERPTech</span></p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Dynamic Content */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;