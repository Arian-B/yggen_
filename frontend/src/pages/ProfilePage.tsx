import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Map, Zap, Star, ArrowRight, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

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
  Physics:    'bg-blue-50 text-blue-700 border-blue-200',
  History:    'bg-amber-50 text-amber-700 border-amber-200',
  Biology:    'bg-green-50 text-green-700 border-green-200',
  Chemistry:  'bg-purple-50 text-purple-700 border-purple-200',
  Technology: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Philosophy: 'bg-rose-50 text-rose-700 border-rose-200',
  Geography:  'bg-orange-50 text-orange-700 border-orange-200',
  General:    'bg-gray-50 text-gray-600 border-gray-200',
};

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_expeditions: 0, total_nodes_visited: 0, total_xp: 0 });
  const [grouped, setGrouped] = useState<DomainStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.user_id) return;
    const load = async () => {
      try {
        const data = await api.user.getExpeditions(user.user_id);
        setStats({
          total_expeditions: data.total_expeditions || 0,
          total_nodes_visited: data.total_nodes_visited || 0,
          total_xp: data.total_xp || 0,
        });
        setGrouped(data.grouped_by_domain || {});
      } catch { /* non-critical */ }
      finally { setLoading(false); }
    };
    load();
  }, [user?.user_id]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const avatarLetter = (user?.display_name || user?.email || 'U')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-2xl mx-auto px-6 pt-16 pb-24">

        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div className="flex items-center gap-4">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.display_name || 'User'}
                className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center text-2xl font-bold">
                {avatarLetter}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tighter">
                {user?.display_name || 'Explorer'}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors">
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
              className="border border-gray-100 p-5 text-center">
              <Icon className="w-4 h-4 text-yggen-teal mx-auto mb-2" />
              <div className="text-2xl font-bold tracking-tighter">{value}</div>
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Knowledge Domains */}
        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-gray-400 mb-6">Knowledge Library</h2>

          {loading ? (
            <div className="text-xs text-yggen-teal animate-pulse tracking-widest uppercase">Loading expeditions...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="py-16 text-center border border-dashed border-gray-200">
              <Star className="w-6 h-6 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No expeditions yet.</p>
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
                      <span className="text-xs text-gray-400">{expeditions.length} expedition{expeditions.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-2">
                      {expeditions.map(exp => (
                        <motion.button
                          key={exp.expedition_id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          onClick={() => navigate(`/map/${exp.expedition_id}`)}
                          className="w-full flex items-center justify-between px-4 py-3 border border-gray-100 hover:border-black transition-all text-left group"
                        >
                          <div>
                            <div className="text-sm font-medium">{exp.root_topic}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {exp.nodes_visited} articles · {exp.xp_earned} XP · {new Date(exp.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-[9px] px-1.5 py-0.5 uppercase tracking-widest border ${
                              exp.state === 'completed'
                                ? 'border-green-200 text-green-600 bg-green-50'
                                : 'border-gray-200 text-gray-500 bg-gray-50'
                            }`}>
                              {exp.state === 'completed' ? 'Done' : 'Active'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-black transition-colors" />
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
