import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Zap, Map, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// ── Web Audio snap sound ───────────────────────────────────────────────────
function playSnapSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Short sharp click: high freq that drops fast
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
    osc.onended = () => ctx.close();
  } catch { /* browser may block AudioContext without user gesture */ }
}

// ── Types ──────────────────────────────────────────────────────────────────
interface ExpeditionCard {
  expedition_id: string;
  root_topic: string;
  domain: string;
  nodes_visited: number;
  xp_earned: number;
  state: string;
  created_at: string;
}

interface LibraryData {
  total_expeditions: number;
  total_nodes_visited: number;
  total_xp: number;
  grouped_by_domain: Record<string, ExpeditionCard[]>;
}

const DOMAIN_ACCENT: Record<string, { dot: string; label: string }> = {
  Physics:          { dot: '#60a5fa', label: 'Physics' },
  History:          { dot: '#fb923c', label: 'History' },
  Biology:          { dot: '#4ade80', label: 'Biology' },
  Chemistry:        { dot: '#c084fc', label: 'Chemistry' },
  Technology:       { dot: '#00ADB5', label: 'Technology' },
  'Computer Science':{ dot: '#00ADB5', label: 'Computer Science' },
  Philosophy:       { dot: '#f87171', label: 'Philosophy' },
  Mathematics:      { dot: '#818cf8', label: 'Mathematics' },
  Geography:        { dot: '#fbbf24', label: 'Geography' },
  Economics:        { dot: '#34d399', label: 'Economics' },
  General:          { dot: '#94a3b8', label: 'General' },
};
const getDomain = (d: string) => DOMAIN_ACCENT[d] || DOMAIN_ACCENT.General;

// ── Expedition tile ────────────────────────────────────────────────────────
const ExpeditionTile = ({ exp, index }: { exp: ExpeditionCard; index: number }) => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const domain = getDomain(exp.domain);

  const handleEnter = useCallback(() => {
    setHovered(true);
    playSnapSound();
  }, []);

  const date = (() => {
    try { return new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  })();

  return (
    <motion.div
      // Snap child — each tile takes full viewport height minus header
      className="scroll-snap-align-start relative w-full cursor-pointer select-none"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: 'easeOut' }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/learn/${exp.expedition_id}`)}
      style={{ scrollSnapAlign: 'start', minHeight: '120px' }}
    >
      {/* Glow layer */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 pointer-events-none rounded-none"
            style={{
              background: 'linear-gradient(90deg, rgba(0,173,181,0.08) 0%, rgba(0,173,181,0.03) 100%)',
              boxShadow: 'inset 0 0 0 1.5px #00ADB5, 0 0 32px rgba(0,173,181,0.18)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Tile content */}
      <motion.div
        animate={{ scale: hovered ? 1.012 : 1, x: hovered ? 6 : 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative flex items-center justify-between px-8 py-7 border border-gray-100"
        style={{
          borderColor: hovered ? '#00ADB5' : undefined,
          transition: 'border-color 0.12s ease',
        }}
      >
        {/* Left — number + title */}
        <div className="flex items-center gap-6 flex-1 min-w-0">
          {/* Index number */}
          <div
            className="text-4xl font-black tabular-nums tracking-tighter shrink-0 leading-none"
            style={{
              color: hovered ? '#00ADB5' : '#e5e7eb',
              transition: 'color 0.12s ease',
              fontVariantNumeric: 'tabular-nums',
              minWidth: '3.5rem',
            }}
          >
            {String(index + 1).padStart(2, '0')}
          </div>

          {/* Domain dot */}
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: domain.dot, boxShadow: hovered ? `0 0 8px ${domain.dot}` : 'none', transition: 'box-shadow 0.12s ease' }}
          />

          {/* Topic + meta */}
          <div className="min-w-0">
            <div
              className="text-xl font-bold tracking-tight truncate leading-tight"
              style={{ color: hovered ? '#00ADB5' : '#111' , transition: 'color 0.12s ease' }}
            >
              {exp.root_topic}
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
              <span
                className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 border"
                style={{ borderColor: domain.dot, color: domain.dot }}
              >
                {exp.domain}
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />{exp.nodes_visited} articles
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />{exp.xp_earned} XP
              </span>
              <span className="hidden sm:inline">{date}</span>
            </div>
          </div>
        </div>

        {/* Right — status + arrow */}
        <div className="flex items-center gap-4 shrink-0 ml-6">
          <span
            className="text-[10px] uppercase tracking-widest px-2 py-1 border"
            style={{
              borderColor: exp.state === 'completed' ? '#4ade80' : hovered ? '#00ADB5' : '#e5e7eb',
              color: exp.state === 'completed' ? '#4ade80' : hovered ? '#00ADB5' : '#9ca3af',
              transition: 'all 0.12s ease'
            }}
          >
            {exp.state === 'completed' ? 'Complete' : 'Active'}
          </span>

          <motion.div
            animate={{ x: hovered ? 4 : 0, opacity: hovered ? 1 : 0.3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            <ArrowRight
              className="w-5 h-5"
              style={{ color: hovered ? '#00ADB5' : '#d1d5db', transition: 'color 0.12s ease' }}
            />
          </motion.div>
        </div>

        {/* Scan line effect on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              key="scan"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: 1 }}
              exit={{ scaleX: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, #00ADB5, transparent)' }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

// ── Main Library component ─────────────────────────────────────────────────
const Library = () => {
  const { user } = useAuth();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.user_id) return;
    api.user.getExpeditions(user.user_id)
      .then(setData)
      .catch(() => setError('Failed to load library.'))
      .finally(() => setLoading(false));
  }, [user?.user_id]);

  // Flatten all expeditions across domains into one sorted list
  const allExpeditions: ExpeditionCard[] = data
    ? Object.values(data.grouped_by_domain)
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-px h-16 bg-gradient-to-b from-transparent via-yggen-teal to-transparent animate-pulse" />
        <span className="text-yggen-teal text-xs tracking-widest uppercase animate-pulse">Loading library...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-red-400 text-sm">{error}</div>
  );

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">

      {/* Fixed header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-8 py-6 flex items-end justify-between">
        <div>
          <div className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Knowledge Library</div>
          <h1 className="text-3xl font-black tracking-tighter leading-none">
            Your Expeditions
            <span className="text-yggen-teal ml-2 text-2xl">{allExpeditions.length > 0 ? `[${allExpeditions.length}]` : ''}</span>
          </h1>
        </div>

        {/* Stats inline */}
        {data && (
          <div className="hidden sm:flex items-center gap-8 text-right">
            {[
              { v: data.total_xp.toLocaleString(), l: 'XP' },
              { v: data.total_nodes_visited, l: 'Articles' },
              { v: data.total_expeditions, l: 'Runs' },
            ].map(s => (
              <div key={s.l}>
                <div className="text-xl font-bold tracking-tighter text-yggen-teal">{s.v}</div>
                <div className="text-[9px] uppercase tracking-widest text-gray-400">{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scroll-snap list */}
      {allExpeditions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-6">
          <div className="w-16 h-px bg-yggen-teal mx-auto" />
          <BookOpen className="w-8 h-8 text-gray-200" />
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">No expeditions yet</p>
            <p className="text-xs text-gray-400">Search a topic on the home page to start one</p>
          </div>
          <a href="/"
            className="text-xs border border-yggen-teal text-yggen-teal px-5 py-2 hover:bg-yggen-teal hover:text-white transition-all tracking-widest uppercase">
            Start Exploring
          </a>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-8 pt-4 pb-16"
          style={{
            scrollSnapType: 'y mandatory',
            scrollBehavior: 'smooth',
            // Webkit scroll snap
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Thin teal scan line at top */}
          <div className="w-full h-px bg-gradient-to-r from-yggen-teal via-transparent to-transparent mb-6 opacity-40" />

          {allExpeditions.map((exp, i) => (
            <ExpeditionTile key={exp.expedition_id} exp={exp} index={i} />
          ))}

          {/* Bottom spacer */}
          <div className="h-24" style={{ scrollSnapAlign: 'start' }} />
        </div>
      )}

      {/* Scroll hint */}
      {allExpeditions.length > 3 && (
        <div className="absolute bottom-6 right-8 flex flex-col items-center gap-1 opacity-30 pointer-events-none">
          <div className="text-[9px] uppercase tracking-widest text-gray-500">scroll</div>
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="w-px h-6 bg-gradient-to-b from-gray-400 to-transparent"
          />
        </div>
      )}
    </div>
  );
};

export default Library;
