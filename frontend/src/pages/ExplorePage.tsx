import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, ExternalLink, Clock, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SearchResult {
  title: string;
  description: string;
  url: string;
}

const ExplorePage = () => {
  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<SearchResult[]>([]);
  const [searching, setSearching]       = useState(false);   // live dropdown search
  const [launching, setLaunching]       = useState(false);   // expedition creation
  const [activeIndex, setActiveIndex]   = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError]               = useState('');
  const navigate   = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search History State
  const [history, setHistory] = useState<string[]>([]);

  // Synchronize search history when active user changes (e.g., login/logout)
  useEffect(() => {
    const historyKey = user?.user_id ? `wikiyggen_search_history_${user.user_id}` : 'wikiyggen_search_history_guest';
    try {
      const saved = localStorage.getItem(historyKey);
      setHistory(saved ? JSON.parse(saved) : []);
    } catch {
      setHistory([]);
    }
  }, [user?.user_id]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.expedition.search(query);
        setResults(data.results || []);
        setShowDropdown((data.results || []).length > 0);
        setActiveIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Save query to localStorage history
  const saveToHistory = useCallback((topic: string) => {
    setHistory(prev => {
      const filtered = prev.filter(t => t.toLowerCase() !== topic.toLowerCase());
      const updated = [topic, ...filtered].slice(0, 5); // limit to last 5
      const historyKey = user?.user_id ? `wikiyggen_search_history_${user.user_id}` : 'wikiyggen_search_history_guest';
      localStorage.setItem(historyKey, JSON.stringify(updated));
      return updated;
    });
  }, [user?.user_id]);

  // Launch expedition
  const launchExpedition = useCallback(async (title: string) => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setShowDropdown(false);
    setLaunching(true);
    setError('');
    try {
      saveToHistory(title);
      const result = await api.expedition.create(title, user!.user_id);
      const rootNodeId = result.root_node?.node_id;
      if (rootNodeId) {
        navigate(`/learn/${rootNodeId}`);
      } else {
        setError('Could not start expedition. Please try a different topic.');
      }
    } catch {
      setError('Failed to start expedition. Please try again.');
    } finally {
      setLaunching(false);
    }
  }, [isAuthenticated, navigate, user, saveToHistory]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || results.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = activeIndex >= 0 ? results[activeIndex] : results[0];
      if (chosen) launchExpedition(chosen.title);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  const exampleTopics = ['Black hole', 'Photosynthesis', 'Roman Empire', 'Machine learning', 'DNA', 'Quantum mechanics'];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 flex flex-col transition-colors duration-200 relative">
      
      {/* Top Header Bar */}
      <header className="absolute top-0 right-0 left-0 px-8 py-6 flex justify-between items-center z-30">
        <div />
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link to="/profile" className="flex items-center gap-2 group">
              <span className="text-xs text-gray-500 group-hover:text-black dark:text-zinc-400 dark:group-hover:text-white font-medium transition-colors">
                {user?.display_name || user?.email}
              </span>
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name || 'Profile'}
                  className="w-8 h-8 rounded-full object-cover hover:ring-2 hover:ring-yggen-teal transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-black dark:bg-zinc-800 text-white dark:text-zinc-200 flex items-center justify-center font-bold text-sm hover:ring-2 hover:ring-yggen-teal transition-all">
                  {(user?.display_name || user?.email || 'U')[0].toUpperCase()}
                </div>
              )}
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-xs px-4 py-2 border border-black dark:border-zinc-700 bg-black dark:bg-zinc-900 text-white dark:text-zinc-100 hover:bg-yggen-teal hover:border-yggen-teal transition-all uppercase tracking-widest"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 relative">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <div className="text-xs font-mono tracking-[0.6em] text-gray-400 dark:text-zinc-550 uppercase mb-4">Explore Graph</div>
          <h1 className="text-7xl md:text-9xl font-bold tracking-tighter text-black dark:text-white mb-6">
            Search.<span className="text-yggen-teal">Discover.</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            Begin your learning journey by typing any subject. Yggen compiles real Wikipedia categories into interactive learning nodes.
          </p>
        </motion.div>

        {/* Search Input Box */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="w-full max-w-2xl"
          ref={dropdownRef}
        >
          <div className="relative">
            <div className="relative flex items-center border-b-2 border-black dark:border-zinc-700 focus-within:border-yggen-teal transition-colors duration-300">
              <Search className="absolute left-2 w-5 h-5 text-gray-400 dark:text-zinc-550 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                placeholder="Search Wikipedia... e.g. Quantum Computing"
                disabled={launching}
                className="w-full bg-transparent text-2xl py-4 pl-10 pr-10 text-black dark:text-zinc-100 placeholder-gray-300 dark:placeholder-zinc-700 focus:outline-none"
                autoFocus
                autoComplete="off"
              />
              <AnimatePresence>
                {(searching || launching) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute right-2">
                    <Loader2 className="w-5 h-5 text-yggen-teal animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {showDropdown && results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full z-50 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg"
                  style={{ maxHeight: '360px', overflowY: 'auto' }}
                >
                  <div className="px-4 py-1.5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 dark:text-zinc-550 tracking-widest uppercase">Wikipedia Results</span>
                    <span className="text-[10px] text-gray-300 dark:text-zinc-650">{results.length} matches</span>
                  </div>

                  {results.map((r, i) => (
                    <button
                      key={r.title}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => launchExpedition(r.title)}
                      className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 transition-colors group border-b border-gray-50 dark:border-zinc-800/40 last:border-0"
                      style={{
                        background: i === activeIndex ? 'rgba(0,173,181,0.07)' : 'transparent',
                        borderLeft: i === activeIndex ? '2px solid #00ADB5' : '2px solid transparent',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100" style={{ color: i === activeIndex ? '#00ADB5' : undefined }}>
                          {r.title}
                        </div>
                        {r.description && (
                          <div className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 line-clamp-1 truncate">
                            {r.description}
                          </div>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#00ADB5' }} />
                    </button>
                  ))}

                  <div className="px-4 py-2 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-3 text-[10px] text-gray-300 dark:text-zinc-500">
                    <span>↑↓ navigate</span>
                    <span>↵ launch expedition</span>
                    <span>esc close</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Loader messages */}
          <AnimatePresence>
            {launching && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-yggen-teal tracking-widest uppercase mt-3 text-center animate-pulse">
                Fetching Wikipedia graph...
              </motion.p>
            )}
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-500 mt-3 text-center">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Timeline-style Search History */}
          {history.length > 0 && query.trim().length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 max-w-md mx-auto"
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500 mb-6 text-center font-bold">
                Recent Expeditions
              </div>
              <div className="relative pl-6 border-l-2 border-dashed border-gray-200 dark:border-zinc-800 space-y-5 text-left">
                {history.map((item, idx) => (
                  <div key={idx} className="relative flex items-center group">
                    {/* Clock Icon Node */}
                    <div className="absolute -left-[33px] bg-white dark:bg-zinc-950 p-1 rounded-full border border-gray-200 dark:border-zinc-800 text-gray-400 dark:text-zinc-500 group-hover:text-yggen-teal group-hover:border-yggen-teal transition-all">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    
                    {/* Topic Link */}
                    <button
                      onClick={() => launchExpedition(item)}
                      disabled={launching}
                      className="text-sm text-gray-650 dark:text-zinc-350 hover:text-yggen-teal dark:hover:text-white transition-colors text-left flex-1"
                    >
                      {item}
                    </button>
                    
                    {/* Delete Item */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistory(prev => {
                          const updated = prev.filter(t => t !== item);
                          const historyKey = user?.user_id ? `wikiyggen_search_history_${user.user_id}` : 'wikiyggen_search_history_guest';
                          localStorage.setItem(historyKey, JSON.stringify(updated));
                          return updated;
                        });
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-zinc-650 hover:text-red-400 dark:hover:text-red-500 p-1 transition-all"
                      title="Remove from history"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Example suggestions */}
          {query.trim().length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-12 flex flex-wrap gap-2 justify-center"
            >
              {exampleTopics.map(topic => (
                <button
                  key={topic}
                  onClick={() => { setQuery(topic); inputRef.current?.focus(); }}
                  disabled={launching}
                  className="text-xs px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:border-yggen-teal dark:hover:border-yggen-teal hover:text-black dark:hover:text-white transition-all duration-200 tracking-wide"
                >
                  {topic}
                </button>
              ))}
            </motion.div>
          )}
        </motion.div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-350 dark:text-zinc-600 tracking-widest uppercase">
        Powered by Wikipedia Rest API + AI — wikiyggen_
      </footer>
    </div>
  );
};

export default ExplorePage;
