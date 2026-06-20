import { motion } from 'framer-motion';
import { ArrowRight, Compass, ShieldAlert, Zap, Cpu, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ScrollCanvas from '../components/canvas/ScrollCanvas';

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="relative bg-white dark:bg-black text-black dark:text-white min-h-screen font-sans selection:bg-yggen-teal selection:text-black overflow-x-hidden">
      {/* Background Interactive Scroll Canvas */}
      <ScrollCanvas frameCount={200} heightClass="h-[350vh]" />
      
      {/* Scrollable Overlay Content */}
      <div className="absolute top-0 left-0 w-full z-10 flex flex-col">
        
        {/* Section 1: Hero Cover */}
        <section className="h-screen w-full flex flex-col justify-center px-10 md:px-24 relative z-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl"
          >
            <div className="text-xs font-mono tracking-[0.6em] text-yggen-teal uppercase mb-4 glow-text">wikiyggen_ v1.0</div>
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-none mb-6">
              THE KNOWLEDGE <br />
              <span className="text-yggen-teal">EXPEDITION</span> ENGINE
            </h1>
            <p className="text-gray-400 text-lg md:text-xl max-w-2xl leading-relaxed mb-8">
              Transform flat reading into multi-dimensional knowledge maps. Powered by real Wikipedia rest structures, custom graph generation, and semantic drift detection.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/create"
                className="px-8 py-3.5 bg-yggen-teal text-black font-bold tracking-widest uppercase hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black hover:border-black dark:hover:border-white transition-all text-xs flex items-center gap-2 group border border-yggen-teal"
              >
                Launch Explore Mode
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              {!isAuthenticated && (
                <Link
                  to="/login"
                  className="px-8 py-3.5 border border-zinc-300 dark:border-zinc-700 hover:border-black dark:hover:border-white text-black dark:text-white transition-all tracking-widest text-xs uppercase"
                >
                  Join the Grid
                </Link>
              )}
            </div>
          </motion.div>
        </section>

        {/* Section 2: Features */}
        <section className="min-h-screen w-full flex flex-col justify-center px-10 md:px-24 py-32 bg-gray-50/40 dark:bg-black/40 backdrop-blur-sm border-y border-gray-150 dark:border-zinc-850">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Compass,
                title: "Radial Knowledge Graphing",
                desc: "Every article is dynamically resolved into a 2D knowledge graph. Follow concepts naturally via radial nodes rather than losing track in endless browser tabs."
              },
              {
                icon: ShieldAlert,
                title: "Semantic Drift Prevention",
                desc: "Our Groq-powered detector evaluates your clicks in real time. If a link wanders off-topic from your root context, Yggen catches it, giving you the choice to focus or fork."
              },
              {
                icon: Zap,
                title: "Gamified Expertise",
                desc: "Earn XP across subject domains. Reach high difficulty nodes to trigger interactive reflections, evaluated by Gemini to lock in your domain mastery."
              }
            ].map(({ icon: Icon, title, desc }, idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="p-8 border border-gray-250 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/30 backdrop-blur-md hover:border-yggen-teal transition-all duration-300 relative group"
              >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-yggen-teal scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300" />
                <Icon className="w-8 h-8 text-yggen-teal mb-6" />
                <h3 className="text-xl font-bold tracking-tight mb-3 text-black dark:text-white">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Section 3: Tech Details */}
        <section className="h-screen w-full flex flex-col justify-center px-10 md:px-24 bg-white/60 dark:bg-black/60 backdrop-blur-md relative">
          <div className="max-w-4xl mx-auto text-center">
            <Cpu className="w-12 h-12 text-yggen-teal mx-auto mb-8 animate-pulse" />
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter mb-6">
              API-FIRST CONTENT SOURCING
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
              Unlike other platforms that hallucinate, wikiyggen_ uses the official Wikipedia Parsoid REST API as the ground truth. AI is strictly relegated to summarization, drift assessment, and reflection validation.
            </p>
            <div className="inline-grid grid-cols-2 md:grid-cols-4 gap-8 justify-center text-center">
              {[
                { label: 'FastAPI', val: 'Async Web Server' },
                { label: 'ArangoDB', val: 'Multi-Model Graph' },
                { label: 'Google Gemini', val: 'Cognitive Engine' },
                { label: 'React Flow', val: 'Interactive UI' },
              ].map(tech => (
                <div key={tech.label} className="p-4 border border-gray-250 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950">
                  <div className="text-yggen-teal font-bold text-sm mb-1">{tech.label}</div>
                  <div className="text-zinc-500 text-[10px] uppercase tracking-wider">{tech.val}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Contact Footer */}
        <footer className="w-full bg-gray-50 dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 py-16 px-10 md:px-24">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div>
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-5 h-5 border border-yggen-teal rotate-45 flex items-center justify-center">
                  <div className="w-1 h-1 bg-yggen-teal rounded-full" />
                </div>
                <span className="font-bold tracking-widest uppercase text-xs text-black dark:text-white">wikiyggen_</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
                A modern visual gateway to human knowledge. Traverse concepts, build domain expertise profiles, and stay focused on your learning journeys.
              </p>
            </div>
            
            <div className="flex flex-col gap-3 text-xs">
              <span className="uppercase tracking-widest text-zinc-400 font-bold mb-2">Contact Us</span>
              <a href="mailto:support@wikiyggen.dev" className="flex items-center gap-2 text-zinc-500 hover:text-yggen-teal transition-colors">
                <Mail className="w-3.5 h-3.5" />
                support@wikiyggen.dev
              </a>
              <span className="flex items-center gap-2 text-zinc-500">
                <Phone className="w-3.5 h-3.5" />
                +1 (800) WIKI-YGN
              </span>
              <span className="flex items-center gap-2 text-zinc-500">
                <MapPin className="w-3.5 h-3.5" />
                Silicon Valley Grid Room 101, CA
              </span>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <span className="uppercase tracking-widest text-zinc-400 font-bold mb-2">Grid Navigation</span>
              <Link to="/create" className="text-zinc-500 hover:text-yggen-teal transition-colors">Explore Graph</Link>
              <Link to="/library" className="text-zinc-500 hover:text-yggen-teal transition-colors">User Library</Link>
              <Link to="/profile" className="text-zinc-500 hover:text-yggen-teal transition-colors">Explorer Profile</Link>
            </div>
          </div>
          
          <div className="max-w-6xl mx-auto pt-8 border-t border-gray-200 dark:border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-zinc-500 uppercase tracking-widest">
            <span>© {new Date().getFullYear()} wikiyggen_. All rights reserved.</span>
            <span>GRID SYSTEM STATUS: ONLINE</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;
