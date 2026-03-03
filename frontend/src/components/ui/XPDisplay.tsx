import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface XPDisplayProps {
  refreshTrigger?: number;
}

const XPDisplay: React.FC<XPDisplayProps> = ({ refreshTrigger }) => {
  const { user } = useAuth();
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!user?.user_id) return;
    const fetchXP = async () => {
      try {
        const stats = await api.user.getStats(user.user_id);
        setXp(stats.total_xp);
        setLevel(stats.level);
      } catch {
        // Non-critical — keep showing 0
      }
    };
    fetchXP();
  }, [user?.user_id, refreshTrigger]);

  return (
    <div className="fixed top-8 right-8 z-50 flex items-center gap-4 font-mono text-sm">
      <div className="flex flex-col items-end">
        <span className="text-gray-400 text-xs tracking-widest uppercase mb-1">Level {level}</span>
        <div className="h-1 w-24 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-yggen-teal transition-all duration-500"
            style={{ width: `${xp % 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col items-end">
        <span className="text-gray-400 text-xs tracking-widest uppercase mb-1">XP</span>
        <span className="text-black font-bold text-xl tracking-tighter">
          {xp.toLocaleString()}
        </span>
      </div>

      <div className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center">
        <div className="w-1.5 h-1.5 bg-yggen-teal rounded-full animate-pulse" />
      </div>
    </div>
  );
};

export default XPDisplay;
