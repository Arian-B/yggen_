import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Gate expedition creation on auth
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await api.expedition.create(query.trim(), user!.user_id);
      const rootNodeId = result.root_node?.node_id;
      if (rootNodeId) {
        navigate(`/learn/${rootNodeId}`);
      } else {
        setError('Could not start expedition. Please try a different topic.');
      }
    } catch {
      setError('Wikipedia page not found. Try a more specific topic.');
    } finally {
      setIsLoading(false);
    }
  };

  const exampleTopics = [
    'The Roman Empire',
    'Photosynthesis',
    'Black Holes',
    'The French Revolution',
    'Machine Learning',
    'DNA',
  ];

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 relative">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <div className="text-xs font-mono tracking-[0.6em] text-gray-400 uppercase mb-4">
            wikiyggen_
          </div>
          <h1 className="text-7xl md:text-9xl font-bold tracking-tighter text-black mb-6">
            Explore.<span className="text-yggen-teal">Learn.</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Search any Wikipedia topic and explore it as a living, interactive knowledge graph.
            Follow hyperlinks, see connections, and track your entire learning journey.
          </p>
        </motion.div>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="w-full max-w-2xl"
        >
          <form onSubmit={handleSearch} className="relative">
            <div className="relative flex items-center border-b-2 border-black focus-within:border-yggen-teal transition-colors duration-300">
              <Search className="absolute left-2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Wikipedia... e.g. The Solar System"
                disabled={isLoading}
                className="w-full bg-transparent text-2xl py-4 pl-10 pr-4 text-black placeholder-gray-300 focus:outline-none"
                autoFocus
              />
              <AnimatePresence>
                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Loader2 className="w-6 h-6 text-yggen-teal animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {isLoading && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-yggen-teal tracking-widest uppercase mt-3 text-center animate-pulse"
                >
                  Fetching Wikipedia graph...
                </motion.p>
              )}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-red-500 mt-3 text-center"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </form>

          {/* Example Topics */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex flex-wrap gap-2 justify-center"
          >
            {exampleTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => setQuery(topic)}
                disabled={isLoading}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-500 hover:border-yggen-teal hover:text-black transition-all duration-200 tracking-wide"
              >
                {topic}
              </button>
            ))}
          </motion.div>
        </motion.div>

      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-300 tracking-widest uppercase">
        Powered by Wikipedia + AI — wikiyggen_
      </footer>
    </div>
  );
};

export default LandingPage;
