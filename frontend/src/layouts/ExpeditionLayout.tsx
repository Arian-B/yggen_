// import React from 'react';
import { Outlet } from 'react-router-dom';
import VerticalNavbar from '../components/layout/VerticalNavbar';
import XPDisplay from '../components/ui/XPDisplay';

const ExpeditionLayout = () => {
  return (
    <div className="min-h-screen bg-white text-black selection:bg-yggen-teal selection:text-white font-sans relative overflow-x-hidden">
      {/* Background Grid - Global minimalistic layer - Light */}
      <div className="fixed inset-0 bg-grid-pattern bg-grid-sm opacity-30 pointer-events-none z-0" />

      {/* Persistent Navigation */}
      <VerticalNavbar />

      {/* Status Features */}
      <XPDisplay />

      {/* Main Content Content */}
      <main className="ml-16 relative z-10 min-h-screen transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
};

export default ExpeditionLayout;
