import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Zap, ArrowRight, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

// ── Snap sound ─────────────────────────────────────────────────────────────
function playSnapSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
    osc.onended = () => ctx.close();
  } catch { /* blocked without user gesture */ }
}

// ── Types ──────────────────────────────────────────────────────────────────
interface ExpeditionCard {
  expedition_id: string;
  root_topic: string;
  category: string;
  domain: string;
  nodes_visited: number;
  xp_earned: number;
  state: string;
  created_at: string;
  root_node_id?: string | null;
}

interface LibraryData {
  total_expeditions: number;
  total_nodes_visited: number;
  total_xp: number;
  grouped_by_domain: Record<string, ExpeditionCard[]>;
  categories?: string[];
}

// ── Tab sound ──────────────────────────────────────────────────────────────
function playTabSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.09);
    osc.onended = () => ctx.close();
  } catch { /* noop */ }
}

// ── Y2K Windows-style tab component ───────────────────────────────────────
const Y2KTab = ({
  label, active, onClick, count
}: { label: string; active: boolean; onClick: () => void; count: number }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <button
      onClick={onClick}
      className="relative px-4 py-1.5 text-xs font-bold tracking-wide select-none focus:outline-none"
      style={{
        background: active ? (isDark ? '#18181b' : '#ffffff') : (isDark ? '#27272a' : '#d4d0c8'),
        color: active ? (isDark ? '#ffffff' : '#000000') : (isDark ? '#a1a1aa' : '#808080'),
        border: '1px solid',
        borderColor: active ? (isDark ? '#3f3f46' : '#ffffff') : (isDark ? '#27272a' : '#808080'),
        borderBottom: active ? (isDark ? '1px solid #18181b' : '1px solid #ffffff') : (isDark ? '1px solid #27272a' : '1px solid #808080'),
        marginBottom: active ? '-1px' : '0px',
        zIndex: active ? 10 : 1,
        fontFamily: 'Tahoma, "MS Sans Serif", Arial, sans-serif',
        cursor: 'pointer',
        boxShadow: active
          ? (isDark ? '1px 0 0 #18181b inset, 0 1px 0 #18181b inset, -1px 0 0 #3f3f46' : '1px 0 0 #ffffff inset, 0 1px 0 #ffffff inset, -1px 0 0 #808080')
          : 'none',
        minWidth: '60px',
        letterSpacing: '0.03em',
        transition: 'background 0.05s, color 0.05s',
      }}
    >
      {label}
      {count > 0 && (
        <span
          className="ml-1.5"
          style={{ color: active ? '#00ADB5' : (isDark ? '#52525b' : '#aaa'), fontWeight: 'bold' }}
        >
          ({count})
        </span>
      )}
    </button>
  );
};

// ── Expedition tile ────────────────────────────────────────────────────────
const ExpeditionTile = ({ exp, index, onDelete, onArchive }: { exp: ExpeditionCard; index: number; onDelete: (id: string) => void, onArchive: (id: string) => void }) => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  const handleEnter = useCallback(() => {
    setHovered(true);
    playSnapSound();
  }, []);

  const date = (() => {
    try { return new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  })();

  const handleContinue = (e: React.MouseEvent) => {
    e.stopPropagation();
    const dest = (exp as any).last_node_id || exp.root_node_id || exp.expedition_id;
    navigate(`/learn/${dest}`);
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const dest = exp.root_node_id || exp.expedition_id;
    navigate(`/learn/${dest}`);
  };

  const isArchived = exp.state === 'archived';

  return (
    <motion.div
      className="relative w-full select-none mb-4"
      style={{ scrollSnapAlign: 'start' }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.28, ease: 'easeOut' }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div key="glow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }} className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(90deg,rgba(0,173,181,0.07) 0%,transparent 100%)',
              boxShadow: 'inset 0 0 0 1.5px #00ADB5, 0 0 28px rgba(0,173,181,0.14)' }} />
        )}
      </AnimatePresence>

      <motion.div
        animate={{ scale: hovered ? 1.008 : 1, x: hovered ? 5 : 0 }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
        className={`relative flex items-center justify-between px-6 py-5 border bg-white/50 dark:bg-zinc-950/50 ${isArchived ? 'border-gray-200 dark:border-zinc-800 opacity-70' : 'border-gray-100 dark:border-zinc-800'}`}
        style={{ borderColor: hovered ? '#00ADB5' : undefined, transition: 'border-color 0.1s, opacity 0.2s' }}
      >
        {/* Index */}
        <div className="text-3xl font-black tabular-nums tracking-tighter shrink-0 leading-none mr-5 text-gray-200 dark:text-zinc-800"
          style={{ color: hovered ? '#00ADB5' : undefined, transition: 'color 0.1s', minWidth: '3rem' }}>
          {String(index + 1).padStart(2, '0')}
        </div>

        {/* Topic + meta */}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold tracking-tight truncate text-black dark:text-zinc-100"
            style={{ color: hovered ? '#00ADB5' : undefined, transition: 'color 0.1s' }}>
            {exp.root_topic}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-zinc-500 flex-wrap">
            <span className="text-[10px] border px-1.5 py-0.5 uppercase tracking-widest"
              style={{ borderColor: '#00ADB5', color: '#00ADB5', opacity: 0.7 }}>
              {exp.category || exp.domain}
            </span>
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{exp.nodes_visited} nodes</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{exp.xp_earned} XP</span>
            <span className="hidden sm:inline text-gray-300 dark:text-zinc-600">{date}</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-4 relative z-20">
          {/* Status Badge */}
          <span className="hidden md:inline-block text-[10px] uppercase tracking-widest px-2 py-0.5 border mr-2"
            style={{
              borderColor: isArchived ? '#9ca3af' : exp.state === 'completed' ? '#4ade80' : hovered ? '#00ADB5' : '#e5e7eb',
              color: isArchived ? '#9ca3af' : exp.state === 'completed' ? '#4ade80' : hovered ? '#00ADB5' : '#9ca3af',
              transition: 'all 0.1s'
            }}>
            {isArchived ? 'Inactive' : exp.state === 'completed' ? 'Done' : 'Active'}
          </span>

          <button
            onClick={handleRestart}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-zinc-700 hover:border-yggen-teal hover:text-yggen-teal transition-colors tracking-widest uppercase"
          >
            Origin
          </button>
          
          <button
            onClick={handleContinue}
            className="px-3 py-1.5 text-xs border border-yggen-teal bg-yggen-teal/10 text-yggen-teal hover:bg-yggen-teal hover:text-white transition-colors tracking-widest uppercase flex items-center gap-1"
          >
            Continue <ArrowRight className="w-3 h-3" />
          </button>

          {!isArchived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive(exp.expedition_id);
              }}
              className="px-3 py-1.5 ml-1 text-xs border border-gray-200 dark:border-zinc-700 hover:border-amber-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all tracking-widest uppercase"
              title="Archive Expedition"
            >
              Archive
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(exp.expedition_id);
            }}
            className="p-1.5 ml-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all rounded"
            title="Delete Expedition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom scan line */}
        <AnimatePresence>
          {hovered && (
            <motion.div key="scan" initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
              transition={{ duration: 0.15 }} className="absolute bottom-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg,#00ADB5,transparent)' }} />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

// ── Main Library ───────────────────────────────────────────────────────────
const Library = () => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Dialog state
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type: 'archive' | 'delete' | null;
    targetId: string | null;
  }>({ isOpen: false, type: null, targetId: null });

  useEffect(() => {
    if (!user?.user_id) return;
    api.user.getExpeditions(user.user_id)
      .then(setData)
      .catch(() => setError('Failed to load library.'))
      .finally(() => setLoading(false));
  }, [user?.user_id]);

  // All expeditions flat-sorted newest first
  const allExpeditions: ExpeditionCard[] = data
    ? Object.values(data.grouped_by_domain).flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : [];

  // Categories that have at least one expedition (sorted alphabetically)
  const usedCategories: string[] = data
    ? Object.keys(data.grouped_by_domain).sort()
    : [];

  // Filtered list for current tab
  const visibleExpeditions = activeTab === 'All'
    ? allExpeditions
    : allExpeditions.filter(e => (e.category || e.domain) === activeTab);

  const handleTabClick = (tab: string) => {
    playTabSound();
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const confirmAction = async () => {
    if (!dialogConfig.targetId || !dialogConfig.type) return;
    
    const id = dialogConfig.targetId;
    const type = dialogConfig.type;
    setDialogConfig({ isOpen: false, type: null, targetId: null });

    try {
      if (type === 'delete') {
        await api.expedition.delete(id);
        setData(prev => {
          if (!prev) return null;
          const updatedGrouped = { ...prev.grouped_by_domain };
          
          for (const domain in updatedGrouped) {
            updatedGrouped[domain] = updatedGrouped[domain].filter(e => e.expedition_id !== id);
            if (updatedGrouped[domain].length === 0) {
              delete updatedGrouped[domain];
            }
          }
          
          const allExp = Object.values(updatedGrouped).flat();
          const totalVisited = allExp.reduce((sum, e) => sum + e.nodes_visited, 0);
          const totalXp = allExp.reduce((sum, e) => sum + e.xp_earned, 0);
          
          return {
            ...prev,
            total_expeditions: allExp.length,
            total_nodes_visited: totalVisited,
            total_xp: totalXp,
            grouped_by_domain: updatedGrouped
          };
        });
      } else if (type === 'archive') {
        await api.expedition.archive(id);
        setData(prev => {
          if (!prev) return null;
          const updatedGrouped = { ...prev.grouped_by_domain };
          
          for (const domain in updatedGrouped) {
            updatedGrouped[domain] = updatedGrouped[domain].map(e => 
              e.expedition_id === id ? { ...e, state: 'archived' } : e
            );
          }
          
          return { ...prev, grouped_by_domain: updatedGrouped };
        });
      }
    } catch {
      alert(`Failed to ${type} expedition.`);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
      <div className="text-yggen-teal text-xs tracking-widest uppercase animate-pulse">Loading library...</div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-red-400 text-sm bg-white dark:bg-zinc-950">{error}</div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 flex flex-col transition-colors duration-200">

      {/* Header */}
      <div className="px-8 pt-10 pb-0 bg-white dark:bg-zinc-950">
        <div className="text-[10px] tracking-widest uppercase text-gray-400 dark:text-zinc-550 mb-1">Knowledge Library</div>
        <div className="flex items-end justify-between mb-6">
          <h1 className="text-3xl font-black tracking-tighter leading-none text-black dark:text-white">
            Your Expeditions
            {allExpeditions.length > 0 && (
              <span className="text-yggen-teal ml-2 text-2xl">[{allExpeditions.length}]</span>
            )}
          </h1>
          {data && (
            <div className="hidden sm:flex items-center gap-8 text-right">
              {[
                { v: data.total_xp.toLocaleString(), l: 'XP' },
                { v: data.total_nodes_visited, l: 'Articles' },
                { v: data.total_expeditions, l: 'Runs' },
              ].map(s => (
                <div key={s.l}>
                  <div className="text-xl font-bold tracking-tighter text-yggen-teal">{s.v}</div>
                  <div className="text-[9px] uppercase tracking-widest text-gray-400 dark:text-zinc-500">{s.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Y2K Windows Dialog Tabs ── */}
        {allExpeditions.length > 0 && (
          <div
            className="flex items-end gap-0 flex-wrap"
            style={{
              borderBottom: resolvedTheme === 'dark' ? '1px solid #3f3f46' : '1px solid #808080',
              paddingTop: '8px',
            }}
          >
            {/* "All" tab always first */}
            <Y2KTab
              label="All"
              active={activeTab === 'All'}
              onClick={() => handleTabClick('All')}
              count={allExpeditions.length}
            />
            {/* One tab per used category */}
            {usedCategories.map(cat => (
              <Y2KTab
                key={cat}
                label={cat}
                active={activeTab === cat}
                onClick={() => handleTabClick(cat)}
                count={(data?.grouped_by_domain[cat] || []).length}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Snap scroll list ── */}
      {allExpeditions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-6 bg-white dark:bg-zinc-950">
          <BookOpen className="w-8 h-8 text-gray-200 dark:text-zinc-700" />
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-zinc-400 mb-1">No expeditions yet</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Search a Wikipedia topic on the home page</p>
          </div>
          <Link to="/create" className="text-xs border border-yggen-teal text-yggen-teal px-5 py-2 hover:bg-yggen-teal hover:text-white transition-all tracking-widest uppercase">
            Start Exploring
          </Link>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 pt-3 pb-24"
          style={{ scrollSnapType: 'y mandatory', scrollBehavior: 'smooth' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-0"
            >
              {visibleExpeditions.map((exp, i) => (
                <ExpeditionTile 
                  key={exp.expedition_id} 
                  exp={exp} 
                  index={i} 
                  onDelete={(id) => setDialogConfig({ isOpen: true, type: 'delete', targetId: id })}
                  onArchive={(id) => setDialogConfig({ isOpen: true, type: 'archive', targetId: id })}
                />
              ))}
              {visibleExpeditions.length === 0 && (
                <div className="py-20 text-center text-gray-400 dark:text-zinc-600 border border-dashed border-gray-200 dark:border-zinc-800">
                  No expeditions found in this category.
                </div>
              )}
              <div style={{ scrollSnapAlign: 'start', height: '80px' }} />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.type === 'delete' ? 'Delete Expedition' : 'Archive Expedition'}
        message={
          dialogConfig.type === 'delete' 
            ? 'Are you sure you want to permanently delete this expedition? All your progress and nodes will be destroyed. This action cannot be undone.'
            : 'Are you sure you want to archive this expedition? It will be marked as inactive.'
        }
        confirmText={dialogConfig.type === 'delete' ? 'Delete' : 'Archive'}
        cancelText="Cancel"
        isDestructive={dialogConfig.type === 'delete'}
        onConfirm={confirmAction}
        onCancel={() => setDialogConfig({ isOpen: false, type: null, targetId: null })}
      />
    </div>
  );
};

export default Library;
