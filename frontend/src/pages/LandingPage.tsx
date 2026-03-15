import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SearchResult {
  title: string;
  description: string;
  url: string;
}

const LandingPage = () => {
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

  // ── Debounced Wikipedia opensearch ───────────────────────────────────────
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

  // ── Launch expedition with a confirmed title ──────────────────────────────
  const launchExpedition = useCallback(async (title: string) => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setShowDropdown(false);
    setLaunching(true);
    setError('');
    try {
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
  }, [isAuthenticated, navigate, user]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || results.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Enter with no dropdown: trigger search to show results
        // (debounce already handles this, so just focus)
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
    <div className="min-h-screen bg-white text-black flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 relative">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <div className="text-xs font-mono tracking-[0.6em] text-gray-400 uppercase mb-4">wikiyggen_</div>
          <h1 className="text-7xl md:text-9xl font-bold tracking-tighter text-black mb-6">
            Explore.<span className="text-yggen-teal">Learn.</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Search any Wikipedia topic and explore it as a living, interactive knowledge graph.
            Follow hyperlinks, see connections, and track your entire learning journey.
          </p>
        </motion.div>

        {/* Search + Dropdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="w-full max-w-2xl"
          ref={dropdownRef}
        >
          {/* Input Row */}
          <div className="relative">
            <div className="relative flex items-center border-b-2 border-black focus-within:border-yggen-teal transition-colors duration-300">
              <Search className="absolute left-2 w-5 h-5 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                placeholder="Search Wikipedia... e.g. The Solar System"
                disabled={launching}
                className="w-full bg-transparent text-2xl py-4 pl-10 pr-10 text-black placeholder-gray-300 focus:outline-none"
                autoFocus
                autoComplete="off"
              />
              {/* Spinner — shows for both live search and expedition creation */}
              <AnimatePresence>
                {(searching || launching) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute right-2">
                    <Loader2 className="w-5 h-5 text-yggen-teal animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Dropdown ── */}
            <AnimatePresence>
              {showDropdown && results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 right-0 top-full z-50 border border-gray-200 bg-white shadow-lg"
                  style={{ maxHeight: '360px', overflowY: 'auto' }}
                >
                  {/* Wikipedia branding strip */}
                  <div className="px-4 py-1.5 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 tracking-widest uppercase">Wikipedia results</span>
                    <span className="text-[10px] text-gray-300">{results.length} matches</span>
                  </div>

                  {results.map((r, i) => (
                    <button
                      key={r.title}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => launchExpedition(r.title)}
                      className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 transition-colors group border-b border-gray-50 last:border-0"
                      style={{
                        background: i === activeIndex ? 'rgba(0,173,181,0.07)' : 'transparent',
                        borderLeft: i === activeIndex ? '2px solid #00ADB5' : '2px solid transparent',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm font-semibold truncate"
                          style={{ color: i === activeIndex ? '#00ADB5' : '#111' }}
                        >
                          {r.title}
                        </div>
                        {r.description && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 truncate">
                            {r.description}
                          </div>
                        )}
                      </div>
                      <ExternalLink
                        className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: '#00ADB5' }}
                      />
                    </button>
                  ))}

                  {/* Footer hint */}
                  <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-300">
                    <span>↑↓ navigate</span>
                    <span>↵ launch expedition</span>
                    <span>esc close</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status messages */}
          <AnimatePresence>
            {launching && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-yggen-teal tracking-widest uppercase mt-3 text-center animate-pulse">
                Fetching Wikipedia graph...
              </motion.p>
            )}
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-xs text-red-500 mt-3 text-center">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Example topics */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex flex-wrap gap-2 justify-center"
          >
            {exampleTopics.map(topic => (
              <button
                key={topic}
                onClick={() => { setQuery(topic); inputRef.current?.focus(); }}
                disabled={launching}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-500 hover:border-yggen-teal hover:text-black transition-all duration-200 tracking-wide"
              >
                {topic}
              </button>
            ))}
          </motion.div>
        </motion.div>

      </main>

      <footer className="py-4 text-center text-xs text-gray-300 tracking-widest uppercase">
        Powered by Wikipedia + AI — wikiyggen_
      </footer>
    </div>
  );
};

export default LandingPage;
