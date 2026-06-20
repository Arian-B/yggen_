import { Home, Map, Library, PlusCircle, LogOut, User, Settings } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import { api } from '../../services/api';

const staticNavItems = [
  { icon: Home,       label: 'Home',     path: '/' },
  { icon: PlusCircle, label: 'Explore',  path: '/create' },
  { icon: Library,    label: 'Library',  path: '/library' },
  { icon: Settings,   label: 'Settings', path: '/settings' },
];

const VerticalNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [mapPath, setMapPath] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Inactivity tracking for auto-hide
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const handleMouseMove = (e: MouseEvent) => {
      // If mouse is near the left edge, show navbar
      if (e.clientX < 24) {
        setIsVisible(true);
      }

      // If visible, restart the 3-second inactivity timer
      if (isVisible) {
        clearTimeout(timer);
        // Do not hide if the mouse is currently hovering over the sidebar area (clientX < 80)
        if (e.clientX >= 80) {
          timer = setTimeout(() => {
            setIsVisible(false);
          }, 3000);
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    // Initial hide timer
    timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timer);
    };
  }, [isVisible]);

  // Click outside to hide sidebar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isVisible) {
        if (e.clientX >= 64) {
          setIsVisible(false);
        }
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isVisible]);

  useEffect(() => {
    if (!user?.user_id) return;
    const fetchXP = async () => {
      try {
        const stats = await api.user.getStats(user.user_id);
        setXp(stats.total_xp);
        setLevel(stats.level);
      } catch {
        // fail silent
      }
    };
    fetchXP();

    const interval = setInterval(fetchXP, 10000);
    return () => clearInterval(interval);
  }, [user?.user_id, location.pathname]);

  useEffect(() => {
    const mapMatch = location.pathname.match(/^\/map\/(.+)$/);
    if (mapMatch) { setMapPath(location.pathname); return; }

    const learnMatch = location.pathname.match(/^\/learn\/(.+)$/);
    if (learnMatch) {
      const ctx = localStorage.getItem('wikiyggen_current_expedition');
      if (ctx) {
        try {
          const { expedition_id } = JSON.parse(ctx);
          if (expedition_id) { setMapPath(`/map/${expedition_id}`); return; }
        } catch { /* ignore */ }
      }
      setMapPath(null);
      return;
    }

    setMapPath(null);
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isMapActive = location.pathname.startsWith('/map/');

  return (
    <>
      <nav 
        style={{ transform: isVisible ? 'translateX(0)' : 'translateX(-61px)' }}
        className="fixed left-0 top-0 h-full w-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-r border-gray-100 dark:border-zinc-800 z-50 flex flex-col items-center py-6 transition-transform duration-300 ease-in-out"
      >
        {/* Right Edge Status Line */}
        <div 
          className={`absolute right-0 top-0 h-full w-[3px] transition-all duration-300 z-50
            ${!isVisible 
              ? 'bg-yggen-teal shadow-[0_0_12px_#00ADB5]' 
              : 'bg-zinc-300 dark:bg-zinc-700'}`} 
        />
      {/* Logo */}
      <Link to="/" className="mb-6">
        <div className="w-7 h-7 border border-black dark:border-zinc-400 rotate-45 flex items-center justify-center hover:border-yggen-teal transition-colors">
          <div className="w-1.5 h-1.5 bg-yggen-teal rounded-full" />
        </div>
      </Link>

      {/* Circular Level Progress Badge */}
      {user && (
        <div className="relative w-10 h-10 flex items-center justify-center mb-8 cursor-pointer group select-none">
          <svg className="w-10 h-10 -rotate-90">
            {/* Background track */}
            <circle
              cx="20"
              cy="20"
              r="15"
              className="stroke-gray-100 dark:stroke-zinc-800 fill-transparent"
              strokeWidth="2.5"
            />
            {/* Progress indicator */}
            <circle
              cx="20"
              cy="20"
              r="15"
              className="stroke-yggen-teal fill-transparent transition-all duration-500"
              strokeWidth="2.5"
              strokeDasharray="94.25"
              strokeDashoffset={94.25 - (94.25 * (xp % 100)) / 100}
            />
          </svg>
          {/* Level text */}
          <span className="absolute text-[10px] font-mono font-black text-black dark:text-white">
            {level}
          </span>
          
          {/* Tooltip Popup */}
          <div className="left-16 absolute top-1/2 -translate-y-1/2 bg-black dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-white p-3 rounded shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-95 group-hover:scale-100 z-50 whitespace-nowrap min-w-[160px] font-mono text-left">
            <div className="text-[9px] text-yggen-teal uppercase tracking-widest font-bold mb-1">Explorer Status</div>
            <div className="text-xs font-bold mb-1 text-white">Level {level}</div>
            <div className="text-[10px] text-zinc-400 mb-2">Total XP: {xp.toLocaleString()} XP</div>
            
            {/* Progress bar inside tooltip */}
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yggen-teal transition-all duration-300"
                style={{ width: `${xp % 100}%` }}
              />
            </div>
            <div className="text-[8px] text-zinc-500 mt-1 text-right">{xp % 100} / 100 XP to level {level + 1}</div>
          </div>
        </div>
      )}

      {/* Static Nav Items */}
      <div className="flex-1 flex flex-col gap-5 items-center">
        {staticNavItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={label}
              to={path}
              title={label}
              className={`flex flex-col items-center gap-1 group transition-colors
                ${isActive
                  ? 'text-black dark:text-white'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'}`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[8px] tracking-widest uppercase">{label}</span>
            </Link>
          );
        })}

        {/* Map — context-aware */}
        {mapPath ? (
          <Link
            to={mapPath}
            title="Galaxy Map"
            className={`flex flex-col items-center gap-1 transition-colors
              ${isMapActive
                ? 'text-black dark:text-white'
                : 'text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'}`}
          >
            <Map className="w-4 h-4" strokeWidth={isMapActive ? 2.5 : 1.5} />
            <span className="text-[8px] tracking-widest uppercase">Map</span>
          </Link>
        ) : (
          <div
            title="Map — open an expedition first"
            className="flex flex-col items-center gap-1 text-gray-400 dark:text-zinc-600 opacity-60 cursor-not-allowed select-none"
          >
            <Map className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-[8px] tracking-widest uppercase">Map</span>
          </div>
        )}
      </div>

      {/* User avatar + logout */}
      <div className="flex flex-col items-center gap-3 mt-auto">
        {user?.avatar_url ? (
          <Link to="/profile">
            <img
              src={user.avatar_url}
              alt={user.display_name || 'User'}
              title={user.display_name || user.email}
              className="w-7 h-7 rounded-full object-cover hover:ring-2 hover:ring-yggen-teal transition-all"
            />
          </Link>
        ) : (
          <Link
            to="/profile"
            title={user?.display_name || user?.email || 'Profile'}
            className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <User className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-400" />
          </Link>
        )}
        <button
          onClick={handleLogout}
          title="Sign out"
          className="text-gray-500 dark:text-zinc-400 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
      </nav>
    </>
  );
};

export default VerticalNavbar;
