import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Map, Zap, Star, ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, type UserExpertiseProfile } from '../services/api';

interface DomainStats {
  [domain: string]: Array<{
    expedition_id: string;
    root_topic: string;
    nodes_visited: number;
    xp_earned: number;
    state: string;
    created_at: string;
  }>;
}

const DOMAIN_COLORS: Record<string, string> = {
  Physics:    'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50',
  History:    'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/50',
  Biology:    'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/50',
  Chemistry:  'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/50',
  Technology: 'bg-cyan-50 dark:bg-cyan-950/20 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900/50',
  Philosophy: 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50',
  Geography:  'bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900/50',
  General:    'bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-800',
};

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_expeditions: 0, total_nodes_visited: 0, total_xp: 0 });
  const [grouped, setGrouped] = useState<DomainStats>({});
  const [expertise, setExpertise] = useState<UserExpertiseProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.user_id) return;
    const load = async () => {
      try {
        const [data, expData] = await Promise.all([
          api.user.getExpeditions(user.user_id),
          api.user.getExpertise(user.user_id)
        ]);
        setStats({
          total_expeditions: data.total_expeditions || 0,
          total_nodes_visited: data.total_nodes_visited || 0,
          total_xp: data.total_xp || 0,
        });
        setGrouped(data.grouped_by_domain || {});
        setExpertise(expData);
      } catch (err) {
        console.error("Error loading profile details:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.user_id]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const avatarLetter = (user?.display_name || user?.email || 'U')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 transition-colors duration-200">
      <div className="max-w-2xl mx-auto px-6 pt-16 pb-24">

        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div className="flex items-center gap-4">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name || 'User'}
                className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-black dark:bg-zinc-800 text-white dark:text-zinc-200 flex items-center justify-center text-2xl font-bold">
                {avatarLetter}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tighter text-black dark:text-white">
                {user?.display_name || 'Explorer'}
              </h1>
              <p className="text-xs text-gray-400 dark:text-zinc-550 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500 hover:text-red-400 dark:hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { icon: Map, label: 'Expeditions', value: stats.total_expeditions },
            { icon: BookOpen, label: 'Articles Read', value: stats.total_nodes_visited },
            { icon: Zap, label: 'Total XP', value: stats.total_xp.toLocaleString() },
          ].map(({ icon: Icon, label, value }) => (
            <motion.div key={label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="border border-gray-100 dark:border-zinc-800 p-5 text-center bg-white dark:bg-zinc-900/10">
              <Icon className="w-4 h-4 text-yggen-teal mx-auto mb-2" />
              <div className="text-2xl font-bold tracking-tighter text-black dark:text-white">{value}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-zinc-550 mt-1">{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Expertise Profile Card */}
        {expertise && Object.keys(expertise.domains).length > 0 && (
          <div className="border border-zinc-100 dark:border-zinc-800 p-6 mb-12 bg-white dark:bg-zinc-900/10 rounded">
            <h2 className="text-xs uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4 flex items-center justify-between">
              <span>Domain Expertise Profile</span>
              <span className="text-yggen-teal font-mono text-[10px]">Breadth: {expertise.breadth}</span>
            </h2>
            <div className="space-y-6">
              {Object.values(expertise.domains).map(dom => {
                const maxDepth = 500; // Reference value for 100% progress
                const percentage = Math.min((dom.depth / maxDepth) * 100, 100);
                
                return (
                  <div key={dom.domain} className="space-y-2">
                    <div className="flex justify-between items-end text-xs">
                      <div>
                        <span className="font-bold text-black dark:text-white mr-2">{dom.domain}</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          ({dom.articles_completed} articles · Avg Diff: {dom.average_difficulty})
                        </span>
                      </div>
                      <div className="text-right font-mono text-yggen-teal font-bold">
                        Depth: {dom.depth}
                      </div>
                    </div>
                    {/* Progress Bar wrapper */}
                    <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden relative">
                      <motion.div
                        className="h-full bg-yggen-teal"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Knowledge Domains */}
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-gray-400 dark:text-zinc-550 mb-6">Knowledge Library</h2>

          {loading ? (
            <div className="text-xs text-yggen-teal animate-pulse tracking-widest uppercase">Loading expeditions...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="py-16 text-center border border-dashed border-gray-200 dark:border-zinc-800">
              <Star className="w-6 h-6 text-gray-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-gray-400 dark:text-zinc-500">No expeditions yet.</p>
              <button onClick={() => navigate('/')}
                className="mt-4 text-xs text-yggen-teal hover:underline underline-offset-2">
                Start your first expedition →
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(grouped).map(([domain, expeditions]) => {
                const colorClass = DOMAIN_COLORS[domain] || DOMAIN_COLORS.General;
                return (
                  <div key={domain}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`text-[10px] px-2 py-0.5 border font-medium tracking-widest uppercase ${colorClass}`}>
                        {domain}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-zinc-500">{expeditions.length} expedition{expeditions.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-2">
                      {expeditions.map(exp => (
                        <motion.button
                          key={exp.expedition_id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          onClick={() => navigate(`/map/${exp.expedition_id}`)}
                          className="w-full flex items-center justify-between px-4 py-3 border border-gray-100 dark:border-zinc-800 hover:border-black dark:hover:border-white transition-all text-left group bg-white dark:bg-zinc-900/10"
                        >
                          <div>
                            <div className="text-sm font-medium text-black dark:text-zinc-150 group-hover:text-yggen-teal transition-colors">{exp.root_topic}</div>
                            <div className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                              {exp.nodes_visited} articles · {exp.xp_earned} XP · {new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[9px] px-1.5 py-0.5 uppercase tracking-widest border ${
                              exp.state === 'completed'
                                ? 'border-green-200 dark:border-green-900/50 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20'
                                : 'border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-900/50'
                            }`}>
                              {exp.state === 'completed' ? 'Done' : 'Active'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-zinc-600 group-hover:text-black dark:group-hover:text-white transition-colors" />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
