// import React from 'react';
import VerticalNavbar from '../components/layout/VerticalNavbar';
import { Link } from 'react-router-dom';
import ScrollCanvas from '../components/canvas/ScrollCanvas';

const LandingPage = () => {
  return (
    <div className="bg-white min-h-screen text-black flex flex-col">
      {/* Navigation */}
      <VerticalNavbar />
      
      {/* Main Content Area */}
      <main className="ml-24 relative flex-1 flex flex-col">
        
        {/* Hero Section */}
        <section className="h-screen flex flex-col justify-center items-center px-8 relative overflow-hidden">
             
             {/* Canvas Placeholder */}
             <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
                {/* Future ScrollCanvas integration */}
                <ScrollCanvas frameCount={300} heightClass="h-full" />
             </div>

             <div className="z-10 text-center max-w-4xl">
                 <div className="mb-6 text-xs font-mono tracking-[0.5em] text-gray-400 uppercase">Input / Output</div>
                 <h1 className="text-9xl font-bold tracking-tighter mb-8 text-black">
                    YGGEN<span className="text-yggen-teal">.</span>
                 </h1>
                 <p className="text-2xl font-light text-gray-600 leading-relaxed max-w-2xl mx-auto">
                    The knowledge traversal engine. <br/>
                    Map your curiosity.
                 </p>
             </div>

             <div className="absolute bottom-20">
                <Link to="/create" className="group flex items-center gap-4 text-sm font-bold tracking-widest uppercase hover:text-yggen-teal transition-colors duration-300">
                    <div>Initialize Expedition</div>
                    <div className="w-12 h-[1px] bg-black group-hover:bg-yggen-teal transition-colors" />
                </Link>
             </div>
        </section>

      </main>
    </div>
  );
};

export default LandingPage;
