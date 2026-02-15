import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface XPDisplayProps {
  // Optional: trigger refresh from parent
  refreshTrigger?: number; 
}

const XPDisplay: React.FC<XPDisplayProps> = ({ refreshTrigger }) => {
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(0);

  useEffect(() => {
    const fetchXP = async () => {
      try {
        const stats = await api.user.getStats();
        setXp(stats.total_xp);
        setLevel(stats.level);
      } catch (err) {
        console.error("Failed to fetch XP", err);
      }
    };
    fetchXP();
  }, [refreshTrigger]);

  return (
    <div className="fixed top-8 right-8 z-50 flex items-center gap-4 font-mono text-sm mix-blend-difference">
       <div className="flex flex-col items-end">
        <span className="text-gray-400 text-xs tracking-widest uppercase mb-1">Level {level}</span>
        <div className="h-1 w-24 bg-gray-800 rounded-full overflow-hidden">
             {/* Simple progress bar mock based on XP % 100 */}
            <div 
                className="h-full bg-yggen-teal" 
                style={{ width: `${xp % 100}%` }} 
            />
        </div>
      </div>
      
      <div className="flex flex-col items-end">
        <span className="text-gray-400 text-xs tracking-widest uppercase mb-1">Current XP</span>
        <span className="text-yggen-teal font-bold text-xl tracking-tighter glow-text">
          {xp.toLocaleString()}
        </span>
      </div>
      
      <div className="w-10 h-10 border border-gray-800 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-2 h-2 bg-yggen-teal rounded-full animate-pulse glow-box" />
      </div>
    </div>
  );
};

export default XPDisplay;
